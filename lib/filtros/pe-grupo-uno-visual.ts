/**
 * Grupo uno PE — visual + cadena DPE · trillizo siamés con Report.
 * Ley: segregación SOLO triunvirato Excel — ver `cadena-dpe-triunvirato.ts`.
 */
import {
  cadenaDpeTriunvirato,
  esComunDpe,
  esLiquidacionDpe,
  esPromoDpe,
  type RowCadenaDpe,
} from '@/lib/filtros/cadena-dpe-triunvirato'

export type PeGrupoUnoShell = 'normal' | 'promo' | 'liquidacion' | 'comun'

export type RowCadenaPe = RowCadenaDpe

export function esComunRow(row: RowCadenaPe): boolean {
  return esComunDpe(row)
}

export function resolvePeGrupoUnoShell(row: RowCadenaPe): PeGrupoUnoShell {
  if (esLiquidacionDpe(row)) return 'liquidacion'
  if (esPromoDpe(row)) return 'promo'
  if (esComunDpe(row)) return 'comun'
  return 'normal'
}

/** Cadena diccionario DPE — triunvirato COD.GRUPO únicamente. */
export function cadenaPeCanonico(
  row: RowCadenaPe,
): 'REGULAR' | 'PROMOCIONAL' | 'LIQUIDACION' | 'COMUN' {
  return cadenaDpeTriunvirato(row)
}
