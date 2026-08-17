'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LISTAS, useSesion, type ListaId } from '@/store/sesionVenta'
import {
  PRECIO_RANGO_FALLBACK,
  precioRangoConFallback,
  type PrecioRangoCatalogo,
} from '@/lib/catalogoPrecioRango'
import {
  draftASqlParams,
  formatPrecioGs,
  sliderMoverHi,
  sliderMoverLo,
  tecladoADraft,
  tecladoMoverLado,
} from '@/lib/filtroPrecioRangoSync'

type Props = {
  precioMin: number | null
  precioMax: number | null
  /** Commit a URL / consulta SQL — solo al Aplicar / Enter */
  onAplicar: (min: number | null, max: number | null, listaPrecioId: ListaId | null) => void
  rangoCatalogo?: PrecioRangoCatalogo | null
  inline?: boolean
}

const THUMB =
  'pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent ' +
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 ' +
  '[&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-1.5 ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative ' +
  '[&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white ' +
  '[&::-moz-range-thumb]:shadow-md'

const INPUT =
  'w-full min-w-0 rounded-md border border-slate-200/90 bg-white px-2 py-1.5 text-right text-[12px] ' +
  'font-semibold tabular-nums tracking-tight text-slate-900 shadow-sm ' +
  'placeholder:font-normal placeholder:text-slate-400 ' +
  'focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/25'

/**
 * Rango barato → caro · teclado ↔ slider espejo · SQL al Aplicar/Enter.
 * UI 2.2.1.60 — Desde / Hasta horizontales + pista clara (no inputs apilados).
 */
export function FiltroPrecioRango({
  precioMin,
  precioMax,
  onAplicar,
  rangoCatalogo,
  inline = false,
}: Props) {
  const activa = useSesion((s) => s.activa)
  const listaPrecioId = useSesion((s) => s.listaPrecioId)
  const listaNombre = LISTAS.find((l) => l.id === listaPrecioId)?.nombre ?? 'LPN'

  const rango = useMemo(() => precioRangoConFallback(rangoCatalogo), [rangoCatalogo])
  const piso = rango.min
  const tope = rango.max
  const paso = rango.step

  const [draftLo, setDraftLo] = useState(precioMin ?? piso)
  const [draftHi, setDraftHi] = useState(precioMax ?? tope)
  const [minTxt, setMinTxt] = useState(formatPrecioGs(precioMin ?? piso))
  const [maxTxt, setMaxTxt] = useState(formatPrecioGs(precioMax ?? tope))
  const [activoMango, setActivoMango] = useState<'lo' | 'hi'>('lo')

  useEffect(() => {
    setDraftLo(precioMin ?? piso)
    setDraftHi(precioMax ?? tope)
    setMinTxt(formatPrecioGs(precioMin ?? piso))
    setMaxTxt(formatPrecioGs(precioMax ?? tope))
  }, [precioMin, precioMax, piso, tope])

  /** Slider: cada mango independiente · ambos en [piso, tope] · no intercambiar. */
  const onSliderLo = useCallback(
    (valor: number) => {
      const lo = sliderMoverLo(valor, draftHi, piso, tope)
      setDraftLo(lo)
      setMinTxt(formatPrecioGs(lo))
    },
    [draftHi, piso, tope],
  )

  const onSliderHi = useCallback(
    (valor: number) => {
      const hi = sliderMoverHi(valor, draftLo, piso, tope)
      setDraftHi(hi)
      setMaxTxt(formatPrecioGs(hi))
    },
    [draftLo, piso, tope],
  )

  /** Teclado → un solo lado (no mueve el otro). */
  const espejoTecladoASlider = useCallback(
    (lado: 'min' | 'max', raw: string) => {
      if (lado === 'min') {
        setMinTxt(raw)
        const moved = tecladoMoverLado('min', raw, draftLo, draftHi, piso, tope)
        if (!moved) return
        setDraftLo(moved.lo)
      } else {
        setMaxTxt(raw)
        const moved = tecladoMoverLado('max', raw, draftLo, draftHi, piso, tope)
        if (!moved) return
        setDraftHi(moved.hi)
      }
    },
    [draftLo, draftHi, piso, tope],
  )

  const commitTxt = useCallback(() => {
    const { lo, hi, minFmt, maxFmt } = tecladoADraft(minTxt, maxTxt, draftLo, draftHi, piso, tope)
    setDraftLo(lo)
    setDraftHi(hi)
    setMinTxt(minFmt)
    setMaxTxt(maxFmt)
    return { lo, hi }
  }, [minTxt, maxTxt, draftLo, draftHi, piso, tope])

  const commitYAplicar = useCallback(() => {
    const { lo, hi, minFmt, maxFmt } = tecladoADraft(minTxt, maxTxt, draftLo, draftHi, piso, tope)
    setDraftLo(lo)
    setDraftHi(hi)
    setMinTxt(minFmt)
    setMaxTxt(maxFmt)
    const { precio_min, precio_max } = draftASqlParams(lo, hi, piso, tope)
    onAplicar(precio_min, precio_max, listaPrecioId)
  }, [minTxt, maxTxt, draftLo, draftHi, piso, tope, listaPrecioId, onAplicar])

  const dirty = (precioMin ?? piso) !== draftLo || (precioMax ?? tope) !== draftHi

  const limpiar = () => {
    setDraftLo(piso)
    setDraftHi(tope)
    setMinTxt(formatPrecioGs(piso))
    setMaxTxt(formatPrecioGs(tope))
    onAplicar(null, null, null)
  }

  const activo = precioMin != null || precioMax != null
  const pct = (v: number) => ((v - piso) / Math.max(tope - piso, 1)) * 100
  const tieneSlider = Boolean(rangoCatalogo) || rango.min !== PRECIO_RANGO_FALLBACK.min

  if (!activa) {
    return (
      <div
        className={`flex min-w-0 items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 ${
          inline ? 'shrink-0' : 'w-full'
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Precio</span>
        <span className="text-[11px] text-slate-500">Activá venta para filtrar por lista</span>
      </div>
    )
  }

  return (
    <div
      className={[
        'filtro-precio-rango min-w-0 rounded-xl border border-slate-200/80 bg-white',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        inline ? 'shrink-0 flex-1' : 'w-full',
      ].join(' ')}
      role="group"
      aria-label={`Filtro de precio ${listaNombre}`}
    >
      <div className="flex flex-col gap-2 px-3 py-2.5">
        {/* Cabecera: título + universo + limpiar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Precio
            </span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-rimec-azul">
              {listaNombre}
            </span>
            {activo ? (
              <span className="rounded-md bg-rimec-azul/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rimec-azul">
                Activo
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[10px] tabular-nums text-slate-400 sm:inline">
              Universo {formatPrecioGs(piso)} – {formatPrecioGs(tope)} Gs
            </span>
            {activo ? (
              <button
                type="button"
                title="Quitar filtro de precio"
                onClick={limpiar}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </div>

        {/* Cuerpo: Desde | Hasta | slider | Aplicar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="grid grid-cols-2 gap-2 sm:w-[13.5rem] sm:shrink-0">
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Desde
              </span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Límite inferior de precio"
                placeholder={formatPrecioGs(piso)}
                value={minTxt}
                onChange={(e) => espejoTecladoASlider('min', e.target.value)}
                onBlur={commitTxt}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitYAplicar()
                  }
                }}
                className={INPUT}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Hasta
              </span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Límite superior de precio"
                placeholder={formatPrecioGs(tope)}
                value={maxTxt}
                onChange={(e) => espejoTecladoASlider('max', e.target.value)}
                onBlur={commitTxt}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitYAplicar()
                  }
                }}
                className={INPUT}
              />
            </label>
          </div>

          {tieneSlider ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1 pb-0.5">
              <div className="relative flex h-8 w-full max-w-md items-center sm:max-w-none">
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
                <div
                  className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-rimec-azul"
                  style={{ left: `${pct(draftLo)}%`, right: `${100 - pct(draftHi)}%` }}
                />
                <input
                  type="range"
                  min={piso}
                  max={tope}
                  step={paso}
                  value={draftLo}
                  aria-label="Deslizar límite inferior"
                  onPointerDown={() => setActivoMango('lo')}
                  onChange={(e) => {
                    setActivoMango('lo')
                    onSliderLo(Number(e.target.value))
                  }}
                  className={`${THUMB} [&::-webkit-slider-thumb]:bg-rimec-azul [&::-moz-range-thumb]:bg-rimec-azul`}
                  style={{ zIndex: activoMango === 'lo' ? 40 : 20 }}
                />
                <input
                  type="range"
                  min={piso}
                  max={tope}
                  step={paso}
                  value={draftHi}
                  aria-label="Deslizar límite superior"
                  onPointerDown={() => setActivoMango('hi')}
                  onChange={(e) => {
                    setActivoMango('hi')
                    onSliderHi(Number(e.target.value))
                  }}
                  className={`${THUMB} [&::-webkit-slider-thumb]:bg-slate-800 [&::-moz-range-thumb]:bg-slate-800`}
                  style={{ zIndex: activoMango === 'hi' ? 40 : 30 }}
                />
              </div>
              <div className="flex justify-between px-0.5 text-[9px] tabular-nums text-slate-400 sm:hidden">
                <span>{formatPrecioGs(piso)}</span>
                <span>{formatPrecioGs(tope)} Gs</span>
              </div>
            </div>
          ) : (
            <span className="flex-1 self-center text-[10px] text-slate-400">Cargando límites…</span>
          )}

          <button
            type="button"
            disabled={!dirty && !activo}
            onClick={commitYAplicar}
            className={[
              'h-9 shrink-0 rounded-lg px-4 text-[12px] font-bold text-white transition',
              'bg-rimec-azul hover:brightness-110',
              'disabled:cursor-default disabled:bg-slate-300 disabled:opacity-70',
              dirty ? 'ring-2 ring-rimec-azul/30 ring-offset-1' : '',
            ].join(' ')}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}

export { PRECIO_RANGO_FALLBACK }
