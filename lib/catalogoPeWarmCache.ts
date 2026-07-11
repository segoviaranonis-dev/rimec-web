/**
 * Warm cache catálogo — CP inmediato · PE en idle · scroll page 2 imperceptible.
 * Protocolo: PROTOCOLO_IMAGENES_CARGA_INTEGRAL_RIMEC_WEB.md
 */
import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { preloadImageDecoded } from '@/lib/image-decode-cache'

export const CARD_PAGE_LIMIT = 30

export type WarmFiltrosMeta = {
  todasLineas: { id: number; label: string }[]
  todasMarcas: { id: number; label: string }[]
  todosEstilos: { id: number; label: string }[]
  todosTipos: { id: number; label: string }[]
  todosGeneros: { codigo: string; label: string }[]
}

export type PageWarmPayload = {
  tarjetas: TarjetaCatalogo[]
  nextRowFrom: number
  hasMore: boolean
  excludeCardKeys: string[]
  filtrosMeta?: WarmFiltrosMeta
  colores?: string[]
  quincenas?: { id: number; label: string }[]
  fetchedAt: number
}

/** Compra previa — entrada default RIMEC Web (sin origen PE). */
export const CP_DEFAULT_FILTERS: CatalogoFilterState = {
  grupo_estilo_id: '',
  marca_id: '',
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
let peInflight: Promise<void> | null = null
const scrollInflight = new Set<string>()

export function runWhenIdle(fn: () => void, timeoutMs = 2800): void {
  if (typeof window === 'undefined') return
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  if (ric) {
    ric(() => fn(), { timeout: timeoutMs })
  } else {
    setTimeout(fn, 150)
  }
}

function filtersQueryString(filters: CatalogoFilterState) {
  const params = new URLSearchParams()
  if (filters.grupo_estilo_id) params.set('grupo_estilo_id', filters.grupo_estilo_id)
  if (filters.marca_id) params.set('marca_id', filters.marca_id)
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

export function warmCatalogImages(tarjetas: TarjetaCatalogo[], maxCards = CARD_PAGE_LIMIT) {
  for (const card of tarjetas.slice(0, maxCards)) {
    const v = card.variantes[0]
    if (!v) continue
    const url = v.imagen_url_thumb ?? v.imagen_url_flat ?? v.imagen_url
    if (url) void preloadImageDecoded(url)
  }
}

async function fetchTarjetasPageClient(
  filters: CatalogoFilterState,
  fromRow: number,
  exclude: string[],
): Promise<PageWarmPayload | null> {
  const qs = filtersQueryString(filters)
  const params = new URLSearchParams(qs)
  params.set('row_from', String(fromRow))
  params.set('limit', String(CARD_PAGE_LIMIT))
  if (exclude.length) params.set('exclude', exclude.join(','))

  const res = await fetch(`/api/catalogo/tarjetas?${params}`, { credentials: 'same-origin' })
  if (!res.ok) return null
  const json = await res.json()
  return {
    tarjetas: json.tarjetas ?? [],
    nextRowFrom: json.nextRowFrom ?? 0,
    hasMore: Boolean(json.hasMore),
    excludeCardKeys: json.excludeCardKeys ?? [],
    fetchedAt: Date.now(),
  }
}

async function fetchFiltrosMeta(filters: CatalogoFilterState): Promise<{
  filtrosMeta: WarmFiltrosMeta
  colores: string[]
  quincenas: { id: number; label: string }[]
} | null> {
  const qs = filtersQueryString(filters)
  const res = await fetch(`/api/catalogo/filtros?${qs}`, { credentials: 'same-origin' })
  if (!res.ok) return null
  const json = await res.json()
  return {
    filtrosMeta: json.filtros ?? {
      todasLineas: [],
      todasMarcas: [],
      todosEstilos: [],
      todosTipos: [],
      todosGeneros: [],
    },
    colores: json.colores ?? [],
    quincenas: json.quincenas ?? [],
  }
}

export function storePageWarmCache(key: string, payload: PageWarmPayload) {
  pageCache.set(key, payload)
  warmCatalogImages(payload.tarjetas)
}

export async function prefetchCatalogPage(
  filters: CatalogoFilterState,
  opts?: { withFiltros?: boolean },
): Promise<void> {
  const key = catalogWarmCacheKey(filters)
  if (getPageWarmCache(key)) return

  const withFiltros = opts?.withFiltros ?? false
  const qs = filtersQueryString(filters)
  const tarjetasParams = new URLSearchParams(qs)
  tarjetasParams.set('row_from', '0')
  tarjetasParams.set('limit', String(CARD_PAGE_LIMIT))

  const [tarjetasRes, filtrosRes] = await Promise.all([
    fetch(`/api/catalogo/tarjetas?${tarjetasParams}`, { credentials: 'same-origin' }),
    withFiltros
      ? fetch(`/api/catalogo/filtros?${qs}`, { credentials: 'same-origin' })
      : Promise.resolve(null),
  ])

  if (!tarjetasRes.ok) return
  const tarjetasJson = await tarjetasRes.json()

  const payload: PageWarmPayload = {
    tarjetas: tarjetasJson.tarjetas ?? [],
    nextRowFrom: tarjetasJson.nextRowFrom ?? 0,
    hasMore: Boolean(tarjetasJson.hasMore),
    excludeCardKeys: tarjetasJson.excludeCardKeys ?? [],
    fetchedAt: Date.now(),
  }

  if (filtrosRes?.ok) {
    const filtrosJson = await filtrosRes.json()
    payload.filtrosMeta = filtrosJson.filtros
    payload.colores = filtrosJson.colores ?? []
    payload.quincenas = filtrosJson.quincenas ?? []
  }

  storePageWarmCache(key, payload)
}

/** Prefetch página scroll (page 2+) — baja prioridad, sin bloquear UI. */
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

/** Tras CP lista — PE calzado en idle (imperceptible). */
export function prefetchPeCatalogWhenIdle(): void {
  if (peInflight) return
  runWhenIdle(() => {
    if (peInflight) return
    peInflight = prefetchCatalogPage(PE_DEFAULT_FILTERS, { withFiltros: true })
      .catch(() => undefined)
      .finally(() => {
        peInflight = null
      })
  })
}

/** @deprecated */
export async function prefetchPeCatalog(filters: CatalogoFilterState = PE_DEFAULT_FILTERS): Promise<void> {
  await prefetchCatalogPage(filters, { withFiltros: true })
}

export type PeWarmPayload = PageWarmPayload
export type PeWarmFiltrosMeta = WarmFiltrosMeta
