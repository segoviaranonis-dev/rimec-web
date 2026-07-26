/**
 * Filtro Tipo PE — diccionario COD.GRUPO · paridad Report `filtro-tipo-pe-diccionario.ts`.
 * Etiquetas UI en MAYÚSCULAS (NORMAL · PROMOCIONAL · LIQUIDACION · COMUN).
 */
import { cadenaPeCanonico, type RowCadenaPe } from '@/lib/filtros/pe-grupo-uno-visual'

export type PeTipoDiccionarioId = 'normal' | 'promo' | 'liquidacion' | 'comun'

export const PE_TIPO_DICCIONARIO_OPCIONES: ReadonlyArray<{
  id: PeTipoDiccionarioId
  label: string
  cadena: string
}> = [
  { id: 'normal', label: 'NORMAL', cadena: 'REGULAR' },
  { id: 'promo', label: 'PROMOCIONAL', cadena: 'PROMOCIONAL' },
  { id: 'liquidacion', label: 'LIQUIDACION', cadena: 'LIQUIDACION' },
  { id: 'comun', label: 'COMUN', cadena: 'COMUN' },
] as const

const CADENA_POR_ID = new Map(
  PE_TIPO_DICCIONARIO_OPCIONES.map((o) => [o.id, o.cadena] as const),
)

const LABEL_POR_ID = new Map(
  PE_TIPO_DICCIONARIO_OPCIONES.map((o) => [o.id, o.label] as const),
)

export function cadenaPeFromTipoId(id: PeTipoDiccionarioId): string {
  return CADENA_POR_ID.get(id) ?? 'REGULAR'
}

export function peTipoIdFromCadena(cadena: string | null | undefined): PeTipoDiccionarioId {
  const u = String(cadena ?? 'REGULAR').trim().toUpperCase()
  if (u === 'PROMOCIONAL' || u === 'PROMO') return 'promo'
  if (u === 'LIQUIDACION' || u === 'LIQUIDACIÓN') return 'liquidacion'
  if (u === 'COMUN' || u === 'COMÚN') return 'comun'
  return 'normal'
}

export function rowMatchesPeTipoDiccionario(
  row: RowCadenaPe,
  selected: readonly PeTipoDiccionarioId[],
): boolean {
  if (!selected.length) return true
  const cadena = cadenaPeCanonico(row)
  const want = new Set(selected.map((id) => cadenaPeFromTipoId(id)))
  return want.has(cadena)
}

export function togglePeTipoDiccionario(
  list: PeTipoDiccionarioId[],
  id: PeTipoDiccionarioId,
): PeTipoDiccionarioId[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

const PE_TIPO_ID_SET = new Set<string>(['normal', 'promo', 'liquidacion', 'comun'])

export function parsePeTipoSelected(ids: readonly string[]): PeTipoDiccionarioId[] {
  return ids.filter((g) => PE_TIPO_ID_SET.has(g)) as PeTipoDiccionarioId[]
}

export function labelPeTipoDiccionario(id: string): string {
  return LABEL_POR_ID.get(id as PeTipoDiccionarioId) ?? id.toUpperCase()
}

/** PE puro o Todos → sidebar diccionario (no chips CP title-case). */
export function usaDiccionarioPeTipo(origen_tipo?: string | null): boolean {
  const o = String(origen_tipo ?? 'TODOS').trim().toUpperCase()
  if (!o || o === 'TODOS') return true
  return o.includes('PRONTA')
}
