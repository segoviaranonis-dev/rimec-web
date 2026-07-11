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
      return row.precio_web ?? row.lpn ?? null
    case 2:
      return row.lpc02 ?? null
    case 3: {
      if (row.lpc03 != null && row.lpc03 > 0) return row.lpc03
      if (promocional && row.lpn != null && row.lpn > 0) return row.lpn
      return null
    }
    case 4:
      return row.lpc04 ?? null
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
