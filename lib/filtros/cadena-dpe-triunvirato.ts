/**
 * Ley Director · DPE — cadena comercial SOLO triunvirato Excel (COD.GRUPO).
 * Trillizo siamés: report `cadena-dpe-triunvirato.ts`
 */
import {
  cadenaComercialDesdeCodGrupo,
  type CadenaDesdeGrupo,
} from '@/lib/pilares/codGrupoCadena'

export type CadenaDpe = CadenaDesdeGrupo

export type RowCadenaDpe = {
  cod_grupo?: string | null
  descp_caso?: string | null
  caso_precio?: string | null
  es_promo?: boolean | number | string | null
  es_liquidacion?: boolean | number | string | null
  cadena_comercial?: string | null
}

export function cadenaDpeTriunvirato(row: RowCadenaDpe): CadenaDpe {
  const desdeGrupo = cadenaComercialDesdeCodGrupo(row.cod_grupo)
  return desdeGrupo ?? 'REGULAR'
}

export function esPromoDpe(row: RowCadenaDpe): boolean {
  return cadenaDpeTriunvirato(row) === 'PROMOCIONAL'
}

export function esLiquidacionDpe(row: RowCadenaDpe): boolean {
  return cadenaDpeTriunvirato(row) === 'LIQUIDACION'
}

export function esComunDpe(row: RowCadenaDpe): boolean {
  return cadenaDpeTriunvirato(row) === 'COMUN'
}
