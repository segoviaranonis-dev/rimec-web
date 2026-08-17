/**
 * Filtro UI «Tipo» = CASOS comerciales (canon 2.2.1.56).
 * No renombrar el label Tipo en pantalla — ver CHUSAR_CANON_CASOS_FILTRO_UNIVERSAL.
 * LIQUIDACION / COMUN: herencia SDRM (COD.GRUPO), aún sin fila BCL 654.
 */
import { casoFiltroIdsDesdeCodGrupo } from '@/lib/pilares/codGrupoCasoFiltro'
import type { RowCadenaPe } from '@/lib/filtros/pe-grupo-uno-visual'

export type PeTipoDiccionarioId =
  | 'normal'
  | 'actual'
  | 'anterior'
  | 'chi'
  | 'promo'
  | 'liquidacion'
  | 'comun'

export const PE_TIPO_DICCIONARIO_OPCIONES: ReadonlyArray<{
  id: PeTipoDiccionarioId
  label: string
  ramos: ReadonlyArray<'CALZADO' | 'CONFECCIONES' | 'TODOS'>
}> = [
  { id: 'normal', label: 'NORMAL', ramos: ['CALZADO', 'TODOS'] },
  { id: 'actual', label: 'ACTUAL', ramos: ['CONFECCIONES', 'TODOS'] },
  { id: 'anterior', label: 'ANTERIOR', ramos: ['CONFECCIONES', 'TODOS'] },
  { id: 'chi', label: 'CHINELO', ramos: ['CALZADO', 'TODOS'] },
  { id: 'promo', label: 'PROMOCIONAL', ramos: ['CALZADO', 'CONFECCIONES', 'TODOS'] },
  { id: 'liquidacion', label: 'LIQUIDACION', ramos: ['CALZADO', 'CONFECCIONES', 'TODOS'] },
  { id: 'comun', label: 'COMUN', ramos: ['CALZADO', 'TODOS'] },
] as const

const PE_TIPO_ID_SET = new Set<string>(PE_TIPO_DICCIONARIO_OPCIONES.map((o) => o.id))

const LABEL_POR_ID = new Map(
  PE_TIPO_DICCIONARIO_OPCIONES.map((o) => [o.id, o.label] as const),
)

export function peTipoOpcionesVisibles(
  ramo_tipo?: string | null,
): typeof PE_TIPO_DICCIONARIO_OPCIONES {
  const ramo = String(ramo_tipo ?? 'TODOS').trim().toUpperCase()
  if (ramo === 'ACCESORIOS') return [] as unknown as typeof PE_TIPO_DICCIONARIO_OPCIONES
  if (ramo === 'CALZADO') {
    return PE_TIPO_DICCIONARIO_OPCIONES.filter((o) => o.ramos.includes('CALZADO'))
  }
  if (ramo === 'CONFECCIONES') {
    return PE_TIPO_DICCIONARIO_OPCIONES.filter((o) => o.ramos.includes('CONFECCIONES'))
  }
  return PE_TIPO_DICCIONARIO_OPCIONES
}

export function cadenaPeFromTipoId(id: PeTipoDiccionarioId): string {
  if (id === 'promo') return 'PROMOCIONAL'
  if (id === 'liquidacion') return 'LIQUIDACION'
  if (id === 'comun') return 'COMUN'
  if (id === 'chi') return 'CHINELO'
  if (id === 'actual') return 'ACTUAL'
  if (id === 'anterior') return 'ANTERIOR'
  return 'REGULAR'
}

export function peTipoIdFromCadena(cadena: string | null | undefined): PeTipoDiccionarioId {
  const u = String(cadena ?? 'REGULAR').trim().toUpperCase()
  if (u === 'PROMOCIONAL' || u === 'PROMO' || u === 'PRO') return 'promo'
  if (u === 'LIQUIDACION' || u === 'LIQUIDACIÓN') return 'liquidacion'
  if (u === 'COMUN' || u === 'COMÚN') return 'comun'
  if (u === 'CHI' || u === 'CHINELO') return 'chi'
  if (u === 'ACTUAL') return 'actual'
  if (u === 'ANTERIOR') return 'anterior'
  if (u === 'NORMAL' || u === 'REGULAR') return 'normal'
  return 'normal'
}

export function rowMatchesPeTipoDiccionario(
  row: RowCadenaPe & {
    cod_grupo?: string | null
    descp_caso?: string | null
    caso_precio?: string | null
    descp_marca?: string | null
  },
  selected: readonly PeTipoDiccionarioId[],
): boolean {
  if (!selected.length) return true
  const ids = [...casoFiltroIdsDesdeCodGrupo(row.cod_grupo)]
  const caso = String(row.descp_caso ?? row.caso_precio ?? '')
    .trim()
    .toUpperCase()
  const marca = String(row.descp_marca ?? '')
    .trim()
    .toUpperCase()
  // Herencia SDRM: marca fantasma CHINELO en vista PE · caso BCL texto
  if (marca === 'CHINELO' || caso.includes('CHINELO') || caso === 'CHI') {
    if (!ids.includes('chi')) ids.push('chi')
  }
  if (!ids.length) return false
  return selected.some((s) => ids.includes(s))
}

export function togglePeTipoDiccionario(
  list: PeTipoDiccionarioId[],
  id: PeTipoDiccionarioId,
): PeTipoDiccionarioId[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function parsePeTipoSelected(ids: readonly string[]): PeTipoDiccionarioId[] {
  return ids.filter((g) => PE_TIPO_ID_SET.has(g)) as PeTipoDiccionarioId[]
}

export function labelPeTipoDiccionario(id: string): string {
  return LABEL_POR_ID.get(id as PeTipoDiccionarioId) ?? id.toUpperCase()
}

export function usaDiccionarioPeTipo(origen_tipo?: string | null): boolean {
  const o = String(origen_tipo ?? 'TODOS').trim().toUpperCase()
  if (!o || o === 'TODOS') return true
  return o.includes('PRONTA')
}
