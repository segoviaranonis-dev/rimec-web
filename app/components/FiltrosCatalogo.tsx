'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface FilterItem {
  id: number
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
  colores: string[]
  quincenas: QuincenaItem[]
  totalModelos: number
  totalPares:   number
}

const RIMEC_BLUE   = '#1E40AF'
const RIMEC_CELESTE = '#0EA5E9'

export function FiltrosCatalogo({ estilos, marcas, lineas, tipos, colores, quincenas, totalModelos, totalPares }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const estiloIdActual = searchParams.get('grupo_estilo_id') ?? ''
  const marcaIdActual  = searchParams.get('marca_id')        ?? ''

  const lineasSelIds = searchParams.get('linea_ids')   ? searchParams.get('linea_ids')!.split(',').filter(Boolean).map(Number) : []
  const tiposSelIds  = searchParams.get('tipo_ids')    ? searchParams.get('tipo_ids')!.split(',').filter(Boolean).map(Number) : []
  const colorsSel    = searchParams.get('colores')     ? searchParams.get('colores')!.split(',').filter(Boolean) : []
  const quincenasSel = searchParams.get('quincenas')   ? searchParams.get('quincenas')!.split(',').filter(Boolean).map(Number) : []

  const aplicar = useCallback((opts: { grupo_estilo_id?: string; marca_id?: string; linea_ids?: number[]; tipo_ids?: number[]; cols?: string[]; quincenas?: number[] }) => {
    const params = new URLSearchParams()

    const estId = opts.grupo_estilo_id !== undefined ? opts.grupo_estilo_id : estiloIdActual
    const marId = opts.marca_id        !== undefined ? opts.marca_id        : marcaIdActual
    const lns   = opts.linea_ids       !== undefined ? opts.linea_ids       : lineasSelIds
    const tps   = opts.tipo_ids        !== undefined ? opts.tipo_ids        : tiposSelIds
    const cls   = opts.cols            !== undefined ? opts.cols            : colorsSel
    const qncs  = opts.quincenas       !== undefined ? opts.quincenas       : quincenasSel

    if (estId)       params.set('grupo_estilo_id', estId)
    if (marId)       params.set('marca_id',        marId)
    if (lns.length)  params.set('linea_ids',       lns.join(','))
    if (tps.length)  params.set('tipo_ids',        tps.join(','))
    if (cls.length)  params.set('colores',         cls.join(','))
    if (qncs.length) params.set('quincenas',       qncs.join(','))

    router.push(`/${params.toString() ? '?' + params.toString() : ''}`)
  }, [estiloIdActual, marcaIdActual, lineasSelIds, tiposSelIds, colorsSel, quincenasSel, router])

  const hayFiltros = !!(estiloIdActual || marcaIdActual || lineasSelIds.length || tiposSelIds.length || colorsSel.length || quincenasSel.length)

  const activeEstiloLabel = estilos.find(e => String(e.id) === estiloIdActual)?.label
  const activeMarcaLabel  = marcas.find(m => String(m.id) === marcaIdActual)?.label

  return (
    <div className="mb-8">
      {/* ── Encabezado ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: RIMEC_BLUE }}>
            {activeEstiloLabel
              ? `Estilo ${activeEstiloLabel}`
              : activeMarcaLabel
                ? activeMarcaLabel.charAt(0) + activeMarcaLabel.slice(1).toLowerCase()
                : 'Catálogo'}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-semibold" style={{ color: RIMEC_CELESTE }}>
              {totalModelos.toLocaleString('es-PY')} modelos
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="text-sm text-slate-400">
              {totalPares.toLocaleString('es-PY')} pares disponibles
            </span>
          </div>
        </div>

        {hayFiltros && (
          <button
            onClick={() => router.push('/')}
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

      {/* ── Barra de filtros unificada ── */}
      <div className="bg-white rounded-2xl p-4 space-y-4"
           style={{ boxShadow: '0 2px 16px rgba(30,64,175,0.07)', border: '1px solid #f1f5f9' }}>

        {/* Marcas (Burbujas) */}
        {marcas.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest shrink-0"
                  style={{ color: '#94a3b8', width: 50 }}>Marca</span>
            <div className="flex flex-wrap gap-1.5">
              <MarcaPill active={!marcaIdActual} onClick={() => aplicar({ marca_id: '' })}>
                Todas
              </MarcaPill>
              {marcas.map(m => (
                <MarcaPill key={m.id} active={marcaIdActual === String(m.id)}
                  onClick={() => aplicar({ marca_id: marcaIdActual === String(m.id) ? '' : String(m.id) })}>
                  {m.label.charAt(0) + m.label.slice(1).toLowerCase()}
                </MarcaPill>
              ))}
            </div>
          </div>
        )}

        {/* Separador */}
        <div className="h-px" style={{ backgroundColor: '#f1f5f9' }} />

        {/* Estilos (Burbujas) */}
        {estilos.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest shrink-0"
                  style={{ color: '#94a3b8', width: 50 }}>Estilo</span>
            <div className="flex flex-wrap gap-1.5">
              <LineaPill active={!estiloIdActual} onClick={() => aplicar({ grupo_estilo_id: '' })}>
                Todos
              </LineaPill>
              {estilos.slice(0, 15).map(e => (
                <LineaPill key={e.id} active={estiloIdActual === String(e.id)}
                  onClick={() => aplicar({ grupo_estilo_id: estiloIdActual === String(e.id) ? '' : String(e.id) })}>
                  {e.label}
                </LineaPill>
              ))}
            </div>
          </div>
        )}

        {/* Separador */}
        <div className="h-px" style={{ backgroundColor: '#f1f5f9' }} />

        {/* Dropdowns Multiselect Row */}
        <div className="flex flex-wrap items-center gap-3">
          <DropdownFilterId
            label="Línea"
            options={lineas}
            selectedIds={lineasSelIds}
            onChange={lns => aplicar({ linea_ids: lns })}
            placeholder="Buscar línea…"
          />

          <DropdownFilter
            label="Color"
            options={colores}
            selected={colorsSel}
            onChange={cls => aplicar({ cols: cls })}
            placeholder="Buscar color…"
            showSearch={true}
          />

          <DropdownFilterId
            label="Tipo 1"
            options={tipos}
            selectedIds={tiposSelIds}
            onChange={tps => aplicar({ tipo_ids: tps })}
            placeholder="Buscar tipo 1…"
            showSearch={true}
          />

          <DropdownFilterQuincena
            label="Llegada"
            options={quincenas}
            selected={quincenasSel}
            onChange={qncs => aplicar({ quincenas: qncs })}
            placeholder="Buscar quincena de llegada…"
            showSearch={false}
          />

          {/* Ofertas toggle */}
          <button
            disabled
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl
                       border-2 transition-all opacity-50 cursor-not-allowed ml-auto sm:ml-0"
            style={{ borderColor: '#e2e8f0', color: '#94a3b8', backgroundColor: '#fafafa' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            Ofertas
          </button>
        </div>
      </div>
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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border-2 transition-all"
        style={{
          borderColor: selectedIds.length ? RIMEC_CELESTE : '#e2e8f0',
          color:       selectedIds.length ? RIMEC_CELESTE : '#64748b',
          backgroundColor: selectedIds.length ? '#f0f9ff' : '#fafafa',
        }}
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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border-2 transition-all"
        style={{
          borderColor: selected.length ? RIMEC_CELESTE : '#e2e8f0',
          color:       selected.length ? RIMEC_CELESTE : '#64748b',
          backgroundColor: selected.length ? '#f0f9ff' : '#fafafa',
        }}
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

function DropdownFilterQuincena({ label, options, selected, onChange, placeholder, showSearch = false }: {
  label: string; options: QuincenaItem[]; selected: number[]; onChange: (vals: number[]) => void; placeholder: string; showSearch?: boolean
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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border-2 transition-all"
        style={{
          borderColor: selected.length ? RIMEC_CELESTE : '#e2e8f0',
          color:       selected.length ? RIMEC_CELESTE : '#64748b',
          backgroundColor: selected.length ? '#f0f9ff' : '#fafafa',
        }}
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

function LineaPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
      style={active
        ? { backgroundColor: RIMEC_CELESTE, color: 'white', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }
        : { backgroundColor: 'white', color: '#64748b', border: '1.5px solid #e2e8f0' }}
    >{children}</button>
  )
}

function MarcaPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-150"
      style={active
        ? { backgroundColor: RIMEC_BLUE, color: 'white', boxShadow: '0 2px 8px rgba(30,64,175,0.25)' }
        : { backgroundColor: '#f1f5f9', color: '#64748b' }}
    >{children}</button>
  )
}
