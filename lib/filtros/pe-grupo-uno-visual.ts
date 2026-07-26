/**
 * Grupo uno PE — visual + cadena · trillizo siamés con Report (`pe-grupo-uno-visual.ts`).
 */
import {
  esLiquidacionRow,
  esPromoRow,
  type RowTipoSignals,
} from '@/lib/filtros/filtro-tipo-canonico'
import { cadenaComercialDesdeCodGrupo } from '@/lib/pilares/codGrupoCadena'

export type PeGrupoUnoShell = 'normal' | 'promo' | 'liquidacion' | 'comun'

export type RowCadenaPe = RowTipoSignals & { cod_grupo?: string | null }

export function esComunRow(row: RowCadenaPe): boolean {
  if (String(row.cadena_comercial ?? '').trim().toUpperCase() === 'COMUN') return true
  const cg = String(row.cod_grupo ?? '').trim()
  if (!cg) return false
  return cadenaComercialDesdeCodGrupo(cg) === 'COMUN'
}

export function resolvePeGrupoUnoShell(row: RowTipoSignals): PeGrupoUnoShell {
  if (esLiquidacionRow(row)) return 'liquidacion'
  if (esPromoRow(row)) return 'promo'
  if (esComunRow(row)) return 'comun'
  return 'normal'
}

/** Cadena diccionario BD — misma prioridad que badge/filtro (cadena + COD.GRUPO). */
export function cadenaPeCanonico(
  row: RowCadenaPe,
): 'REGULAR' | 'PROMOCIONAL' | 'LIQUIDACION' | 'COMUN' {
  const shell = resolvePeGrupoUnoShell(row)
  if (shell === 'liquidacion') return 'LIQUIDACION'
  if (shell === 'promo') return 'PROMOCIONAL'
  if (shell === 'comun') return 'COMUN'
  return 'REGULAR'
}
