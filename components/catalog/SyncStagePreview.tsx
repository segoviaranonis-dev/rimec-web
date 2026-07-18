'use client'

import { CatalogTarjetaDeposito } from '@/components/catalog/CatalogTarjetaDeposito'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import type { CatalogSyncStageId } from '@/lib/catalogoSyncStages'
import { heroLoteDeGrilla, tarjetaGrillaKey } from '@/lib/catalogoSyncPreview'
import { cantidadTallasConStock, isConfecciones638Lote, stockEnLote } from '@/lib/confeccionesCatalogo'
import type { TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'
import { resolveParesPorCaja } from '@/lib/prontaEntregaVenta'

function paresEnLote(p: TarjetaCatalogo): number {
  if (isConfecciones638Lote(p)) return stockEnLote(p)
  return p.variantes
    .filter(v => v.cajas_disponibles > 0)
    .reduce((s, v) => {
      const ppc = resolveParesPorCaja({
        pares_por_caja: v.pares_por_caja,
        cantidad_cajas: v.cantidad_cajas,
        saldo_pares: v.saldo_pares,
        origen_tipo: p.origen_tipo,
        det_id: v.det_id,
        pp_id: v.pp_id,
      })
      return s + Math.max(0, v.cajas_disponibles * ppc)
    }, 0)
}

type Props = {
  tarjetas: TarjetaGrilla[]
  stageId: CatalogSyncStageId
  ghostSlots?: number
  accent?: string
}

export function SyncStagePreview({ tarjetas, stageId, ghostSlots = 0, accent = '#0EA5E9' }: Props) {
  return (
    <div className="rimec-sync-preview-grid" aria-label="Vista previa catálogo">
      {tarjetas.map((t, i) => {
        const p = heroLoteDeGrilla(t)
        if (!p) return null
        const v = p.variantes.find(x => x.cajas_disponibles > 0) ?? p.variantes[0]
        if (!v) return null
        const esConf = isConfecciones638Lote(p)
        const shellVariant = stageId === 'cp' ? 'cp' as const : 'pe' as const

        return (
          <div key={tarjetaGrillaKey(t)} className="rimec-sync-preview-card">
            <CatalogTarjetaDeposito
              marca={p.descp_marca}
              stockPares={paresEnLote(p)}
              stockUnidad={esConf ? 'prend' : 'p'}
              hideStockBadge
              shellVariant={shellVariant}
              linea={p.linea_codigo}
              referencia={p.referencia_codigo}
              material={v.material_code}
              color={v.color_code}
              imagenNombre={v.imagen_nombre}
              thumbSrc={v.imagen_url_thumb}
              flatSrc={v.imagen_url_flat}
              thumbCandidates={v.imagen_candidates_thumb}
              alt={`${p.linea_codigo}-${p.referencia_codigo} ${v.descp_color}`}
              priority={i < 6}
              compactGrid={false}
              imageOverlay={
                esConf && cantidadTallasConStock(p) > 1 ? (
                  <span className="pointer-events-none absolute top-2.5 right-2.5 z-10 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm">
                    {cantidadTallasConStock(p)} tall.
                  </span>
                ) : null
              }
            />
          </div>
        )
      })}
      {Array.from({ length: ghostSlots }).map((_, i) => (
        <div
          key={`ghost-${i}`}
          className="rimec-sync-card rimec-sync-preview-card"
          style={
            {
              '--sync-accent': accent,
              animationDelay: `${(tarjetas.length + i) * 0.07}s`,
            } as React.CSSProperties
          }
          aria-hidden
        >
          <div className="rimec-sync-card-img" />
          <div className="rimec-sync-card-line rimec-sync-card-line--wide" />
          <div className="rimec-sync-card-line" />
        </div>
      ))}
    </div>
  )
}
