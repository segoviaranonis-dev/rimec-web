'use client'

import { ProductImage } from '@/components/ProductImage'
import type { TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'
import { heroLoteDeGrilla, tarjetaGrillaKey, tarjetaTieneImagen } from '@/lib/catalogoSyncPreview'

type Props = {
  tarjetas: TarjetaGrilla[]
  accent: string
}

function heroLote(t: TarjetaGrilla) {
  return heroLoteDeGrilla(t)
}

function MiniCard({ tarjeta }: { tarjeta: TarjetaGrilla }) {
  const p = heroLote(tarjeta)
  if (!p) return null
  const v = p.variantes.find(x => x.cajas_disponibles > 0) ?? p.variantes[0]
  if (!v) return null

  return (
    <div className="rimec-sync-marquee-card rimec-sync-marquee-card--real">
      <div className="rimec-sync-marquee-img rimec-sync-marquee-img--photo">
        <ProductImage
          src={v.imagen_url_thumb}
          fallbackSrc={v.imagen_url_flat}
          candidates={v.imagen_candidates_thumb}
          linea={p.linea_codigo}
          referencia={p.referencia_codigo}
          material={v.material_code}
          color={v.color_code}
          imagenNombre={v.imagen_nombre}
          alt=""
          className="h-full w-full object-contain p-1"
        />
      </div>
      <p className="rimec-sync-marquee-ref">
        {p.linea_codigo} · {p.referencia_codigo}
      </p>
    </div>
  )
}

function GhostCard({ accent }: { accent: string }) {
  return (
    <div
      className="rimec-sync-marquee-card rimec-sync-marquee-card--ghost"
      style={{ '--sync-accent': accent } as React.CSSProperties}
    >
      <div className="rimec-sync-marquee-img" />
      <div className="rimec-sync-marquee-line rimec-sync-marquee-line--wide" />
      <div className="rimec-sync-marquee-line" />
    </div>
  )
}

function MarqueeRow({
  items,
  reverse = false,
  accent,
}: {
  items: React.ReactNode[]
  reverse?: boolean
  accent: string
}) {
  const loop = [...items, ...items]
  return (
    <div
      className={[
        'rimec-sync-marquee-row',
        reverse ? 'rimec-sync-marquee-row--reverse' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--sync-accent': accent } as React.CSSProperties}
    >
      <div className="rimec-sync-marquee-track">
        {loop.map((node, i) => (
          <div key={i} className="rimec-sync-marquee-item">
            {node}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SyncBackgroundMarquee({ tarjetas, accent }: Props) {
  const withImages = tarjetas.filter(tarjetaTieneImagen)
  const hasReal = withImages.length > 0
  const pool = hasReal ? withImages : Array.from({ length: 10 })

  const rowA = pool.map((t, i) =>
    hasReal ? (
      <MiniCard key={`a-${tarjetaGrillaKey(t as TarjetaGrilla)}-${i}`} tarjeta={t as TarjetaGrilla} />
    ) : (
      <GhostCard key={`a-${i}`} accent={accent} />
    ),
  )

  const rowB = [...pool].reverse().map((t, i) =>
    hasReal ? (
      <MiniCard key={`b-${tarjetaGrillaKey(t as TarjetaGrilla)}-${i}`} tarjeta={t as TarjetaGrilla} />
    ) : (
      <GhostCard key={`b-${i}`} accent={accent} />
    ),
  )

  return (
    <div className="rimec-sync-marquee-layer" aria-hidden>
      <MarqueeRow items={rowA} accent={accent} />
      <MarqueeRow items={rowB} reverse accent={accent} />
      <MarqueeRow items={rowA} accent={accent} />
    </div>
  )
}
