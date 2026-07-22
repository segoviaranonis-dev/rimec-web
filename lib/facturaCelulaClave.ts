/**
 * R-FI-2 — Segregación comercial infalible en FI.
 * PROMO y LIQUIDACIÓN nunca comparten factura (ni entre sí ni con Regular
 * si el caso_id colapsara). Prioridad: LIQ > PROMO > REGULAR (hermanos siameses).
 *
 * Fuente de verdad liquidación/promo PE = COD.GRUPO Carlos (dígito cadena)
 * materializado en `es_liquidacion` / `es_promo` / `cadena_comercial` (vista PE).
 * Si faltan flags, se re-deriva desde `cod_grupo`.
 */
import { esLiquidacionRow, esPromoRow, type RowTipoSignals } from '@/lib/filtros/filtro-tipo-canonico'
import { claveCasoFi, etiquetaCasoFi, type CasoFragmentable } from '@/lib/facturaCasoClave'
import { cadenaComercialDesdeCodGrupo } from '@/lib/pilares/codGrupoCadena'

export type CadenaComercialFi = 'LIQUIDACION' | 'PROMOCIONAL' | 'REGULAR'

export type CelulaFragmentable = CasoFragmentable &
  RowTipoSignals & {
    cod_grupo?: string | null
  }

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
  // Fallback Carlos: dígito cadena en COD.GRUPO (calzado 45=04 · confecciones 67=04)
  const desdeGrupo = cadenaComercialDesdeCodGrupo(item.cod_grupo)
  if (desdeGrupo) return desdeGrupo
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
