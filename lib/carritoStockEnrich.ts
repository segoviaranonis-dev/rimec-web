import type { SupabaseClient } from '@supabase/supabase-js'
import { PE_DET_ID_BASE } from '@/lib/prontaEntregaVenta'
import { normalizarFilaStockVenta } from '@/lib/disponibilidad'

export const CARRITO_STOCK_SELECT =
  'det_id, lpn, lpc02, lpc03, lpc04, cajas_disponibles, saldo_pares, cantidad_cajas, cantidad_pares, grades_json, linea_codigo, referencia_codigo, material_code, color_code, descp_color, pp_nro, proforma, quincena_desc, nombre, imagen_url, pares_por_caja, descp_caso, origen_tipo, pp_id'

export type CarritoStockEnriched = Record<string, unknown> & { det_id: number }

/** Expande ids PE legacy (<800M) y sintéticos para lookup en vistas. */
function expandPeDetIds(detIds: number[]): number[] {
  const out = new Set<number>()
  for (const id of detIds) {
    out.add(id)
    if (id > 0 && id < PE_DET_ID_BASE) out.add(id + PE_DET_ID_BASE)
    if (id >= PE_DET_ID_BASE) out.add(id - PE_DET_ID_BASE)
  }
  return [...out]
}

export async function fetchCarritoStockByDetIds(
  sb: SupabaseClient,
  detIds: number[],
): Promise<Map<number, CarritoStockEnriched>> {
  const map = new Map<number, CarritoStockEnriched>()
  if (!detIds.length) return map

  const expanded = expandPeDetIds(detIds)

  const [cpRes, peRes] = await Promise.all([
    sb.from('v_stock_rimec').select(CARRITO_STOCK_SELECT).in('det_id', expanded),
    sb.from('v_stock_pe_rimec').select(CARRITO_STOCK_SELECT).in('det_id', expanded),
  ])

  const aliasKeys = new Set(detIds)

  function storeRow(row: CarritoStockEnriched) {
    const detId = Number(row.det_id)
    const normalized = normalizarFilaStockVenta(row as unknown as Parameters<typeof normalizarFilaStockVenta>[0])
    map.set(detId, normalized as unknown as CarritoStockEnriched)
    if (detId >= PE_DET_ID_BASE && aliasKeys.has(detId - PE_DET_ID_BASE)) {
      map.set(detId - PE_DET_ID_BASE, { ...normalized, det_id: detId - PE_DET_ID_BASE } as unknown as CarritoStockEnriched)
    }
    if (detId > 0 && detId < PE_DET_ID_BASE && aliasKeys.has(detId + PE_DET_ID_BASE)) {
      map.set(detId, normalized as unknown as CarritoStockEnriched)
    }
  }

  for (const row of cpRes.data ?? []) {
    storeRow(row as CarritoStockEnriched)
  }
  for (const row of peRes.data ?? []) {
    storeRow(row as CarritoStockEnriched)
  }
  return map
}
