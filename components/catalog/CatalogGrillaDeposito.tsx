'use client'

import type { ReactNode } from 'react'

type Props = {
  totalModelos: number
  totalPares: number
  totalValor?: number | null
  compactStats?: boolean
  children: ReactNode
}

/**
 * Contenedor grilla catálogo — paridad Tablet `GrillaCajasDeposito` (colapsada).
 * Doc: CHUSAR_TABLET_CADENA_GRADA_GRILLA.md
 */
export function CatalogGrillaDeposito({
  totalModelos,
  totalPares,
  totalValor,
  compactStats = true,
  children,
}: Props) {
  return (
    <>
      <div
        className={`mb-3 flex flex-wrap items-center justify-center gap-2 text-center text-slate-600 ${
          compactStats ? 'text-xs' : 'mb-4 text-sm'
        }`}
      >
        <span
          className={`rounded-full bg-rimec-azul/10 font-bold text-rimec-azul ${
            compactStats ? 'px-2 py-0.5' : 'px-3 py-1'
          }`}
        >
          {totalModelos.toLocaleString('es-PY')} modelos
        </span>
        <span
          className={`rounded-full bg-bazzar-naranja/15 font-bold text-bazzar-naranja-dark ${
            compactStats ? 'px-2 py-0.5' : 'px-3 py-1'
          }`}
        >
          {Math.round(totalPares).toLocaleString('es-PY')} pares
        </span>
        {totalValor != null && totalValor > 0 ? (
          <span
            className={`rounded-full bg-emerald-100 font-bold text-emerald-800 ${
              compactStats ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
            }`}
          >
            {new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(
              totalValor,
            )}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </>
  )
}
