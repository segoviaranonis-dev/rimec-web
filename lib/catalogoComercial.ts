import { esCasoPromocional } from '@/lib/precioLista'
import { esComunRow } from '@/lib/filtros/pe-grupo-uno-visual'
type ComercialPe = {
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
  cadena_comercial?: string | null
  descp_caso?: string | null
  cod_grupo?: string | null
}

export function esLiquidacionPe(item: ComercialPe): boolean {
  return (
    item.es_liquidacion === true ||
    String(item.cadena_comercial ?? '').trim().toUpperCase() === 'LIQUIDACION'
  )
}

/** CP: caso PROMOCIONAL · PE: flag SDRM o cadena PROMOCIONAL. */
export function esPromoTarjeta(item: ComercialPe): boolean {
  if (esComunPe(item)) return false
  if (esCasoPromocional(item.descp_caso)) return true
  if (item.es_promo === true) return true
  return String(item.cadena_comercial ?? '').trim().toUpperCase() === 'PROMOCIONAL'
}

export function esComunPe(item: ComercialPe): boolean {
  return esComunRow(item)
}

/** Resuelve borde/latido tarjeta — PE grupo uno vs CP promo ámbar. */
export type CatalogShellVariant = 'cp' | 'pe' | 'fusion' | 'liquidacion' | 'promo' | 'cp-promo' | 'comun'

export function resolveCatalogShellVariant(opts: {
  esLiquidacion: boolean
  esPromo: boolean
  esComun?: boolean
  esPe?: boolean
  esFusion?: boolean
}): CatalogShellVariant {
  if (opts.esFusion) return 'fusion'
  if (opts.esLiquidacion) return 'liquidacion'
  if (opts.esPromo && opts.esPe) return 'promo'
  if (opts.esComun && opts.esPe) return 'comun'
  if (opts.esPromo) return 'cp-promo'
  if (opts.esPe) return 'pe'
  return 'cp'
}
