import { parseDescuentoInput } from '@/lib/descuentoInput'
import { fetchCarritoStockByDetIds } from '@/lib/carritoStockEnrich'
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

  const { data: sesion, error: sesionErr } = await sb
    .from('carrito_sesion')
    .select('descuentos_lote, lista_precio_id')
    .eq('id_usuario', idUsuario)
    .single()

  if (sesionErr || !sesion) {
    throw new Error('Sesión de carrito no encontrada')
  }

  const descuentosLote = sesion.descuentos_lote as { facturas: Array<Record<string, unknown>> }
  if (!descuentosLote?.facturas?.length) {
    throw new Error('Sin facturas internas en sesión')
  }

  const idx = descuentosLote.facturas.findIndex(
    (f) =>
      Number(f.pp_id) === input.pp_id &&
      String(f.marca) === input.marca &&
      String(f.caso) === input.caso,
  )
  if (idx === -1) {
    throw new Error('Factura interna no encontrada en sesión')
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
  }

  const { data: items, error: itemsErr } = await sb
    .from('carrito_item')
    .select('det_id, pp_id, marca_snapshot, caso_snapshot')
    .eq('id_usuario', idUsuario)
    .eq('pp_id', input.pp_id)
    .eq('marca_snapshot', input.marca)
    .eq('caso_snapshot', input.caso)

  if (itemsErr) throw new Error(itemsErr.message)
  if (!items?.length) throw new Error('Sin ítems en esta factura interna')

  const detIds = items.map((i) => Number(i.det_id))
  const stockMap = await fetchCarritoStockByDetIds(sb, detIds)

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
