'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RIMEC_PE_DEPOSITOS, type PeDepositoCodigo, type PeRamoTipo } from '@/lib/rimecPeDeposito'
import { tituloAbcrSidebar, tiposMetaModuloAccesorios, esRamoAccesorios } from '@/lib/filtros/modulo-accesorios'
import { clearSharedCatalogFilters, persistSharedCatalogFilters } from '@/lib/catalogoFiltrosCompartidos'
import { FiltroTonoCabecera } from '@/components/catalog/FiltroTonoCabecera'
import { FiltroTonoPrecioFila } from '@/components/catalog/FiltroTonoPrecioFila'
import { CatalogExtenderDatosToggle } from '@/components/catalog/CatalogAcordeonContext'
import { HeaderSesionVenta } from '@/components/catalog/HeaderSesionVenta'
import type { ColorEstandar } from '@/lib/pilares/colores-estandar'
import {
  sanitizeTipoGruposParaRamo,
  tipoGrupoOpcionesVisibles,
  type TipoGrupoId,
} from '@/lib/filtros/filtro-tipo-canonico'
import {
  PE_TIPO_DICCIONARIO_OPCIONES,
  labelPeTipoDiccionario,
  usaDiccionarioPeTipo,
} from '@/lib/filtros/filtro-tipo-pe-diccionario'
import type { FamiliaPilarItem } from '@/lib/pilares/agrupar-etiqueta-pilar'
import type { PrecioRangoCatalogo } from '@/lib/catalogoPrecioRango'
import { labelMarcaCatalogo } from '@/lib/marcaBadge'
import { useSesion, type ListaId } from '@/store/sesionVenta'
import {
  cascadaColor,
  cascadaDimensiones,
  cascadaEstilo,
  cascadaLinea,
  cascadaMaterial,
  resetCascadaAlCambiarRamo,
  toggleColorCascada,
  toggleLineaCascada,
  toggleMaterialCascada,
} from '@/lib/catalogoCascadaMolecula'

interface FilterItem {
  id: number
  label: string
}

function filterItemKey(prefix: string, item: FilterItem, index: number) {
  return `${prefix}-${item.id}-${item.label}-${index}`
}

interface GeneroItem {
  codigo: string
  label: string
}

interface QuincenaItem {
  id: number
  label: string
}

interface Props {
  estilos: FilterItem[]
  marcas:  FilterItem[]
  lineas:  FilterItem[]
  tipos:   FilterItem[]
  generos: GeneroItem[]
  tonoCatalog: ColorEstandar[]
  colores: string[]
  quincenas: QuincenaItem[]
  /** Familias Material / Color (paridad Report) */
  materialFamilias?: FamiliaPilarItem[]
  colorFamilias?: FamiliaPilarItem[]
  totalModelos: number
  totalPares:   number
  /** Límites MIN/MAX SQL (barato → caro) */
  rangoPrecioCatalogo?: PrecioRangoCatalogo | null
  value?: CatalogoFilterState
  onChange?: (filters: CatalogoFilterState) => void
  /** Cabecera + Tono; Dimensiones/Molécula viven en CatalogoFiltrosSidebar */
  variant?: 'pills' | 'cabecera'
  /** Vendedores calzado — oculta Confecciones. */
  soloCalzado?: boolean
  /** PATRICIA / DARIO — oculta Calzado. */
  soloConfecciones?: boolean
}

export type CatalogoFilterState = {
  /** Legacy single-select; plural manda cuando trae valores. */
  grupo_estilo_id: string
  marca_id: string
  grupo_estilo_ids?: number[]
  marca_ids?: number[]
  linea_ids: number[]
  tipo_ids: number[]
  colores: string[]
  quincenas: number[]
  origen_tipo?: string
  ramo_tipo?: '' | PeRamoTipo
  deposito_codigo?: '' | PeDepositoCodigo
  /** Legacy single; plural genero_codigos manda. */
  genero_codigo?: string
  genero_codigos?: string[]
  tonos?: string[]
  sin_tono?: boolean
  buscar?: string
  cadena_comercial?: string
  /** Tipo canónico: Normal · Carteras · Promo · Liquidación */
  tipo_grupos?: TipoGrupoId[]
  /** Familias Material / Color (claves) */
  material_familias?: string[]
  color_familias?: string[]
  /** Nº preventa Carlos (CP) — legacy */
  preventas?: string[]
  /** Pares casados quincena + preventa (CP) */
  dato_duro_cp?: string[]
  /** Rango LPN (Gs) — filtro memoria */
  precio_min?: number | null
  precio_max?: number | null
  /** Tope lista sesión — precio <= tope */
  precio_tope?: number | null
  lista_precio_id?: ListaId | null
}

const GENEROS_FALLBACK: GeneroItem[] = [
  { codigo: 'DAMAS', label: 'Damas' },
  { codigo: 'CABALLEROS', label: 'Caballeros' },
  { codigo: 'NINAS', label: 'Niñas' },
  { codigo: 'NINOS', label: 'Niños' },
]

const RIMEC_BLUE    = '#1E40AF'
const RIMEC_CELESTE = '#0EA5E9'
const RIMEC_ORANGE  = '#EA580C'

function parseTipoGruposParam(raw: string | null): TipoGrupoId[] {
  if (!raw) return []
  return raw
    .split(',')
    .filter(Boolean)
    .filter((x): x is TipoGrupoId =>
      x === 'normal' || x === 'carteras' || x === 'promo' || x === 'liquidacion' || x === 'comun',
    )
}

export function FiltrosCatalogo({
  estilos, marcas, lineas, tipos, generos, tonoCatalog,
  colores, quincenas, materialFamilias = [], colorFamilias = [],
  totalModelos, totalPares, rangoPrecioCatalogo, value, onChange,
  variant = 'pills',
  soloCalzado = false,
  soloConfecciones = false,
}: Props) {
  const soloCabecera = variant === 'cabecera'
  const router       = useRouter()
  const searchParams = useSearchParams()
  const ventaActiva  = useSesion((s) => s.activa)

  const estiloIdActual = value?.grupo_estilo_id ?? searchParams.get('grupo_estilo_id') ?? ''
  const marcaIdActual  = value?.marca_id        ?? searchParams.get('marca_id')        ?? ''
  const estiloIdsActual = value?.grupo_estilo_ids ??
    (searchParams.get('grupo_estilo_ids')
      ? searchParams.get('grupo_estilo_ids')!.split(',').filter(Boolean).map(Number)
      : estiloIdActual ? [Number(estiloIdActual)] : [])
  const marcaIdsActual = value?.marca_ids ??
    (searchParams.get('marca_ids')
      ? searchParams.get('marca_ids')!.split(',').filter(Boolean).map(Number)
      : marcaIdActual ? [Number(marcaIdActual)] : [])

  const lineasSelIds = value?.linea_ids ?? (searchParams.get('linea_ids') ? searchParams.get('linea_ids')!.split(',').filter(Boolean).map(Number) : [])
  const tiposSelIds  = value?.tipo_ids ?? (searchParams.get('tipo_ids') ? searchParams.get('tipo_ids')!.split(',').filter(Boolean).map(Number) : [])
  const colorsSel    = value?.colores ?? (searchParams.get('colores') ? searchParams.get('colores')!.split(',').filter(Boolean) : [])
  const quincenasSel = value?.quincenas ?? (searchParams.get('quincenas') ? searchParams.get('quincenas')!.split(',').filter(Boolean).map(Number) : [])
  const origenActual = value?.origen_tipo ?? searchParams.get('origen_tipo') ?? ''
  const ramoActual = value?.ramo_tipo ?? (searchParams.get('ramo_tipo') as PeRamoTipo | '') ?? ''
  const tiposAbcr = esRamoAccesorios(ramoActual) ? tiposMetaModuloAccesorios(tipos) : tipos
  const abcrLabel = tituloAbcrSidebar(ramoActual)
  const depositoActual = value?.deposito_codigo ?? (searchParams.get('deposito_codigo') as PeDepositoCodigo | '') ?? ''
  const generoActual = value?.genero_codigo ?? searchParams.get('genero_codigo') ?? ''
  const generoIdsActual = value?.genero_codigos ??
    (searchParams.get('genero_codigos')
      ? searchParams.get('genero_codigos')!.split(',').filter(Boolean)
      : generoActual ? [generoActual] : [])
  const tonosSel = value?.tonos ?? (searchParams.get('tonos') ? searchParams.get('tonos')!.split(',').filter(Boolean) : [])
  const sinTono = value?.sin_tono ?? searchParams.get('sin_tono') === '1'
  const buscarActual = value?.buscar ?? searchParams.get('buscar') ?? ''
  const tipoGruposSel = value?.tipo_grupos ?? parseTipoGruposParam(searchParams.get('tipo_grupos'))
  const materialFamSel = value?.material_familias ?? (searchParams.get('material_familias') ? searchParams.get('material_familias')!.split(',').filter(Boolean) : [])
  const colorFamSel = value?.color_familias ?? (searchParams.get('color_familias') ? searchParams.get('color_familias')!.split(',').filter(Boolean) : [])
  const parsePrecioParam = (raw: string | null): number | null => {
    if (!raw) return null
    const n = Number(raw.replace(/\D/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const precioMinActual = value?.precio_min ?? parsePrecioParam(searchParams.get('precio_min'))
  const precioMaxActual =
    value?.precio_max ??
    parsePrecioParam(searchParams.get('precio_max')) ??
    (value?.precio_tope ?? parsePrecioParam(searchParams.get('precio_tope')))
  const listaPrecioFiltro = (() => {
    const fromValue = value?.lista_precio_id
    if (fromValue === 1 || fromValue === 2 || fromValue === 3 || fromValue === 4) return fromValue
    const n = Number(searchParams.get('lista_precio_id'))
    return n === 1 || n === 2 || n === 3 || n === 4 ? (n as ListaId) : null
  })()
  const [buscarLocal, setBuscarLocal] = useState(buscarActual)
  const [encabezadoOculto, setEncabezadoOculto] = useState(false)
  const esProntaEntrega = origenActual.toUpperCase().includes('PRONTA')
  const esTodos = origenActual.toUpperCase() === 'TODOS'
  const esCpSolo = !esProntaEntrega && !esTodos
  const generosLista = generos.length ? generos : GENEROS_FALLBACK

  useEffect(() => { setBuscarLocal(buscarActual) }, [buscarActual])

  useEffect(() => {
    try {
      setEncabezadoOculto(localStorage.getItem('rimec-web-filtros-collapsed') === '1')
    } catch { /* ignore */ }
  }, [])

  const toggleEncabezado = () => {
    setEncabezadoOculto(prev => {
      const next = !prev
      try { localStorage.setItem('rimec-web-filtros-collapsed', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  const cadenaActual =
    value?.cadena_comercial ?? searchParams.get('cadena_comercial') ?? ''

  const aplicar = useCallback((opts: {
    grupo_estilo_id?: string
    marca_id?: string
    grupo_estilo_ids?: number[]
    marca_ids?: number[]
    linea_ids?: number[]
    tipo_ids?: number[]
    cols?: string[]
    quincenas?: number[]
    origen_tipo?: string
    ramo_tipo?: '' | PeRamoTipo
    deposito_codigo?: '' | PeDepositoCodigo
    genero_codigo?: string
    genero_codigos?: string[]
    tonos?: string[]
    sin_tono?: boolean
    buscar?: string
    cadena_comercial?: string
    tipo_grupos?: TipoGrupoId[]
    material_familias?: string[]
    color_familias?: string[]
    precio_tope?: number | null
    precio_min?: number | null
    precio_max?: number | null
    lista_precio_id?: ListaId | null
  }) => {
    const params = new URLSearchParams()

    const estId = opts.grupo_estilo_id !== undefined ? opts.grupo_estilo_id : estiloIdActual
    const marId = opts.marca_id        !== undefined ? opts.marca_id        : marcaIdActual
    const estIds = opts.grupo_estilo_ids !== undefined ? opts.grupo_estilo_ids : estiloIdsActual
    const marIds = opts.marca_ids !== undefined ? opts.marca_ids : marcaIdsActual
    const lns   = opts.linea_ids       !== undefined ? opts.linea_ids       : lineasSelIds
    const tps   = opts.tipo_ids        !== undefined ? opts.tipo_ids        : tiposSelIds
    const cls   = opts.cols            !== undefined ? opts.cols            : colorsSel
    const qncs  = opts.quincenas       !== undefined ? opts.quincenas       : quincenasSel
    const origen = opts.origen_tipo    !== undefined ? opts.origen_tipo     : origenActual
    const ramo   = opts.ramo_tipo       !== undefined ? opts.ramo_tipo       : ramoActual
    const dep    = opts.deposito_codigo !== undefined ? opts.deposito_codigo : depositoActual
    const gen    = opts.genero_codigo   !== undefined ? opts.genero_codigo   : generoActual
    const genIds = opts.genero_codigos  !== undefined ? opts.genero_codigos : generoIdsActual
    const ton    = opts.tonos           !== undefined ? opts.tonos           : tonosSel
    const sinT   = opts.sin_tono        !== undefined ? opts.sin_tono        : sinTono
    const busq   = opts.buscar          !== undefined ? opts.buscar          : buscarActual
    const cadena = opts.cadena_comercial !== undefined ? opts.cadena_comercial : cadenaActual
    const tGrupos = sanitizeTipoGruposParaRamo(
      opts.tipo_grupos !== undefined ? opts.tipo_grupos : tipoGruposSel,
      ramo,
    )
    const matFam = opts.material_familias !== undefined ? opts.material_familias : materialFamSel
    const colFam = opts.color_familias !== undefined ? opts.color_familias : colorFamSel
    const pTope = opts.precio_tope !== undefined ? opts.precio_tope : null
    const pMin = opts.precio_min !== undefined ? opts.precio_min : precioMinActual
    const pMax = opts.precio_max !== undefined ? opts.precio_max : precioMaxActual
    const listaP = opts.lista_precio_id !== undefined ? opts.lista_precio_id : listaPrecioFiltro

    const next: CatalogoFilterState = {
      grupo_estilo_id: estId,
      marca_id: marId,
      grupo_estilo_ids: estIds,
      marca_ids: marIds,
      linea_ids: lns,
      tipo_ids: tps,
      colores: cls,
      quincenas: qncs,
      origen_tipo: origen,
      ramo_tipo: ramo,
      deposito_codigo: dep,
      genero_codigo: gen,
      genero_codigos: genIds,
      tonos: sinT ? [] : ton,
      sin_tono: sinT,
      buscar: busq,
      cadena_comercial: cadena,
      tipo_grupos: tGrupos,
      material_familias: matFam,
      color_familias: colFam,
      precio_tope: pTope,
      precio_min: pMin,
      precio_max: pMax,
      lista_precio_id: listaP,
    }

    if (onChange) {
      persistSharedCatalogFilters(next)
      onChange(next)
      return
    }

    persistSharedCatalogFilters(next)

    if (estId)       params.set('grupo_estilo_id', estId)
    if (marId)       params.set('marca_id',        marId)
    if (estIds.length) params.set('grupo_estilo_ids', estIds.join(','))
    if (marIds.length) params.set('marca_ids', marIds.join(','))
    if (lns.length)  params.set('linea_ids',       lns.join(','))
    if (tps.length)  params.set('tipo_ids',        tps.join(','))
    if (cls.length)  params.set('colores',         cls.join(','))
    if (qncs.length) params.set('quincenas',       qncs.join(','))
    if (origen)      params.set('origen_tipo',     origen)
    if (ramo)        params.set('ramo_tipo',       ramo)
    if (dep)         params.set('deposito_codigo', dep)
    if (genIds.length) params.set('genero_codigos', genIds.join(','))
    else if (gen)      params.set('genero_codigo', gen)
    if (sinT)        params.set('sin_tono',        '1')
    else if (ton.length) params.set('tonos',     ton.join(','))
    if (busq.trim()) params.set('buscar',          busq.trim())
    if (cadena.trim()) params.set('cadena_comercial', cadena.trim())
    if (tGrupos.length) params.set('tipo_grupos', tGrupos.join(','))
    if (matFam.length) params.set('material_familias', matFam.join(','))
    if (colFam.length) params.set('color_familias', colFam.join(','))
    if (pTope != null) params.set('precio_tope', String(pTope))
    if (pMin != null) params.set('precio_min', String(pMin))
    if (pMax != null) params.set('precio_max', String(pMax))
    if (listaP != null) params.set('lista_precio_id', String(listaP))
    router.push(`/${params.toString() ? '?' + params.toString() : ''}`)
  }, [estiloIdActual, marcaIdActual, estiloIdsActual, marcaIdsActual, lineasSelIds, tiposSelIds, colorsSel, quincenasSel, origenActual, ramoActual, depositoActual, generoActual, generoIdsActual, tonosSel, sinTono, buscarActual, cadenaActual, tipoGruposSel, materialFamSel, colorFamSel, precioMinActual, precioMaxActual, listaPrecioFiltro, router, onChange])

  useEffect(() => {
    const t = setTimeout(() => {
      if (buscarLocal !== buscarActual) aplicar({ buscar: buscarLocal })
    }, 400)
    return () => clearTimeout(t)
  }, [buscarLocal, buscarActual, aplicar])

  const hayFiltros = !!(
    estiloIdsActual.length || marcaIdsActual.length || lineasSelIds.length || tiposSelIds.length ||
    colorsSel.length || quincenasSel.length || generoIdsActual.length || tonosSel.length || sinTono ||
    buscarActual.trim() || esProntaEntrega || (ramoActual && ramoActual !== 'CALZADO') || depositoActual ||
    (origenActual && origenActual.toUpperCase() !== 'TODOS' && !esProntaEntrega) ||
    tipoGruposSel.length || materialFamSel.length || colorFamSel.length ||
    precioMinActual != null ||
    precioMaxActual != null
  )

  const activeEstiloLabel = estilos.find(e => String(e.id) === estiloIdActual)?.label
  const activeMarcaLabel  = marcas.find(m => String(m.id) === marcaIdActual)?.label
  const tonosActivos = sinTono ? 1 : tonosSel.length

  /* Cabecera densificada: VENTA ocupa franja · Tono+Precio debajo · cero hueco muerto. */
  if (soloCabecera) {
    const limpiarFiltros = () => {
      const empty: CatalogoFilterState = {
        grupo_estilo_id: '', marca_id: '', grupo_estilo_ids: [], marca_ids: [], linea_ids: [], tipo_ids: [], colores: [], quincenas: [],
        origen_tipo: 'TODOS', ramo_tipo: 'CALZADO', deposito_codigo: '',
        genero_codigo: '', genero_codigos: [], tonos: [], sin_tono: false, buscar: '',
        tipo_grupos: [], material_familias: [], color_familias: [],
        precio_tope: null, precio_min: null, precio_max: null, lista_precio_id: null,
      }
      clearSharedCatalogFilters()
      if (onChange) onChange(empty)
      else router.push('/?origen_tipo=TODOS&ramo_tipo=CALZADO')
    }

    return (
      <div className="mb-1.5 space-y-1.5">
        {ventaActiva ? (
          <HeaderSesionVenta
            compact
            trailing={
              <>
                <span className="hidden text-[10px] tabular-nums text-white/75 sm:inline">
                  {totalModelos.toLocaleString('es-PY')} · {totalPares.toLocaleString('es-PY')} pares
                </span>
                {hayFiltros ? (
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="text-[11px] font-semibold text-red-200 hover:text-white hover:underline"
                  >
                    Limpiar
                  </button>
                ) : null}
              </>
            }
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 py-0.5">
            <p className="text-xs text-slate-500 tabular-nums">
              {totalModelos.toLocaleString('es-PY')} tarjetas · {totalPares.toLocaleString('es-PY')} pares
            </p>
            {hayFiltros ? (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <FiltroTonoPrecioFila
              tonoCatalog={tonoCatalog}
              tonosSel={tonosSel}
              sinTono={sinTono}
              onTonoChange={(tonos, sin) => aplicar({ tonos, sin_tono: sin })}
              precioMin={precioMinActual}
              precioMax={precioMaxActual}
              onPrecioAplicar={(min, max, lista) =>
                aplicar({
                  precio_min: min,
                  precio_max: max,
                  precio_tope: null,
                  lista_precio_id: lista,
                })
              }
              rangoPrecioSql={rangoPrecioCatalogo}
            />
          </div>
          {totalModelos > 0 ? (
            <div className="shrink-0 [&_button]:min-h-[32px] [&_button]:px-3 [&_button]:text-[11px]">
              <CatalogExtenderDatosToggle />
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3">
      {/* ── Encabezado (modo pills legacy) ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: RIMEC_BLUE }}>
            {activeEstiloLabel
              ? `Estilo ${activeEstiloLabel}`
              : esProntaEntrega
                ? 'Pronta entrega'
              : activeMarcaLabel
                ? activeMarcaLabel.charAt(0) + activeMarcaLabel.slice(1).toLowerCase()
                : 'Catálogo'}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-sm font-semibold" style={{ color: RIMEC_CELESTE }}>
              {totalModelos.toLocaleString('es-PY')} modelos
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="text-sm text-slate-400">
              {totalPares.toLocaleString('es-PY')} pares disponibles
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={toggleEncabezado}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all hover:border-slate-400 hover:bg-slate-50"
            style={{ borderColor: '#e2e8f0', color: '#64748b' }}
            aria-expanded={!encabezadoOculto}
          >
            {encabezadoOculto ? 'Mostrar filtros ▼' : 'Ocultar filtros ▲'}
          </button>

        {hayFiltros && (
          <button
            onClick={() => {
              const empty: CatalogoFilterState = {
                grupo_estilo_id: '', marca_id: '', grupo_estilo_ids: [], marca_ids: [], linea_ids: [], tipo_ids: [], colores: [], quincenas: [],
                origen_tipo: 'TODOS', ramo_tipo: 'CALZADO', deposito_codigo: '',
                genero_codigo: '', genero_codigos: [], tonos: [], sin_tono: false, buscar: '',
                tipo_grupos: [], material_familias: [], color_familias: [],
              }
              if (onChange) {
                clearSharedCatalogFilters()
                onChange(empty)
              } else {
                clearSharedCatalogFilters()
                router.push('/?origen_tipo=TODOS&ramo_tipo=CALZADO')
              }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl
                       border transition-all hover:border-red-300 hover:text-red-500 hover:bg-red-50"
            style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpiar filtros
          </button>
        )}
        </div>
      </div>

      {!encabezadoOculto ? (
      <div className="border border-slate-200 bg-white p-3 space-y-2.5">

        <>
        {/* Origen — compra previa vs pronta entrega */}
        <div className="flex items-center gap-3 flex-wrap">
          <FilterLabel>Origen</FilterLabel>
          <div className="flex flex-wrap gap-2">
            <MarcaPill
              active={esTodos}
              onClick={() => aplicar({ origen_tipo: 'TODOS', quincenas: [], ramo_tipo: 'CALZADO', deposito_codigo: '' })}
            >
              ⊞ Todos
            </MarcaPill>
            <MarcaPill
              active={esCpSolo}
              onClick={() => aplicar({ origen_tipo: 'CP', quincenas: [], ramo_tipo: 'CALZADO', deposito_codigo: '' })}
            >
              🚢 Compra previa
            </MarcaPill>
            <MarcaPill
              active={esProntaEntrega}
              onClick={() => aplicar({ origen_tipo: 'PRONTA_ENTREGA', quincenas: [], ramo_tipo: 'CALZADO' })}
            >
              📦 Pronta entrega
            </MarcaPill>
          </div>
        </div>

        {(esProntaEntrega || esTodos) && (
          <>
            <div className="h-px bg-slate-200" />
            {/* tipo_v2 — trascendental PE (paridad Report PE) */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <FilterLabel>Categoría</FilterLabel>
              <div
                className="inline-flex flex-wrap gap-1 rounded-2xl border-2 border-orange-300/50 bg-gradient-to-r from-orange-50 via-white to-orange-50 p-1 shadow-sm"
                role="group"
                aria-label="Calzado o Confecciones"
              >
                {!soloConfecciones ? (
                <CategoriaBtn
                  active={ramoActual === 'CALZADO' || !ramoActual}
                  dimmed={!!ramoActual && ramoActual !== 'CALZADO'}
                  onClick={() => aplicar({
                    ramo_tipo: 'CALZADO',
                    ...(ramoActual === 'CALZADO' ? {} : resetCascadaAlCambiarRamo()),
                  })}
                >
                  👟 Calzado
                </CategoriaBtn>
                ) : null}
                {!soloCalzado ? (
                <CategoriaBtn
                  active={ramoActual === 'CONFECCIONES'}
                  dimmed={!!ramoActual && ramoActual !== 'CONFECCIONES'}
                  onClick={() => aplicar({
                    ramo_tipo: ramoActual === 'CONFECCIONES' ? 'CALZADO' : 'CONFECCIONES',
                    ...resetCascadaAlCambiarRamo(),
                  })}
                >
                  👕 Confecciones
                </CategoriaBtn>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <FilterLabel>Depósito</FilterLabel>
              <div className="flex flex-wrap gap-2">
                <DepositoPill
                  active={!depositoActual}
                  onClick={() => aplicar({ deposito_codigo: '' })}
                >
                  Todos
                </DepositoPill>
                {RIMEC_PE_DEPOSITOS.map(d => (
                  <DepositoPill
                    key={d.codigo}
                    active={depositoActual === d.codigo}
                    onClick={() => aplicar({ deposito_codigo: depositoActual === d.codigo ? '' : d.codigo })}
                  >
                    {d.codigo}
                  </DepositoPill>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="h-px bg-slate-200" />

        {/* Dimensiones: Categoría (arriba PE) → AB-CR → Marca → Tipo → Género */}
        {tiposAbcr.length > 0 && (
          <FilterRow label={abcrLabel}>
            <ScrollPillsRow>
              <CabeceraPill active={!tiposSelIds.length} onClick={() => aplicar(cascadaDimensiones({ tipo_ids: [] }))}>
                Todos
              </CabeceraPill>
              {tiposAbcr.map((t, idx) => {
                const sel = tiposSelIds.includes(t.id)
                return (
                  <CabeceraPill
                    key={filterItemKey('abcr', t, idx)}
                    active={sel}
                    onClick={() => {
                      const next = sel ? tiposSelIds.filter(x => x !== t.id) : [...tiposSelIds, t.id]
                      aplicar(cascadaDimensiones({ tipo_ids: next }))
                    }}
                  >
                    {t.label}
                  </CabeceraPill>
                )
              })}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {marcas.length > 0 && (
          <FilterRow label="Marca · multi">
            <ScrollPillsRow>
              <CabeceraPill active={!marcaIdsActual.length} onClick={() => aplicar(cascadaDimensiones({ marca_id: '', marca_ids: [] }))}>
                Todas
              </CabeceraPill>
              {marcas.map((m, idx) => {
                const selected = marcaIdsActual.includes(m.id)
                return (
                  <CabeceraPill
                    key={filterItemKey('marca', m, idx)}
                    active={selected}
                    onClick={() => aplicar(cascadaDimensiones({
                      marca_id: '',
                      marca_ids: selected
                        ? marcaIdsActual.filter((id) => id !== m.id)
                        : [...marcaIdsActual, m.id],
                    }))}
                  >
                    {labelMarcaCatalogo(m.label)}
                  </CabeceraPill>
                )
              })}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {(() => {
          const tipoPeUi = usaDiccionarioPeTipo(origenActual) && ramoActual !== 'ACCESORIOS'
          const opcionesTipo = tipoPeUi
            ? PE_TIPO_DICCIONARIO_OPCIONES
            : tipoGrupoOpcionesVisibles(ramoActual)
          if (!opcionesTipo.length) return null
          return (
        <FilterRow label={tipoPeUi ? 'Tipo · diccionario PE' : 'Tipo · multi'}>
          <ScrollPillsRow>
            <CabeceraPill active={!tipoGruposSel.length} onClick={() => aplicar(cascadaDimensiones({ tipo_grupos: [] }))}>
              Todos
            </CabeceraPill>
            {opcionesTipo.map((t) => {
              const sel = tipoGruposSel.includes(t.id)
              return (
                <CabeceraPill
                  key={t.id}
                  active={sel}
                  onClick={() => {
                    const next = sel
                      ? tipoGruposSel.filter((x) => x !== t.id)
                      : [...tipoGruposSel, t.id]
                    aplicar(cascadaDimensiones({ tipo_grupos: next }))
                  }}
                >
                  {tipoPeUi ? labelPeTipoDiccionario(t.id) : t.label}
                </CabeceraPill>
              )
            })}
          </ScrollPillsRow>
        </FilterRow>
          )
        })()}

        <FilterRow label="Género · multi">
          <ScrollPillsRow>
            <CabeceraPill active={!generoIdsActual.length} onClick={() => aplicar(cascadaDimensiones({ genero_codigo: '', genero_codigos: [] }))}>
              Todos
            </CabeceraPill>
            {generosLista.map(g => {
              const selected = generoIdsActual.includes(g.codigo)
              return (
              <CabeceraPill
                key={g.codigo}
                active={selected}
                onClick={() => aplicar(cascadaDimensiones({
                  genero_codigo: '',
                  genero_codigos: selected
                    ? generoIdsActual.filter((c) => c !== g.codigo)
                    : [...generoIdsActual, g.codigo],
                }))}
              >
                {g.label}
              </CabeceraPill>
              )
            })}
          </ScrollPillsRow>
        </FilterRow>

        <FilterRow label="Buscar">
          <input
            value={buscarLocal}
            onChange={e => setBuscarLocal(e.target.value)}
            placeholder="L-R-M-C · línea · marca · material · color…"
            className="flex-1 min-w-0 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-orange-400"
          />
        </FilterRow>

        <div className="h-px bg-slate-200" />

        {/* Molécula cascada: Estilo → Línea → Material → Color */}
        {estilos.length > 0 && (
          <FilterRow label="Estilo · multi">
            <ScrollPillsRow>
              <CabeceraPill active={!estiloIdsActual.length} onClick={() => aplicar(cascadaEstilo([]))}>
                Todos
              </CabeceraPill>
              {estilos.map((e, idx) => {
                const selected = estiloIdsActual.includes(e.id)
                return (
                  <CabeceraPill
                    key={filterItemKey('estilo', e, idx)}
                    active={selected}
                    onClick={() => aplicar(cascadaEstilo(
                      selected
                        ? estiloIdsActual.filter((id) => id !== e.id)
                        : [...estiloIdsActual, e.id],
                    ))}
                  >
                    {e.label}
                  </CabeceraPill>
                )
              })}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {lineas.length > 0 && (
          <FilterRow label="Línea · multi">
            <ScrollPillsRow>
              <CabeceraPill active={!lineasSelIds.length} onClick={() => aplicar(cascadaLinea([]))}>
                Todas
              </CabeceraPill>
              {lineas.map((l, idx) => {
                const sel = lineasSelIds.includes(l.id)
                return (
                  <CabeceraPill
                    key={filterItemKey('linea', l, idx)}
                    active={sel}
                    onClick={() => aplicar(toggleLineaCascada(lineasSelIds, l.id))}
                  >
                    {l.label}
                  </CabeceraPill>
                )
              })}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {materialFamilias.length > 0 && (
          <FilterRow label="Material">
            <ScrollPillsRow>
              <CabeceraPill
                active={!materialFamSel.length}
                onClick={() => aplicar(cascadaMaterial([]))}
              >
                Todos
              </CabeceraPill>
              {materialFamilias.map((f) => {
                const sel = materialFamSel.includes(f.key)
                return (
                  <CabeceraPill
                    key={`mat-${f.key}`}
                    active={sel}
                    onClick={() => aplicar(toggleMaterialCascada(materialFamSel, f.key))}
                  >
                    {f.label}
                  </CabeceraPill>
                )
              })}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {colorFamilias.length > 0 && (
          <FilterRow label="Color">
            <ScrollPillsRow>
              <CabeceraPill active={!colorFamSel.length} onClick={() => aplicar(cascadaColor([]))}>
                Todos
              </CabeceraPill>
              {colorFamilias.map((f) => {
                const sel = colorFamSel.includes(f.key)
                return (
                  <CabeceraPill
                    key={`col-${f.key}`}
                    active={sel}
                    onClick={() => aplicar(toggleColorCascada(colorFamSel, f.key))}
                  >
                    {f.label}
                  </CabeceraPill>
                )
              })}
            </ScrollPillsRow>
          </FilterRow>
        )}
        </>

        {tonoCatalog.length > 0 && (
          <FilterRow label="Tono">
            <FiltroTonoCabecera
              catalogo={tonoCatalog}
              tonosSel={tonosSel}
              sinTono={sinTono}
              onChange={(tonos, sin) => aplicar({ tonos, sin_tono: sin })}
            />
          </FilterRow>
        )}

        {!esProntaEntrega && quincenas.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <DropdownFilterQuincena
              label="Llegada"
              options={quincenas}
              selected={quincenasSel}
              onChange={qncs => aplicar({ quincenas: qncs })}
              placeholder="Buscar quincena de llegada…"
              showSearch={false}
            />
            <button
              disabled
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl
                         border-2 transition-all opacity-50 cursor-not-allowed"
              style={{ borderColor: '#e2e8f0', color: '#94a3b8', backgroundColor: '#fafafa' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
              </svg>
              Ofertas
            </button>
          </div>
        )}
        {totalModelos > 0 ? (
          <div className="flex justify-end border-t border-slate-100 pt-2">
            <CatalogExtenderDatosToggle />
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  )
}

function DropdownFilterId({ label, options, selectedIds, onChange, placeholder, showSearch = true }: {
  label: string; options: FilterItem[]; selectedIds: number[]; onChange: (vals: number[]) => void; placeholder: string; showSearch?: boolean
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [temp, setTemp]   = useState<number[]>(selectedIds)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setTemp(selectedIds) }, [selectedIds])

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = query.length >= 2
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function toggle(id: number) {
    setTemp(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-xs font-bold transition',
          selectedIds.length
            ? 'border-sky-500 bg-sky-50 text-sky-800'
            : 'border-slate-300 bg-white text-slate-800 hover:border-sky-300',
        ].join(' ')}
      >
        {label}
        {selectedIds.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white text-[10px] border border-sky-100">{selectedIds.length}</span>}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 bg-white rounded-2xl w-64 overflow-hidden"
             style={{ boxShadow: '0 16px 48px rgba(30,64,175,0.18)', border: '1px solid #f1f5f9' }}>
          
          {showSearch && (
            <div className="p-3 border-b" style={{ borderColor: '#f1f5f9' }}>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-xs rounded-xl border outline-none bg-slate-50 focus:border-sky-400"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {filtered.map(o => {
              const sel = temp.includes(o.id)
              return (
                <button key={o.id} onClick={() => toggle(o.id)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-left hover:bg-slate-50 transition-colors">
                  <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: sel ? RIMEC_CELESTE : '#cbd5e1',
                          backgroundColor: sel ? RIMEC_CELESTE : 'white',
                        }}>
                    {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </span>
                  <span className={sel ? 'font-bold text-sky-600' : 'text-slate-600'}>{o.label}</span>
                </button>
              )
            })}
          </div>

          <div className="p-3 flex items-center justify-between border-t" style={{ borderColor: '#f1f5f9' }}>
            <button onClick={() => setTemp([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500">Limpiar</button>
            <button onClick={() => { onChange(temp); setOpen(false) }}
                    className="text-xs font-bold px-4 py-2 rounded-xl text-white bg-sky-500 hover:bg-sky-600">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function DropdownFilter({ label, options, selected, onChange, placeholder, showSearch = true }: {
  label: string; options: string[]; selected: string[]; onChange: (vals: string[]) => void; placeholder: string; showSearch?: boolean
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [temp, setTemp]   = useState<string[]>(selected)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setTemp(selected) }, [selected])

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = query.length >= 2
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  function toggle(o: string) {
    setTemp(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-xs font-bold transition',
          selected.length
            ? 'border-sky-500 bg-sky-50 text-sky-800'
            : 'border-slate-300 bg-white text-slate-800 hover:border-sky-300',
        ].join(' ')}
      >
        {label}
        {selected.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white text-[10px] border border-sky-100">{selected.length}</span>}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 bg-white rounded-2xl w-64 overflow-hidden"
             style={{ boxShadow: '0 16px 48px rgba(30,64,175,0.18)', border: '1px solid #f1f5f9' }}>
          
          {showSearch && (
            <div className="p-3 border-b" style={{ borderColor: '#f1f5f9' }}>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-xs rounded-xl border outline-none bg-slate-50 focus:border-sky-400"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {filtered.map((o, idx) => {
              const sel = temp.includes(o)
              // Fallback de key: si la opción vino sin valor (null/undefined/'')
              // o duplicada, usamos el índice para garantizar unicidad.
              const safeKey = (o !== null && o !== undefined && String(o).length > 0)
                ? String(o)
                : `__empty_${idx}`
              return (
                <button key={safeKey} onClick={() => toggle(o)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-left hover:bg-slate-50 transition-colors">
                  <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: sel ? RIMEC_CELESTE : '#cbd5e1',
                          backgroundColor: sel ? RIMEC_CELESTE : 'white',
                        }}>
                    {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </span>
                  <span className={sel ? 'font-bold text-sky-600' : 'text-slate-600'}>{o}</span>
                </button>
              )
            })}
          </div>

          <div className="p-3 flex items-center justify-between border-t" style={{ borderColor: '#f1f5f9' }}>
            <button onClick={() => setTemp([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500">Limpiar</button>
            <button onClick={() => { onChange(temp); setOpen(false) }}
                    className="text-xs font-bold px-4 py-2 rounded-xl text-white bg-sky-500 hover:bg-sky-600">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function DropdownFilterQuincena({ label, options, selected, onChange, placeholder, showSearch = false, disabled = false }: {
  label: string; options: QuincenaItem[]; selected: number[]; onChange: (vals: number[]) => void; placeholder: string; showSearch?: boolean; disabled?: boolean
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [temp, setTemp]   = useState<number[]>(selected)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setTemp(selected) }, [selected])

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = query.length >= 2
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function toggle(id: number) {
    setTemp(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(!open) }}
        className={[
          'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
          selected.length
            ? 'border-sky-500 bg-sky-50 text-sky-800'
            : 'border-slate-300 bg-white text-slate-800 hover:border-sky-300',
        ].join(' ')}
      >
        {label}
        {selected.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white text-[10px] border border-sky-100">{selected.length}</span>}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-full mt-2 z-30 bg-white rounded-2xl w-64 overflow-hidden"
             style={{ boxShadow: '0 16px 48px rgba(30,64,175,0.18)', border: '1px solid #f1f5f9' }}>

          {showSearch && (
            <div className="p-3 border-b" style={{ borderColor: '#f1f5f9' }}>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-xs rounded-xl border outline-none bg-slate-50 focus:border-sky-400"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {filtered.map(o => {
              const sel = temp.includes(o.id)
              return (
                <button key={o.id} onClick={() => toggle(o.id)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-left hover:bg-slate-50 transition-colors">
                  <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: sel ? RIMEC_CELESTE : '#cbd5e1',
                          backgroundColor: sel ? RIMEC_CELESTE : 'white',
                        }}>
                    {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </span>
                  <span className={sel ? 'font-bold text-sky-600' : 'text-slate-600'}>{o.label}</span>
                </button>
              )
            })}
          </div>

          <div className="p-3 flex items-center justify-between border-t" style={{ borderColor: '#f1f5f9' }}>
            <button onClick={() => setTemp([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500">Limpiar</button>
            <button onClick={() => { onChange(temp); setOpen(false) }}
                    className="text-xs font-bold px-4 py-2 rounded-xl text-white bg-sky-500 hover:bg-sky-600">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-1.5">
      {children}
    </span>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <FilterLabel>{label}</FilterLabel>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function ScrollPillsRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto pb-0.5 -mr-1">
      <div className="flex flex-wrap gap-1.5 min-w-max">{children}</div>
    </div>
  )
}

function CabeceraPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'shrink-0 rounded-full border-2 px-3 py-1 text-[11px] font-bold transition',
        active
          ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-700 hover:border-orange-300',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function CategoriaBtn({
  active,
  dimmed,
  onClick,
  children,
}: {
  active: boolean
  dimmed?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl px-4 py-2.5 text-sm font-black uppercase tracking-wide transition sm:px-6 sm:py-3',
        active
          ? 'bg-orange-600 text-white shadow-md ring-2 ring-orange-400/40'
          : dimmed
            ? 'bg-white/80 text-slate-500 hover:bg-orange-50'
            : 'bg-white text-orange-800 hover:bg-orange-50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function DepositoPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border-2 px-3 py-1.5 font-mono text-xs font-bold transition',
        active
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-800 hover:border-emerald-300',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function LineaPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-800 hover:border-sky-300',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function MarcaPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border-2 px-4 py-1.5 text-xs font-bold transition',
        active
          ? 'border-[#1E40AF] bg-[#1E40AF] text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-800 hover:border-blue-300',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
