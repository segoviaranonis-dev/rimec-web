'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { CatalogoGrid } from './CatalogoGrid'
import { FiltrosCatalogo, type CatalogoFilterState } from './components/FiltrosCatalogo'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'

type FilterItem = { id: number; label: string }
type QuincenaItem = { id: number; label: string }

type Props = {
  initialFilters: CatalogoFilterState
}

function sameArray(a: unknown[], b: unknown[]) {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function filterToSearchParams(filters: CatalogoFilterState) {
  const params = new URLSearchParams()
  if (filters.grupo_estilo_id) params.set('grupo_estilo_id', filters.grupo_estilo_id)
  if (filters.marca_id) params.set('marca_id', filters.marca_id)
  if (filters.linea_ids.length) params.set('linea_ids', filters.linea_ids.join(','))
  if (filters.tipo_ids.length) params.set('tipo_ids', filters.tipo_ids.join(','))
  if (filters.colores.length) params.set('colores', filters.colores.join(','))
  if (filters.quincenas.length) params.set('quincenas', filters.quincenas.join(','))
  return params
}

function filtersQueryString(filters: CatalogoFilterState) {
  return filterToSearchParams(filters).toString()
}

export function CatalogoClient({ initialFilters }: Props) {
  const [filters, setFilters] = useState<CatalogoFilterState>(initialFilters)
  const [, startTransition] = useTransition()

  const [filtrosMeta, setFiltrosMeta] = useState<{
    todasLineas: FilterItem[]
    todasMarcas: FilterItem[]
    todosEstilos: FilterItem[]
    todosTipos: FilterItem[]
  }>({ todasLineas: [], todasMarcas: [], todosEstilos: [], todosTipos: [] })
  const [colores, setColores] = useState<string[]>([])
  const [quincenas, setQuincenas] = useState<QuincenaItem[]>([])

  const [productos, setProductos] = useState<TarjetaCatalogo[]>([])
  const [rowFrom, setRowFrom] = useState(0)
  const [excludeKeys, setExcludeKeys] = useState<string[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFilters(initialFilters)
  }, [
    initialFilters.grupo_estilo_id,
    initialFilters.marca_id,
    initialFilters.linea_ids.join(','),
    initialFilters.tipo_ids.join(','),
    initialFilters.colores.join(','),
    initialFilters.quincenas.join(','),
  ])

  // Filtros sidebar desde BD completa (875 filas post-MIG-138) — no desde tarjetas paginadas
  useEffect(() => {
    let cancelled = false

    async function loadFiltros(attempt = 0) {
      try {
        const r = await fetch('/api/catalogo/filtros', { credentials: 'same-origin' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json()
        if (cancelled || json.error) return
        setFiltrosMeta(json.filtros ?? { todasLineas: [], todasMarcas: [], todosEstilos: [], todosTipos: [] })
        setColores(json.colores ?? [])
        setQuincenas(json.quincenas ?? [])
      } catch {
        if (!cancelled && attempt < 2) {
          setTimeout(() => loadFiltros(attempt + 1), 800 * (attempt + 1))
        }
      }
    }

    loadFiltros()
    return () => { cancelled = true }
  }, [])

  const fetchPage = useCallback(
    async (opts: { fromRow: number; exclude: string[]; currentFilters: CatalogoFilterState }) => {
      const qs = filtersQueryString(opts.currentFilters)
      const params = new URLSearchParams(qs)
      params.set('row_from', String(opts.fromRow))
      params.set('limit', '30')
      if (opts.exclude.length) params.set('exclude', opts.exclude.join(','))

      const res = await fetch(`/api/catalogo/tarjetas?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error cargando catálogo')
      return json as {
        tarjetas: TarjetaCatalogo[]
        nextRowFrom: number
        hasMore: boolean
        excludeCardKeys: string[]
      }
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setProductos([])
    setRowFrom(0)
    setExcludeKeys([])
    setHasMore(true)

    fetchPage({ fromRow: 0, exclude: [], currentFilters: filters })
      .then(json => {
        if (cancelled) return
        setProductos(json.tarjetas ?? [])
        setRowFrom(json.nextRowFrom ?? 0)
        setExcludeKeys(json.excludeCardKeys ?? [])
        setHasMore(Boolean(json.hasMore))
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando catálogo')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [
    filters.grupo_estilo_id,
    filters.marca_id,
    filters.linea_ids.join(','),
    filters.tipo_ids.join(','),
    filters.colores.join(','),
    filters.quincenas.join(','),
    fetchPage,
  ])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const json = await fetchPage({
        fromRow: rowFrom,
        exclude: excludeKeys,
        currentFilters: filters,
      })
      setProductos(prev => [...prev, ...(json.tarjetas ?? [])])
      setRowFrom(json.nextRowFrom ?? rowFrom)
      setExcludeKeys(json.excludeCardKeys ?? excludeKeys)
      setHasMore(Boolean(json.hasMore))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando más modelos')
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, rowFrom, excludeKeys, filters, fetchPage])

  const updateFilters = (next: CatalogoFilterState) => {
    startTransition(() => {
      setFilters(next)
      const params = filterToSearchParams(next)
      const url = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState(null, '', url)
    })
  }

  const pps = useMemo(
    () =>
      Array.from(
        new Map(
          productos.flatMap(p =>
            p.variantes.map(v => [v.pp_nro, { nro: v.pp_nro }] as const),
          ),
        ).values(),
      ).sort((a, b) => a.nro.localeCompare(b.nro)),
    [productos],
  )

  const totalPares = useMemo(
    () =>
      productos.reduce(
        (s, p) =>
          s +
          p.variantes.reduce(
            (vs, v) => vs + v.cajas_disponibles * (v.pares_por_caja || 12),
            0,
          ),
        0,
      ),
    [productos],
  )

  const isInitial =
    filters.grupo_estilo_id === initialFilters.grupo_estilo_id &&
    filters.marca_id === initialFilters.marca_id &&
    sameArray(filters.linea_ids, initialFilters.linea_ids) &&
    sameArray(filters.tipo_ids, initialFilters.tipo_ids) &&
    sameArray(filters.colores, initialFilters.colores) &&
    sameArray(filters.quincenas, initialFilters.quincenas)

  return (
    <>
      <FiltrosCatalogo
        estilos={filtrosMeta.todosEstilos}
        marcas={filtrosMeta.todasMarcas}
        lineas={filtrosMeta.todasLineas}
        tipos={filtrosMeta.todosTipos}
        colores={colores}
        quincenas={quincenas}
        totalModelos={productos.length}
        totalPares={totalPares}
        value={filters}
        onChange={updateFilters}
      />

      {loading && (
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
            No hay artículos disponibles con los filtros aplicados. Probá quitar filtros o reintentá la carga.
          </p>
          <button
            type="button"
            onClick={() =>
              updateFilters({
                grupo_estilo_id: '',
                marca_id: '',
                linea_ids: [],
                tipo_ids: [],
                colores: [],
                quincenas: [],
              })
            }
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
            <li>App catálogo: <strong>http://localhost:3001</strong></li>
          </ul>
        </div>
      )}

      {!loading && productos.length > 0 && (
        <CatalogoGrid
          productos={productos}
          pps={pps}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}
    </>
  )
}
