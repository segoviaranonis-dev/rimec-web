/**
 * Filtro canónico «Tipo» — paridad Report Alejandro Magno ↔ RIMEC Web (hermanos siameses).
 *
 * Prioridad exclusiva (como liquidación):
 * 1. liquidacion — es_liquidacion / cadena LIQUIDACION
 * 2. promo — es_promo / cadena PROMOCIONAL / caso PROMOCIONAL
 * 3. carteras | normal — casos biblioteca (snapshot o BCL línea→caso)
 *
 * ⛔ PE / DPE: NO usar esPromoRow — `cadena-dpe-triunvirato.ts` (solo COD.GRUPO).
 * BCL aplica programado + compra previa únicamente.
 * clasificaba por descp_caso/BCL y filtraba mal línea promocional (ej. 1395).
 */
import { lookupCasoLinea, normalizeCasoNombre } from '@/lib/depositos/caso-biblioteca'
import { esFilaModuloAccesorios, esRamoAccesorios, peTieneSubfamiliaAccesorios } from '@/lib/filtros/modulo-accesorios'

export type TipoGrupoId = 'normal' | 'actual' | 'anterior' | 'chi' | 'carteras' | 'promo' | 'liquidacion' | 'comun'

export const TIPO_GRUPO_OPCIONES: ReadonlyArray<{ id: TipoGrupoId; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'actual', label: 'Actual' },
  { id: 'anterior', label: 'Anterior' },
  { id: 'chi', label: 'CHINELO' },
  { id: 'carteras', label: 'Carteras' },
  { id: 'promo', label: 'Promo' },
  { id: 'liquidacion', label: 'Liquidación' },
] as const

export const CASOS_TIPO_NORMAL = [
  'ACT-BRSPORT',
  'BR-VZ-MD-MKA-O',
  'BR-VZ-MD-ML-MKA-O',
  'TENIS',
  'CLASICOS',
  'TENIS-CLASICOS',
] as const

const SET_NORMAL = new Set<string>(CASOS_TIPO_NORMAL)
const SET_ACTUAL = new Set<string>(['ACTUAL'])
const SET_ANTERIOR = new Set<string>(['ANTERIOR'])
const SET_CHI = new Set<string>(['CHINELO', 'CHI'])
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
  if (
    snap &&
    (SET_NORMAL.has(snap) ||
      SET_ACTUAL.has(snap) ||
      SET_ANTERIOR.has(snap) ||
      SET_CHI.has(snap) ||
      SET_CARTERAS.has(snap) ||
      SET_PROMO.has(snap))
  ) {
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
    if (SET_CHI.has(caso)) out.push('chi')
    else if (SET_NORMAL.has(caso)) out.push('normal')
    else if (SET_ACTUAL.has(caso)) out.push('actual')
    else if (SET_ANTERIOR.has(caso)) out.push('anterior')
    else if (SET_CARTERAS.has(caso)) out.push('carteras')
    else if (SET_PROMO.has(caso)) out.push('promo')
  }
  // Marca fantasma CHINELO (SDRM / vista) · mismo id filtro que caso BCL.
  const marca = String((row as { descp_marca?: string | null }).descp_marca ?? '')
    .trim()
    .toUpperCase()
  if (marca === 'CHINELO' && !out.includes('chi')) out.push('chi')
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

/** Canon 2.2.1.56 · chips según ramo. */
export function tipoGrupoOpcionesVisibles(ramo_tipo?: string): typeof TIPO_GRUPO_OPCIONES {
  const ramo = String(ramo_tipo ?? '').trim().toUpperCase()
  if (ramo === 'ACCESORIOS') return []
  if (ramo === 'CALZADO') {
    return TIPO_GRUPO_OPCIONES.filter(
      (o) => o.id === 'normal' || o.id === 'chi' || o.id === 'promo' || o.id === 'liquidacion',
    )
  }
  if (ramo === 'CONFECCIONES') {
    return TIPO_GRUPO_OPCIONES.filter(
      (o) => o.id === 'actual' || o.id === 'anterior' || o.id === 'promo' || o.id === 'liquidacion',
    )
  }
  return TIPO_GRUPO_OPCIONES.filter((o) => o.id !== 'carteras')
}

export function sanitizeTipoGruposParaRamo(
  tipo_grupos: readonly TipoGrupoId[] | undefined,
  ramo_tipo?: string,
): TipoGrupoId[] {
  const list = [...(tipo_grupos ?? [])]
  if (esRamoAccesorios(ramo_tipo)) return []
  if (String(ramo_tipo ?? '').trim().toUpperCase() !== 'CALZADO') return list
  return list.filter((g) => g !== 'carteras')
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

/** @deprecated usar esFilaModuloAccesorios */
export function esFilaCarteraCatalogo(
  row: RowTipoSignals & {
    descp_grupo_estilo?: string | null
    descp_tipo_1?: string | null
  },
  lineaCasoMap?: Map<string, string> | null,
): boolean {
  return esFilaModuloAccesorios(row, lineaCasoMap)
}

/** Calzado por defecto = calzado puro; carteras/anteojos con chip AB-CR (tipo_ids -1/-2) o tipo_grupos carteras. */
export function calzadoExcluyeCarterasPorDefecto(filters: {
  ramo_tipo?: string
  tipo_grupos?: readonly TipoGrupoId[]
  tipo_ids?: readonly number[]
}): boolean {
  if (String(filters.ramo_tipo ?? '').trim().toUpperCase() !== 'CALZADO') return false
  if ((filters.tipo_grupos ?? []).includes('carteras')) return false
  if (peTieneSubfamiliaAccesorios(filters.tipo_ids ?? [])) return false
  return true
}

export { normalizeCasoNombre }
