import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarFilaStockVenta, type StockRowMin } from '@/lib/disponibilidad'
import { isProntaEntregaStockRow, PE_DET_ID_BASE } from '@/lib/prontaEntregaVenta'

export type CarritoStockView = 'v_stock_rimec' | 'v_stock_pe_rimec'

export interface CarritoStockRow {
  det_id: number
  cajas_disponibles: number | null
  origen_tipo?: string | null
}

/** Solo columnas para validar stock — sin enrich PE ni mapa descuento. */
const VALIDATE_SELECT =
  'det_id, cajas_disponibles, saldo_pares, origen_tipo, pp_id, tipo_v2_id, ramo_tipo, grada, pares_por_caja, cantidad_cajas, cantidad_pares, pares_vendidos, grades_json'

function expandPeDetIds(detIds: number[]): number[] {
  const out = new Set<number>()
  for (const id of detIds) {
    out.add(id)
    if (id > 0 && id < PE_DET_ID_BASE) out.add(id + PE_DET_ID_BASE)
    if (id >= PE_DET_ID_BASE) out.add(id - PE_DET_ID_BASE)
  }
  return [...out]
}

function pickStockRow(
  detId: number,
  expanded: number[],
  preferPe: boolean,
  cpRows: StockRowMin[],
  peRows: StockRowMin[],
): StockRowMin | null {
  const lookupOrder = [detId, ...expanded.filter((id) => id !== detId)]

  function fromRows(rows: StockRowMin[]): StockRowMin | null {
    for (const lookupId of lookupOrder) {
      const hit = rows.find((r) => Number(r.det_id) === lookupId)
      if (hit) return hit
    }
    return null
  }

  if (preferPe) return fromRows(peRows) ?? fromRows(cpRows)
  return fromRows(cpRows) ?? fromRows(peRows)
}

/** Lookup rápido 1 SKU — 2 queries mínimas · sin pe_descuento ni PPD masivo. */
export async function resolveCarritoStockRow(
  sb: SupabaseClient,
  detId: number,
  origenTipo?: string | null,
  ppId?: number | null,
): Promise<{ view: CarritoStockView; row: CarritoStockRow; canonicalDetId: number } | null> {
  const preferPe = isProntaEntregaStockRow({
    det_id: detId,
    origen_tipo: origenTipo,
    pp_id: ppId,
  })
  const expanded = expandPeDetIds([detId])

  const [cpRes, peRes] = await Promise.all([
    sb.from('v_stock_rimec').select(VALIDATE_SELECT).in('det_id', expanded),
    sb.from('v_stock_pe_rimec').select(VALIDATE_SELECT).in('det_id', expanded),
  ])

  const raw = pickStockRow(
    detId,
    expanded,
    preferPe,
    (cpRes.data ?? []) as StockRowMin[],
    (peRes.data ?? []) as StockRowMin[],
  )
  if (!raw) return null

  const normalized = normalizarFilaStockVenta(raw)
  const origenEfectivo = normalized.origen_tipo ?? origenTipo
  const esPe = isProntaEntregaStockRow({
    det_id: detId,
    origen_tipo: origenEfectivo,
    pp_id: ppId ?? (raw.pp_id as number | null | undefined),
  })

  return {
    view: esPe ? 'v_stock_pe_rimec' : 'v_stock_rimec',
    row: {
      det_id: detId,
      cajas_disponibles: normalized.cajas_disponibles ?? 0,
      origen_tipo: origenEfectivo,
    },
    canonicalDetId: Number(normalized.det_id ?? detId),
  }
}

export function stockCantidadLabel(
  detId: number,
  qty: number,
  origenTipo?: string | null,
): string {
  const esPe = isProntaEntregaStockRow({ det_id: detId, origen_tipo: origenTipo })
  if (esPe) return qty === 1 ? '1 ud' : `${qty} uds`
  return qty === 1 ? '1 caja' : `${qty} cajas`
}
