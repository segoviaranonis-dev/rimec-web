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
