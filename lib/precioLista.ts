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

  /** FOB×índice sin redondear — ley Excel LPC tiers. */
  lpn_raw?: number | null

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



/**
 * Ley Excel tradicional — un solo redondeo sobre base bruta (FOB×índice).
 * LPC03 = ROUND(baseBruta×1.12, centena) · no centena(LPN)×1.12.
 */
export function lpcDesdeBaseBruta(baseBruta: number, factor: number): number {
  return redondearCentenaGs(Number(baseBruta) * factor)
}

/** Fallback legacy cuando solo hay LPN ya redondeado (sin base bruta). */
export function lpcDesdeLpn(lpn: number, factor: number): number {
  return redondearCentenaGs(Number(lpn) * factor)
}

function resolverLpcTier(
  lpn: number | null,
  lpcStored: number | null,
  descpCaso: string | null | undefined,
  factor: number,
  baseBruta?: number | null,
): number | null {
  const base = precioPositivo(lpn)
  if (base == null) return null
  if (esCasoPromocional(descpCaso)) return redondearCentenaGs(base)
  const stored = precioComercial(lpcStored)
  if (stored != null) return stored
  if (baseBruta != null && baseBruta > 0) return lpcDesdeBaseBruta(baseBruta, factor)
  return null
}

/** LPC03: PROMO = LPN · resto = ROUND(baseBruta×1.12) estilo Excel. */
export function resolverLpc03(
  lpn: number | null,
  lpc03: number | null,
  descpCaso?: string | null,
  baseBruta?: number | null,
): number | null {
  return resolverLpcTier(lpn, lpc03, descpCaso, LEY_LPC03_FACTOR, baseBruta)
}

/** LPC04: PROMO = LPN · resto = ROUND(baseBruta×1.20) estilo Excel. */
export function resolverLpc04(
  lpn: number | null,
  lpc04: number | null,
  descpCaso?: string | null,
  baseBruta?: number | null,
): number | null {
  return resolverLpcTier(lpn, lpc04, descpCaso, LEY_LPC04_FACTOR, baseBruta)
}



/**

 * Precio de venta según lista de sesión.

 * Ley Excel: LPN centena · LPC03/04 = centena(baseBruta×factor) · PROMO = LPN.

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

      return resolverLpc03(row.lpn, row.lpc03, caso, row.lpn_raw)

    case 4:

      return resolverLpc04(row.lpn, row.lpc04, caso, row.lpn_raw)

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

