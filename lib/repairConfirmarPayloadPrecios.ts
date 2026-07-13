import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCarritoStockByDetIds } from '@/lib/carritoStockEnrich'
import { getPrecioActivo, getPrecioActivoPe, type ListaPrecioId } from '@/lib/precioLista'
import { isProntaEntregaStockRow } from '@/lib/prontaEntregaVenta'

function calcNeto(precioBase: number, d1: number, d2: number, d3: number, d4: number): number {
  let p = precioBase
  for (const d of [d1, d2, d3, d4]) p = p * (1 - (Number(d) || 0) / 100)
  return Math.floor(p / 100) * 100
}

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
        const pares = Number(it.pares) || 0
        let precioBase = Number(it.precio_base) || 0

        if (precioBase <= 0) {
          const snap = snapByDet.get(detId)
          const stock = stockMap.get(detId)
          const caso = String(snap?.caso ?? stock?.descp_caso ?? '')
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
          precioBase =
            (fromLista != null && fromLista > 0 ? fromLista : null) ??
            (snap && snap.precio > 0 ? snap.precio : 0) ??
            0
        }

        const precioNeto = calcNeto(precioBase, d1, d2, d3, d4)
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
