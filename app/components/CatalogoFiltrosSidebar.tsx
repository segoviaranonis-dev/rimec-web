'use client'

import { useEffect, useRef, useState } from 'react'
import { RIMEC_PE_DEPOSITOS, type PeDepositoCodigo, type PeRamoTipo } from '@/lib/rimecPeDeposito'
import {
  cascadaEstilo,
  cascadaLinea,
  cascadaMaterial,
  cascadaColor,
  toggleEstiloCascada,
  toggleLineaCascada,
  toggleMaterialCascada,
  toggleColorCascada,
  resetCascadaAlCambiarRamo,
  toggleId,
} from '@/lib/catalogoCascadaMolecula'
import {
  TIPO_GRUPO_OPCIONES,
  toggleTipoGrupo,
  type TipoGrupoId,
} from '@/lib/filtros/filtro-tipo-canonico'
import type { FamiliaPilarItem } from '@/lib/pilares/agrupar-etiqueta-pilar'
import { clearSharedCatalogFilters } from '@/lib/catalogoFiltrosCompartidos'
import type { CatalogoFilterState } from './FiltrosCatalogo'

type FilterItem = { id: number; label: string }
type GeneroItem = { codigo: string; label: string }

export type CatalogoFiltrosOpciones = {
  estilos: FilterItem[]
  marcas: FilterItem[]
  lineas: FilterItem[]
  tipos: FilterItem[]
  generos: GeneroItem[]
  materialFamilias: FamiliaPilarItem[]
  colorFamilias: FamiliaPilarItem[]
  /** Fechas de llegada CP (ex slider / quincenas) */
  quincenas?: { id: number; label: string }[]
  /** Nº preventa Carlos */
  preventas?: string[]
}

type Props = {
  filtros: CatalogoFilterState
  onChange: (next: CatalogoFilterState) => void
  opciones: CatalogoFiltrosOpciones
  emptyFilters: CatalogoFilterState
  className?: string
  trailing?: React.ReactNode
}

export const CATALOGO_FILTROS_VACIOS: CatalogoFilterState = {
  grupo_estilo_id: '',
  marca_id: '',
  grupo_estilo_ids: [],
  marca_ids: [],
  linea_ids: [],
  tipo_ids: [],
  colores: [],
  quincenas: [],
  origen_tipo: 'TODOS',
  ramo_tipo: 'CALZADO',
  deposito_codigo: '',
  genero_codigo: '',
  tonos: [],
  sin_tono: false,
  buscar: '',
  tipo_grupos: [],
  material_familias: [],
  color_familias: [],
  preventas: [],
}

function cap(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function toggleStr(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

function hayFiltrosActivos(f: CatalogoFilterState, empty: CatalogoFilterState): boolean {
  return (
    (f.grupo_estilo_ids?.length ?? 0) > 0 ||
    (f.marca_ids?.length ?? 0) > 0 ||
    Boolean(f.grupo_estilo_id) ||
    Boolean(f.marca_id) ||
    f.linea_ids.length > 0 ||
    f.tipo_ids.length > 0 ||
    (f.tipo_grupos?.length ?? 0) > 0 ||
    Boolean(f.genero_codigo) ||
    (f.material_familias?.length ?? 0) > 0 ||
    (f.color_familias?.length ?? 0) > 0 ||
    (f.quincenas?.length ?? 0) > 0 ||
    (f.preventas?.length ?? 0) > 0 ||
    Boolean(f.buscar?.trim()) ||
    Boolean(f.deposito_codigo) ||
    (f.origen_tipo ?? '') !== (empty.origen_tipo ?? 'TODOS') ||
    (f.ramo_tipo ?? '') !== (empty.ramo_tipo ?? 'CALZADO')
  )
}

function AcordeonHeader({
  title,
  count,
  onClear,
}: {
  title: string
  count: number
  onClear?: () => void
}) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-1.5">
        <span className="text-rimec-azul transition group-open:rotate-90" aria-hidden>
          ▸
        </span>
        {title}
        {count > 0 ? (
          <span className="rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black tabular-nums text-white">
            {count}
          </span>
        ) : null}
      </span>
      {count > 0 && onClear ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onClear()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onClear()
            }
          }}
          className="text-[10px] font-semibold text-red-600 hover:underline"
        >
          Limpiar
        </span>
      ) : null}
    </summary>
  )
}

function MultiSelectGroup({
  title,
  items,
  selected,
  onToggle,
  onClear,
  emptyLabel = 'Sin opciones',
  maxH = 'max-h-36',
  defaultOpen = false,
}: {
  title: string
  items: FilterItem[]
  selected: number[]
  onToggle: (id: number) => void
  onClear: () => void
  emptyLabel?: string
  maxH?: string
  defaultOpen?: boolean
}) {
  const n = selected.length
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title={title} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        {items.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-slate-400">{emptyLabel}</p>
        ) : (
          <ul className={`${maxH} space-y-0.5 overflow-y-auto`} role="group" aria-label={`${title} · multi-selección`}>
            {items.map((item) => {
              const id = Number(item.id)
              if (!Number.isFinite(id)) return null
              const on = selected.includes(id)
              return (
                <li key={id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      on
                        ? 'bg-rimec-azul/10 font-semibold text-rimec-azul'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(id)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-rimec-azul focus:ring-rimec-azul/30"
                    />
                    <span className="min-w-0 flex-1 truncate" title={item.label}>
                      {item.label}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </details>
  )
}

function SingleSelectGroup({
  title,
  items,
  selectedId,
  onSelect,
  onClear,
  emptyLabel = 'Sin opciones',
  maxH = 'max-h-36',
  defaultOpen = false,
}: {
  title: string
  items: FilterItem[]
  selectedId: string
  onSelect: (id: string) => void
  onClear: () => void
  emptyLabel?: string
  maxH?: string
  defaultOpen?: boolean
}) {
  const n = selectedId ? 1 : 0
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title={title} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        {items.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-slate-400">{emptyLabel}</p>
        ) : (
          <ul className={`${maxH} space-y-0.5 overflow-y-auto`} role="radiogroup" aria-label={`${title} · selección`}>
            {items.map((item) => {
              const id = String(item.id)
              const on = selectedId === id
              return (
                <li key={id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      on
                        ? 'bg-rimec-azul/10 font-semibold text-rimec-azul'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`catalogo-filtro-${title}`}
                      checked={on}
                      onChange={() => onSelect(id)}
                      className="h-3.5 w-3.5 shrink-0 border-slate-300 text-rimec-azul focus:ring-rimec-azul/30"
                    />
                    <span className="min-w-0 flex-1 truncate" title={item.label}>
                      {item.label}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </details>
  )
}

function TipoMultiSelectGroup({
  selected,
  onToggle,
  onClear,
}: {
  selected: TipoGrupoId[]
  onToggle: (id: TipoGrupoId) => void
  onClear: () => void
}) {
  const n = selected.length
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title="Tipo" count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        <ul className="max-h-36 space-y-0.5 overflow-y-auto" role="group" aria-label="Tipo · multi-selección">
          {TIPO_GRUPO_OPCIONES.map((item) => {
            const on = selected.includes(item.id)
            return (
              <li key={item.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                    on
                      ? 'bg-rimec-azul/10 font-semibold text-rimec-azul'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(item.id)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-rimec-azul focus:ring-rimec-azul/30"
                  />
                  <span className="min-w-0 flex-1 truncate" title={item.label}>
                    {item.label}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>
    </details>
  )
}

function FamiliaMultiSelectGroup({
  title,
  items,
  selected,
  onToggle,
  onClear,
  emptyLabel = 'Sin descripción de pilar',
  maxH = 'max-h-52',
  defaultOpen = false,
}: {
  title: string
  items: FamiliaPilarItem[]
  selected: string[]
  onToggle: (key: string) => void
  onClear: () => void
  emptyLabel?: string
  maxH?: string
  defaultOpen?: boolean
}) {
  const n = selected.length
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title={title} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        {items.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-slate-400">{emptyLabel}</p>
        ) : (
          <ul className={`${maxH} space-y-0.5 overflow-y-auto`} role="group" aria-label={`${title} · familias`}>
            {items.map((item) => {
              const on = selected.includes(item.key)
              return (
                <li key={item.key}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      on
                        ? 'bg-rimec-azul/10 font-semibold text-rimec-azul'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(item.key)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-rimec-azul focus:ring-rimec-azul/30"
                    />
                    <span className="min-w-0 flex-1 truncate" title={item.label}>
                      {item.label}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </details>
  )
}

function BloqueColapsable({
  title,
  badge,
  open,
  onToggle,
  children,
  railLabel,
}: {
  title: string
  badge?: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  railLabel: string
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={`Mostrar ${title}`}
        className="flex h-full min-h-[12rem] w-9 shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 shadow-sm transition hover:border-rimec-azul/40 hover:bg-slate-50"
        aria-expanded={false}
        aria-label={`Mostrar bloque ${title}`}
      >
        <span className="text-rimec-azul" aria-hidden>
          ▸
        </span>
        {badge && badge > 0 ? (
          <span className="rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black text-white">
            {badge}
          </span>
        ) : null}
        <span
          className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {railLabel}
        </span>
      </button>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 shadow-sm lg:w-56">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rimec-azul">{title}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-rimec-azul"
          aria-expanded
          aria-label={`Ocultar bloque ${title}`}
          title="Ocultar"
        >
          ◂
        </button>
      </div>
      <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-2 overflow-y-auto p-3">{children}</div>
    </div>
  )
}

/**
 * Sidebar dual Dimensiones + Molécula (paridad Report).
 * Estado = CatalogoFilterState / URL existente; Molécula aplica cascada Estilo→Línea→Material→Color.
 */
export function CatalogoFiltrosSidebar({
  filtros,
  onChange,
  opciones,
  emptyFilters,
  className = '',
  trailing,
}: Props) {
  const [bloqueDimOpen, setBloqueDimOpen] = useState(true)
  const [bloqueMolOpen, setBloqueMolOpen] = useState(true)
  const [buscarLocal, setBuscarLocal] = useState(filtros.buscar ?? '')
  const filtrosRef = useRef(filtros)
  filtrosRef.current = filtros

  useEffect(() => {
    setBuscarLocal(filtros.buscar ?? '')
  }, [filtros.buscar])

  useEffect(() => {
    const t = setTimeout(() => {
      const cur = filtrosRef.current
      if (buscarLocal !== (cur.buscar ?? '')) {
        onChange({ ...cur, buscar: buscarLocal })
      }
    }, 400)
    return () => clearTimeout(t)
  }, [buscarLocal, onChange])

  /** Solo onChange — Client ya persiste shared + URL. */
  const patch = (p: Partial<CatalogoFilterState>) => onChange({ ...filtros, ...p })

  const origen = (filtros.origen_tipo ?? 'TODOS').toUpperCase()
  const esPe = origen.includes('PRONTA')
  const esTodos = origen === 'TODOS'
  const esCp = !esPe && !esTodos
  const mostrarDeposito = esPe || esTodos
  const ramo = (filtros.ramo_tipo ?? '') as '' | PeRamoTipo
  const deposito = (filtros.deposito_codigo ?? '') as '' | PeDepositoCodigo
  const tipoGrupos = filtros.tipo_grupos ?? []
  const marcaIds = filtros.marca_ids ??
    (filtros.marca_id ? [Number(filtros.marca_id)] : [])
  const estiloIds = filtros.grupo_estilo_ids ??
    (filtros.grupo_estilo_id ? [Number(filtros.grupo_estilo_id)] : [])
  const materialFam = filtros.material_familias ?? []
  const colorFam = filtros.color_familias ?? []

  const dirty = hayFiltrosActivos(filtros, emptyFilters)

  const badgeDim =
    (filtros.tipo_ids?.length ?? 0) +
    marcaIds.length +
    tipoGrupos.length +
    (filtros.genero_codigo ? 1 : 0) +
    (filtros.deposito_codigo ? 1 : 0) +
    (ramo ? 1 : 0) +
    (origen !== 'TODOS' ? 1 : 0) +
    (filtros.quincenas?.length ?? 0)

  const badgeMol =
    estiloIds.length +
    filtros.linea_ids.length +
    materialFam.length +
    colorFam.length

  const setOrigen = (origen_tipo: string) => {
    patch({
      origen_tipo,
      quincenas: origen_tipo === 'CP' ? filtros.quincenas : [],
      ramo_tipo: 'CALZADO',
      deposito_codigo: origen_tipo === 'PRONTA_ENTREGA' ? filtros.deposito_codigo : '',
    })
  }

  const setCompraPrevia = () => {
    if (esCp) {
      // Toggle off → Todos (CP+PE)
      setOrigen('TODOS')
      return
    }
    setOrigen('CP')
  }

  const setProntaEntrega = () => {
    if (esPe) {
      setOrigen('TODOS')
      return
    }
    setOrigen('PRONTA_ENTREGA')
  }

  const setRamo = (next: '' | PeRamoTipo) => {
    if (ramo === next) {
      patch({ ramo_tipo: '' })
      return
    }
    patch({ ramo_tipo: next, ...resetCascadaAlCambiarRamo() })
  }

  const quincenasOpts = opciones.quincenas ?? []
  const quincenasSel = filtros.quincenas ?? []
  const preventasOpts = opciones.preventas ?? []
  const preventasSel = filtros.preventas ?? []

  return (
    <div
      className={`flex w-full flex-col gap-3 sm:flex-row sm:items-stretch ${className}`}
      aria-label="Filtros catálogo · dimensiones + molécula"
    >
      <BloqueColapsable
        title="Dimensiones"
        railLabel="Dimensiones"
        badge={badgeDim}
        open={bloqueDimOpen}
        onToggle={() => setBloqueDimOpen((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] text-slate-500">Multi-selección</p>
          {dirty ? (
            <button
              type="button"
              onClick={() => {
                clearSharedCatalogFilters()
                onChange(emptyFilters)
              }}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50"
            >
              Reset
            </button>
          ) : null}
        </div>

        {/* Compra previa (fechas = quincenas) + Pronta entrega */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Stock
          </span>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={setCompraPrevia}
              className={`w-full rounded-md px-2.5 py-2 text-left text-[11px] font-semibold ${
                esCp
                  ? 'bg-rimec-azul text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              🚢 Compra previa
              {esCp && quincenasSel.length > 0
                ? ` · ${quincenasSel.length} fecha${quincenasSel.length === 1 ? '' : 's'}`
                : ''}
              {esCp && preventasSel.length > 0
                ? ` · ${preventasSel.length} preventa${preventasSel.length === 1 ? '' : 's'}`
                : ''}
            </button>

            {esCp ? (
              <details open className="group rounded-lg border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-1.5">
                    <span className="text-rimec-azul transition group-open:rotate-90" aria-hidden>
                      ▸
                    </span>
                    Fechas de llegada
                    {quincenasSel.length > 0 ? (
                      <span className="rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black text-white">
                        {quincenasSel.length}
                      </span>
                    ) : null}
                  </span>
                  {quincenasSel.length > 0 ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-[10px] font-semibold normal-case tracking-normal text-red-600 hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        patch({ quincenas: [] })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          patch({ quincenas: [] })
                        }
                      }}
                    >
                      Limpiar
                    </span>
                  ) : null}
                </summary>
                <div className="max-h-48 space-y-1 overflow-y-auto border-t border-slate-100 p-2">
                  {quincenasOpts.length === 0 ? (
                    <p className="px-1 py-1 text-[11px] text-slate-400">Sin fechas disponibles</p>
                  ) : (
                    quincenasOpts.map((q) => {
                      const on = quincenasSel.includes(q.id)
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() =>
                            patch({ quincenas: toggleId(quincenasSel, q.id) })
                          }
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                            on
                              ? 'bg-rimec-azul/10 font-semibold text-rimec-azul'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                              on
                                ? 'border-rimec-azul bg-rimec-azul text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                            aria-hidden
                          >
                            {on ? '✓' : ''}
                          </span>
                          <span className="min-w-0 flex-1 truncate" title={q.label}>
                            {q.label}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </details>
            ) : null}

            {esCp && preventasOpts.length > 0 ? (
              <details className="group rounded-lg border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-1.5">
                    <span className="text-rimec-azul transition group-open:rotate-90" aria-hidden>
                      ▸
                    </span>
                    Nº preventa
                    {preventasSel.length > 0 ? (
                      <span className="rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black text-white">
                        {preventasSel.length}
                      </span>
                    ) : null}
                  </span>
                  {preventasSel.length > 0 ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-[10px] font-semibold normal-case tracking-normal text-red-600 hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        patch({ preventas: [] })
                      }}
                    >
                      Limpiar
                    </span>
                  ) : null}
                </summary>
                <div className="max-h-48 space-y-1 overflow-y-auto border-t border-slate-100 p-2">
                  {preventasOpts.map((pv) => {
                    const on = preventasSel.includes(pv)
                    return (
                      <button
                        key={pv}
                        type="button"
                        onClick={() => patch({ preventas: toggleStr(preventasSel, pv) })}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs ${
                          on
                            ? 'bg-rimec-azul/10 font-semibold text-rimec-azul'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                            on
                              ? 'border-rimec-azul bg-rimec-azul text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                          aria-hidden
                        >
                          {on ? '✓' : ''}
                        </span>
                        {pv}
                      </button>
                    )
                  })}
                </div>
              </details>
            ) : null}

            <button
              type="button"
              onClick={setProntaEntrega}
              className={`w-full rounded-md px-2.5 py-2 text-left text-[11px] font-semibold ${
                esPe
                  ? 'bg-rimec-azul text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              📦 Pronta entrega
            </button>
          </div>
        </div>

        {mostrarDeposito ? (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Depósito</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => patch({ deposito_codigo: '' })}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  !deposito
                    ? 'bg-rimec-azul text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Todos
              </button>
              {RIMEC_PE_DEPOSITOS.map((d) => (
                <button
                  key={d.codigo}
                  type="button"
                  onClick={() =>
                    patch({ deposito_codigo: deposito === d.codigo ? '' : d.codigo })
                  }
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                    deposito === d.codigo
                      ? 'bg-rimec-azul text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {d.codigo}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Categoría</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setRamo('CALZADO')}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  ramo === 'CALZADO'
                    ? 'bg-rimec-azul text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Calzado
              </button>
              <button
                type="button"
                onClick={() => setRamo('CONFECCIONES')}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  ramo === 'CONFECCIONES'
                    ? 'bg-rimec-azul text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Confecciones
              </button>
            </div>
          </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Buscar</span>
          <input
            type="search"
            value={buscarLocal}
            onChange={(e) => setBuscarLocal(e.target.value)}
            placeholder="Línea, ref, marca…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
          />
        </label>

        <MultiSelectGroup
          title="AB - CR"
          items={opciones.tipos}
          selected={filtros.tipo_ids}
          onToggle={(id) =>
            patch({
              tipo_ids: toggleId(filtros.tipo_ids, id),
              material_familias: [],
              color_familias: [],
            })
          }
          onClear={() => patch({ tipo_ids: [], material_familias: [], color_familias: [] })}
        />

        <MultiSelectGroup
          title="Marca"
          items={opciones.marcas.map((m) => ({ ...m, label: cap(m.label) }))}
          selected={marcaIds}
          onToggle={(id) =>
            patch({
              marca_id: '',
              marca_ids: toggleId(marcaIds, id),
              linea_ids: [],
              tonos: [],
              sin_tono: false,
              material_familias: [],
              color_familias: [],
            })
          }
          onClear={() =>
            patch({
              marca_id: '',
              marca_ids: [],
              linea_ids: [],
              tonos: [],
              sin_tono: false,
              material_familias: [],
              color_familias: [],
            })
          }
          maxH="max-h-44"
        />

        <TipoMultiSelectGroup
          selected={tipoGrupos}
          onToggle={(id) => patch({ tipo_grupos: toggleTipoGrupo(tipoGrupos, id) })}
          onClear={() => patch({ tipo_grupos: [] })}
        />

        <details className="group rounded-lg border border-slate-200/90 bg-white">
          <AcordeonHeader
            title="Género"
            count={filtros.genero_codigo ? 1 : 0}
            onClear={() => patch({ genero_codigo: '' })}
          />
          <div className="border-t border-slate-100 p-1.5">
            <ul className="max-h-36 space-y-0.5 overflow-y-auto" role="radiogroup" aria-label="Género">
              {opciones.generos.map((g) => {
                const on = filtros.genero_codigo === g.codigo
                return (
                  <li key={g.codigo}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                        on
                          ? 'bg-rimec-azul/10 font-semibold text-rimec-azul'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="catalogo-filtro-genero"
                        checked={on}
                        onChange={() =>
                          patch({ genero_codigo: on ? '' : g.codigo })
                        }
                        className="h-3.5 w-3.5 shrink-0 border-slate-300 text-rimec-azul focus:ring-rimec-azul/30"
                      />
                      <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        </details>

        {trailing}
      </BloqueColapsable>

      <BloqueColapsable
        title="Molécula"
        railLabel="Estilo · Línea · Mat · Color"
        badge={badgeMol}
        open={bloqueMolOpen}
        onToggle={() => setBloqueMolOpen((v) => !v)}
      >
        <p className="text-[10px] text-slate-500">
          Cascada: Estilo → Línea → Material → Color · familias texto
        </p>

        <MultiSelectGroup
          title="Estilo"
          items={opciones.estilos}
          selected={estiloIds}
          onToggle={(id) => patch(toggleEstiloCascada(estiloIds, id))}
          onClear={() => patch(cascadaEstilo([]))}
          defaultOpen
        />

        <MultiSelectGroup
          title="Línea"
          items={opciones.lineas}
          selected={filtros.linea_ids}
          onToggle={(id) => patch(toggleLineaCascada(filtros.linea_ids, id))}
          onClear={() => patch(cascadaLinea([]))}
          maxH="max-h-48"
        />

        <FamiliaMultiSelectGroup
          title="Material"
          items={opciones.materialFamilias}
          selected={materialFam}
          onToggle={(key) => patch(toggleMaterialCascada(materialFam, key))}
          onClear={() => patch(cascadaMaterial([]))}
          maxH="max-h-52"
        />

        <FamiliaMultiSelectGroup
          title="Color"
          items={opciones.colorFamilias}
          selected={colorFam}
          onToggle={(key) => patch(toggleColorCascada(colorFam, key))}
          onClear={() => patch(cascadaColor([]))}
          maxH="max-h-52"
        />
      </BloqueColapsable>
    </div>
  )
}

// Re-export helpers usados por pills / tests
export {
  cascadaEstilo,
  cascadaLinea,
  cascadaMaterial,
  cascadaColor,
  toggleEstiloCascada,
  toggleLineaCascada,
  toggleMaterialCascada,
  toggleColorCascada,
}
export { toggleFamiliaKey } from '@/lib/pilares/agrupar-etiqueta-pilar'
