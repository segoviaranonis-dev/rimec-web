'use client'

import { useMemo, useState, useTransition, useEffect } from 'react'
import { CatalogoGrid } from './CatalogoGrid'
import { FiltrosCatalogo, type CatalogoFilterState } from './components/FiltrosCatalogo'
import { agruparTarjetasCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { cajasDisponiblesDeFila, paresDisponiblesDeFila } from '@/lib/disponibilidad'
import type { StockRow } from './page'

type FilterItem = { id: number; label: string }
type QuincenaItem = { id: number; label: string }

type Props = {
  rows: StockRow[]
  bucketUrl: string
  filtros: {
    todasLineas: FilterItem[]
    todasMarcas: FilterItem[]
    todosEstilos: FilterItem[]
    todosTipos: FilterItem[]
  }
  colores: string[]
  quincenas: QuincenaItem[]
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

export function CatalogoClient({
  rows: allRows,
  bucketUrl,
  filtros,
  colores,
  quincenas,
  initialFilters,
}: Props) {
  const [filters, setFilters] = useState<CatalogoFilterState>(initialFilters)
  const [, startTransition] = useTransition()

  // Sincronizar estado local con initialFilters cuando cambia la navegación
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

  const updateFilters = (next: CatalogoFilterState) => {
    startTransition(() => {
      setFilters(next)
      const params = filterToSearchParams(next)
      const url = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState(null, '', url)
    })
  }

  const rows = useMemo(() => {
    let filtered = allRows
    if (filters.grupo_estilo_id) {
      filtered = filtered.filter(r => r.grupo_estilo_id === Number(filters.grupo_estilo_id))
    }
    if (filters.marca_id) {
      filtered = filtered.filter(r => r.marca_id === Number(filters.marca_id))
    }
    if (filters.linea_ids.length > 0) {
      const lineas = new Set(filters.linea_ids)
      filtered = filtered.filter(r => lineas.has(r.linea_id))
    }
    if (filters.tipo_ids.length > 0) {
      const tipos = new Set(filters.tipo_ids)
      filtered = filtered.filter(r => r.tipo_1_id && tipos.has(r.tipo_1_id))
    }
    if (filters.colores.length > 0) {
      const cols = new Set(filters.colores.map(c => c.trim()))
      filtered = filtered.filter(r => cols.has(String(r.descp_color ?? '').trim()))
    }
    if (filters.quincenas.length > 0) {
      const q = new Set(filters.quincenas)
      filtered = filtered.filter(r => r.quincena_arribo_id != null && q.has(r.quincena_arribo_id))
    }
    return filtered
  }, [allRows, filters])

  const productos = useMemo(
    () => agruparTarjetasCatalogo(rows, bucketUrl, cajasDisponiblesDeFila),
    [rows, bucketUrl],
  )

  const pps = useMemo(
    () => Array.from(new Map(rows.map(r => [r.pp_nro, { nro: r.pp_nro }])).values())
      .sort((a, b) => a.nro.localeCompare(b.nro)),
    [rows],
  )

  const totalPares = useMemo(
    () => rows.reduce((s, r) => s + paresDisponiblesDeFila(r), 0),
    [rows],
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
        estilos={filtros.todosEstilos}
        marcas={filtros.todasMarcas}
        lineas={filtros.todasLineas}
        tipos={filtros.todosTipos}
        colores={colores}
        quincenas={quincenas}
        totalModelos={productos.length}
        totalPares={totalPares}
        value={filters}
        onChange={updateFilters}
      />

      {productos.length === 0 && (
        <div className="mb-6 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <span className="mb-4 text-5xl" aria-hidden>📦</span>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Catálogo sin existencias por el momento</h2>
          <p className="mb-6 max-w-md text-sm text-slate-500">
            No hay artículos disponibles con los filtros aplicados. Probá quitar filtros o reintentá la carga.
          </p>
          <button
            type="button"
            onClick={() => updateFilters({
              grupo_estilo_id: '',
              marca_id: '',
              linea_ids: [],
              tipo_ids: [],
              colores: [],
              quincenas: [],
            })}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && productos.length === 0 && isInitial && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold mb-1">Catálogo vacío — diagnóstico rápido (DEV)</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Filas cargadas: <strong>{allRows.length}</strong></li>
            <li>Tras filtros locales: <strong>{rows.length}</strong> · tarjetas: <strong>{productos.length}</strong></li>
            <li>App catálogo: <strong>http://localhost:3001</strong> (no :3000)</li>
          </ul>
        </div>
      )}

      <CatalogoGrid productos={productos} pps={pps} />
    </>
  )
}
