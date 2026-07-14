'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RIMEC_PE_DEPOSITOS, type PeDepositoCodigo, type PeRamoTipo } from '@/lib/rimecPeDeposito'
import { clearSharedCatalogFilters, persistSharedCatalogFilters } from '@/lib/catalogoFiltrosCompartidos'
import { FiltroTonoCabecera } from '@/components/catalog/FiltroTonoCabecera'
import { CatalogExtenderDatosToggle } from '@/components/catalog/CatalogAcordeonContext'
import type { ColorEstandar } from '@/lib/pilares/colores-estandar'

interface FilterItem {
  id: number
  label: string
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
  totalModelos: number
  totalPares:   number
  value?: CatalogoFilterState
  onChange?: (filters: CatalogoFilterState) => void
}

export type CatalogoFilterState = {
  grupo_estilo_id: string
  marca_id: string
  linea_ids: number[]
  tipo_ids: number[]
  colores: string[]
  quincenas: number[]
  origen_tipo?: string
  ramo_tipo?: '' | PeRamoTipo
  deposito_codigo?: '' | PeDepositoCodigo
  genero_codigo?: string
  tonos?: string[]
  sin_tono?: boolean
  buscar?: string
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

export function FiltrosCatalogo({
  estilos, marcas, lineas, tipos, generos, tonoCatalog,
  colores, quincenas, totalModelos, totalPares, value, onChange,
}: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const estiloIdActual = value?.grupo_estilo_id ?? searchParams.get('grupo_estilo_id') ?? ''
  const marcaIdActual  = value?.marca_id        ?? searchParams.get('marca_id')        ?? ''

  const lineasSelIds = value?.linea_ids ?? (searchParams.get('linea_ids') ? searchParams.get('linea_ids')!.split(',').filter(Boolean).map(Number) : [])
  const tiposSelIds  = value?.tipo_ids ?? (searchParams.get('tipo_ids') ? searchParams.get('tipo_ids')!.split(',').filter(Boolean).map(Number) : [])
  const colorsSel    = value?.colores ?? (searchParams.get('colores') ? searchParams.get('colores')!.split(',').filter(Boolean) : [])
  const quincenasSel = value?.quincenas ?? (searchParams.get('quincenas') ? searchParams.get('quincenas')!.split(',').filter(Boolean).map(Number) : [])
  const origenActual = value?.origen_tipo ?? searchParams.get('origen_tipo') ?? ''
  const ramoActual = value?.ramo_tipo ?? (searchParams.get('ramo_tipo') as PeRamoTipo | '') ?? ''
  const depositoActual = value?.deposito_codigo ?? (searchParams.get('deposito_codigo') as PeDepositoCodigo | '') ?? ''
  const generoActual = value?.genero_codigo ?? searchParams.get('genero_codigo') ?? ''
  const tonosSel = value?.tonos ?? (searchParams.get('tonos') ? searchParams.get('tonos')!.split(',').filter(Boolean) : [])
  const sinTono = value?.sin_tono ?? searchParams.get('sin_tono') === '1'
  const buscarActual = value?.buscar ?? searchParams.get('buscar') ?? ''
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

  const resetCascadeAlCambiarRamo = {
    marca_id: '',
    linea_ids: [] as number[],
    tipo_ids: [] as number[],
    grupo_estilo_id: '',
  }

  const aplicar = useCallback((opts: {
    grupo_estilo_id?: string
    marca_id?: string
    linea_ids?: number[]
    tipo_ids?: number[]
    cols?: string[]
    quincenas?: number[]
    origen_tipo?: string
    ramo_tipo?: '' | PeRamoTipo
    deposito_codigo?: '' | PeDepositoCodigo
    genero_codigo?: string
    tonos?: string[]
    sin_tono?: boolean
    buscar?: string
  }) => {
    const params = new URLSearchParams()

    const estId = opts.grupo_estilo_id !== undefined ? opts.grupo_estilo_id : estiloIdActual
    const marId = opts.marca_id        !== undefined ? opts.marca_id        : marcaIdActual
    const lns   = opts.linea_ids       !== undefined ? opts.linea_ids       : lineasSelIds
    const tps   = opts.tipo_ids        !== undefined ? opts.tipo_ids        : tiposSelIds
    const cls   = opts.cols            !== undefined ? opts.cols            : colorsSel
    const qncs  = opts.quincenas       !== undefined ? opts.quincenas       : quincenasSel
    const origen = opts.origen_tipo    !== undefined ? opts.origen_tipo     : origenActual
    const ramo   = opts.ramo_tipo       !== undefined ? opts.ramo_tipo       : ramoActual
    const dep    = opts.deposito_codigo !== undefined ? opts.deposito_codigo : depositoActual
    const gen    = opts.genero_codigo   !== undefined ? opts.genero_codigo   : generoActual
    const ton    = opts.tonos           !== undefined ? opts.tonos           : tonosSel
    const sinT   = opts.sin_tono        !== undefined ? opts.sin_tono        : sinTono
    const busq   = opts.buscar          !== undefined ? opts.buscar          : buscarActual

    const next = {
      grupo_estilo_id: estId,
      marca_id: marId,
      linea_ids: lns,
      tipo_ids: tps,
      colores: cls,
      quincenas: qncs,
      origen_tipo: origen,
      ramo_tipo: ramo,
      deposito_codigo: dep,
      genero_codigo: gen,
      tonos: sinT ? [] : ton,
      sin_tono: sinT,
      buscar: busq,
    }

    if (onChange) {
      persistSharedCatalogFilters(next)
      onChange(next)
      return
    }

    persistSharedCatalogFilters(next)

    if (estId)       params.set('grupo_estilo_id', estId)
    if (marId)       params.set('marca_id',        marId)
    if (lns.length)  params.set('linea_ids',       lns.join(','))
    if (tps.length)  params.set('tipo_ids',        tps.join(','))
    if (cls.length)  params.set('colores',         cls.join(','))
    if (qncs.length) params.set('quincenas',       qncs.join(','))
    if (origen)      params.set('origen_tipo',     origen)
    if (ramo)        params.set('ramo_tipo',       ramo)
    if (dep)         params.set('deposito_codigo', dep)
    if (gen)         params.set('genero_codigo',   gen)
    if (sinT)        params.set('sin_tono',        '1')
    else if (ton.length) params.set('tonos',     ton.join(','))
    if (busq.trim()) params.set('buscar',          busq.trim())
    router.push(`/${params.toString() ? '?' + params.toString() : ''}`)
  }, [estiloIdActual, marcaIdActual, lineasSelIds, tiposSelIds, colorsSel, quincenasSel, origenActual, ramoActual, depositoActual, generoActual, tonosSel, sinTono, buscarActual, router, onChange])

  useEffect(() => {
    const t = setTimeout(() => {
      if (buscarLocal !== buscarActual) aplicar({ buscar: buscarLocal })
    }, 400)
    return () => clearTimeout(t)
  }, [buscarLocal, buscarActual, aplicar])

  const hayFiltros = !!(
    estiloIdActual || marcaIdActual || lineasSelIds.length || tiposSelIds.length ||
    colorsSel.length || quincenasSel.length || generoActual || tonosSel.length || sinTono ||
    buscarActual.trim() || esProntaEntrega || (ramoActual && ramoActual !== 'CALZADO') || depositoActual ||
    (origenActual && origenActual.toUpperCase() !== 'TODOS' && !esProntaEntrega)
  )

  const activeEstiloLabel = estilos.find(e => String(e.id) === estiloIdActual)?.label
  const activeMarcaLabel  = marcas.find(m => String(m.id) === marcaIdActual)?.label

  return (
    <div className="mb-3">
      {/* ── Encabezado ── */}
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
                grupo_estilo_id: '', marca_id: '', linea_ids: [], tipo_ids: [], colores: [], quincenas: [],
                origen_tipo: 'TODOS', ramo_tipo: 'CALZADO', deposito_codigo: '',
                genero_codigo: '', tonos: [], sin_tono: false, buscar: '',
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
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-md space-y-2.5">

        {/* Origen — compra previa vs pronta entrega */}
        <div className="flex items-center gap-3 flex-wrap">
          <FilterLabel>Origen</FilterLabel>
          <div className="flex flex-wrap gap-2">
            <MarcaPill
              active={esTodos}
              onClick={() => aplicar({ origen_tipo: 'TODOS', quincenas: [], ramo_tipo: '', deposito_codigo: '' })}
            >
              ⊞ Todos
            </MarcaPill>
            <MarcaPill
              active={esCpSolo}
              onClick={() => aplicar({ origen_tipo: 'CP', quincenas: [], ramo_tipo: '', deposito_codigo: '' })}
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
                <CategoriaBtn
                  active={ramoActual === 'CALZADO'}
                  dimmed={!!ramoActual && ramoActual !== 'CALZADO'}
                  onClick={() => aplicar({
                    ramo_tipo: ramoActual === 'CALZADO' ? '' : 'CALZADO',
                    ...(ramoActual === 'CALZADO' ? {} : resetCascadeAlCambiarRamo),
                  })}
                >
                  👟 Calzado
                </CategoriaBtn>
                <CategoriaBtn
                  active={ramoActual === 'CONFECCIONES'}
                  dimmed={!!ramoActual && ramoActual !== 'CONFECCIONES'}
                  onClick={() => aplicar({
                    ramo_tipo: ramoActual === 'CONFECCIONES' ? '' : 'CONFECCIONES',
                    ...(ramoActual === 'CONFECCIONES' ? {} : resetCascadeAlCambiarRamo),
                  })}
                >
                  👕 Confecciones
                </CategoriaBtn>
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

        {/* Género */}
        {!esProntaEntrega && (
          <FilterRow label="Género">
            <ScrollPillsRow>
              <CabeceraPill active={!generoActual} onClick={() => aplicar({ genero_codigo: '' })}>
                Todos
              </CabeceraPill>
              {generosLista.map(g => (
                <CabeceraPill
                  key={g.codigo}
                  active={generoActual === g.codigo}
                  onClick={() => aplicar({ genero_codigo: generoActual === g.codigo ? '' : g.codigo })}
                >
                  {g.label}
                </CabeceraPill>
              ))}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {/* Marcas */}
        {marcas.length > 0 && (
          <FilterRow label="Marca">
            <ScrollPillsRow>
              <CabeceraPill active={!marcaIdActual} onClick={() => aplicar({ marca_id: '', linea_ids: [], tonos: [], sin_tono: false })}>
                Todas
              </CabeceraPill>
              {marcas.map(m => (
                <CabeceraPill
                  key={m.id}
                  active={marcaIdActual === String(m.id)}
                  onClick={() => aplicar({
                    marca_id: marcaIdActual === String(m.id) ? '' : String(m.id),
                    linea_ids: [],
                    tonos: [],
                    sin_tono: false,
                  })}
                >
                  {m.label.charAt(0) + m.label.slice(1).toLowerCase()}
                </CabeceraPill>
              ))}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {estilos.length > 0 && (
          <FilterRow label="Estilo">
            <ScrollPillsRow>
              <CabeceraPill active={!estiloIdActual} onClick={() => aplicar({ grupo_estilo_id: '', linea_ids: [], tipo_ids: [] })}>
                Todos
              </CabeceraPill>
              {estilos.map(e => (
                <CabeceraPill
                  key={e.id}
                  active={estiloIdActual === String(e.id)}
                  onClick={() => aplicar({
                    grupo_estilo_id: estiloIdActual === String(e.id) ? '' : String(e.id),
                    linea_ids: [],
                    tipo_ids: [],
                  })}
                >
                  {e.label}
                </CabeceraPill>
              ))}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {!esProntaEntrega && tipos.length > 0 && (
          <FilterRow label="Tipo 1">
            <ScrollPillsRow>
              <CabeceraPill active={!tiposSelIds.length} onClick={() => aplicar({ tipo_ids: [] })}>
                Todos
              </CabeceraPill>
              {tipos.map(t => {
                const sel = tiposSelIds.includes(t.id)
                return (
                  <CabeceraPill
                    key={t.id}
                    active={sel}
                    onClick={() => {
                      const next = sel ? tiposSelIds.filter(x => x !== t.id) : [...tiposSelIds, t.id]
                      aplicar({ tipo_ids: next })
                    }}
                  >
                    {t.label}
                  </CabeceraPill>
                )
              })}
            </ScrollPillsRow>
          </FilterRow>
        )}

        {lineas.length > 0 && (
          <FilterRow label="Línea">
            <ScrollPillsRow>
              <CabeceraPill active={!lineasSelIds.length} onClick={() => aplicar({ linea_ids: [] })}>
                Todas
              </CabeceraPill>
              {lineas.map(l => {
                const sel = lineasSelIds.includes(l.id)
                return (
                  <CabeceraPill
                    key={l.id}
                    active={sel}
                    onClick={() => {
                      const next = sel ? lineasSelIds.filter(x => x !== l.id) : [...lineasSelIds, l.id]
                      aplicar({ linea_ids: next })
                    }}
                  >
                    {l.label}
                  </CabeceraPill>
                )
              })}
            </ScrollPillsRow>
          </FilterRow>
        )}

        <FilterRow label="Buscar">
          <input
            value={buscarLocal}
            onChange={e => setBuscarLocal(e.target.value)}
            placeholder="Línea, ref, marca, material, color…"
            className="flex-1 min-w-0 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-orange-400"
          />
        </FilterRow>

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
