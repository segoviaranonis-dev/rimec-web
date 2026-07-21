/**
 * Warm cache catálogo — CP + PE siempre calientes (≥30 tarjetas).
 * Característica producto: CHUSAR_DUAL_CACHE_CATALOGO_INSTANTANEO.md
 */
import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import type { TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'
import { isTarjetaFusionada } from '@/lib/fusionTarjetasCatalogo'
import { mergeSharedIntoFilters } from '@/lib/catalogoFiltrosCompartidos'
import { preloadImageDecoded } from '@/lib/image-decode-cache'
import { requestTarjetasPage } from '@/lib/catalogoFetch'

export const CARD_PAGE_LIMIT = 30
/** Mínimo de tarjetas en cache para cambio CP↔PE instantáneo (Director · 2026-07-13). */
export const MIN_WARM_CARDS = CARD_PAGE_LIMIT

export type WarmFiltrosMeta = {
  todasLineas: { id: number; label: string }[]
  todasMarcas: { id: number; label: string }[]
  todosEstilos: { id: number; label: string }[]
  todosTipos: { id: number; label: string }[]
  todosGeneros: { codigo: string; label: string }[]
}

export type PageWarmPayload = {
  tarjetas: TarjetaGrilla[]
  nextRowFrom: number
  hasMore: boolean
  excludeCardKeys: string[]
  filtrosMeta?: WarmFiltrosMeta
  colores?: string[]
  quincenas?: { id: number; label: string }[]
  fetchedAt: number
}

/** Compra previa — cache warm legacy (origen vacío = CP). */
export const CP_DEFAULT_FILTERS: CatalogoFilterState = {
  grupo_estilo_id: '',
  marca_id: '',
  grupo_estilo_ids: [],
  marca_ids: [],
  linea_ids: [],
  tipo_ids: [],
  colores: [],
  quincenas: [],
  origen_tipo: '',
  ramo_tipo: '',
  deposito_codigo: '',
  genero_codigo: '',
  tonos: [],
  sin_tono: false,
  buscar: '',
  tipo_grupos: [],
  material_familias: [],
  color_familias: [],
}

/** Modo Todos — CP+PE fusionados por SKU (default catálogo · 2026-07-13). */
export const TODOS_DEFAULT_FILTERS: CatalogoFilterState = {
  ...CP_DEFAULT_FILTERS,
  origen_tipo: 'TODOS',
  ramo_tipo: 'CALZADO',
}

/** Compra previa explícita (pill CP). */
export const CP_SOLO_FILTERS: CatalogoFilterState = {
  ...CP_DEFAULT_FILTERS,
  origen_tipo: 'CP',
}

/** Pronta entrega — calzado preestablecido al abrir pill PE. */
export const PE_DEFAULT_FILTERS: CatalogoFilterState = {
  ...CP_DEFAULT_FILTERS,
  origen_tipo: 'PRONTA_ENTREGA',
  ramo_tipo: 'CALZADO',
}

const CACHE_TTL_MS = 15 * 60 * 1000

const pageCache = new Map<string, PageWarmPayload>()
const scrollCache = new Map<string, PageWarmPayload>()
let cpInflight: Promise<void> | null = null
let peInflight: Promise<void> | null = null
const scrollInflight = new Set<string>()

export function runWhenIdle(fn: () => void, timeoutMs = 800): void {
  if (typeof window === 'undefined') return
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  if (ric) {
    ric(() => fn(), { timeout: timeoutMs })
  } else {
    setTimeout(fn, 80)
  }
}

function filtersQueryString(filters: CatalogoFilterState) {
  const params = new URLSearchParams()
  if (filters.grupo_estilo_id) params.set('grupo_estilo_id', filters.grupo_estilo_id)
  if (filters.marca_id) params.set('marca_id', filters.marca_id)
  if (filters.grupo_estilo_ids?.length) params.set('grupo_estilo_ids', filters.grupo_estilo_ids.join(','))
  if (filters.marca_ids?.length) params.set('marca_ids', filters.marca_ids.join(','))
  if (filters.linea_ids.length) params.set('linea_ids', filters.linea_ids.join(','))
  if (filters.tipo_ids.length) params.set('tipo_ids', filters.tipo_ids.join(','))
  if (filters.colores.length) params.set('colores', filters.colores.join(','))
  if (filters.quincenas.length) params.set('quincenas', filters.quincenas.join(','))
  if (filters.origen_tipo) params.set('origen_tipo', filters.origen_tipo)
  if (filters.ramo_tipo) params.set('ramo_tipo', filters.ramo_tipo)
  if (filters.deposito_codigo) params.set('deposito_codigo', filters.deposito_codigo)
  if (filters.genero_codigo) params.set('genero_codigo', filters.genero_codigo)
  if (filters.sin_tono) params.set('sin_tono', '1')
  else if (filters.tonos?.length) params.set('tonos', filters.tonos.join(','))
  if (filters.buscar?.trim()) params.set('buscar', filters.buscar.trim())
  if (filters.cadena_comercial?.trim()) params.set('cadena_comercial', filters.cadena_comercial.trim())
  if (filters.tipo_grupos?.length) params.set('tipo_grupos', filters.tipo_grupos.join(','))
  if (filters.material_familias?.length) {
    params.set('material_familias', filters.material_familias.join(','))
  }
  if (filters.color_familias?.length) {
    params.set('color_familias', filters.color_familias.join(','))
  }
  if (filters.dato_duro_cp?.length) {
    params.set('dato_duro_cp', filters.dato_duro_cp.join(','))
  }
  if (filters.preventas?.length) {
    params.set('preventas', filters.preventas.join(','))
  }
  return params.toString()
}

export function catalogWarmCacheKey(filters: CatalogoFilterState): string {
  return filtersQueryString(filters)
}

/** @deprecated alias PE */
export const peWarmCacheKey = catalogWarmCacheKey

function isFresh(hit: PageWarmPayload | undefined): hit is PageWarmPayload {
  if (!hit) return false
  if (Date.now() - hit.fetchedAt > CACHE_TTL_MS) return false
  return true
}

/** Cache lista para cambio de pestaña instantáneo. */
export function isCatalogWarmEnough(hit: PageWarmPayload | null | undefined): boolean {
  if (!hit || !isFresh(hit)) return false
  return hit.tarjetas.length >= MIN_WARM_CARDS
}

export function getPageWarmCache(key: string): PageWarmPayload | null {
  const hit = pageCache.get(key)
  if (!isFresh(hit)) {
    if (hit) pageCache.delete(key)
    return null
  }
  return hit
}

/** @deprecated alias PE */
export function getPeWarmCache(key: string): PageWarmPayload | null {
  return getPageWarmCache(key)
}

function scrollCacheKey(filters: CatalogoFilterState, rowFrom: number, exclude: string[]) {
  return `${catalogWarmCacheKey(filters)}|${rowFrom}|${exclude.join(',')}`
}

export function getScrollWarmCache(
  filters: CatalogoFilterState,
  rowFrom: number,
  exclude: string[],
): PageWarmPayload | null {
  const hit = scrollCache.get(scrollCacheKey(filters, rowFrom, exclude))
  if (!isFresh(hit)) {
    if (hit) scrollCache.delete(scrollCacheKey(filters, rowFrom, exclude))
    return null
  }
  return hit
}

export function warmCatalogImages(tarjetas: TarjetaGrilla[], maxCards = CARD_PAGE_LIMIT) {
  let n = 0
  for (const card of tarjetas) {
    if (n >= maxCards) break
    const lotes = isTarjetaFusionada(card) ? card.lotes : [card]
    for (const lote of lotes) {
      const v = lote.variantes[0]
      if (!v) continue
      const url = v.imagen_url_thumb ?? v.imagen_url_flat ?? v.imagen_url
      if (url) void preloadImageDecoded(url)
      n++
      if (n >= maxCards) break
    }
  }
}

async function fetchTarjetasPageClient(
  filters: CatalogoFilterState,
  fromRow: number,
  exclude: string[],
): Promise<PageWarmPayload | null> {
  const qs = filtersQueryString(filters)

  try {
    const res = await requestTarjetasPage({
      filtersQuery: qs,
      filters: filters as unknown as Record<string, unknown>,
      fromRow,
      limit: CARD_PAGE_LIMIT,
      exclude,
    })
    return {
      tarjetas: (res.tarjetas ?? []) as TarjetaGrilla[],
      nextRowFrom: res.nextRowFrom ?? 0,
      hasMore: Boolean(res.hasMore),
      excludeCardKeys: res.excludeCardKeys ?? [],
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}

export function storePageWarmCache(key: string, payload: PageWarmPayload) {
  pageCache.set(key, payload)
  warmCatalogImages(payload.tarjetas)
}

export async function prefetchCatalogPage(
  filters: CatalogoFilterState,
  opts?: { withFiltros?: boolean; force?: boolean },
): Promise<void> {
  const key = catalogWarmCacheKey(filters)
  if (!opts?.force && isCatalogWarmEnough(getPageWarmCache(key))) return

  const withFiltros = opts?.withFiltros ?? false
  const qs = filtersQueryString(filters)

  let rowFrom = 0
  let exclude: string[] = []
  let tarjetas: TarjetaGrilla[] = []
  let hasMore = true
  let attempts = 0
  const MAX_WARM_ATTEMPTS = 8

  while (tarjetas.length < MIN_WARM_CARDS && hasMore && attempts < MAX_WARM_ATTEMPTS) {
    attempts++
    const chunk = await fetchTarjetasPageClient(filters, rowFrom, exclude)
    if (!chunk?.tarjetas.length) break

    for (const card of chunk.tarjetas) {
      if (tarjetas.length >= MIN_WARM_CARDS) break
      tarjetas.push(card)
    }

    rowFrom = chunk.nextRowFrom
    exclude = chunk.excludeCardKeys
    hasMore = chunk.hasMore
  }

  if (!tarjetas.length) return

  const payload: PageWarmPayload = {
    tarjetas,
    nextRowFrom: rowFrom,
    hasMore,
    excludeCardKeys: exclude,
    fetchedAt: Date.now(),
  }

  if (withFiltros) {
    const filtrosRes = await fetch(`/api/catalogo/filtros?${qs}`, { credentials: 'same-origin' })
    if (filtrosRes.ok) {
      const filtrosJson = await filtrosRes.json()
      payload.filtrosMeta = filtrosJson.filtros
      payload.colores = filtrosJson.colores ?? []
      payload.quincenas = filtrosJson.quincenas ?? []
    }
  }

  storePageWarmCache(key, payload)
}

let todosInflight: Promise<void> | null = null

/** Todos fusionado ≥30 modelos SKU — prioridad al abrir catálogo. */
export function ensureTodosCatalogWarm(): void {
  if (typeof window === 'undefined') return
  const f = effectiveTodosWarmFilters()
  const key = catalogWarmCacheKey(f)
  if (isCatalogWarmEnough(getPageWarmCache(key)) || todosInflight) return
  todosInflight = prefetchCatalogPage(f, { withFiltros: true })
    .catch(() => undefined)
    .finally(() => { todosInflight = null })
}

/** PE calzado ≥30 tarjetas — prioridad máxima en toda la sesión. */
export function ensurePeCatalogWarm(): void {
  if (typeof window === 'undefined') return
  const peFilters = effectivePeWarmFilters()
  const peKey = catalogWarmCacheKey(peFilters)
  if (isCatalogWarmEnough(getPageWarmCache(peKey)) || peInflight) return
  peInflight = prefetchCatalogPage(peFilters, { withFiltros: true })
    .catch(() => undefined)
    .finally(() => { peInflight = null })
}

/** Todos + filtros compartidos sessionStorage. */
export function effectiveTodosWarmFilters(): CatalogoFilterState {
  return mergeSharedIntoFilters(TODOS_DEFAULT_FILTERS)
}

/** CP default + filtros compartidos sessionStorage (marca, línea, etc.). */
export function effectiveCpWarmFilters(): CatalogoFilterState {
  return mergeSharedIntoFilters(CP_DEFAULT_FILTERS)
}

/** PE calzado default + mismos filtros compartidos que CP. */
export function effectivePeWarmFilters(): CatalogoFilterState {
  return mergeSharedIntoFilters(PE_DEFAULT_FILTERS)
}

/**
 * Mantiene CP y PE con ≥30 tarjetas en cache — prefetch paralelo, sin espera.
 * Corre en layout global (no solo catálogo) para cambio instantáneo tras estadísticas.
 */
export function ensureDualCatalogWarm(_activeFilters?: CatalogoFilterState): void {
  if (typeof window === 'undefined') return

  // Todos primero — grilla fusionada CP+PE (Director · 2026-07-13)
  ensureTodosCatalogWarm()
  ensurePeCatalogWarm()

  const cpFilters = effectiveCpWarmFilters()
  const cpKey = catalogWarmCacheKey(cpFilters)

  if (!isCatalogWarmEnough(getPageWarmCache(cpKey)) && !cpInflight) {
    cpInflight = prefetchCatalogPage(cpFilters, { withFiltros: false })
      .catch(() => undefined)
      .finally(() => { cpInflight = null })
  }
}

/** @deprecated usar ensureDualCatalogWarm */
export function prefetchPeCatalogWhenIdle(): void {
  ensureDualCatalogWarm(CP_DEFAULT_FILTERS)
}

/** Prefetch página scroll (page 2+) — baja prioridad. */
export async function prefetchScrollPage(
  filters: CatalogoFilterState,
  rowFrom: number,
  exclude: string[],
): Promise<void> {
  if (rowFrom <= 0 && exclude.length === 0) return
  const sk = scrollCacheKey(filters, rowFrom, exclude)
  if (scrollInflight.has(sk) || isFresh(scrollCache.get(sk))) return

  scrollInflight.add(sk)
  try {
    const payload = await fetchTarjetasPageClient(filters, rowFrom, exclude)
    if (payload?.tarjetas.length) {
      scrollCache.set(sk, payload)
      warmCatalogImages(payload.tarjetas)
    }
  } finally {
    scrollInflight.delete(sk)
  }
}

export function prefetchScrollPageWhenIdle(
  filters: CatalogoFilterState,
  rowFrom: number,
  exclude: string[],
): void {
  if (!rowFrom && !exclude.length) return
  runWhenIdle(() => {
    void prefetchScrollPage(filters, rowFrom, exclude)
  })
}

/** @deprecated */
export async function prefetchPeCatalog(filters: CatalogoFilterState = PE_DEFAULT_FILTERS): Promise<void> {
  await prefetchCatalogPage(filters, { withFiltros: true })
}

export type PeWarmPayload = PageWarmPayload
export type PeWarmFiltrosMeta = WarmFiltrosMeta
