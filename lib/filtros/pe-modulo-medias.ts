/**
 * Módulo MEDIAS PE — paridad Report `report/src/lib/filtros/pe-modulo-medias.ts`.
 * Calzado · COD.GRUPO d23=04 · marcas *MEDIA*.
 */
import { normalizeCodGrupo10 } from '@/lib/pilares/codGrupoCadena'

export const PE_TIPO1_MEDIAS_ID = 4

export const PE_MEDIAS_MARCAS_VALORIZADO = [
  'ACTVITTA MEDIA FEM',
  'ACTVITTA MEDIA MASC',
  'MOLEKINHA MEDIAS',
  'MOLEKINHO MEDIAS',
  'MOLECA MEDIAS',
  'MODARE MEDIAS',
] as const

export const PE_MEDIAS_LINEAS_VALORIZADO = [
  '2199',
  '2598',
  '2599',
  '2799',
  '2899',
  '4998',
  '4999',
  '5999',
  '7499',
] as const

function normLabel(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export type FilaMediasSignals = {
  tipo_1?: string | null
  descp_tipo_1?: string | null
  marca?: string | null
  sdrm_marca?: string | null
  cod_grupo?: string | null
  linea_codigo?: string | null
  linea_codigo_proveedor?: string | null
}

export function codGrupoEsMedias(cod_grupo: string | null | undefined): boolean {
  const g = normalizeCodGrupo10(cod_grupo)
  if (!g) return false
  const conf = ['10', '11', '12', '13', '14', '15'].includes(g.slice(0, 2))
  if (conf) return false
  return g.slice(2, 4) === '04'
}

export function esMarcaMedias(raw: string | null | undefined): boolean {
  const u = normLabel(raw)
  if (!u) return false
  if (/\bMEDIAS?\b/.test(u)) return true
  return PE_MEDIAS_MARCAS_VALORIZADO.some((m) => u.includes(normLabel(m)))
}

export function esLabelMedias(raw: string | null | undefined): boolean {
  return normLabel(raw) === 'MEDIAS'
}

export function esFilaMedias(row: FilaMediasSignals): boolean {
  if (esLabelMedias(row.tipo_1) || esLabelMedias(row.descp_tipo_1)) return true
  if (codGrupoEsMedias(row.cod_grupo)) return true
  if (esMarcaMedias(row.marca) || esMarcaMedias(row.sdrm_marca)) return true
  const linea = String(row.linea_codigo_proveedor ?? row.linea_codigo ?? '').trim()
  if (linea && (PE_MEDIAS_LINEAS_VALORIZADO as readonly string[]).includes(linea)) return true
  return false
}

export const ABCR_MEDIAS_ITEM = { id: PE_TIPO1_MEDIAS_ID, label: 'MEDIAS' } as const
