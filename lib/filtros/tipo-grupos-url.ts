/** Ids canónicos filtro Tipo/CASOS — URL · session · API (2.2.1.56). */
export const TIPO_GRUPO_IDS_URL = [
  'normal',
  'actual',
  'anterior',
  'chi',
  'carteras',
  'promo',
  'liquidacion',
  'comun',
] as const

export type TipoGrupoIdUrl = (typeof TIPO_GRUPO_IDS_URL)[number]

const SET = new Set<string>(TIPO_GRUPO_IDS_URL)

export function parseTipoGruposCsv(raw: string | null | undefined): TipoGrupoIdUrl[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter((x): x is TipoGrupoIdUrl => SET.has(x))
}

export function parseTipoGruposList(raw: unknown): TipoGrupoIdUrl[] {
  if (!Array.isArray(raw)) return []
  return raw.map(String).filter((x): x is TipoGrupoIdUrl => SET.has(x))
}
