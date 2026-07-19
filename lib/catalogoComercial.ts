import { esCasoPromocional } from '@/lib/precioLista'

type ComercialPe = {
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
  cadena_comercial?: string | null
  descp_caso?: string | null
}

export function esLiquidacionPe(item: ComercialPe): boolean {
  return (
    item.es_liquidacion === true ||
    String(item.cadena_comercial ?? '').trim().toUpperCase() === 'LIQUIDACION'
  )
}

/** CP: caso PROMOCIONAL · PE: flag SDRM o cadena PROMOCIONAL. */
export function esPromoTarjeta(item: ComercialPe): boolean {
  if (esCasoPromocional(item.descp_caso)) return true
  if (item.es_promo === true) return true
  return String(item.cadena_comercial ?? '').trim().toUpperCase() === 'PROMOCIONAL'
}

/** Resuelve borde/latido tarjeta — solo PROMO y LIQUIDACIÓN laten. */
export type CatalogShellVariant = 'cp' | 'pe' | 'fusion' | 'liquidacion' | 'promo'

export function resolveCatalogShellVariant(opts: {
  esLiquidacion: boolean
  esPromo: boolean
  esPe?: boolean
  esFusion?: boolean
}): CatalogShellVariant {
  if (opts.esLiquidacion) return 'liquidacion'
  if (opts.esPromo) return 'promo'
  if (opts.esFusion) return 'fusion'
  if (opts.esPe) return 'pe'
  return 'cp'
}
