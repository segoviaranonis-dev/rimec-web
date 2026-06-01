export interface StockRowMin {
  cajas_disponibles?: number | null
  saldo_pares?: number | null
  cantidad_pares: number
  pares_vendidos?: number | null
  pares_por_caja: number
  cantidad_cajas: number
}

/** Cajas vendibles: usa columna de la vista o calcula desde saldo de pares. */
export function cajasDisponiblesDeFila(item: StockRowMin): number {
  if (item.cajas_disponibles != null && !Number.isNaN(Number(item.cajas_disponibles))) {
    return Math.max(0, Number(item.cajas_disponibles))
  }
  const saldoPares = Math.max(
    0,
    Number(item.saldo_pares ?? (item.cantidad_pares - (item.pares_vendidos ?? 0))),
  )
  const ppc = Number(item.pares_por_caja)
    || (item.cantidad_cajas > 0 ? item.cantidad_pares / item.cantidad_cajas : 0)
  if (ppc <= 0) return saldoPares > 0 ? Math.max(0, item.cantidad_cajas) : 0
  return Math.max(0, Math.floor(saldoPares / ppc))
}

/** Pares realmente vendibles, alineados con cajas disponibles. */
export function paresDisponiblesDeFila(item: StockRowMin): number {
  const cajas = cajasDisponiblesDeFila(item)
  const ppc = Number(item.pares_por_caja)
    || (item.cantidad_cajas > 0 ? item.cantidad_pares / item.cantidad_cajas : 0)
  if (cajas > 0 && ppc > 0) return cajas * ppc
  return Math.max(
    0,
    Number(item.saldo_pares ?? (item.cantidad_pares - (item.pares_vendidos ?? 0))),
  )
}
