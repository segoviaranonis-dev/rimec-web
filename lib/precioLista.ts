/** Caso comercial PROMOCIONAL — LPN = LPC03 = LPC04 (Director · 2026-07-15). */
import { redondearCentenaGs } from '@/lib/redondeoCentenaGs'

export { redondearCentenaGs }

export const CASO_PROMOCIONAL_NOMBRE = 'PROMOCIONAL'

/** Ley general RIMEC Web (CP + PE · post-vincular / stock AM) — no toca motor. */
export const LEY_LPC03_FACTOR = 1.12
export const LEY_LPC04_FACTOR = 1.2

export function esCasoPromocional(descpCaso: string | null | undefined): boolean {
  return String(descpCaso ?? '').trim().toUpperCase() === CASO_PROMOCIONAL_NOMBRE
}

export type PrecioListaRow = {
  lpn: number | null
  lpc02: number | null
  lpc03: number | null
  lpc04: number | null
  precio_web?: number | null
  descp_caso?: string | null
}

export type ListaPrecioId = 1 | 2 | 3 | 4

function precioPositivo(v: number | null | undefined): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function precioComercial(v: number | null | undefined): number | null {
  const n = precioPositivo(v)
  if (n == null) return null
  const r = redondearCentenaGs(n)
  return r > 0 ? r : null
}

export function lpcDesdeLpn(lpn: number, factor: number): number {
  return redondearCentenaGs(Number(lpn) * factor)
}

/** LPC03: PROMO = LPN · resto = LPN×1.12 → centena próxima. */
export function resolverLpc03(
  lpn: number | null,
  _lpc03: number | null,
  descpCaso?: string | null,
): number | null {
  const base = precioPositivo(lpn)
  if (base == null) return null
  if (esCasoPromocional(descpCaso)) return redondearCentenaGs(base)
  return lpcDesdeLpn(base, LEY_LPC03_FACTOR)
}

/** LPC04: PROMO = LPN · resto = LPN×1.20 → centena próxima. */
export function resolverLpc04(
  lpn: number | null,
  _lpc04: number | null,
  descpCaso?: string | null,
): number | null {
  const base = precioPositivo(lpn)
  if (base == null) return null
  if (esCasoPromocional(descpCaso)) return redondearCentenaGs(base)
  return lpcDesdeLpn(base, LEY_LPC04_FACTOR)
}

/**
 * Precio de venta según lista de sesión.
 * Siempre aplica ley aritmética sobre LPN (CP y PE) + redondeo centena.
 */
export function getPrecioActivo(
  row: PrecioListaRow,
  listaId: ListaPrecioId | number,
  descpCaso?: string | null,
): number | null {
  const caso = descpCaso ?? row.descp_caso
  const tier = Number(listaId)

  switch (tier) {
    case 1:
      return precioComercial(precioPositivo(row.precio_web) ?? precioPositivo(row.lpn))
    case 2:
      return precioComercial(row.lpc02)
    case 3:
      return resolverLpc03(row.lpn, row.lpc03, caso)
    case 4:
      return resolverLpc04(row.lpn, row.lpc04, caso)
    default:
      return null
  }
}

/** PE: misma ley; si tier vacío → LPN centena. */
export function getPrecioActivoPe(
  row: PrecioListaRow,
  listaId: ListaPrecioId | number,
  descpCaso?: string | null,
): number | null {
  const tier = getPrecioActivo(row, listaId, descpCaso)
  if (tier != null && tier > 0) return tier
  const lpn = Number(row.lpn ?? 0)
  return lpn > 0 ? redondearCentenaGs(lpn) : null
}
