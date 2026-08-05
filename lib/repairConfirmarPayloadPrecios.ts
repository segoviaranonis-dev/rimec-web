import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCarritoStockByDetIds } from '@/lib/carritoStockEnrich'
import { precioNetoCascada } from '@/lib/carritoDescuentosFi'
import { normalizarFilaStockVenta, paresDisponiblesDeFila } from '@/lib/disponibilidad'
import { getPrecioActivo, getPrecioActivoPe, type ListaPrecioId } from '@/lib/precioLista'
import { isProntaEntregaStockRow, paresCarritoDesdeCajas } from '@/lib/prontaEntregaVenta'

/**
 * Hotfix: payload con precio_base/neto 0 pero snapshot/BD con precio → repara antes del RPC.
 * Evita "Precio cambió … payload 0, BD N".
 */
export async function repairConfirmarPayloadPrecios(
  sb: SupabaseClient,
  idUsuario: number,
  payload: unknown,
): Promise<unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const p = payload as { lotes?: unknown[]; total_neto?: number }
  if (!Array.isArray(p.lotes)) return payload

  const { data: items } = await sb
    .from('carrito_item')
    .select('det_id, precio_snapshot, caso_snapshot')
    .eq('id_usuario', idUsuario)

  const snapByDet = new Map<number, { precio: number; caso: string }>()
  for (const row of items ?? []) {
    snapByDet.set(Number(row.det_id), {
      precio: Number(row.precio_snapshot) || 0,
      caso: String(row.caso_snapshot ?? ''),
    })
  }

  const detIds: number[] = []
  for (const lote of p.lotes) {
    if (!lote || typeof lote !== 'object') continue
    const facturas = (lote as { facturas?: unknown[] }).facturas
    if (!Array.isArray(facturas)) continue
    for (const f of facturas) {
      if (!f || typeof f !== 'object') continue
      const itemsF = (f as { items?: unknown[] }).items
      if (!Array.isArray(itemsF)) continue
      for (const it of itemsF) {
        if (!it || typeof it !== 'object') continue
        const detId = Number((it as { det_id?: number }).det_id)
        if (Number.isFinite(detId)) detIds.push(detId)
      }
    }
  }

  const stockMap = await fetchCarritoStockByDetIds(sb, [...new Set(detIds)])

  let totalNeto = 0
  const lotes = p.lotes.map((rawLote) => {
    if (!rawLote || typeof rawLote !== 'object') return rawLote
    const lote = rawLote as Record<string, unknown>
    const facturas = Array.isArray(lote.facturas) ? lote.facturas : []
    let loteMonto = 0

    const facturasOut = facturas.map((rawF) => {
      if (!rawF || typeof rawF !== 'object') return rawF
      const f = rawF as Record<string, unknown>
      const listaId = (Number(f.lista_precio_id) || 1) as ListaPrecioId
      const d1 = Number(f.descuento_1) || 0
      const d2 = Number(f.descuento_2) || 0
      const d3 = Number(f.descuento_3) || 0
      const d4 = Number(f.descuento_4) || 0
      const itemsF = Array.isArray(f.items) ? f.items : []
      let facturaMonto = 0

      const itemsOut = itemsF.map((rawIt) => {
        if (!rawIt || typeof rawIt !== 'object') return rawIt
        const it = rawIt as Record<string, unknown>
        const detId = Number(it.det_id)
        const cajas = Math.max(0, Number(it.cajas) || 0)
        let pares = Number(it.pares) || 0

        const snap = snapByDet.get(detId)
        const stock = stockMap.get(detId)
        if (stock && cajas > 0) {
          const fila = normalizarFilaStockVenta(stock as unknown as Parameters<typeof normalizarFilaStockVenta>[0])
          const maxPares = paresDisponiblesDeFila(fila)
          const paresCalc = paresCarritoDesdeCajas(cajas, {
            cant_caja: fila.pares_por_caja,
            saldo_pares: fila.saldo_pares,
            grades_json: fila.grades_json,
            grada: fila.grada,
            origen_tipo: fila.origen_tipo,
            det_id: detId,
            pp_id: fila.pp_id,
          })
          pares = Math.min(pares, paresCalc, maxPares > 0 ? maxPares : paresCalc)
        }
        const caso = String(stock?.descp_caso ?? snap?.caso ?? '')
        let precioBase = Number(it.precio_base) || 0
        const precioRow = {
          lpn: Number(stock?.lpn) || null,
          lpc02: Number(stock?.lpc02) || null,
          lpc03: Number(stock?.lpc03) || null,
          lpc04: Number(stock?.lpc04) || null,
          descp_caso: caso,
        }
        const esPe =
          isProntaEntregaStockRow({
            det_id: detId,
            origen_tipo: stock?.origen_tipo as string | null | undefined,
            pp_id: stock?.pp_id as number | null | undefined,
          }) || Number(lote.pp_id) < 0
        const fromLista = esPe
          ? getPrecioActivoPe(precioRow, listaId, caso)
          : getPrecioActivo(precioRow, listaId, caso)
        const precioBd = fromLista != null && fromLista > 0 ? fromLista : null

        if (precioBd != null && precioBd > 0) {
          precioBase = precioBd
        } else if (precioBase <= 0) {
          precioBase = snap && snap.precio > 0 ? snap.precio : 0
        }

        const precioNeto = precioNetoCascada(precioBase, [d1, d2, d3, d4])
        const subtotal = precioNeto * pares
        facturaMonto += subtotal
        return {
          ...it,
          precio_base: precioBase,
          precio_neto: precioNeto,
          subtotal,
        }
      })

      loteMonto += facturaMonto
      return { ...f, items: itemsOut, total_monto: facturaMonto }
    })

    totalNeto += loteMonto
    return { ...lote, facturas: facturasOut, total_monto: loteMonto }
  })

  return { ...p, lotes, total_neto: totalNeto }
}
