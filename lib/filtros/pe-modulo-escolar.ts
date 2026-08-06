/**
 * AB-CR · ESCOLAR (d45=08 Carlos) — Molekinha/Molekinho CERRADO ESCOLAR.
 * Cadena comercial sigue REGULAR (grupo uno). Chip en dimensión AB-CR.
 */
import { normalizeCodGrupo10 } from '@/lib/pilares/codGrupoCadena'

/** Sintético sidebar — no es FK `tipo_1` (CERRADO sigue id=2). */
export const PE_TIPO1_ESCOLAR_ID = -8

export const ABCR_ESCOLAR_ITEM = {
  id: PE_TIPO1_ESCOLAR_ID,
  label: 'ESCOLAR',
} as const

export function codGrupoEsEscolar(cod_grupo: string | null | undefined): boolean {
  const g = normalizeCodGrupo10(cod_grupo)
  if (!g) return false
  const conf = ['10', '11', '12', '13', '14', '15'].includes(g.slice(0, 2))
  if (conf) return false
  return g.slice(4, 6) === '08'
}

export function esLabelEscolar(raw: string | null | undefined): boolean {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') === 'ESCOLAR'
}

export type FilaEscolarSignals = {
  descp_tipo_1?: string | null
  tipo_1?: string | null
  sdrm_tipo1?: string | null
  cod_grupo?: string | null
}

/** Fila ESCOLAR: d45=08 o label SDRM/Excel ESCOLAR. */
export function esFilaEscolar(row: FilaEscolarSignals): boolean {
  if (codGrupoEsEscolar(row.cod_grupo)) return true
  if (esLabelEscolar(row.sdrm_tipo1)) return true
  if (esLabelEscolar(row.descp_tipo_1) || esLabelEscolar(row.tipo_1)) return true
  return false
}
