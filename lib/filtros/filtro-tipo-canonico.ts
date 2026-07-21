/**
 * Filtro canónico «Tipo» — paridad Report Alejandro Magno ↔ RIMEC Web (hermanos siameses).
 *
 * Prioridad exclusiva (como liquidación):
 * 1. liquidacion — es_liquidacion / cadena LIQUIDACION
 * 2. promo — es_promo / cadena PROMOCIONAL / caso PROMOCIONAL
 * 3. carteras | normal — casos biblioteca (snapshot o BCL línea→caso)
 *
 * Vulnerabilidad 2026-07-20: PE mostraba badge PROMO (es_promo) pero «Normal»
 * clasificaba por descp_caso/BCL y filtraba mal línea promocional (ej. 1395).
 */
import { lookupCasoLinea, normalizeCasoNombre } from '@/lib/depositos/caso-biblioteca'

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
  es_liquidacion?: boolean | number | string | null
  /** SDRM / vista PE — misma señal que badge PROMO en grilla */
  es_promo?: boolean | number | string | null
}

export function esLiquidacionRow(row: RowTipoSignals): boolean {
  if (row.es_liquidacion === true || row.es_liquidacion === 1) return true
  if (String(row.es_liquidacion ?? '').trim().toLowerCase() === 'true') return true
  return String(row.cadena_comercial ?? '').trim().toUpperCase() === 'LIQUIDACION'
}

/** Promo comercial — prioriza flag SDRM sobre caso/BCL (paridad badge UI). */
export function esPromoRow(row: RowTipoSignals): boolean {
  if (row.es_promo === true || row.es_promo === 1) return true
  if (String(row.es_promo ?? '').trim().toLowerCase() === 'true') return true
  if (String(row.cadena_comercial ?? '').trim().toUpperCase() === 'PROMOCIONAL') return true
  const snap = normalizeCasoNombre(row.caso_precio ?? row.descp_caso)
  return Boolean(snap && SET_PROMO.has(snap))
}

function casoBiblioteca(
  row: RowTipoSignals,
  lineaCasoMap?: Map<string, string> | null,
): string | null {
  const snap = normalizeCasoNombre(row.caso_precio ?? row.descp_caso)
  if (snap && (SET_NORMAL.has(snap) || SET_CARTERAS.has(snap) || SET_PROMO.has(snap))) {
    return snap
  }
  // Snapshot vacío o basura tipo «PE · proforma» → BCL
  const linea = row.linea_codigo ?? row.linea_codigo_proveedor
  const fromBcl = lookupCasoLinea(lineaCasoMap, linea)
  return fromBcl ? normalizeCasoNombre(fromBcl) : snap || null
}

export function resolveTipoGruposForRow(
  row: RowTipoSignals,
  lineaCasoMap?: Map<string, string> | null,
): TipoGrupoId[] {
  if (esLiquidacionRow(row)) return ['liquidacion']
  if (esPromoRow(row)) return ['promo']

  const out: TipoGrupoId[] = []
  const caso = casoBiblioteca(row, lineaCasoMap)
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
  lineaCasoMap?: Map<string, string> | null,
): boolean {
  if (!selected.length) return true
  const grupos = resolveTipoGruposForRow(row, lineaCasoMap)
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

export { normalizeCasoNombre }
