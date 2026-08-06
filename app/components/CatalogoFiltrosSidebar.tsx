'use client'

import { useEffect, useRef, useState } from 'react'
import { RIMEC_PE_DEPOSITOS, type PeDepositoCodigo, type PeRamoTipo } from '@/lib/rimecPeDeposito'
import { tituloAbcrSidebar, tiposMetaModuloAccesorios, esRamoAccesorios } from '@/lib/filtros/modulo-accesorios'
import {
  cascadaEstilo,
  cascadaLinea,
  cascadaMaterial,
  cascadaColor,
  cascadaDimensiones,
  toggleEstiloCascada,
  toggleLineaCascada,
  toggleMaterialCascada,
  toggleColorCascada,
  resetCascadaAlCambiarRamo,
  toggleId,
} from '@/lib/catalogoCascadaMolecula'
import {
  TIPO_GRUPO_OPCIONES,
  sanitizeTipoGruposParaRamo,
  tipoGrupoOpcionesVisibles,
  toggleTipoGrupo,
  type TipoGrupoId,
} from '@/lib/filtros/filtro-tipo-canonico'
import {
  PE_TIPO_DICCIONARIO_OPCIONES,
  parsePeTipoSelected,
  togglePeTipoDiccionario,
  usaDiccionarioPeTipo,
  type PeTipoDiccionarioId,
} from '@/lib/filtros/filtro-tipo-pe-diccionario'
import type { FamiliaPilarItem } from '@/lib/pilares/agrupar-etiqueta-pilar'
import { clearSharedCatalogFilters } from '@/lib/catalogoFiltrosCompartidos'
import type { DatoDuroCpParItem } from '@/lib/datoDuroCpFiltro'
import { DatoDuroCpFilas } from '@/components/catalog/DatoDuroCpFilas'
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
  /** Fechas de llegada CP (legacy) */
  quincenas?: { id: number; label: string }[]
  /** Pares casados preventa + quincena */
  paresDatoDuro?: DatoDuroCpParItem[]
}

type Props = {
  filtros: CatalogoFilterState
  onChange: (next: CatalogoFilterState) => void
  opciones: CatalogoFiltrosOpciones
  emptyFilters: CatalogoFilterState
  className?: string
  trailing?: React.ReactNode
  /** Oculta pill Confecciones (vendedores calzado 654). */
  soloCalzado?: boolean
  /** Oculta pill Calzado (PATRICIA / DARIO · 638). */
  soloConfecciones?: boolean
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
  genero_codigos: [],
  tonos: [],
  sin_tono: false,
  buscar: '',
  tipo_grupos: [],
  material_familias: [],
  color_familias: [],
  dato_duro_cp: [],
  precio_tope: null,
  precio_min: null,
  precio_max: null,
  lista_precio_id: null,
}

import { labelMarcaCatalogo } from '@/lib/marcaBadge'

function toggleDatoDuroCp(arr: string[], key: string): string[] {
  return arr.includes(key) ? arr.filter(x => x !== key) : [...arr, key]
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
    (f.genero_codigos?.length ?? 0) > 0 ||
    (f.material_familias?.length ?? 0) > 0 ||
    (f.color_familias?.length ?? 0) > 0 ||
    (f.dato_duro_cp?.length ?? 0) > 0 ||
    Boolean(f.buscar?.trim()) ||
    Boolean(f.deposito_codigo) ||
    (f.origen_tipo ?? '') !== (empty.origen_tipo ?? 'TODOS') ||
    (f.ramo_tipo ?? '') !== (empty.ramo_tipo ?? '')
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

const MULTI_HINT = ' · multi'

function toggleCodigo(list: string[], codigo: string): string[] {
  return list.includes(codigo) ? list.filter((c) => c !== codigo) : [...list, codigo]
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
  filterable = false,
}: {
  title: string
  items: FilterItem[]
  selected: number[]
  onToggle: (id: number) => void
  onClear: () => void
  emptyLabel?: string
  maxH?: string
  defaultOpen?: boolean
  /** Caja de filtro local — Estilo/Marca con muchas opciones (TENIS abajo del ABC). */
  filterable?: boolean
}) {
  const n = selected.length
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const visible = needle
    ? items.filter((it) => String(it.label ?? '').toLowerCase().includes(needle))
    : items
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title={`${title} · ${items.length}`} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        {items.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-slate-400">{emptyLabel}</p>
        ) : (
          <>
            {filterable && items.length > 6 ? (
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar lista…"
                className="mb-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-rimec-azul focus:outline-none"
              />
            ) : null}
            <ul className={`${maxH} space-y-0.5 overflow-y-auto`} role="group" aria-label={`${title} · multi-selección`}>
              {visible.map((item) => {
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
              {visible.length === 0 ? (
                <li className="px-1 py-1 text-[11px] text-slate-400">Sin coincidencias</li>
              ) : null}
            </ul>
          </>
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

function PeTipoDiccionarioMultiSelectGroup({
  selected,
  onToggle,
  onClear,
}: {
  selected: PeTipoDiccionarioId[]
  onToggle: (id: PeTipoDiccionarioId) => void
  onClear: () => void
}) {
  const n = selected.length
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title={`Tipo${MULTI_HINT}`} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-slate-500">
          Diccionario pronta entrega · COD.GRUPO
        </p>
        <ul className="max-h-36 space-y-0.5 overflow-y-auto" role="group" aria-label="Tipo · diccionario PE">
          {PE_TIPO_DICCIONARIO_OPCIONES.map((item) => {
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

function TipoMultiSelectGroup({
  selected,
  opciones,
  onToggle,
  onClear,
}: {
  selected: TipoGrupoId[]
  opciones: typeof TIPO_GRUPO_OPCIONES
  onToggle: (id: TipoGrupoId) => void
  onClear: () => void
}) {
  const n = selected.length
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title={`Tipo${MULTI_HINT}`} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        <ul className="max-h-36 space-y-0.5 overflow-y-auto" role="group" aria-label="Tipo · multi-selección">
          {opciones.map((item) => {
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
  soloCalzado = false,
  soloConfecciones = false,
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
  const generoIds =
    filtros.genero_codigos ??
    (filtros.genero_codigo ? [filtros.genero_codigo] : [])
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
    generoIds.length +
    (filtros.deposito_codigo ? 1 : 0) +
    (ramo ? 1 : 0) +
    (origen !== 'TODOS' ? 1 : 0) +
    (filtros.dato_duro_cp?.length ?? 0)

  const badgeMol =
    estiloIds.length +
    filtros.linea_ids.length +
    materialFam.length +
    colorFam.length

  const setOrigen = (origen_tipo: string) => {
    const esCpNext =
      origen_tipo === 'CP' || origen_tipo === 'TRÁNSITO_PP' || (!origen_tipo && origen !== 'TODOS')
    patch({
      origen_tipo,
      dato_duro_cp:
        origen_tipo === 'CP' || origen_tipo === 'TRÁNSITO_PP' || !origen_tipo
          ? filtros.dato_duro_cp
          : [],
      quincenas: [],
      preventas: [],
      ramo_tipo: 'CALZADO',
      deposito_codigo: origen_tipo === 'PRONTA_ENTREGA' ? filtros.deposito_codigo : '',
      tipo_grupos: esCpNext
        ? (filtros.tipo_grupos ?? []).filter((g) => g !== 'comun')
        : filtros.tipo_grupos,
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
    if (soloCalzado && next === 'CONFECCIONES') return
    if (soloConfecciones && (next === 'CALZADO' || !next)) return
    // Home = Calzado + Todos. Nunca vaciar ramo (universo mixto / confecciones).
    if (ramo === next) {
      if (next === 'CONFECCIONES' && !soloConfecciones) {
        patch({ ramo_tipo: 'CALZADO', ...resetCascadaAlCambiarRamo() })
      }
      return
    }
    patch({
      ramo_tipo: next || (soloConfecciones ? 'CONFECCIONES' : 'CALZADO'),
      ...resetCascadaAlCambiarRamo(),
    })
  }

  const paresOpts = opciones.paresDatoDuro ?? []
  const datoDuroSel = filtros.dato_duro_cp ?? []

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
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setOrigen('TODOS')}
              className={`w-full rounded-lg border px-2 py-2.5 text-left text-[11px] font-semibold transition ${
                esTodos
                  ? 'border-rimec-azul bg-rimec-azul text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              ⧉ Todos
            </button>
            <button
              type="button"
              onClick={setCompraPrevia}
              className={`w-full rounded-lg border px-2 py-2.5 text-left text-[11px] font-semibold transition ${
                esCp
                  ? 'border-rimec-azul bg-rimec-azul text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              🚢 Compra previa
              {esCp && datoDuroSel.length > 0
                ? ` · ${datoDuroSel.length} lote${datoDuroSel.length === 1 ? '' : 's'}`
                : ''}
            </button>
            <button
              type="button"
              onClick={setProntaEntrega}
              className={`w-full rounded-lg border px-2 py-2.5 text-left text-[11px] font-semibold transition ${
                esPe
                  ? 'border-rimec-azul bg-rimec-azul text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              📦 Pronta entrega
            </button>
          </div>

          {esCp ? (
            <details open className="group rounded-lg border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-1.5">
                  <span className="text-rimec-azul transition group-open:rotate-90" aria-hidden>
                    ▸
                  </span>
                  Llegada · preventa
                  {datoDuroSel.length > 0 ? (
                    <span className="rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black text-white">
                      {datoDuroSel.length}
                    </span>
                  ) : null}
                </span>
                {datoDuroSel.length > 0 ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="text-[10px] font-semibold normal-case tracking-normal text-red-600 hover:underline"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      patch({ dato_duro_cp: [], quincenas: [], preventas: [] })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        patch({ dato_duro_cp: [], quincenas: [], preventas: [] })
                      }
                    }}
                  >
                    Limpiar
                  </span>
                ) : null}
              </summary>
              <div className="max-h-52 space-y-1 overflow-y-auto border-t border-slate-100 p-2">
                {paresOpts.length === 0 ? (
                  <p className="px-1 py-1 text-[11px] text-slate-400">Sin lotes disponibles</p>
                ) : (
                  paresOpts.map((par) => {
                    const on = datoDuroSel.includes(par.key)
                    return (
                      <button
                        key={par.key}
                        type="button"
                        onClick={() =>
                          patch({
                            dato_duro_cp: toggleDatoDuroCp(datoDuroSel, par.key),
                            quincenas: [],
                            preventas: [],
                          })
                        }
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${
                          on
                            ? 'bg-rimec-azul/10 ring-1 ring-rimec-azul/20'
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
                        <DatoDuroCpFilas
                          preventa={par.preventa}
                          quincena={par.quincenaLabel}
                          layout="left"
                        />
                      </button>
                    )
                  })
                )}
              </div>
            </details>
          ) : null}
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
              {!soloConfecciones ? (
              <button
                type="button"
                onClick={() => setRamo('CALZADO')}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  ramo === 'CALZADO' || !ramo
                    ? 'bg-rimec-azul text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Calzado
              </button>
              ) : null}
              {!soloCalzado ? (
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
              ) : null}
            </div>
          </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Buscar</span>
          <input
            type="search"
            value={buscarLocal}
            onChange={(e) => setBuscarLocal(e.target.value)}
            placeholder="L-R-M-C · línea · marca…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
          />
        </label>

        <MultiSelectGroup
          title={`${tituloAbcrSidebar(filtros.ramo_tipo)}${MULTI_HINT}`}
          items={
            esRamoAccesorios(filtros.ramo_tipo)
              ? tiposMetaModuloAccesorios(opciones.tipos)
              : opciones.tipos
          }
          selected={filtros.tipo_ids}
          onToggle={(id) => {
            patch(
              cascadaDimensiones({
                tipo_ids: toggleId(filtros.tipo_ids, id),
              }),
            )
          }}
          onClear={() => patch(cascadaDimensiones({ tipo_ids: [] }))}
        />

        <MultiSelectGroup
          title={`Marca${MULTI_HINT}`}
          items={opciones.marcas.map((m) => ({ ...m, label: labelMarcaCatalogo(m.label) }))}
          selected={marcaIds}
          onToggle={(id) =>
            patch(
              cascadaDimensiones({
                marca_id: '',
                marca_ids: toggleId(marcaIds, id),
              }),
            )
          }
          onClear={() =>
            patch(cascadaDimensiones({ marca_id: '', marca_ids: [] }))
          }
          maxH="max-h-44"
        />

        {usaDiccionarioPeTipo(filtros.origen_tipo) && ramo !== 'ACCESORIOS' ? (
          <PeTipoDiccionarioMultiSelectGroup
            selected={parsePeTipoSelected(tipoGrupos)}
            onToggle={(id) =>
              patch(
                cascadaDimensiones({
                  tipo_grupos: togglePeTipoDiccionario(parsePeTipoSelected(tipoGrupos), id) as TipoGrupoId[],
                }),
              )
            }
            onClear={() => patch(cascadaDimensiones({ tipo_grupos: [] }))}
          />
        ) : tipoGrupoOpcionesVisibles(filtros.ramo_tipo).length > 0 ? (
        <TipoMultiSelectGroup
          selected={tipoGrupos.filter((g): g is TipoGrupoId => g !== 'comun')}
          opciones={tipoGrupoOpcionesVisibles(filtros.ramo_tipo)}
          onToggle={(id) =>
            patch(
              cascadaDimensiones({
                tipo_grupos: sanitizeTipoGruposParaRamo(
                  toggleTipoGrupo(tipoGrupos.filter((g): g is TipoGrupoId => g !== 'comun'), id),
                  filtros.ramo_tipo,
                ),
              }),
            )
          }
          onClear={() => patch(cascadaDimensiones({ tipo_grupos: [] }))}
        />
        ) : null}

        <details className="group rounded-lg border border-slate-200/90 bg-white">
          <AcordeonHeader
            title={`Género${MULTI_HINT}`}
            count={generoIds.length}
            onClear={() => patch(cascadaDimensiones({ genero_codigo: '', genero_codigos: [] }))}
          />
          <div className="border-t border-slate-100 p-1.5">
            <ul className="max-h-36 space-y-0.5 overflow-y-auto" role="group" aria-label="Género · multi-selección">
              {opciones.generos.map((g) => {
                const on = generoIds.includes(g.codigo)
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
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          patch(
                            cascadaDimensiones({
                              genero_codigo: '',
                              genero_codigos: toggleCodigo(generoIds, g.codigo),
                            }),
                          )
                        }
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-rimec-azul focus:ring-rimec-azul/30"
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
          title={`Estilo${MULTI_HINT}`}
          items={opciones.estilos}
          selected={estiloIds}
          onToggle={(id) => patch(toggleEstiloCascada(estiloIds, id))}
          onClear={() => patch(cascadaEstilo([]))}
          defaultOpen
          filterable
          maxH="max-h-72"
        />

        <MultiSelectGroup
          title={`Línea${MULTI_HINT}`}
          items={opciones.lineas}
          selected={filtros.linea_ids}
          onToggle={(id) => patch(toggleLineaCascada(filtros.linea_ids, id))}
          onClear={() => patch(cascadaLinea([]))}
          maxH="max-h-48"
        />

        <FamiliaMultiSelectGroup
          title={`Material${MULTI_HINT}`}
          items={opciones.materialFamilias}
          selected={materialFam}
          onToggle={(key) => patch(toggleMaterialCascada(materialFam, key))}
          onClear={() => patch(cascadaMaterial([]))}
          maxH="max-h-52"
        />

        <FamiliaMultiSelectGroup
          title={`Color${MULTI_HINT}`}
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
