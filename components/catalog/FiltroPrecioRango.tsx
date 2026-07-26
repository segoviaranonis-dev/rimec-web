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
  parsePrecioInput,
  tecladoADraft,
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
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1 ' +
  '[&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-1 ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative ' +
  '[&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white ' +
  '[&::-moz-range-thumb]:shadow'

/**
 * Rango barato → caro · teclado ↔ slider espejo · SQL al Aplicar/Enter.
 * Misma consulta, dos representaciones.
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
  /** Quién tiene el z-index alto — sin esto el mango superior tapa el inferior. */
  const [activoMango, setActivoMango] = useState<'lo' | 'hi'>('lo')

  useEffect(() => {
    setDraftLo(precioMin ?? piso)
    setDraftHi(precioMax ?? tope)
    setMinTxt(formatPrecioGs(precioMin ?? piso))
    setMaxTxt(formatPrecioGs(precioMax ?? tope))
  }, [precioMin, precioMax, piso, tope])

  /** Slider → inputs (espejo). */
  const syncDesdeSlider = useCallback(
    (nextLo: number, nextHi: number) => {
      const { lo, hi, minFmt, maxFmt } = tecladoADraft(
        String(nextLo),
        String(nextHi),
        nextLo,
        nextHi,
        piso,
        tope,
      )
      setDraftLo(lo)
      setDraftHi(hi)
      setMinTxt(minFmt)
      setMaxTxt(maxFmt)
    },
    [piso, tope],
  )

  /**
   * Teclado → slider en vivo (si el lado tipeado parsea).
   * No formatea el input en edición para no pelear con el caret.
   */
  const espejoTecladoASlider = useCallback(
    (lado: 'min' | 'max', raw: string) => {
      if (lado === 'min') {
        setMinTxt(raw)
        const parsed = parsePrecioInput(raw)
        if (parsed == null) return
        const { lo, hi } = tecladoADraft(raw, maxTxt, draftLo, draftHi, piso, tope)
        setDraftLo(lo)
        setDraftHi(hi)
      } else {
        setMaxTxt(raw)
        const parsed = parsePrecioInput(raw)
        if (parsed == null) return
        const { lo, hi } = tecladoADraft(minTxt, raw, draftLo, draftHi, piso, tope)
        setDraftLo(lo)
        setDraftHi(hi)
      }
    },
    [minTxt, maxTxt, draftLo, draftHi, piso, tope],
  )

  /** Blur: formatea ambos y alinea slider. */
  const commitTxt = useCallback(() => {
    const { lo, hi, minFmt, maxFmt } = tecladoADraft(minTxt, maxTxt, draftLo, draftHi, piso, tope)
    setDraftLo(lo)
    setDraftHi(hi)
    setMinTxt(minFmt)
    setMaxTxt(maxFmt)
    return { lo, hi }
  }, [minTxt, maxTxt, draftLo, draftHi, piso, tope])

  /** Una sola fuente de verdad → SQL (Enter / Aplicar). Sin stale setState. */
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

  return (
    <div
      className={[
        'flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3',
        inline ? 'shrink-0 flex-1' : 'w-full',
      ].join(' ')}
    >
      <div className="flex shrink-0 flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Precio · {listaNombre}
        </span>
        <span className="text-[10px] tabular-nums text-slate-400">
          {formatPrecioGs(piso)} → {formatPrecioGs(tope)} Gs
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          aria-label="Precio desde (más barato)"
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
          className="w-[5.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium tabular-nums text-slate-800 focus:border-rimec-azul focus:outline-none focus:ring-1 focus:ring-rimec-azul/30"
        />
        <span className="text-slate-300">—</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Precio hasta (más caro)"
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
          className="w-[5.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium tabular-nums text-slate-800 focus:border-rimec-azul focus:outline-none focus:ring-1 focus:ring-rimec-azul/30"
        />
      </div>

      {rangoCatalogo || rango.min !== PRECIO_RANGO_FALLBACK.min ? (
        <div className="relative hidden h-7 w-[11rem] items-center sm:flex">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
          <div
            className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-rimec-azul/70"
            style={{ left: `${pct(draftLo)}%`, right: `${100 - pct(draftHi)}%` }}
          />
          <input
            type="range"
            min={piso}
            max={draftHi}
            step={paso}
            value={draftLo}
            aria-label="Precio mínimo"
            onPointerDown={() => setActivoMango('lo')}
            onChange={(e) => {
              setActivoMango('lo')
              syncDesdeSlider(Number(e.target.value), draftHi)
            }}
            className={`${THUMB} [&::-webkit-slider-thumb]:bg-rimec-azul [&::-moz-range-thumb]:bg-rimec-azul`}
            style={{ zIndex: activoMango === 'lo' ? 40 : 20 }}
          />
          <input
            type="range"
            min={draftLo}
            max={tope}
            step={paso}
            value={draftHi}
            aria-label="Precio máximo"
            onPointerDown={() => setActivoMango('hi')}
            onChange={(e) => {
              setActivoMango('hi')
              syncDesdeSlider(draftLo, Number(e.target.value))
            }}
            className={`${THUMB} [&::-webkit-slider-thumb]:bg-slate-700 [&::-moz-range-thumb]:bg-slate-700`}
            style={{ zIndex: activoMango === 'hi' ? 40 : 30 }}
          />
        </div>
      ) : (
        <span className="hidden text-[10px] text-slate-400 sm:inline">Límites SQL…</span>
      )}

      <button
        type="button"
        disabled={!dirty && !activo}
        onClick={commitYAplicar}
        className="rounded-lg bg-rimec-azul px-2.5 py-1 text-[11px] font-bold text-white disabled:cursor-default disabled:opacity-40 hover:brightness-110"
      >
        Aplicar
      </button>

      {activo ? (
        <button
          type="button"
          title="Quitar filtro de precio"
          onClick={limpiar}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-600"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

export { PRECIO_RANGO_FALLBACK }
