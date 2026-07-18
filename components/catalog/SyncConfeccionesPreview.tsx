'use client'

import { CatalogTarjetaDeposito } from '@/components/catalog/CatalogTarjetaDeposito'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { cantidadTallasConStock, isConfecciones638Lote, stockEnLote } from '@/lib/confeccionesCatalogo'
import { isTarjetaFusionada, type TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'

function heroLote(t: TarjetaGrilla): TarjetaCatalogo | null {
  if (isTarjetaFusionada(t)) {
    return t.lotes.find(l => isConfecciones638Lote(l)) ?? t.lotes[0] ?? null
  }
  return t
}

type Props = {
  tarjetas: TarjetaGrilla[]
}

export function SyncConfeccionesPreview({ tarjetas }: Props) {
  return (
    <div className="rimec-sync-preview-grid" aria-label="Vista previa confecciones">
      {tarjetas.map((t, i) => {
        const p = heroLote(t)
        if (!p) return null
        const v = p.variantes.find(x => x.cajas_disponibles > 0) ?? p.variantes[0]
        if (!v) return null
        const cardKey = isTarjetaFusionada(t) ? t.cardKey : p.cardKey

        return (
          <div key={cardKey} className="rimec-sync-preview-card">
            <CatalogTarjetaDeposito
              marca={p.descp_marca}
              stockPares={stockEnLote(p)}
              stockUnidad="prend"
              hideStockBadge
              shellVariant="pe"
              linea={p.linea_codigo}
              referencia={p.referencia_codigo}
              material={v.material_code}
              color={v.color_code}
              imagenNombre={v.imagen_nombre}
              thumbSrc={v.imagen_url_thumb}
              flatSrc={v.imagen_url_flat}
              thumbCandidates={v.imagen_candidates_thumb}
              alt={`${p.linea_codigo}-${p.referencia_codigo} ${v.descp_color}`}
              priority={i < 3}
              compactGrid={false}
              imageOverlay={
                cantidadTallasConStock(p) > 1 ? (
                  <span className="pointer-events-none absolute top-2.5 right-2.5 z-10 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm">
                    {cantidadTallasConStock(p)} tall.
                  </span>
                ) : null
              }
            />
          </div>
        )
      })}
    </div>
  )
}
