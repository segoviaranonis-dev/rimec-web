'use client'

import { useEffect, useState } from 'react'

type Props = {
  eventoId: number
  filtro: string
  onDone: (eventoId: number) => void
}

const PASO_MS = 400
const TOTAL_MS = 3000

/** Respuesta visual inmediata al tocar un filtro; no bloquea la multiselección. */
export function FiltroAplicandoOverlay({ eventoId, filtro, onDone }: Props) {
  const [cuenta, setCuenta] = useState<3 | 2 | 1 | 0>(3)

  useEffect(() => {
    setCuenta(3)
    const t2 = window.setTimeout(() => setCuenta(2), PASO_MS)
    const t1 = window.setTimeout(() => setCuenta(1), PASO_MS * 2)
    const aplicando = window.setTimeout(() => setCuenta(0), PASO_MS * 3)
    const fin = window.setTimeout(() => onDone(eventoId), TOTAL_MS)
    return () => {
      window.clearTimeout(t2)
      window.clearTimeout(t1)
      window.clearTimeout(aplicando)
      window.clearTimeout(fin)
    }
  }, [eventoId, onDone])

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-[90] flex justify-center px-4"
      role="status"
      aria-live="polite"
      aria-label={`Aplicando filtro ${filtro}`}
    >
      <div className="flex min-w-[250px] max-w-[92vw] items-center gap-3 rounded-2xl border border-rimec-azul/20 bg-white/95 px-4 py-3 shadow-[0_14px_45px_rgba(15,23,42,0.22)] backdrop-blur-md">
        <span
          key={cuenta}
          className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-rimec-azul font-black tabular-nums text-white shadow-md"
        >
          {cuenta || '✓'}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rimec-azul">
            {cuenta ? 'Preparando filtro…' : 'Aplicando filtro…'}
          </p>
          <p className="truncate text-sm font-bold text-slate-800">{filtro}</p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full animate-pulse rounded-full bg-bazzar-naranja transition-all duration-300" style={{ width: cuenta ? `${(4 - cuenta) * 28}%` : '100%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
