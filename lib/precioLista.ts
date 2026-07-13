/** Caso comercial con solo LPN — excepción LPC03 = LPN (Director · 2026-07-07). */
export const CASO_PROMOCIONAL_NOMBRE = 'PROMOCIONAL'

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

/** 0 / NaN / null no son precio — evita `0 ?? snapshot` que pisa el carrito. */
function precioPositivo(v: number | null | undefined): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Precio activo según política cliente (LPN/LPC02/LPC03/LPC04). */
export function getPrecioActivo(
  row: PrecioListaRow,
  listaId: ListaPrecioId | number,
  descpCaso?: string | null,
): number | null {
  const promocional = esCasoPromocional(descpCaso ?? row.descp_caso)
  const tier = Number(listaId)

  switch (tier) {
    case 1:
      return precioPositivo(row.precio_web) ?? precioPositivo(row.lpn)
    case 2:
      return precioPositivo(row.lpc02)
    case 3: {
      const lpc03 = precioPositivo(row.lpc03)
      if (lpc03 != null) return lpc03
      if (promocional) return precioPositivo(row.lpn)
      return null
    }
    case 4:
      return precioPositivo(row.lpc04)
    default:
      return null
  }
}

/**
 * Pronta entrega — vista casi siempre solo trae LPN (LPC02-04 null).
 * Si el tier de lista queda vacío → fallback LPN (paridad carritoValidarPe).
 */
export function getPrecioActivoPe(
  row: PrecioListaRow,
  listaId: ListaPrecioId | number,
  descpCaso?: string | null,
): number | null {
  const tier = getPrecioActivo(row, listaId, descpCaso)
  if (tier != null && tier > 0) return tier
  const lpn = Number(row.lpn ?? 0)
  return lpn > 0 ? lpn : null
}
