/**
 * R-FI-2 — Segregación comercial infalible en FI.
 * PROMO y LIQUIDACIÓN nunca comparten factura (ni entre sí ni con Regular
 * si el caso_id colapsara). Prioridad: LIQ > PROMO > REGULAR (hermanos siameses).
 */
import { esLiquidacionRow, esPromoRow, type RowTipoSignals } from '@/lib/filtros/filtro-tipo-canonico'
import { claveCasoFi, etiquetaCasoFi, type CasoFragmentable } from '@/lib/facturaCasoClave'

export type CadenaComercialFi = 'LIQUIDACION' | 'PROMOCIONAL' | 'REGULAR'

export type CelulaFragmentable = CasoFragmentable & RowTipoSignals

export function cadenaComercialFi(item: CelulaFragmentable): CadenaComercialFi {
  const row: RowTipoSignals = {
    descp_caso: item.caso ?? item.descp_caso ?? null,
    caso_precio: item.caso_precio ?? item.caso ?? null,
    caso_id: item.caso_id ?? null,
    cadena_comercial: item.cadena_comercial ?? null,
    es_liquidacion: item.es_liquidacion ?? null,
    es_promo: item.es_promo ?? null,
    linea_codigo: item.linea_codigo ?? null,
  }
  if (esLiquidacionRow(row)) return 'LIQUIDACION'
  if (esPromoRow(row)) return 'PROMOCIONAL'
  return 'REGULAR'
}

/** Clave FI = caso × cadena comercial (R-FI-1 + R-FI-2). */
export function claveCelulaFi(item: CelulaFragmentable): string {
  return `${claveCasoFi(item)}|${cadenaComercialFi(item)}`
}

export function etiquetaCelulaFi(item: CelulaFragmentable): string {
  const caso = etiquetaCasoFi(item)
  const cad = cadenaComercialFi(item)
  if (cad === 'REGULAR') return caso
  if (caso === 'Sin caso' || caso.startsWith('Caso #')) return `${caso} · ${cad}`
  // Evitar duplicar si el nombre del caso ya es PROMOCIONAL / LIQUIDACION
  const up = caso.toUpperCase()
  if (up.includes('LIQUID') || up.includes('PROMO')) return caso
  return `${caso} · ${cad}`
}

export function mismasCelulasFi(a: CelulaFragmentable, b: CelulaFragmentable): boolean {
  return claveCelulaFi(a) === claveCelulaFi(b)
}

/** True si un set de cadenas viola R-FI-2 (promo+liq u otras mezclas). */
export function violacionSegregacionCadenas(cadenas: Iterable<CadenaComercialFi>): boolean {
  const set = new Set(cadenas)
  if (set.size <= 1) return false
  // Cualquier mezcla de cadenas comerciales distintas en una FI = violación
  return true
}
