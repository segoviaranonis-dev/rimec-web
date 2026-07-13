/**
 * Pronta entrega en catálogo / carrito.
 * Regla Director 2026-07-13: **misma unidad de venta que CP** (caja cerrada / grada).
 * Solo cambia el camino (origen PE vs tránsito CP), no la cantidad por click.
 */

export const PE_DET_ID_BASE = 800_000_000

export function isProntaEntregaDetId(detId: number): boolean {
  return Number.isFinite(detId) && detId >= PE_DET_ID_BASE
}

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

/** Grada importadora estándar RIMEC calzado — OT-NEXUS-FI-CAJAS-CERRADAS-RIMEC-001. */
export const PARES_POR_CAJA_DEFAULT = 12

/** @deprecated PE usa misma regla CP desde 2026-07-13 — no forzar 1 par. */
export const PARES_POR_UNIDAD_PE = 1

export interface ParesPorCajaInput {
  pares_por_caja?: number | null
  cantidad_cajas?: number | null
  cantidad_pares?: number | null
  saldo_pares?: number | null
  grades_json?: Record<string, number> | null
  origen_tipo?: string | null
  det_id?: number | null
  pp_id?: number | null
}

function sumGradesJson(grades: Record<string, number> | null | undefined): number {
  if (!grades || typeof grades !== 'object') return 0
  return Object.values(grades).reduce((s, n) => s + (Number(n) || 0), 0)
}

/**
 * Vista MIG-144 contamina `pares_por_caja := saldo_pares` — no es grada real.
 */
export function paresPorCajaVistaContaminada(input: ParesPorCajaInput): boolean {
  const ppc = Number(input.pares_por_caja)
  const saldo = Number(input.saldo_pares ?? 0)
  if (!Number.isFinite(ppc) || ppc <= 0) return false
  if (!Number.isFinite(saldo) || saldo <= 0) return false
  return Math.round(ppc) === Math.round(saldo)
}

/**
 * Pares por caja cerrada (PE = CP):
 * grades_json → ratio cantidad_pares/cantidad_cajas → residual → default 12.
 */
export function resolveParesPorCaja(input: ParesPorCajaInput): number {
  if (!paresPorCajaVistaContaminada(input)) {
    const ppc = Number(input.pares_por_caja)
    if (Number.isFinite(ppc) && ppc > 0 && ppc <= 48) return Math.round(ppc)
  }

  const fromGrades = sumGradesJson(input.grades_json ?? null)
  if (fromGrades > 0) return Math.round(fromGrades)

  const cc = Number(input.cantidad_cajas ?? 0)
  const cp = Number(input.cantidad_pares ?? 0)
  if (cc > 0 && cp > 0) return Math.max(1, Math.round(cp / cc))

  const saldo = Number(input.saldo_pares ?? 0)
  if (Number.isFinite(saldo) && saldo > 0 && saldo < PARES_POR_CAJA_DEFAULT) {
    return Math.floor(saldo)
  }

  return PARES_POR_CAJA_DEFAULT
}

/** Pares = cajas × pares/caja (PE y CP). */
export function paresDesdeCajasCerradas(cajas: number, input: ParesPorCajaInput): number {
  const n = Math.max(0, Math.floor(Number(cajas) || 0))
  return n * resolveParesPorCaja(input)
}

/** @deprecated Usar cajasDisponiblesDeFila — saldo en pares, no unidades carrito. */
export function paresVendiblesPe(input: {
  cajas_disponibles?: number | null
  saldo_pares?: number | null
}): number {
  const saldo = Number(input.saldo_pares ?? input.cajas_disponibles ?? 0)
  return Number.isFinite(saldo) && saldo > 0 ? Math.floor(saldo) : 0
}

export function unidadDisponibleLabel(_origenTipo: string | undefined, cajas: number): string {
  return cajas === 1 ? '1 cj' : `${cajas} cjs`
}
