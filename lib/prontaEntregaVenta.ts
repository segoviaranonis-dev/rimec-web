/**
 * Pronta entrega en catálogo / carrito.
 * Regla Director 2026-07-13: **misma unidad de venta que CP** (caja cerrada / grada).
 * Solo cambia el camino (origen PE vs tránsito CP), no la cantidad por click.
 */

import { sumGradaPares } from '@/lib/gradasFmt'

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
  pares_vendidos?: number | null
  grades_json?: Record<string, number> | null
  grada?: string | null
  origen_tipo?: string | null
  det_id?: number | null
  pp_id?: number | null
  ramo_tipo?: string | null
  tipo_v2_id?: number | null
}

/** Kyly 638 — grada abierta · venta por prenda (no caja cerrada). */
export function isGradaAbiertaConfecciones(input: {
  ramo_tipo?: string | null
  tipo_v2_id?: number | null
}): boolean {
  const ramo = String(input.ramo_tipo ?? '').trim().toUpperCase()
  if (ramo === 'CONFECCIONES') return true
  return Number(input.tipo_v2_id) === 2
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
  if (isGradaAbiertaConfecciones(input)) return 1

  if (!paresPorCajaVistaContaminada(input)) {
    const ppc = Number(input.pares_por_caja)
    if (Number.isFinite(ppc) && ppc > 0 && ppc <= 48) return Math.round(ppc)
  }

  const fromGrades = sumGradaPares(input)
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

/** Pares = cajas × pares/caja, topeado al saldo real (última caja abierta). */
export function paresDesdeCajasCerradas(cajas: number, input: ParesPorCajaInput): number {
  if (isGradaAbiertaConfecciones(input)) {
    const n = Math.max(0, Math.floor(Number(cajas) || 0))
    if (n <= 0) return 0
    let saldo = Number(input.saldo_pares ?? NaN)
    if (!Number.isFinite(saldo) || saldo < 0) {
      const base = Number(input.cantidad_pares ?? 0)
      const vend = Number(input.pares_vendidos ?? 0)
      saldo = Math.max(0, base - vend)
    }
    return saldo > 0 ? Math.min(n, Math.floor(saldo)) : 0
  }

  const n = Math.max(0, Math.floor(Number(cajas) || 0))
  if (n <= 0) return 0
  const ppc = resolveParesPorCaja(input)
  const bruto = n * ppc
  let saldo = Number(input.saldo_pares ?? NaN)
  if (!Number.isFinite(saldo) || saldo < 0) {
    const base = Number(input.cantidad_pares ?? 0)
    const vend = Number(input.pares_vendidos ?? 0)
    saldo = Math.max(0, base - vend)
  }
  if (saldo > 0 && bruto > saldo) return Math.floor(saldo)
  return bruto
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

/** Input unificado para pares desde ítem de carrito (store / confirmar). */
export function paresInputDesdeCarrito(item: ParesPorCajaInput & {
  cant_caja?: number | null
  saldo_pares?: number | null
}): ParesPorCajaInput {
  return {
    pares_por_caja: item.cant_caja ?? item.pares_por_caja,
    cantidad_cajas: item.cantidad_cajas,
    cantidad_pares: item.cantidad_pares,
    saldo_pares: item.saldo_pares,
    pares_vendidos: item.pares_vendidos,
    grades_json: item.grades_json,
    grada: item.grada,
    origen_tipo: item.origen_tipo,
    det_id: item.det_id,
    pp_id: item.pp_id,
  }
}

/** Pares vendibles para N cajas — siempre topeado al saldo real (última caja abierta). */
export function paresCarritoDesdeCajas(
  cajas: number,
  item: ParesPorCajaInput & { cant_caja?: number | null; saldo_pares?: number | null },
): number {
  return paresDesdeCajasCerradas(cajas, paresInputDesdeCarrito(item))
}

/**
 * Etiqueta PE catálogo — solo origen (+ LIQ).
 * Prohibido repetir línea/referencia bajo el chip (Director 2026-07-20).
 * `linea`/`referencia` se ignoran (compat call sites existentes).
 */
export function etiquetaProntaEntregaCatalogo(
  _linea?: string | null,
  _referencia?: string | null,
  opts?: { liquidacion?: boolean },
): string {
  let out = 'Pronta entrega'
  if (opts?.liquidacion) out += ' · LIQ'
  return out
}
