'use client'

import { useEffect, useRef } from 'react'
import { ProductImage } from '@/components/ProductImage'
import type { RimecVariante } from '@/lib/agruparTarjetasCatalogo'

type Props = {
  variantes: RimecVariante[]
  activeIdx: number
  onSelect: (idx: number) => void
  linea: string
  referencia: string
  compact?: boolean
}

/**
 * Carrusel miniaturas por color — paridad Tablet `CarruselColores`.
 * Doc: CHUSAR_TABLET_CADENA_GRADA_GRILLA.md · cadena/vista
 */
export function CatalogCarruselColores({
  variantes,
  activeIdx,
  onSelect,
  linea,
  referencia,
  compact = false,
}: Props) {
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeIdx])

  if (variantes.length <= 1) return null

  const tileSize = compact
    ? 'h-[72px] w-[60px] min-h-[72px] min-w-[60px]'
    : 'h-[88px] w-[72px] min-h-[88px] min-w-[72px]'

  return (
    <div className="border-t border-slate-100 bg-slate-50">
      <p className="px-2 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
        Colores · {variantes.length}
      </p>
      <div className="flex gap-1.5 overflow-x-auto scroll-smooth snap-x snap-mandatory px-2 pb-2 pt-0.5 [scrollbar-width:none]">
        {variantes.map((v, idx) => {
          const selected = idx === activeIdx
          return (
            <div key={v.det_id} ref={selected ? activeRef : undefined} className="shrink-0 snap-center">
              <button
                type="button"
                onClick={() => onSelect(idx)}
                aria-label={`Color ${v.descp_color || v.color_code}`}
                aria-current={selected ? 'true' : undefined}
                className="rounded-md p-0.5 active:opacity-80"
              >
                <div
                  className={`relative grid place-items-center overflow-hidden rounded-md border-2 bg-white shadow-sm ${tileSize} ${
                    selected ? 'border-rimec-azul' : 'border-slate-200'
                  }`}
                >
                  <ProductImage
                    className="absolute inset-0"
                    src={v.imagen_url_thumb}
                    fallbackSrc={v.imagen_url_flat}
                    candidates={v.imagen_candidates_thumb}
                    linea={linea}
                    referencia={referencia}
                    material={v.material_code}
                    color={v.color_code}
                    imagenNombre={v.imagen_nombre}
                    alt={v.descp_color?.trim() || v.color_code}
                    priority={selected}
                  />
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
