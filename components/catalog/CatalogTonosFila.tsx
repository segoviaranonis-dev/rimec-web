'use client'

import { tonoFromVariante, type VarianteTonoInput } from '@/lib/pilares/tonoVariante'
import { preloadImageDecoded } from '@/lib/image-decode-cache'

const CELESTE = '#0EA5E9'

type VarianteConId = VarianteTonoInput & {
  det_id: number
  imagen_url_thumb?: string | null
  imagen_candidates_thumb?: string[]
}

type Props = {
  variantes: VarianteConId[]
  activeIdx: number
  onSelect: (idx: number) => void
}

function preloadVarianteImagen(v: VarianteConId) {
  for (const u of v.imagen_candidates_thumb ?? []) {
    if (u) void preloadImageDecoded(u)
  }
  if (v.imagen_url_thumb) void preloadImageDecoded(v.imagen_url_thumb)
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
            onMouseEnter={() => preloadVarianteImagen(vv)}
            onFocus={() => preloadVarianteImagen(vv)}
            onClick={e => {
              e.stopPropagation()
              preloadVarianteImagen(vv)
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
