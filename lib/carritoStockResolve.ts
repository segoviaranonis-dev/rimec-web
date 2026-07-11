import type { SupabaseClient } from '@supabase/supabase-js'
import { isProntaEntregaDetId, isProntaEntregaStockRow, PE_DET_ID_BASE } from '@/lib/prontaEntregaVenta'

export type CarritoStockView = 'v_stock_rimec' | 'v_stock_pe_rimec'

export interface CarritoStockRow {
  det_id: number
  cajas_disponibles: number | null
  origen_tipo?: string | null
}

/** Prioridad: origen explícito → id sintético ≥800M → fallback PE si no está en CP. */
export async function resolveCarritoStockRow(
  sb: SupabaseClient,
  detId: number,
  origenTipo?: string | null,
): Promise<{ view: CarritoStockView; row: CarritoStockRow; canonicalDetId: number } | null> {
  const preferPe = isProntaEntregaStockRow({ det_id: detId, origen_tipo: origenTipo })

  async function fromView(view: CarritoStockView, lookupId: number) {
    const { data, error } = await sb
      .from(view)
      .select('det_id, cajas_disponibles, origen_tipo')
      .eq('det_id', lookupId)
      .maybeSingle()
    if (error || !data) return null
    return {
      view,
      row: { ...data, det_id: detId } as CarritoStockRow,
      canonicalDetId: Number(data.det_id),
    }
  }

  const peCandidates = preferPe
    ? [detId, detId + PE_DET_ID_BASE, detId - PE_DET_ID_BASE].filter(
        (id, i, arr) => id > 0 && arr.indexOf(id) === i,
      )
    : [detId]

  if (preferPe) {
    for (const lookupId of peCandidates) {
      const pe = await fromView('v_stock_pe_rimec', lookupId)
      if (pe) return pe
    }
  }

  const cp = await fromView('v_stock_rimec', detId)
  if (cp) return cp

  if (!preferPe) {
    for (const lookupId of [detId, detId + PE_DET_ID_BASE]) {
      const pe = await fromView('v_stock_pe_rimec', lookupId)
      if (pe) return pe
    }
  }

  return null
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
