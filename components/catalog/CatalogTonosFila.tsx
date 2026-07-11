'use client'

import { tonoFromVariante, type VarianteTonoInput } from '@/lib/pilares/tonoVariante'

const CELESTE = '#0EA5E9'

type VarianteConId = VarianteTonoInput & { det_id: number }

type Props = {
  variantes: VarianteConId[]
  activeIdx: number
  onSelect: (idx: number) => void
}

/**
 * Fila tonos en tarjeta catálogo — siempre visible (1+ colores) para altura uniforme.
 * Fuente: `color.tono_canon` / `color.hex_web` — administrador Report `/pilares/color`.
 */
export function CatalogTonosFila({ variantes, activeIdx, onSelect }: Props) {
  if (variantes.length === 0) {
    return <div className="mb-2 min-h-[22px]" aria-hidden />
  }

  return (
    <div
      className="mb-2 flex min-h-[22px] flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Tonos del modelo"
    >
      {variantes.map((vv, i) => {
        const { style, title } = tonoFromVariante(vv)
        const isActive = i === activeIdx
        return (
          <button
            key={vv.det_id}
            type="button"
            onClick={e => {
              e.stopPropagation()
              onSelect(i)
            }}
            title={title}
            aria-label={title}
            aria-pressed={isActive}
            className="h-[18px] w-[18px] shrink-0 rounded-full border border-slate-300 focus:outline-none"
            style={{
              ...style,
              boxShadow: isActive ? `0 0 0 2px white, 0 0 0 3px ${CELESTE}` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
