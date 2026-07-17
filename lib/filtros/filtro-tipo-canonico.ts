/**
 * Filtro canónico «Tipo» — paridad Report herramienta-reposicion.
 * Casos biblioteca (descp_caso) + liquidación SDRM (es_liquidacion / cadena_comercial).
 */
export type TipoGrupoId = 'normal' | 'carteras' | 'promo' | 'liquidacion'

export const TIPO_GRUPO_OPCIONES: ReadonlyArray<{ id: TipoGrupoId; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'carteras', label: 'Carteras' },
  { id: 'promo', label: 'Promo' },
  { id: 'liquidacion', label: 'Liquidación' },
] as const

export const CASOS_TIPO_NORMAL = [
  'ACT-BRSPORT',
  'BR-VZ-MD-MKA-O',
  'BR-VZ-MD-ML-MKA-O',
] as const

const SET_NORMAL = new Set<string>(CASOS_TIPO_NORMAL)
const SET_CARTERAS = new Set<string>(['CARTERAS'])
const SET_PROMO = new Set<string>(['PROMOCIONAL'])

export type RowTipoSignals = {
  linea_codigo?: string | number | null
  linea_codigo_proveedor?: string | number | null
  caso_precio?: string | null
  descp_caso?: string | null
  caso_id?: number | null
  cadena_comercial?: string | null
  es_liquidacion?: boolean | null
}

export function normalizeCasoNombre(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase()
}

export function esLiquidacionRow(row: RowTipoSignals): boolean {
  if (row.es_liquidacion === true) return true
  return String(row.cadena_comercial ?? '').trim().toUpperCase() === 'LIQUIDACION'
}

function casoEfectivo(row: RowTipoSignals): string | null {
  const snap = normalizeCasoNombre(row.caso_precio ?? row.descp_caso)
  return snap || null
}

export function resolveTipoGruposForRow(row: RowTipoSignals): TipoGrupoId[] {
  const out: TipoGrupoId[] = []
  if (esLiquidacionRow(row)) out.push('liquidacion')
  const caso = casoEfectivo(row)
  if (caso) {
    if (SET_NORMAL.has(caso)) out.push('normal')
    else if (SET_CARTERAS.has(caso)) out.push('carteras')
    else if (SET_PROMO.has(caso)) out.push('promo')
  }
  return out
}

export function rowMatchesTipoGrupos(
  row: RowTipoSignals,
  selected: readonly TipoGrupoId[],
): boolean {
  if (!selected.length) return true
  const grupos = resolveTipoGruposForRow(row)
  if (!grupos.length) return false
  return selected.some((g) => grupos.includes(g))
}

export function toggleTipoGrupo(list: TipoGrupoId[], id: TipoGrupoId): TipoGrupoId[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function esMarcaFantasmaFiltro(label: string): boolean {
  const t = label.trim().toUpperCase()
  return (
    !t ||
    t === 'RIMEC' ||
    t === '—' ||
    t === '-' ||
    t === '(SIN MARCA)' ||
    t === 'SIN MARCA'
  )
}
