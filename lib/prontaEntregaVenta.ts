/**
 * Pronta entrega en catálogo / carrito — ids sintéticos MIG-134.
 * det_id = 800_000_000 + stock_pronta_entrega_rimec.id
 */

export const PE_DET_ID_BASE = 800_000_000

export function isProntaEntregaDetId(detId: number): boolean {
  return Number.isFinite(detId) && detId >= PE_DET_ID_BASE
}

/** PE en BD local: det_id crudo en v_stock_pe_rimec · sintético ≥800M · pp_id negativo. */
export function isProntaEntregaStockRow(input: {
  det_id?: number
  origen_tipo?: string | null
  pp_id?: number | null
}): boolean {
  const ot = String(input.origen_tipo ?? '').trim().toUpperCase()
  if (ot === 'PRONTA_ENTREGA' || ot === 'PRONTA ENTREGA') return true
  if (input.pp_id != null && Number(input.pp_id) < 0) return true
  return isProntaEntregaDetId(Number(input.det_id ?? 0))
}

export function peStockRowId(detId: number): number {
  return detId - PE_DET_ID_BASE
}

/** pp_id negativo estable por depósito + batch (agrupa carrito / factura PE). */
export function syntheticPpIdForPe(input: {
  deposito_id?: number | null
  proforma?: string | null
  pp_nro?: string | null
}): number {
  const dep = Math.abs(Number(input.deposito_id ?? 0)) % 100_000
  const batch = String(input.proforma || input.pp_nro || 'pe')
  let h = dep * 997 + 13
  for (let i = 0; i < batch.length; i++) {
    h = (Math.imul(31, h) + batch.charCodeAt(i)) | 0
  }
  const n = Math.abs(h) % 900_000_000
  return n === 0 ? -1 : -n
}

export function isSyntheticPePpId(ppId: number): boolean {
  return ppId < 0
}

export function unidadDisponibleLabel(origenTipo: string | undefined, cajas: number): string {
  return cajas === 1 ? '1 cj' : `${cajas} cjs`
}

/**
 * RIMEC vende cajas cerradas, no pares sueltos (Director, OT-NEXUS-FI-CAJAS-CERRADAS-RIMEC-001).
 * pares_por_caja real = suma de la curva de tallas de la grada, no la columna cruda de la vista
 * (para Pronta Entrega esa columna no trae dato de caja real — ver CHUSAR_STOCK_PRONTA_ENTREGA_RIMEC).
 */
export function sumGradesJson(gradesJson: Record<string, unknown> | null | undefined, fallback = 12): number {
  if (!gradesJson || typeof gradesJson !== 'object') return fallback
  const suma = Object.values(gradesJson).reduce((s: number, v) => s + (Number(v) || 0), 0)
  return suma > 0 ? suma : fallback
}

/** Mismo cálculo que sumGradesJson pero a partir del string ya formateado ("34(1-2-3-3-2-1)39"). */
export function paresPorCajaDesdeGradasFmt(gradasFmt: string | null | undefined, fallback = 12): number {
  if (!gradasFmt) return fallback
  const m = gradasFmt.match(/\(([^)]+)\)/)
  if (!m) return fallback
  const suma = m[1].split(/[-,\s]+/).reduce((s, part) => s + (Number(part) || 0), 0)
  return suma > 0 ? suma : fallback
}
