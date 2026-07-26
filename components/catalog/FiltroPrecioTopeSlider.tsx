'use client'

import { useMemo } from 'react'
import { LISTAS, useSesion, type ListaId } from '@/store/sesionVenta'
import type { PrecioEscaleraCatalogo } from '@/lib/catalogoPrecioEscalera'

type Props = {
  precioTope: number | null
  onChange: (tope: number | null, listaPrecioId: ListaId | null) => void
  escaleraApi?: PrecioEscaleraCatalogo | null
  escaleraLocal?: PrecioEscaleraCatalogo | null
  inline?: boolean
}

function fmtGs(n: number): string {
  return n.toLocaleString('es-PY')
}

/**
 * Slider discreto — empieza en el precio mayor (sin filtro) y baja el tope
 * para encontrar modelos más baratos (ej. taco alto más económico).
 */
export function FiltroPrecioTopeSlider({
  precioTope,
  onChange,
  escaleraApi,
  escaleraLocal,
  inline = false,
}: Props) {
  const activa = useSesion((s) => s.activa)
  const listaPrecioId = useSesion((s) => s.listaPrecioId)

  const escalera = useMemo(() => {
    const steps = new Set<number>()
    for (const src of [escaleraApi, escaleraLocal]) {
      if (!src || src.listaPrecioId !== listaPrecioId) continue
      for (const v of src.escalera) steps.add(v)
    }
    if (steps.size === 0) return null
    const sorted = [...steps].sort((a, b) => b - a)
    return { escalera: sorted, max: sorted[0]!, min: sorted[sorted.length - 1]! }
  }, [escaleraApi, escaleraLocal, listaPrecioId])

  const listaNombre = LISTAS.find((l) => l.id === listaPrecioId)?.nombre ?? 'LPN'

  /** 0 = todos · 1..n = tope = escalera[i-1] */
  const stepIdx = useMemo(() => {
    if (precioTope == null || !escalera) return 0
    const i = escalera.escalera.indexOf(precioTope)
    return i >= 0 ? i + 1 : 0
  }, [precioTope, escalera])

  const maxStep = escalera?.escalera.length ?? 0

  if (!activa) {
    return (
      <div className={`flex items-center gap-2 ${inline ? 'shrink-0' : 'w-full'}`}>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Precio</span>
        <span className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
          Activá venta para filtrar por lista
        </span>
      </div>
    )
  }

  if (!escalera || maxStep === 0) {
    return (
      <div className={`flex items-center gap-2 ${inline ? 'shrink-0' : 'w-full'}`}>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Precio</span>
        <span className="text-[11px] text-slate-400">Cargando precios {listaNombre}…</span>
      </div>
    )
  }

  const etiqueta =
    stepIdx === 0
      ? `Todos · hasta ${fmtGs(escalera.max)} Gs`
      : `Hasta ${fmtGs(precioTope ?? escalera.escalera[stepIdx - 1]!)} Gs`

  return (
    <div
      className={[
        'flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3',
        inline ? 'shrink-0 flex-1' : 'w-full',
      ].join(' ')}
    >
      <div className="flex shrink-0 flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Tope · {listaNombre}
        </span>
        <span className="max-w-[11rem] truncate text-[10px] font-semibold tabular-nums text-rimec-azul sm:max-w-none">
          {etiqueta}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="hidden shrink-0 text-[9px] tabular-nums text-slate-400 sm:inline">
          {fmtGs(escalera.min)}
        </span>
        <input
          type="range"
          min={0}
          max={maxStep}
          step={1}
          value={maxStep - stepIdx}
          aria-label="Tope de precio — mayor a menor"
          onChange={(e) => {
            const fromMax = Number(e.target.value)
            const idx = maxStep - fromMax
            if (idx <= 0) {
              onChange(null, listaPrecioId)
              return
            }
            onChange(escalera.escalera[idx - 1]!, listaPrecioId)
          }}
          className="h-2 min-w-[6rem] flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-rimec-azul [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-rimec-azul [&::-webkit-slider-thumb]:shadow"
        />
        <span className="hidden shrink-0 text-[9px] tabular-nums text-slate-400 sm:inline">
          {fmtGs(escalera.max)}
        </span>
      </div>

      {stepIdx > 0 ? (
        <button
          type="button"
          title="Quitar tope de precio"
          onClick={() => onChange(null, null)}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-600"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
