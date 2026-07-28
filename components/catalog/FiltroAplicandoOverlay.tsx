'use client'

import { useEffect, useState } from 'react'

type Props = {
  eventoId: number
  filtro: string
  onDone: (eventoId: number) => void
  /** true mientras la grilla carga — mantiene animación (Calzado↔Confecciones). */
  waiting?: boolean
}

const PASO_MS = 400
const INTRO_MS = 3000
const MAX_WAIT_MS = 45_000

/** Respuesta visual inmediata al tocar un filtro; persiste si `waiting` (BD lenta). */
export function FiltroAplicandoOverlay({ eventoId, filtro, onDone, waiting = false }: Props) {
  const [cuenta, setCuenta] = useState<3 | 2 | 1 | 0>(3)
  const [fase, setFase] = useState<'intro' | 'cargando'>('intro')

  useEffect(() => {
    setCuenta(3)
    setFase('intro')
    const t2 = window.setTimeout(() => setCuenta(2), PASO_MS)
    const t1 = window.setTimeout(() => setCuenta(1), PASO_MS * 2)
    const aplicando = window.setTimeout(() => setCuenta(0), PASO_MS * 3)
    const introFin = window.setTimeout(() => setFase('cargando'), INTRO_MS)
    return () => {
      window.clearTimeout(t2)
      window.clearTimeout(t1)
      window.clearTimeout(aplicando)
      window.clearTimeout(introFin)
    }
  }, [eventoId])

  useEffect(() => {
    if (waiting) return
    if (fase === 'intro') {
      const fin = window.setTimeout(() => onDone(eventoId), INTRO_MS)
      return () => window.clearTimeout(fin)
    }
    onDone(eventoId)
  }, [waiting, fase, eventoId, onDone])

  useEffect(() => {
    if (!waiting) return
    const cap = window.setTimeout(() => onDone(eventoId), MAX_WAIT_MS)
    return () => window.clearTimeout(cap)
  }, [waiting, eventoId, onDone])

  const enCarga = fase === 'cargando' || waiting

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-[90] flex justify-center px-4"
      role="status"
      aria-live="polite"
      aria-label={enCarga ? `Cargando catálogo ${filtro}` : `Aplicando filtro ${filtro}`}
    >
      <div className="flex min-w-[250px] max-w-[92vw] items-center gap-3 rounded-2xl border border-rimec-azul/20 bg-white/95 px-4 py-3 shadow-[0_14px_45px_rgba(15,23,42,0.22)] backdrop-blur-md">
        <span
          key={enCarga ? 'load' : cuenta}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rimec-azul font-black tabular-nums text-white shadow-md ${
            enCarga ? 'animate-spin text-lg' : 'animate-pulse'
          }`}
        >
          {enCarga ? '↻' : cuenta || '✓'}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rimec-azul">
            {enCarga ? 'Cargando catálogo…' : cuenta ? 'Preparando filtro…' : 'Aplicando filtro…'}
          </p>
          <p className="truncate text-sm font-bold text-slate-800">{filtro}</p>
          <p className="text-[11px] text-slate-500">
            {enCarga ? 'El sistema sigue conectado · preparando tarjetas' : 'Un momento'}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-bazzar-naranja ${enCarga ? 'animate-pulse w-full' : 'transition-all duration-300'}`}
              style={enCarga ? undefined : { width: cuenta ? `${(4 - cuenta) * 28}%` : '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
