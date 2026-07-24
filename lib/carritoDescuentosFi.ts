import { asegurarFacturasDescuentosLote } from '@/lib/asegurarFacturasDescuentosLote'
import { parseDescuentoInput } from '@/lib/descuentoInput'
import { fetchCarritoStockByDetIds } from '@/lib/carritoStockEnrich'
import { etiquetaCelulaFi } from '@/lib/facturaCelulaClave'
import { mismaFacturaConfig, sintetizarFacturaConfig } from '@/lib/facturaConfigMatch'
import { getPrecioActivo, getPrecioActivoPe, type ListaPrecioId } from '@/lib/precioLista'
import { isProntaEntregaStockRow } from '@/lib/prontaEntregaVenta'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Descuentos4 = [number, number, number, number]

export function normalizarDescuentos4(raw: unknown): Descuentos4 {
  const src = Array.isArray(raw) ? raw : []
  return [0, 1, 2, 3].map((i) => {
    const v = src[i]
    if (v == null || v === '') return 0
    if (typeof v === 'number') return Math.min(100, Math.max(0, v))
    return parseDescuentoInput(String(v))
  }) as Descuentos4
}

/** Cascada d1→d4 · floor centenas (paridad confirmar / fragmentarCarrito). */
export function precioNetoCascada(precioBase: number, descuentos: Descuentos4 | number[]): number {
  let precio = precioBase
  for (let i = 0; i < 4; i++) {
    const d = Number(descuentos[i]) || 0
    if (d > 0) precio = precio * (1 - d / 100)
  }
  return Math.floor(precio / 100) * 100
}

export function etiquetaDescuentos(desc: Descuentos4 | number[]): string {
  const activos = normalizarDescuentos4(desc).filter((d) => d > 0)
  return activos.length ? activos.map((d) => `${d}%`).join(' + ') : 'Sin descuento'
}

export interface GuardarDescuentosFiInput {
  pp_id: number
  marca: string
  caso: string
  lista_precio_id?: number
  descuentos: unknown
}

export interface GuardarDescuentosFiResult {
  ok: true
  factura: Record<string, unknown>
  descuentos_aplicados: Descuentos4
  lista_aplicada: number
  items_actualizados: number
  origen: 'CP' | 'PE' | 'MIXTO'
}

type ItemRow = {
  det_id: number
  pp_id: number
  marca_snapshot: string
  caso_snapshot: string
  caso_id_snapshot: number | null
}

function etiquetaItem(
  item: ItemRow,
  stock: Record<string, unknown> | undefined,
): string {
  const casoId =
    item.caso_id_snapshot != null && Number(item.caso_id_snapshot) > 0
      ? Number(item.caso_id_snapshot)
      : null
  return etiquetaCelulaFi({
    caso: String(item.caso_snapshot ?? stock?.descp_caso ?? ''),
    caso_id: casoId,
    es_promo: stock?.es_promo != null ? Boolean(stock.es_promo) : null,
    es_liquidacion: stock?.es_liquidacion != null ? Boolean(stock.es_liquidacion) : null,
    cadena_comercial: stock?.cadena_comercial != null ? String(stock.cadena_comercial) : null,
    cod_grupo: stock?.cod_grupo != null ? String(stock.cod_grupo) : null,
    linea_codigo: stock?.linea_codigo != null ? String(stock.linea_codigo) : null,
  })
}

/**
 * Transacción lógica única: fija descuentos FI en sesión + recalcula precio_snapshot
 * de cada ítem (camino CP v_stock_rimec · camino PE v_stock_pe_rimec / staging).
 */
export async function guardarDescuentosFacturaInterna(
  sb: SupabaseClient,
  idUsuario: number,
  input: GuardarDescuentosFiInput,
): Promise<GuardarDescuentosFiResult> {
  const descuentos = normalizarDescuentos4(input.descuentos)

  // Regenera facturas PE/CP si faltan (hotfix: botón descuento sin fila en sesión).
  await asegurarFacturasDescuentosLote(sb, idUsuario)

  const { data: sesion, error: sesionErr } = await sb
    .from('carrito_sesion')
    .select('descuentos_lote, lista_precio_id')
    .eq('id_usuario', idUsuario)
    .single()

  if (sesionErr || !sesion) {
    throw new Error('Sesión de carrito no encontrada')
  }

  const descuentosLote = (sesion.descuentos_lote as { facturas: Array<Record<string, unknown>> }) ?? {
    facturas: [],
  }
  if (!Array.isArray(descuentosLote.facturas)) descuentosLote.facturas = []

  let idx = descuentosLote.facturas.findIndex((f) =>
    mismaFacturaConfig(
      {
        pp_id: Number(f.pp_id),
        marca: String(f.marca),
        caso: String(f.caso),
        caso_id: f.caso_id != null ? Number(f.caso_id) : null,
      },
      input.pp_id,
      input.marca,
      input.caso,
      null,
    ),
  )

  if (idx === -1) {
    descuentosLote.facturas.push(
      sintetizarFacturaConfig({
        pp_id: input.pp_id,
        marca: input.marca,
        caso: input.caso,
        lista_precio_id: Number(input.lista_precio_id ?? sesion.lista_precio_id) || 1,
        descuentos,
        items_count: 0,
      }) as unknown as Record<string, unknown>,
    )
    idx = descuentosLote.facturas.length - 1
  }

  const prev = descuentosLote.facturas[idx]
  const listaId = (input.lista_precio_id ??
    Number(prev.lista_precio_id) ??
    Number(sesion.lista_precio_id) ??
    1) as ListaPrecioId

  descuentosLote.facturas[idx] = {
    ...prev,
    lista_precio_id: listaId,
    descuentos: [...descuentos],
    pre_autorizado: true,
    caso: input.caso,
  }

  const { data: itemsRaw, error: itemsErr } = await sb
    .from('carrito_item')
    .select('det_id, pp_id, marca_snapshot, caso_snapshot, caso_id_snapshot')
    .eq('id_usuario', idUsuario)
    .eq('marca_snapshot', input.marca)

  let itemsFiltered = itemsRaw ?? []
  if (input.pp_id) {
    const byPp = itemsFiltered.filter((i) => Number(i.pp_id) === Number(input.pp_id))
    if (byPp.length) itemsFiltered = byPp
  }

  if (itemsErr) throw new Error(itemsErr.message)
  if (!itemsFiltered.length) throw new Error('Sin ítems en esta factura interna')

  const stockMap = await fetchCarritoStockByDetIds(
    sb,
    itemsRaw.map((i) => Number(i.det_id)),
  )

  // R-FI-2: caso UI = etiquetaCelulaFi; caso_snapshot puede diferir.
  let items = (itemsFiltered as ItemRow[]).filter((item) => {
    const stock = stockMap.get(Number(item.det_id)) as Record<string, unknown> | undefined
    const etiqueta = etiquetaItem(item, stock)
    return etiqueta === input.caso || String(item.caso_snapshot) === input.caso
  })

  if (!items.length) {
    const etiquetas = new Set(
      (itemsRaw as ItemRow[]).map((item) => {
        const stock = stockMap.get(Number(item.det_id)) as Record<string, unknown> | undefined
        return etiquetaItem(item, stock)
      }),
    )
    // Una sola FI en ese PP×marca → aplicar a todos
    if (etiquetas.size <= 1) items = itemsFiltered as ItemRow[]
  }

  if (!items.length) throw new Error('Sin ítems en esta factura interna')

  let itemsActualizados = 0
  let origenCp = 0
  let origenPe = 0

  for (const item of items) {
    const detId = Number(item.det_id)
    const stock = stockMap.get(detId)
    if (!stock) continue

    const esPe = isProntaEntregaStockRow({
      det_id: detId,
      pp_id: Number(item.pp_id),
      origen_tipo: String(stock.origen_tipo ?? ''),
    })

    if (esPe) origenPe += 1
    else origenCp += 1

    const caso = String(item.caso_snapshot ?? stock.descp_caso ?? '')
    const row = {
      lpn: Number(stock.lpn) || null,
      lpc02: Number(stock.lpc02) || null,
      lpc03: Number(stock.lpc03) || null,
      lpc04: Number(stock.lpc04) || null,
      descp_caso: String(stock.descp_caso ?? caso),
    }

    const precioBase = esPe
      ? getPrecioActivoPe(row, listaId, caso)
      : getPrecioActivo(row, listaId, caso)

    if (precioBase == null || precioBase <= 0) continue

    const precioNeto = precioNetoCascada(precioBase, descuentos)

    const { error: updErr } = await sb
      .from('carrito_item')
      .update({
        precio_snapshot: precioNeto,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id_usuario', idUsuario)
      .eq('det_id', detId)

    if (updErr) throw new Error(updErr.message)
    itemsActualizados += 1
  }

  descuentosLote.facturas[idx] = {
    ...descuentosLote.facturas[idx],
    items_count: items.length,
  }

  const { error: sesUpdErr } = await sb
    .from('carrito_sesion')
    .update({
      descuentos_lote: descuentosLote,
      validada_en: null,
      validacion_token: null,
      validacion_estado: null,
      actualizada_en: new Date().toISOString(),
    })
    .eq('id_usuario', idUsuario)

  if (sesUpdErr) throw new Error(sesUpdErr.message)

  const origen: GuardarDescuentosFiResult['origen'] =
    origenPe > 0 && origenCp > 0 ? 'MIXTO' : origenPe > 0 ? 'PE' : 'CP'

  return {
    ok: true,
    factura: descuentosLote.facturas[idx],
    descuentos_aplicados: descuentos,
    lista_aplicada: listaId,
    items_actualizados: itemsActualizados,
    origen,
  }
}
