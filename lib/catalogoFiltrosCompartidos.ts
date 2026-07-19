/**
 * Filtros compartidos CP ↔ PE — sessionStorage + evento custom + storage cross-tab.
 * Origen, ramo, depósito y quincenas NO se sincronizan (solo catálogo transversal).
 */
import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import type { TipoGrupoId } from '@/lib/filtros/filtro-tipo-canonico'

export const SHARED_CATALOG_FILTERS_STORAGE_KEY = 'rimec_catalog_shared_filters_v1'

export type SharedCatalogFilterSlice = Pick<
  CatalogoFilterState,
  | 'grupo_estilo_id'
  | 'marca_id'
  | 'linea_ids'
  | 'tipo_ids'
  | 'colores'
  | 'genero_codigo'
  | 'tonos'
  | 'sin_tono'
  | 'buscar'
  | 'tipo_grupos'
  | 'material_familias'
  | 'color_familias'
>

function isSharedFieldEmpty(key: keyof SharedCatalogFilterSlice, value: unknown): boolean {
  if (
    key === 'linea_ids' ||
    key === 'tipo_ids' ||
    key === 'colores' ||
    key === 'tonos' ||
    key === 'tipo_grupos' ||
    key === 'material_familias' ||
    key === 'color_familias'
  ) {
    return !Array.isArray(value) || value.length === 0
  }
  if (key === 'sin_tono') return !value
  if (key === 'buscar') return typeof value !== 'string' || !value.trim()
  return value === undefined || value === null || value === ''
}

export function extractSharedCatalogFilters(filters: CatalogoFilterState): SharedCatalogFilterSlice {
  return {
    grupo_estilo_id: filters.grupo_estilo_id ?? '',
    marca_id: filters.marca_id ?? '',
    linea_ids: [...(filters.linea_ids ?? [])],
    tipo_ids: [...(filters.tipo_ids ?? [])],
    colores: [...(filters.colores ?? [])],
    genero_codigo: filters.genero_codigo ?? '',
    tonos: filters.sin_tono ? [] : [...(filters.tonos ?? [])],
    sin_tono: Boolean(filters.sin_tono),
    buscar: (filters.buscar ?? '').trim(),
    tipo_grupos: [...(filters.tipo_grupos ?? [])],
    material_familias: [...(filters.material_familias ?? [])],
    color_familias: [...(filters.color_familias ?? [])],
  }
}

export function persistSharedCatalogFilters(filters: CatalogoFilterState): void {
  if (typeof window === 'undefined') return
  try {
    const slice = extractSharedCatalogFilters(filters)
    sessionStorage.setItem(SHARED_CATALOG_FILTERS_STORAGE_KEY, JSON.stringify(slice))
    window.dispatchEvent(new CustomEvent('rimec-shared-filters', { detail: slice }))
  } catch {
    /* quota / modo privado */
  }
}

function parseTipoGrupos(raw: unknown): TipoGrupoId[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(String)
    .filter((x): x is TipoGrupoId =>
      x === 'normal' || x === 'carteras' || x === 'promo' || x === 'liquidacion',
    )
}

export function readSharedCatalogFilters(): SharedCatalogFilterSlice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SHARED_CATALOG_FILTERS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SharedCatalogFilterSlice>
    return {
      grupo_estilo_id: String(parsed.grupo_estilo_id ?? ''),
      marca_id: String(parsed.marca_id ?? ''),
      linea_ids: Array.isArray(parsed.linea_ids)
        ? parsed.linea_ids.map(Number).filter((n) => !Number.isNaN(n))
        : [],
      tipo_ids: Array.isArray(parsed.tipo_ids)
        ? parsed.tipo_ids.map(Number).filter((n) => !Number.isNaN(n))
        : [],
      colores: Array.isArray(parsed.colores) ? parsed.colores.filter(Boolean).map(String) : [],
      genero_codigo: String(parsed.genero_codigo ?? ''),
      tonos: Array.isArray(parsed.tonos) ? parsed.tonos.filter(Boolean).map(String) : [],
      sin_tono: Boolean(parsed.sin_tono),
      buscar: String(parsed.buscar ?? '').trim(),
      tipo_grupos: parseTipoGrupos(parsed.tipo_grupos),
      material_familias: Array.isArray(parsed.material_familias)
        ? parsed.material_familias.filter(Boolean).map(String)
        : [],
      color_familias: Array.isArray(parsed.color_familias)
        ? parsed.color_familias.filter(Boolean).map(String)
        : [],
    }
  } catch {
    return null
  }
}

export function clearSharedCatalogFilters(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SHARED_CATALOG_FILTERS_STORAGE_KEY)
    window.dispatchEvent(new CustomEvent('rimec-shared-filters', { detail: null }))
  } catch {
    /* noop */
  }
}

/** URL gana si trae valor; sessionStorage rellena huecos. Origen/ramo/depósito/quincenas intactos. */
import { isColdWideOpenCatalogEntry } from '@/lib/catalogoFiltrosEntrada'

export function mergeSharedIntoFilters(fromUrl: CatalogoFilterState): CatalogoFilterState {
  const shared = readSharedCatalogFilters()
  if (!shared) return fromUrl
  // Entrada fría: grilla Todos completa — el usuario achica; no restaurar filtros estrechos.
  if (isColdWideOpenCatalogEntry(fromUrl)) return fromUrl

  const pick = <K extends keyof SharedCatalogFilterSlice>(key: K): SharedCatalogFilterSlice[K] => {
    const urlVal = fromUrl[key as keyof CatalogoFilterState]
    if (!isSharedFieldEmpty(key, urlVal)) return urlVal as SharedCatalogFilterSlice[K]
    return shared[key]
  }

  return {
    ...fromUrl,
    grupo_estilo_id: pick('grupo_estilo_id'),
    marca_id: pick('marca_id'),
    linea_ids: pick('linea_ids'),
    tipo_ids: pick('tipo_ids'),
    colores: pick('colores'),
    genero_codigo: pick('genero_codigo'),
    tonos: pick('tonos'),
    sin_tono: pick('sin_tono'),
    buscar: pick('buscar'),
    tipo_grupos: pick('tipo_grupos'),
    material_familias: pick('material_familias'),
    color_familias: pick('color_familias'),
  }
}

/** Aplica solo la porción compartida sobre el estado actual (p. ej. otro tab o pill origen). */
export function applySharedSliceToFilters(
  current: CatalogoFilterState,
  slice: SharedCatalogFilterSlice | null,
): CatalogoFilterState {
  if (!slice) return current
  return {
    ...current,
    grupo_estilo_id: slice.grupo_estilo_id,
    marca_id: slice.marca_id,
    linea_ids: [...slice.linea_ids],
    tipo_ids: [...slice.tipo_ids],
    colores: [...slice.colores],
    genero_codigo: slice.genero_codigo,
    tonos: slice.sin_tono ? [] : [...(slice.tonos ?? [])],
    sin_tono: slice.sin_tono,
    buscar: slice.buscar,
    tipo_grupos: [...(slice.tipo_grupos ?? [])],
    material_familias: [...(slice.material_familias ?? [])],
    color_familias: [...(slice.color_familias ?? [])],
  }
}

export function subscribeSharedCatalogFilters(
  onChange: (slice: SharedCatalogFilterSlice | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (e: StorageEvent) => {
    if (e.key === SHARED_CATALOG_FILTERS_STORAGE_KEY) onChange(readSharedCatalogFilters())
  }
  const onCustom = (e: Event) => {
    const ce = e as CustomEvent<SharedCatalogFilterSlice | null>
    onChange(ce.detail ?? readSharedCatalogFilters())
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener('rimec-shared-filters', onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('rimec-shared-filters', onCustom)
  }
}
