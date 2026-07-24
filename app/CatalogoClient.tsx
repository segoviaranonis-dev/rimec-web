'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, useDeferredValue } from 'react'
import { CatalogoGrid } from './CatalogoGrid'
import { FiltrosCatalogo, type CatalogoFilterState } from './components/FiltrosCatalogo'
import {
  CatalogoFiltrosSidebar,
  CATALOGO_FILTROS_VACIOS,
} from './components/CatalogoFiltrosSidebar'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import type { TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'
import { isTarjetaFusionada } from '@/lib/fusionTarjetasCatalogo'
import { isCatalogoOrigenPe, isCatalogoOrigenTodos, normalizeFilterItems, normalizeOrigenCatalogo } from '@/lib/catalogoFilters'
import { sortTarjetasLineaRef } from '@/lib/catalogoPaginado'
import { esMarcaFantasmaFiltro } from '@/lib/filtros/filtro-tipo-canonico'
import type { FamiliaPilarItem } from '@/lib/pilares/agrupar-etiqueta-pilar'
import { buildFamiliaItems, primeraPalabraPilar } from '@/lib/pilares/agrupar-etiqueta-pilar'
import { readJsonResponse, requestTarjetasPage } from '@/lib/catalogoFetch'
import {
  catalogWarmCacheKey,
  CP_DEFAULT_FILTERS,
  TODOS_DEFAULT_FILTERS,
  ensureDualCatalogWarm,
  ensurePeCatalogWarm,
  ensureTodosCatalogWarm,
  getPageWarmCache,
  getScrollWarmCache,
  isCatalogWarmEnough,
  prefetchScrollPageWhenIdle,
  runWhenIdle,
  storePageWarmCache,
  warmCatalogImages,
} from '@/lib/catalogoPeWarmCache'
import type { ColorEstandar } from '@/lib/pilares/colores-estandar'
import type { PrecioRangoCatalogo } from '@/lib/catalogoPrecioRango'
import { useSesion, type ListaId } from '@/store/sesionVenta'
import { COLORES_ESTANDAR_DEFAULT } from '@/lib/pilares/colores-estandar'
import {
  applySharedSliceToFilters,
  mergeSharedIntoFilters,
  persistSharedCatalogFilters,
  subscribeSharedCatalogFilters,
} from '@/lib/catalogoFiltrosCompartidos'
import { resolveParesPorCaja } from '@/lib/prontaEntregaVenta'
import {
  CatalogAcordeonProvider,
  collectLoteKeysFromGrilla,
} from '@/components/catalog/CatalogAcordeonContext'
import { RimecSincronizandoOverlay } from '@/components/catalog/RimecSincronizandoOverlay'
import { FiltroAplicandoOverlay } from '@/components/catalog/FiltroAplicandoOverlay'
import { hasSidebarFilters } from '@/lib/catalogoFiltrosEntrada'
import {
  areAllSyncStagesWarm,
  runCatalogSyncStages,
  type CatalogSyncProgress,
} from '@/lib/catalogoSyncStages'

type FilterItem = { id: number; label: string }
type GeneroItem = { codigo: string; label: string }
type QuincenaItem = { id: number; label: string }

type Props = {
  initialFilters: CatalogoFilterState
}

function etiquetaCambioFiltro(prev: CatalogoFilterState, next: CatalogoFilterState): string {
  const cambio = (key: keyof CatalogoFilterState) =>
    JSON.stringify(prev[key] ?? null) !== JSON.stringify(next[key] ?? null)
  const cantidad = (value: unknown) =>
    Array.isArray(value) && value.length > 1 ? ` · ${value.length} seleccionados` : ''

  if (cambio('origen_tipo')) {
    const origen = next.origen_tipo === 'PRONTA_ENTREGA'
      ? 'Pronta entrega'
      : next.origen_tipo === 'TODOS' ? 'Todos' : 'Compra previa'
    return `Stock · ${origen}`
  }
  if (cambio('ramo_tipo')) return `Categoría · ${next.ramo_tipo || 'Todas'}`
  if (cambio('deposito_codigo')) return `Depósito · ${next.deposito_codigo || 'Todos'}`
  if (cambio('tipo_grupos')) {
    const nombres = (next.tipo_grupos ?? []).map((x) => ({
      normal: 'Normal',
      carteras: 'Carteras',
      promo: 'Promo',
      liquidacion: 'Liquidación',
    })[x])
    return `Tipo · ${nombres.join(', ') || 'Todos'}`
  }
  if (cambio('marca_ids') || cambio('marca_id')) return `Marca${cantidad(next.marca_ids)}`
  if (cambio('grupo_estilo_ids') || cambio('grupo_estilo_id')) return `Estilo${cantidad(next.grupo_estilo_ids)}`
  if (cambio('genero_codigo')) return `Género · ${next.genero_codigo || 'Todos'}`
  if (cambio('linea_ids')) return `Línea${cantidad(next.linea_ids)}`
  if (cambio('tipo_ids')) return `AB - CR${cantidad(next.tipo_ids)}`
  if (cambio('material_familias')) return `Material${cantidad(next.material_familias)}`
  if (cambio('color_familias') || cambio('colores')) {
    return `Color${cantidad(next.color_familias?.length ? next.color_familias : next.colores)}`
  }
  if (cambio('tonos') || cambio('sin_tono')) return 'Tono'
  if (cambio('precio_min') || cambio('precio_max') || cambio('precio_tope') || cambio('lista_precio_id')) {
    return 'Rango precio'
  }
  if (cambio('dato_duro_cp')) return `Lote CP${cantidad(next.dato_duro_cp)}`
  if (cambio('quincenas')) return `Quincena${cantidad(next.quincenas)}`
  if (cambio('preventas')) return `Preventa${cantidad(next.preventas)}`
  if (cambio('buscar')) return `Búsqueda · ${next.buscar?.trim() || 'limpia'}`
  return 'Filtros del catálogo'
}

function sameArray(a: unknown[], b: unknown[]) {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function filterToSearchParams(filters: CatalogoFilterState) {
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
  if (filters.material_familias?.length) params.set('material_familias', filters.material_familias.join(','))
  if (filters.color_familias?.length) params.set('color_familias', filters.color_familias.join(','))
  if (filters.dato_duro_cp?.length) params.set('dato_duro_cp', filters.dato_duro_cp.join(','))
  if (filters.preventas?.length) params.set('preventas', filters.preventas.join(','))
  if (filters.precio_tope != null) params.set('precio_tope', String(filters.precio_tope))
  if (filters.precio_min != null) params.set('precio_min', String(filters.precio_min))
  if (filters.precio_max != null) params.set('precio_max', String(filters.precio_max))
  if (filters.lista_precio_id != null) params.set('lista_precio_id', String(filters.lista_precio_id))
  return params
}

function filtersMatchDefault(a: CatalogoFilterState, b: CatalogoFilterState) {
  return catalogWarmCacheKey(a) === catalogWarmCacheKey(b)
}

function isTodosDefault(filters: CatalogoFilterState) {
  return filtersMatchDefault(filters, TODOS_DEFAULT_FILTERS)
}

function isCpDefault(filters: CatalogoFilterState) {
  return filtersMatchDefault(filters, CP_DEFAULT_FILTERS)
}

/** Origen/ramo no se diferirán — evita chrome PE con grilla CP (pedido proveedor). */
function filtersConOrigenInmediato(
  deferred: CatalogoFilterState,
  live: CatalogoFilterState,
): CatalogoFilterState {
  return {
    ...deferred,
    origen_tipo: live.origen_tipo,
    ramo_tipo: live.ramo_tipo,
    deposito_codigo: live.deposito_codigo,
    quincenas: live.quincenas,
    preventas: live.preventas,
    dato_duro_cp: live.dato_duro_cp,
  }
}

function origenesEnTarjeta(t: TarjetaGrilla): string[] {
  if (isTarjetaFusionada(t)) {
    return t.lotes.map((l) => normalizeOrigenCatalogo(l.origen_tipo))
  }
  return [normalizeOrigenCatalogo(t.origen_tipo)]
}

/** Rechaza warm cache cruzado CP↔PE (p.ej. quincenas PP bajo Pronta entrega). */
function tarjetasRespetanOrigen(
  tarjetas: TarjetaGrilla[],
  origenRaw: string | undefined,
): boolean {
  const want = normalizeOrigenCatalogo(origenRaw)
  if (want === 'TODOS' || tarjetas.length === 0) return true
  for (const t of tarjetas.slice(0, 16)) {
    const orgs = origenesEnTarjeta(t)
    if (want === 'PRONTA_ENTREGA') {
      if (orgs.some((o) => o !== 'PRONTA_ENTREGA')) return false
    } else if (want === 'TRÁNSITO_PP') {
      if (orgs.some((o) => o !== 'TRÁNSITO_PP')) return false
    }
  }
  return true
}

export function CatalogoClient({ initialFilters }: Props) {
  const [filters, setFilters] = useState<CatalogoFilterState>(() =>
    mergeSharedIntoFilters(initialFilters),
  )
  const [filtroFeedback, setFiltroFeedback] = useState<{ id: number; filtro: string } | null>(null)
  const [, startTransition] = useTransition()
  const deferredFilters = useDeferredValue(filters)
  const filtrosPendientes = deferredFilters !== filters
  const mergedUrlOnce = useRef(false)

  const [filtrosMeta, setFiltrosMeta] = useState<{
    todasLineas: FilterItem[]
    todasMarcas: FilterItem[]
    todosEstilos: FilterItem[]
    todosTipos: FilterItem[]
    todosGeneros: GeneroItem[]
  }>({ todasLineas: [], todasMarcas: [], todosEstilos: [], todosTipos: [], todosGeneros: [] })
  const [materialFamilias, setMaterialFamilias] = useState<FamiliaPilarItem[]>([])
  const [colorFamilias, setColorFamilias] = useState<FamiliaPilarItem[]>([])
  const [tonoCatalog, setTonoCatalog] = useState<ColorEstandar[]>(COLORES_ESTANDAR_DEFAULT)
  const [colores, setColores] = useState<string[]>([])
  const [quincenas, setQuincenas] = useState<QuincenaItem[]>([])
  const [preventasOpciones, setPreventasOpciones] = useState<string[]>([])
  const [paresDatoDuro, setParesDatoDuro] = useState<
    { key: string; quincenaId: number; quincenaLabel: string; preventa: string }[]
  >([])
  const [tonosDisponibles, setTonosDisponibles] = useState<string[]>([])
  const [precioRangoApi, setPrecioRangoApi] = useState<PrecioRangoCatalogo | null>(null)
  const listaPrecioSesion = useSesion(s => s.listaPrecioId)
  const ventaActiva = useSesion(s => s.activa)

  const [productos, setProductos] = useState<TarjetaGrilla[]>([])
  const [rowFrom, setRowFrom] = useState(0)
  const [excludeKeys, setExcludeKeys] = useState<string[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<CatalogSyncProgress | null>(null)
  const [syncRunning, setSyncRunning] = useState(false)
  const [syncOverlayVisible, setSyncOverlayVisible] = useState(false)
  const [syncStartedAt, setSyncStartedAt] = useState<number | null>(null)
  const syncStartedRef = useRef(false)

  // Warm secuencial CP → PE → Confecciones con overlay «RIMEC sincronizando».
  useEffect(() => {
    if (syncStartedRef.current) return
    syncStartedRef.current = true

    const merged = mergeSharedIntoFilters(initialFilters)
    if (hasSidebarFilters(merged) || areAllSyncStagesWarm()) {
      ensureDualCatalogWarm(merged)
      return
    }

    setSyncOverlayVisible(true)
    setSyncStartedAt(Date.now())
    setSyncRunning(true)
    void runCatalogSyncStages((p) => setSyncProgress(p))
      .finally(() => {
        setSyncRunning(false)
        setSyncOverlayVisible(false)
        setSyncProgress(null)
        ensureDualCatalogWarm(merged)
      })
  }, [initialFilters])

  useEffect(() => {
    const merged = mergeSharedIntoFilters(initialFilters)
    setFilters(merged)
    persistSharedCatalogFilters(merged)
  }, [
    initialFilters.grupo_estilo_id,
    initialFilters.marca_id,
    initialFilters.grupo_estilo_ids?.join(',') ?? '',
    initialFilters.marca_ids?.join(',') ?? '',
    initialFilters.linea_ids.join(','),
    initialFilters.tipo_ids.join(','),
    initialFilters.colores.join(','),
    initialFilters.quincenas.join(','),
    initialFilters.origen_tipo ?? '',
    initialFilters.ramo_tipo ?? '',
    initialFilters.deposito_codigo ?? '',
    initialFilters.genero_codigo ?? '',
    initialFilters.tonos?.join(',') ?? '',
    initialFilters.sin_tono ? '1' : '',
    initialFilters.buscar ?? '',
    initialFilters.tipo_grupos?.join(',') ?? '',
    initialFilters.material_familias?.join(',') ?? '',
    initialFilters.color_familias?.join(',') ?? '',
  ])

  // Sincronizar URL si sessionStorage aportó filtros que la URL no trae (primera carga).
  useEffect(() => {
    if (mergedUrlOnce.current) return
    mergedUrlOnce.current = true
    const merged = mergeSharedIntoFilters(initialFilters)
    const params = filterToSearchParams(merged)
    const urlParams = filterToSearchParams(initialFilters)
    if (params.toString() !== urlParams.toString()) {
      const url = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState(null, '', url)
    }
  }, [initialFilters])

  // Cross-tab: otro tab cambió filtros compartidos → reflejar sin perder origen PE/CP.
  useEffect(() => {
    return subscribeSharedCatalogFilters((slice) => {
      setFilters((prev) => applySharedSliceToFilters(prev, slice))
    })
  }, [])

  // Filtros sidebar — en CP default diferido (idle) para priorizar tarjetas <1s
  useEffect(() => {
    let cancelled = false

    async function loadFiltros(attempt = 0) {
      try {
        const params = filterToSearchParams(filters)
        if (ventaActiva) params.set('lista_precio_id', String(listaPrecioSesion))
        const qs = params.toString()
        const r = await fetch(`/api/catalogo/filtros${qs ? `?${qs}` : ''}`, { credentials: 'same-origin' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await readJsonResponse<{
          error?: string
          filtros?: typeof filtrosMeta
          colores?: string[]
          quincenas?: QuincenaItem[]
          preventas?: string[]
          paresDatoDuro?: typeof paresDatoDuro
          tonosDisponibles?: string[]
          materialFamilias?: FamiliaPilarItem[]
          colorFamilias?: FamiliaPilarItem[]
          precioRango?: PrecioRangoCatalogo | null
        }>(r)
        if (cancelled || json.error) return
        const meta = json.filtros ?? { todasLineas: [], todasMarcas: [], todosEstilos: [], todosTipos: [], todosGeneros: [] }
        let nextMeta = {
          todasLineas: normalizeFilterItems(meta.todasLineas ?? []),
          todasMarcas: normalizeFilterItems(
            (meta.todasMarcas ?? []).filter((m) => !esMarcaFantasmaFiltro(m.label)),
          ),
          todosEstilos: normalizeFilterItems(meta.todosEstilos ?? []),
          todosTipos: normalizeFilterItems(meta.todosTipos ?? []),
          todosGeneros: meta.todosGeneros ?? [],
        }
        if (!nextMeta.todasMarcas.length) {
          try {
            const hr = await fetch('/api/catalogo/header-filtros', { credentials: 'same-origin' })
            if (hr.ok) {
              const hj = await readJsonResponse<{
                todasMarcas?: FilterItem[]
                todasLineas?: FilterItem[]
                todosEstilos?: FilterItem[]
                todosTipos?: FilterItem[]
              }>(hr)
              if ((hj.todasMarcas?.length ?? 0) > 0) {
                nextMeta = {
                  ...nextMeta,
                  todasMarcas: normalizeFilterItems(hj.todasMarcas ?? []),
                  todasLineas: nextMeta.todasLineas.length
                    ? nextMeta.todasLineas
                    : normalizeFilterItems(hj.todasLineas ?? []),
                  todosEstilos: nextMeta.todosEstilos.length
                    ? nextMeta.todosEstilos
                    : normalizeFilterItems(hj.todosEstilos ?? []),
                  todosTipos: nextMeta.todosTipos.length
                    ? nextMeta.todosTipos
                    : normalizeFilterItems(hj.todosTipos ?? []),
                }
              }
            }
          } catch {
            /* fallback header opcional */
          }
        }
        setFiltrosMeta(nextMeta)
        setMaterialFamilias(json.materialFamilias ?? [])
        setColorFamilias(json.colorFamilias ?? [])
        setColores(json.colores ?? [])
        setQuincenas(json.quincenas ?? [])
        setPreventasOpciones(json.preventas ?? [])
        setParesDatoDuro(json.paresDatoDuro ?? [])
        setTonosDisponibles(json.tonosDisponibles ?? [])
        if (json.precioRango && json.precioRango.min < json.precioRango.max) {
          setPrecioRangoApi(json.precioRango)
        }

        const lineaIdsValid = new Set((meta.todasLineas as FilterItem[]).map(l => l.id))
        // No borrar líneas si meta vino vacía (RPC/legacy falló) — evita “filtros que no pegan”.
        if (lineaIdsValid.size > 0) {
          const invalidLineas = filters.linea_ids.filter(id => !lineaIdsValid.has(id))
          if (invalidLineas.length) {
            setFilters(prev => ({
              ...prev,
              linea_ids: prev.linea_ids.filter(id => lineaIdsValid.has(id)),
            }))
          }
        }
      } catch {
        if (!cancelled && attempt < 2) {
          setTimeout(() => loadFiltros(attempt + 1), 800 * (attempt + 1))
        }
      }
    }

    if (isCpDefault(filters) && !isCatalogoOrigenTodos(filters)) {
      runWhenIdle(() => {
        if (!cancelled) void loadFiltros()
      })
    } else {
      void loadFiltros()
    }

    return () => { cancelled = true }
  }, [
    filters.origen_tipo ?? '',
    filters.ramo_tipo ?? '',
    filters.deposito_codigo ?? '',
    filters.marca_id ?? '',
    filters.grupo_estilo_id ?? '',
    filters.marca_ids?.join(',') ?? '',
    filters.grupo_estilo_ids?.join(',') ?? '',
    filters.genero_codigo ?? '',
    filters.linea_ids.join(','),
    filters.tipo_ids.join(','),
    filters.colores.join(','),
    filters.quincenas.join(','),
    filters.dato_duro_cp?.join(',') ?? '',
    filters.preventas?.join(',') ?? '',
    filters.tonos?.join(',') ?? '',
    filters.sin_tono ? '1' : '',
    filters.buscar ?? '',
    filters.cadena_comercial ?? '',
    filters.tipo_grupos?.join(',') ?? '',
    filters.material_familias?.join(',') ?? '',
    filters.color_familias?.join(',') ?? '',
    ventaActiva ? '1' : '0',
    String(listaPrecioSesion),
  ])

  useEffect(() => {
    let cancelled = false
    const loadTonos = () => {
      fetch('/api/catalogo/tonos', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(json => {
          if (!cancelled && json.catalogo?.length) setTonoCatalog(json.catalogo)
        })
        .catch(() => {})
    }
    if (isCpDefault(filters) && !isCatalogoOrigenTodos(filters)) {
      runWhenIdle(loadTonos)
    } else {
      loadTonos()
    }
    return () => { cancelled = true }
  }, [])

  const tonoCatalogFiltrado = useMemo(() => {
    if (!tonosDisponibles.length) return tonoCatalog
    const set = new Set(tonosDisponibles.map(t => t.toLowerCase()))
    const filtrado = tonoCatalog.filter(c => set.has(c.etiqueta.toLowerCase()))
    return filtrado.length ? filtrado : tonoCatalog
  }, [tonoCatalog, tonosDisponibles.join('|')])

  const filtersQueryString = useCallback(
    (f: CatalogoFilterState) => filterToSearchParams(f).toString(),
    [],
  )

  const fetchPage = useCallback(
    async (opts: { fromRow: number; exclude: string[]; currentFilters: CatalogoFilterState; limit?: number }) => {
      const qs = filtersQueryString(opts.currentFilters)
      const json = await requestTarjetasPage({
        filtersQuery: qs,
        filters: opts.currentFilters as unknown as Record<string, unknown>,
        fromRow: opts.fromRow,
        limit: opts.limit ?? 30,
        exclude: opts.exclude,
      })
      return json as {
        tarjetas: TarjetaGrilla[]
        nextRowFrom: number
        hasMore: boolean
        excludeCardKeys: string[]
      }
    },
    [filtersQueryString],
  )

  useEffect(() => {
    let cancelled = false
    // Origen/ramo/depósito/quincenas = live (no deferred) — chrome PE ≠ grilla CP
    const activeFilters = filtersConOrigenInmediato(deferredFilters, filters)
    const esPe = isCatalogoOrigenPe(activeFilters)
    const esTodos = isCatalogoOrigenTodos(activeFilters)
    const cacheKey = catalogWarmCacheKey(activeFilters)
    const cachedRaw = getPageWarmCache(cacheKey)
    const cached =
      cachedRaw && tarjetasRespetanOrigen(cachedRaw.tarjetas, activeFilters.origen_tipo)
        ? cachedRaw
        : null
    const cacheReady = isCatalogWarmEnough(cached)

    const hasCached = (cached?.tarjetas.length ?? 0) > 0

    if (hasCached && cached) {
      setProductos(sortTarjetasLineaRef(cached.tarjetas))
      setRowFrom(cached.nextRowFrom)
      setExcludeKeys(cached.excludeCardKeys)
      setHasMore(cached.hasMore)
      if (cached.filtrosMeta) {
        setFiltrosMeta({
          todasLineas: normalizeFilterItems(cached.filtrosMeta.todasLineas ?? []),
          todasMarcas: normalizeFilterItems(cached.filtrosMeta.todasMarcas ?? []),
          todosEstilos: normalizeFilterItems(cached.filtrosMeta.todosEstilos ?? []),
          todosTipos: normalizeFilterItems(cached.filtrosMeta.todosTipos ?? []),
          todosGeneros: cached.filtrosMeta.todosGeneros ?? [],
        })
      }
      if (cached.colores) setColores(cached.colores)
      if (cached.quincenas) setQuincenas(cached.quincenas)
      setError(null)
      warmCatalogImages(cached.tarjetas)
    } else if (!cached) {
      setProductos([])
      setRowFrom(0)
      setExcludeKeys([])
      setHasMore(true)
    }

    const origenPendiente =
      (filters.origen_tipo ?? '') !== (deferredFilters.origen_tipo ?? '') ||
      (filters.ramo_tipo ?? '') !== (deferredFilters.ramo_tipo ?? '')
    setLoading(!hasCached || filtrosPendientes || origenPendiente)
    setError(null)

    if (cacheReady && !hasSidebarFilters(activeFilters)) {
      ensureDualCatalogWarm(activeFilters)
      return () => { cancelled = true }
    }

    if (esTodos) ensureTodosCatalogWarm()
    else if (esPe) ensurePeCatalogWarm()

    fetchPage({ fromRow: 0, exclude: [], currentFilters: activeFilters, limit: 30 })
      .then(json => {
        if (cancelled) return
        if (!tarjetasRespetanOrigen(json.tarjetas ?? [], activeFilters.origen_tipo)) {
          setError('Origen de stock inconsistente — reintentá Pronta entrega / Compra previa')
          setProductos([])
          return
        }
        setProductos(sortTarjetasLineaRef(json.tarjetas ?? []))
        setRowFrom(json.nextRowFrom ?? 0)
        setExcludeKeys(json.excludeCardKeys ?? [])
        setHasMore(Boolean(json.hasMore))
        warmCatalogImages(json.tarjetas ?? [])
        if (isTodosDefault(activeFilters) || isCpDefault(activeFilters) || esPe) {
          storePageWarmCache(cacheKey, {
            tarjetas: json.tarjetas ?? [],
            nextRowFrom: json.nextRowFrom ?? 0,
            hasMore: Boolean(json.hasMore),
            excludeCardKeys: json.excludeCardKeys ?? [],
            fetchedAt: Date.now(),
          })
        }
      })
      .catch(err => {
        if (!cancelled && !cacheReady) {
          setError(err instanceof Error ? err.message : 'Error cargando catálogo')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    ensureDualCatalogWarm(activeFilters)

    return () => { cancelled = true }
  }, [
    deferredFilters.grupo_estilo_id,
    deferredFilters.marca_id,
    deferredFilters.grupo_estilo_ids?.join(',') ?? '',
    deferredFilters.marca_ids?.join(',') ?? '',
    deferredFilters.linea_ids.join(','),
    deferredFilters.tipo_ids.join(','),
    deferredFilters.colores.join(','),
    filters.quincenas.join(','),
    filters.dato_duro_cp?.join(',') ?? '',
    filters.preventas?.join(',') ?? '',
    filters.origen_tipo ?? '',
    filters.ramo_tipo ?? '',
    filters.deposito_codigo ?? '',
    deferredFilters.genero_codigo ?? '',
    deferredFilters.tonos?.join(',') ?? '',
    deferredFilters.sin_tono ? '1' : '',
    deferredFilters.buscar ?? '',
    deferredFilters.cadena_comercial ?? '',
    deferredFilters.tipo_grupos?.join(',') ?? '',
    deferredFilters.material_familias?.join(',') ?? '',
    deferredFilters.color_familias?.join(',') ?? '',
    fetchPage,
    filtrosPendientes,
  ])

  // Mantener dual warm + scroll page 2 en idle
  useEffect(() => {
    if (loading || productos.length === 0 || !hasMore) return
    ensureDualCatalogWarm(filters)
    prefetchScrollPageWhenIdle(filters, rowFrom, excludeKeys)
  }, [loading, productos.length, hasMore, rowFrom, excludeKeys.join(','), filters.origen_tipo ?? ''])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return

    const scrollHit = getScrollWarmCache(filters, rowFrom, excludeKeys)
    if (scrollHit) {
      setProductos(prev => sortTarjetasLineaRef([...prev, ...scrollHit.tarjetas]))
      setRowFrom(scrollHit.nextRowFrom)
      setExcludeKeys(scrollHit.excludeCardKeys)
      setHasMore(scrollHit.hasMore)
      warmCatalogImages(scrollHit.tarjetas)
      prefetchScrollPageWhenIdle(filters, scrollHit.nextRowFrom, scrollHit.excludeCardKeys)
      return
    }

    setLoadingMore(true)
    try {
      const json = await fetchPage({
        fromRow: rowFrom,
        exclude: excludeKeys,
        currentFilters: filters,
        limit: 30,
      })
      setProductos(prev => sortTarjetasLineaRef([...prev, ...(json.tarjetas ?? [])]))
      setRowFrom(json.nextRowFrom ?? rowFrom)
      setExcludeKeys(json.excludeCardKeys ?? excludeKeys)
      setHasMore(Boolean(json.hasMore))
      setError(null)
      warmCatalogImages(json.tarjetas ?? [])
      prefetchScrollPageWhenIdle(filters, json.nextRowFrom ?? rowFrom, json.excludeCardKeys ?? excludeKeys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando más modelos')
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, rowFrom, excludeKeys, filters, fetchPage])

  const updateFilters = (next: CatalogoFilterState) => {
    setFiltroFeedback({
      id: Date.now(),
      filtro: etiquetaCambioFiltro(filters, next),
    })
    persistSharedCatalogFilters(next)
    startTransition(() => {
      setFilters(next)
      const params = filterToSearchParams(next)
      const url = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState(null, '', url)
    })
  }

  const cerrarFiltroFeedback = useCallback((eventoId: number) => {
    setFiltroFeedback((actual) => actual?.id === eventoId ? null : actual)
  }, [])

  const showSyncOverlay = syncOverlayVisible && !error

  const pps = useMemo(() => {
    const lotes = productos.flatMap(p => (isTarjetaFusionada(p) ? p.lotes : [p]))
    return Array.from(
      new Map(
        lotes.flatMap(p =>
          p.variantes.map(v => [v.pp_nro, { nro: v.pp_nro }] as const),
        ),
      ).values(),
    ).sort((a, b) => a.nro.localeCompare(b.nro))
  }, [productos])

  const totalPares = useMemo(() => {
    function paresDeLote(p: TarjetaCatalogo) {
      return p.variantes.reduce((vs, v) => {
        const ppc = resolveParesPorCaja({
          pares_por_caja: v.pares_por_caja,
          cantidad_cajas: v.cantidad_cajas,
          saldo_pares: v.saldo_pares,
          origen_tipo: p.origen_tipo,
          det_id: v.det_id,
          pp_id: v.pp_id,
        })
        return vs + Math.max(0, v.cajas_disponibles * ppc)
      }, 0)
    }
    return productos.reduce((s, p) => {
      if (isTarjetaFusionada(p)) {
        return s + p.lotes.reduce((ls, l) => ls + paresDeLote(l), 0)
      }
      return s + paresDeLote(p)
    }, 0)
  }, [productos])

  const isInitial =
    filters.grupo_estilo_id === initialFilters.grupo_estilo_id &&
    filters.marca_id === initialFilters.marca_id &&
    sameArray(filters.grupo_estilo_ids ?? [], initialFilters.grupo_estilo_ids ?? []) &&
    sameArray(filters.marca_ids ?? [], initialFilters.marca_ids ?? []) &&
    sameArray(filters.linea_ids, initialFilters.linea_ids) &&
    sameArray(filters.tipo_ids, initialFilters.tipo_ids) &&
    sameArray(filters.colores, initialFilters.colores) &&
    sameArray(filters.quincenas, initialFilters.quincenas) &&
    (filters.origen_tipo ?? '') === (initialFilters.origen_tipo ?? '') &&
    (filters.ramo_tipo ?? '') === (initialFilters.ramo_tipo ?? '') &&
    (filters.deposito_codigo ?? '') === (initialFilters.deposito_codigo ?? '') &&
    (filters.genero_codigo ?? '') === (initialFilters.genero_codigo ?? '') &&
    sameArray(filters.tonos ?? [], initialFilters.tonos ?? []) &&
    Boolean(filters.sin_tono) === Boolean(initialFilters.sin_tono) &&
    (filters.buscar ?? '') === (initialFilters.buscar ?? '') &&
    (filters.cadena_comercial ?? '') === (initialFilters.cadena_comercial ?? '') &&
    sameArray(filters.tipo_grupos ?? [], initialFilters.tipo_grupos ?? []) &&
    sameArray(filters.material_familias ?? [], initialFilters.material_familias ?? []) &&
    sameArray(filters.color_familias ?? [], initialFilters.color_familias ?? [])

  const materialFamiliasUi = useMemo(() => {
    if (materialFamilias.length) return materialFamilias
    const textos: string[] = []
    for (const p of productos) {
      if (isTarjetaFusionada(p)) {
        const t = primeraPalabraPilar(p.descp_material)
        if (t) textos.push(t)
      } else {
        const t = primeraPalabraPilar(p.descp_material)
        if (t) textos.push(t)
      }
    }
    return buildFamiliaItems(textos)
  }, [materialFamilias, productos])

  const colorFamiliasUi = useMemo(() => {
    if (colorFamilias.length) return colorFamilias
    const textos: string[] = []
    for (const p of productos) {
      const lotes = isTarjetaFusionada(p) ? p.lotes : [p]
      for (const l of lotes) {
        for (const v of l.variantes) {
          const t = primeraPalabraPilar(v.descp_color)
          if (t) textos.push(t)
        }
      }
    }
    return buildFamiliaItems(textos)
  }, [colorFamilias, productos])

  const esProntaEntrega = isCatalogoOrigenPe(filters)

  const allLoteKeys = useMemo(() => collectLoteKeysFromGrilla(productos), [productos])

  return (
    <CatalogAcordeonProvider allKeys={allLoteKeys}>
    <>
      {filtroFeedback && (
        <FiltroAplicandoOverlay
          key={filtroFeedback.id}
          eventoId={filtroFeedback.id}
          filtro={filtroFeedback.filtro}
          onDone={cerrarFiltroFeedback}
        />
      )}
      {showSyncOverlay && (
        <RimecSincronizandoOverlay
          progress={syncProgress}
          startedAt={syncStartedAt}
          waitingGrid={!syncRunning && loading && productos.length === 0}
        />
      )}
      {esProntaEntrega && (
        <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-900">
          📦 Catálogo · Pronta entrega (local)
        </div>
      )}
      <FiltrosCatalogo
        estilos={filtrosMeta.todosEstilos}
        marcas={filtrosMeta.todasMarcas}
        lineas={filtrosMeta.todasLineas}
        tipos={filtrosMeta.todosTipos}
        generos={filtrosMeta.todosGeneros}
        tonoCatalog={tonoCatalogFiltrado}
        colores={colores}
        quincenas={quincenas}
        materialFamilias={materialFamiliasUi}
        colorFamilias={colorFamiliasUi}
        totalModelos={productos.length}
        totalPares={totalPares}
        rangoPrecioCatalogo={precioRangoApi}
        value={filters}
        onChange={updateFilters}
        variant="cabecera"
      />

      <div className="mt-3 flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:gap-2">
        <div className="w-full shrink-0 pl-1 pr-1 lg:sticky lg:top-2 lg:w-auto lg:max-w-[32rem] lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto lg:pl-1 lg:pr-0">
          <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm lg:hidden" open>
            <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-rimec-azul [&::-webkit-details-marker]:hidden">
              ▾ Filtros · dimensiones + molécula
            </summary>
            <div className="border-t border-slate-100 p-2">
              <CatalogoFiltrosSidebar
                filtros={filters}
                onChange={updateFilters}
                opciones={{
                  estilos: filtrosMeta.todosEstilos,
                  marcas: filtrosMeta.todasMarcas,
                  lineas: filtrosMeta.todasLineas,
                  tipos: filtrosMeta.todosTipos,
                  generos: filtrosMeta.todosGeneros,
                  materialFamilias: materialFamiliasUi,
                  colorFamilias: colorFamiliasUi,
                  quincenas,
                  paresDatoDuro,
                }}
                emptyFilters={CATALOGO_FILTROS_VACIOS}
              />
            </div>
          </details>
          <div className="hidden lg:block">
            <CatalogoFiltrosSidebar
              filtros={filters}
              onChange={updateFilters}
              opciones={{
                estilos: filtrosMeta.todosEstilos,
                marcas: filtrosMeta.todasMarcas,
                lineas: filtrosMeta.todasLineas,
                tipos: filtrosMeta.todosTipos,
                generos: filtrosMeta.todosGeneros,
                materialFamilias: materialFamiliasUi,
                colorFamilias: colorFamiliasUi,
                quincenas,
                paresDatoDuro,
              }}
              emptyFilters={CATALOGO_FILTROS_VACIOS}
            />
          </div>
        </div>

        <div className="relative min-h-[12rem] min-w-0 flex-1 pr-2 sm:pr-3">
      {loading && productos.length === 0 && !showSyncOverlay && (
        <div className="mb-6 flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => updateFilters(filters)}
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && productos.length === 0 && (
        <div className="mb-6 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <span className="mb-4 text-5xl" aria-hidden>📦</span>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Catálogo sin existencias por el momento</h2>
          <p className="mb-6 max-w-md text-sm text-slate-500">
            {esProntaEntrega && (filters.ramo_tipo === 'CALZADO')
              ? 'El stock PE cargado es casi todo confección (material 638). Probá el filtro 👕 Confecciones o quitá categoría.'
              : 'No hay artículos disponibles con los filtros aplicados. Probá quitar filtros o reintentá la carga.'}
          </p>
          <button
            type="button"
            onClick={() => updateFilters({ ...CATALOGO_FILTROS_VACIOS })}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && !loading && productos.length === 0 && isInitial && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold mb-1">Catálogo vacío — diagnóstico rápido (DEV)</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tarjetas cargadas: <strong>{productos.length}</strong></li>
            <li>Quincenas en BD: <strong>{quincenas.length}</strong></li>
            <li>Filtros estrechos activos: <strong>{hasSidebarFilters(filters) ? 'SÍ — limpiar' : 'no'}</strong></li>
            <li>App catálogo: <strong>http://localhost:3001</strong></li>
          </ul>
        </div>
      )}

      {productos.length > 0 && (
        <CatalogoGrid
          productos={productos}
          pps={pps}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}
        </div>
      </div>
    </>
    </CatalogAcordeonProvider>
  )
}
