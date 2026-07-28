'use client'

import { CARD_PAGE_LIMIT } from '@/lib/catalogoPeWarmCache'
import { CATALOG_CARD_WIDTH_CLASS } from '@/components/catalog/CatalogTarjetaDeposito'

/** Placeholder de grilla — siempre 30 slots para sensación de catálogo lleno al instante. */
export function CatalogoGrillaSkeleton({ slots = CARD_PAGE_LIMIT }: { slots?: number }) {
  return (
    <div className="mb-3 flex flex-wrap justify-center gap-2" aria-busy aria-label="Cargando catálogo">
      {Array.from({ length: slots }).map((_, i) => (
        <div
          key={i}
          className={`${CATALOG_CARD_WIDTH_CLASS} animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}
          style={{ animationDelay: `${(i % 6) * 0.05}s` }}
        >
          <div className="aspect-square w-full bg-slate-100" />
          <div className="space-y-2 p-2">
            <div className="mx-auto h-2 w-3/4 rounded bg-slate-100" />
            <div className="mx-auto h-2 w-1/2 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
