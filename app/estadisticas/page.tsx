'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ControlKpis, ControlStockResponse, PeControlStockResponse, PpOption } from '@/lib/controlStock/types'
import { TablaJerarquicaControl } from './components/TablaJerarquicaControl'

const fmt = (n: number) => n.toLocaleString('es-PY')

function KpiMini({
  label,
  value,
  sub,
  accent = 'sky',
}: {
  label: string
  value: string
  sub?: string
  accent?: 'sky' | 'orange'
}) {
  const border = accent === 'orange' ? 'border-orange-200' : 'border-sky-200'
  const labelC = accent === 'orange' ? 'text-orange-700/80' : 'text-sky-800/70'
  return (
    <div className={`rounded-lg border ${border} bg-white px-3 py-2 shadow-sm`}>
      <p className={`text-[9px] uppercase tracking-widest ${labelC} mb-0.5`}>{label}</p>
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      {sub ? <p className="text-[9px] text-slate-500">{sub}</p> : null}
    </div>
  )
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  accent = 'sky',
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  accent?: 'sky' | 'orange'
}) {
  const onCls =
    accent === 'orange'
      ? 'bg-orange-100 border-orange-300 text-orange-950'
      : 'bg-sky-100 border-sky-300 text-sky-950'
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
        {options.map(opt => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(on ? selected.filter(x => x !== opt) : [...selected, opt])}
              className={`text-[11px] px-2 py-0.5 rounded-md border ${
                on ? onCls : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TarjetaCompraPrevia() {
  const [data, setData] = useState<ControlStockResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ppSel, setPpSel] = useState<number[]>([])
  const [genSel, setGenSel] = useState<string[]>([])
  const [marSel, setMarSel] = useState<string[]>([])
  const [estSel, setEstSel] = useState<string[]>([])
  const [soloSaldo, setSoloSaldo] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ origen: 'compra_previa' })
    if (ppSel.length) qs.set('pp_ids', ppSel.join(','))
    if (genSel.length) qs.set('generos', genSel.join('|'))
    if (marSel.length) qs.set('marcas', marSel.join('|'))
    if (estSel.length) qs.set('estilos', estSel.join('|'))
    if (soloSaldo) qs.set('solo_saldo', '1')
    try {
      const r = await fetch(`/api/estadisticas?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Error al cargar')
      setData(j as ControlStockResponse)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [ppSel, genSel, marSel, estSel, soloSaldo])

  useEffect(() => { void cargar() }, [cargar])

  const kpis: ControlKpis = data?.kpis ?? {
    inicial: 0, vendido: 0, saldo: 0, pct_vendido: null, skus: 0, marcas: 0, pps: 0,
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-[520px]">
      <div className="px-5 py-4 border-b border-slate-200 bg-sky-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>🚢</span>
          <div>
            <h2 className="text-lg font-bold text-rimec-azul">Compra previa</h2>
            <p className="text-xs text-slate-500">
              Tránsito · proforma + ETA · sin PROGRAMADO
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col bg-[#f8fafc]">
        <div className="grid grid-cols-2 gap-2">
          <KpiMini label="Vendido" value={fmt(kpis.vendido)} sub="pares" />
          <KpiMini label="Disponible" value={fmt(kpis.saldo)} sub="pares" />
          <KpiMini label="SKUs" value={String(kpis.skus)} />
          <KpiMini label="Marcas" value={String(kpis.marcas)} sub={`${kpis.pps} lotes`} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-800/80">
            Filtros · proforma / llegada
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {(data?.pps ?? []).map((pp: PpOption) => {
              const active = ppSel.includes(pp.id)
              return (
                <button
                  key={pp.id}
                  type="button"
                  title={`${pp.nro}${pp.proforma ? ` · ${pp.proforma}` : ''}${pp.preventa ? ` · preventa ${pp.preventa}` : ''}`}
                  onClick={() =>
                    setPpSel(prev =>
                      prev.includes(pp.id) ? prev.filter(x => x !== pp.id) : [...prev, pp.id],
                    )
                  }
                  className={`text-[10px] px-2 py-1 rounded border text-left ${
                    active
                      ? 'bg-sky-100 border-sky-400 text-sky-950 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span className="font-bold">{pp.proforma || 'Sin proforma'}</span>
                  <span className="text-slate-500"> · {pp.eta ? pp.eta.slice(5) : 'sin ETA'}</span>
                  {pp.preventa ? (
                    <span className="text-sky-800 font-mono font-semibold"> · {pp.preventa}</span>
                  ) : null}
                  <span className="block text-[9px] font-mono text-slate-400">{pp.nro}</span>
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <MultiSelect label="Género" options={data?.generos ?? []} selected={genSel} onChange={setGenSel} />
            <MultiSelect label="Marca" options={data?.marcas ?? []} selected={marSel} onChange={setMarSel} />
            <MultiSelect label="Estilo" options={data?.estilos ?? []} selected={estSel} onChange={setEstSel} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={soloSaldo} onChange={e => setSoloSaldo(e.target.checked)} className="accent-sky-600" />
              Solo saldo &gt; 0
            </label>
            <button type="button" onClick={() => { setPpSel([]); setGenSel([]); setMarSel([]); setEstSel([]); setSoloSaldo(false) }}
              className="text-[10px] text-slate-400 hover:text-slate-700">Limpiar</button>
            <button type="button" onClick={() => void cargar()}
              className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-rimec-azul hover:opacity-90 text-white">
              {loading ? '…' : 'Aplicar'}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex-1 min-h-[180px] overflow-auto">
          {loading && !data ? (
            <p className="text-center text-slate-400 py-8 text-sm">Cargando…</p>
          ) : (
            <TablaJerarquicaControl arbol={data?.arbol ?? []} compact />
          )}
        </div>
      </div>
    </section>
  )
}

function TarjetaProntaEntrega() {
  const [data, setData] = useState<PeControlStockResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [depSel, setDepSel] = useState<string[]>([])
  const [marSel, setMarSel] = useState<string[]>([])
  const [estSel, setEstSel] = useState<string[]>([])
  const [soloSaldo, setSoloSaldo] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ origen: 'pronta_entrega' })
    if (depSel.length) qs.set('depositos', depSel.join('|'))
    if (marSel.length) qs.set('marcas', marSel.join('|'))
    if (estSel.length) qs.set('estilos', estSel.join('|'))
    if (soloSaldo) qs.set('solo_saldo', '1')
    try {
      const r = await fetch(`/api/estadisticas?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Error al cargar')
      setData(j as PeControlStockResponse)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [depSel, marSel, estSel, soloSaldo])

  useEffect(() => { void cargar() }, [cargar])

  const kpis: ControlKpis = data?.kpis ?? {
    inicial: 0, vendido: 0, saldo: 0, pct_vendido: null, skus: 0, marcas: 0, pps: 0,
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-[520px]">
      <div className="px-5 py-4 border-b border-slate-200 bg-orange-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>📦</span>
          <div>
            <h2 className="text-lg font-bold text-orange-900">Pronta entrega</h2>
            <p className="text-xs text-slate-500">Depósito local · Depósito → Marca → Estilo</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col bg-[#f8fafc]">
        <div className="grid grid-cols-2 gap-2">
          <KpiMini label="Vendido" value={fmt(kpis.vendido)} sub="pares" accent="orange" />
          <KpiMini label="Disponible" value={fmt(kpis.saldo)} sub="pares" accent="orange" />
          <KpiMini label="SKUs" value={String(kpis.skus)} accent="orange" />
          <KpiMini label="Marcas" value={String(kpis.marcas)} sub={`${kpis.pps} depósitos`} accent="orange" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-800/80">Filtros</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <MultiSelect label="Depósito" options={data?.depositos ?? []} selected={depSel} onChange={setDepSel} accent="orange" />
            <MultiSelect label="Marca" options={data?.marcas ?? []} selected={marSel} onChange={setMarSel} accent="orange" />
            <MultiSelect label="Estilo" options={data?.estilos ?? []} selected={estSel} onChange={setEstSel} accent="orange" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={soloSaldo} onChange={e => setSoloSaldo(e.target.checked)} className="accent-orange-600" />
              Solo saldo &gt; 0
            </label>
            <button type="button" onClick={() => { setDepSel([]); setMarSel([]); setEstSel([]); setSoloSaldo(false) }}
              className="text-[10px] text-slate-400 hover:text-slate-700">Limpiar</button>
            <button type="button" onClick={() => void cargar()}
              className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white">
              {loading ? '…' : 'Aplicar'}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex-1 min-h-[180px] overflow-auto">
          {loading && !data ? (
            <p className="text-center text-slate-400 py-8 text-sm">Cargando…</p>
          ) : (
            <TablaJerarquicaControl arbol={data?.arbol ?? []} compact />
          )}
        </div>
      </div>
    </section>
  )
}

export default function EstadisticasPage() {
  return (
    <div className="-mx-3 sm:-mx-4 md:-mx-8 lg:-mx-12 -mt-3 md:-mt-5 min-h-[calc(100vh-4rem)] min-w-0 overflow-x-clip bg-[#f1f5f9] text-slate-900 px-3 sm:px-4 md:px-8 lg:px-12 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-rimec-azul">Estadísticas</h1>
          <p className="text-sm text-slate-600 mt-1">
            Compra previa y Pronta entrega · vendido vs disponible · NIIF
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-rimec-azul hover:bg-slate-50 sm:w-auto"
        >
          ← Catálogo
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TarjetaCompraPrevia />
        <TarjetaProntaEntrega />
      </div>
    </div>
  )
}
