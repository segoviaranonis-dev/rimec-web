'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ControlKpis, ControlStockResponse, PpOption } from '@/lib/controlStock/types'
import { TablaJerarquicaControl } from './components/TablaJerarquicaControl'

const fmt = (n: number) => n.toLocaleString('es-PY')

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">{label}</p>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      {sub ? <p className="text-[10px] text-white/40 mt-0.5">{sub}</p> : null}
    </div>
  )
}

export default function EstadisticasPage() {
  const [data, setData] = useState<ControlStockResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ppSel, setPpSel] = useState<number[]>([])
  const [genSel, setGenSel] = useState<string[]>([])
  const [marSel, setMarSel] = useState<string[]>([])
  const [estSel, setEstSel] = useState<string[]>([])
  const [soloSaldo, setSoloSaldo] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams()
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

  useEffect(() => {
    void cargar()
  }, [cargar])

  const kpis: ControlKpis = data?.kpis ?? {
    inicial: 0,
    vendido: 0,
    saldo: 0,
    pct_vendido: null,
    skus: 0,
    marcas: 0,
    pps: 0,
  }

  return (
    <div className="-mx-4 md:-mx-8 lg:-mx-12 -mt-8 md:-mt-12 min-h-screen bg-[#0b1528] text-white px-4 md:px-8 lg:px-12 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Estadísticas · Control tránsito</h1>
          <p className="text-sm text-white/50 mt-1">
            PP → Género → Marca → Estilo → 5 pilares · Inicial / Vendido / Saldo
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sky-300"
        >
          ← Catálogo
        </Link>
      </div>

      {/* Filtros cabecera */}
      <div className="rounded-2xl border border-white/10 bg-[#0f1f35] p-4 mb-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/90">
          Filtros
        </p>

        <div>
          <p className="text-xs text-white/50 mb-2">Pedido proveedor (PP)</p>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {(data?.pps ?? []).map((pp: PpOption) => {
              const on = ppSel.length === 0 || ppSel.includes(pp.id)
              return (
                <button
                  key={pp.id}
                  type="button"
                  onClick={() =>
                    setPpSel(prev =>
                      prev.includes(pp.id)
                        ? prev.filter(x => x !== pp.id)
                        : [...prev, pp.id],
                    )
                  }
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    on && ppSel.includes(pp.id)
                      ? 'bg-sky-500/30 border-sky-400/50 text-sky-100'
                      : ppSel.length === 0
                        ? 'bg-white/10 border-white/20 text-white/80'
                        : 'bg-transparent border-white/10 text-white/40'
                  }`}
                >
                  {pp.nro}
                  {pp.eta ? ` · ${pp.eta}` : ''}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-white/35 mt-1">
            Sin selección = todos los PP en tránsito. Clic para filtrar uno o varios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MultiSelect
            label="Género"
            options={data?.generos ?? []}
            selected={genSel}
            onChange={setGenSel}
          />
          <MultiSelect
            label="Marca"
            options={data?.marcas ?? []}
            selected={marSel}
            onChange={setMarSel}
          />
          <MultiSelect
            label="Estilo"
            options={data?.estilos ?? []}
            selected={estSel}
            onChange={setEstSel}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={soloSaldo}
              onChange={e => setSoloSaldo(e.target.checked)}
              className="accent-sky-400"
            />
            Solo con saldo &gt; 0
          </label>
          <button
            type="button"
            onClick={() => {
              setPpSel([])
              setGenSel([])
              setMarSel([])
              setEstSel([])
              setSoloSaldo(false)
            }}
            className="text-xs text-white/50 hover:text-white"
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={() => void cargar()}
            className="ml-auto text-sm font-semibold px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white"
          >
            {loading ? 'Cargando…' : 'Aplicar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Inicial" value={fmt(kpis.inicial)} sub="pares" />
        <KpiCard label="Vendido" value={fmt(kpis.vendido)} sub="pares" />
        <KpiCard label="Saldo" value={fmt(kpis.saldo)} sub="pares" />
        <KpiCard
          label="% vendido"
          value={kpis.pct_vendido != null ? `${kpis.pct_vendido.toFixed(1)}%` : '—'}
        />
        <KpiCard label="SKUs" value={String(kpis.skus)} />
        <KpiCard label="Marcas" value={String(kpis.marcas)} sub={`${kpis.pps} PP`} />
      </div>

      <p className="text-xs text-white/40 mb-3">
        Marque filas con checkbox para armar reporte. Estilo Sales Report — estructura de análisis.
      </p>

      {loading && !data ? (
        <p className="text-center text-white/50 py-20">Cargando datos…</p>
      ) : (
        <TablaJerarquicaControl
          arbol={data?.arbol ?? []}
          seleccionados={seleccionados}
          onSeleccionChange={setSeleccionados}
        />
      )}
    </div>
  )
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div>
      <p className="text-xs text-white/50 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
        {options.map(opt => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange(on ? selected.filter(x => x !== opt) : [...selected, opt])
              }
              className={`text-[11px] px-2 py-0.5 rounded-md border ${
                on
                  ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-100'
                  : 'border-white/10 text-white/50 hover:text-white/80'
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
