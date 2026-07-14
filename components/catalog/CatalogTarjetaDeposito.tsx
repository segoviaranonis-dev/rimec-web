import type { ReactNode } from 'react'
import { ProductImage } from '@/components/ProductImage'
import { formatPrecioGs } from '@/lib/formatPrecioGs'
import { PromoCasoBadge } from '@/components/catalog/PromoCasoBadge'

/** Ancho tarjeta colapsada — copia literal Tablet `TarjetaCajaDeposito`. */
export const CATALOG_CARD_WIDTH_CLASS =
  'w-[calc(50%-0.375rem)] max-w-[220px] sm:w-[180px] md:w-[200px]'

/** Grilla densa cadena/ventas — ~13 cols en desktop ancho. */
export const CATALOG_CARD_COMPACT_CLASS =
  'w-[calc(33.333%-0.5rem)] max-w-[150px] sm:w-[calc(25%-0.5625rem)] sm:max-w-[160px]'

const IMAGE_HOST_CLASS =
  'relative aspect-square w-full min-h-0 overflow-hidden bg-white p-1 touch-manipulation active:opacity-90'

type Props = {
  marca: string
  stockPares: number
  linea: string
  referencia: string
  material: string
  color: string
  imagenNombre?: string | null
  thumbSrc?: string | null
  flatSrc?: string | null
  thumbCandidates?: string[]
  alt: string
  precio: number | null
  precioLabel?: string
  priority?: boolean
  compactGrid?: boolean
  esPromo?: boolean
  onImageClick?: () => void
  imageOverlay?: ReactNode
  ventaFooter?: ReactNode
  /** Oculta badge naranja sobre la foto (pares van al panel origen). */
  hideStockBadge?: boolean
  /** cp = azul suave · pe = verde · fusion = pulso dual */
  shellVariant?: 'cp' | 'pe' | 'fusion'
}

/** Tarjeta catálogo — paridad Tablet `TarjetaCajaDeposito` colapsada. */
export function CatalogTarjetaDeposito({
  marca,
  stockPares,
  linea,
  referencia,
  material,
  color,
  imagenNombre,
  thumbSrc,
  flatSrc,
  thumbCandidates,
  alt,
  precio,
  precioLabel = '/ par',
  priority = false,
  compactGrid = true,
  esPromo = false,
  onImageClick,
  imageOverlay,
  ventaFooter,
  hideStockBadge = false,
  shellVariant,
}: Props) {
  const widthClass = compactGrid ? CATALOG_CARD_COMPACT_CLASS : CATALOG_CARD_WIDTH_CLASS

  const shellClass =
    shellVariant === 'cp'
      ? 'border-blue-200/90 bg-gradient-to-b from-blue-50/95 via-white to-white'
      : shellVariant === 'pe'
        ? 'border-emerald-200/90 bg-gradient-to-b from-emerald-50/95 via-white to-white'
        : shellVariant === 'fusion'
          ? 'catalog-card-fusion-pulse border-violet-200/80 bg-gradient-to-b from-violet-50/40 via-white to-white'
          : 'border-slate-300 bg-white'

  const footerShellClass =
    shellVariant === 'cp'
      ? 'border-blue-100/80 bg-blue-50/30'
      : shellVariant === 'pe'
        ? 'border-emerald-100/80 bg-emerald-50/30'
        : shellVariant === 'fusion'
          ? 'border-violet-100/80 bg-white/80'
          : 'border-slate-200 bg-white'

  const image = (
    <ProductImage
      className="absolute inset-0"
      src={thumbSrc}
      fallbackSrc={flatSrc}
      candidates={thumbCandidates}
      linea={linea}
      referencia={referencia}
      material={material}
      color={color}
      imagenNombre={imagenNombre}
      alt={alt}
      priority={priority}
    />
  )

  return (
    <div className={`flex flex-col ${widthClass}`}>
      <article className={`flex flex-col overflow-hidden rounded-xl border ${shellClass}`}>
        <div className="flex items-center justify-between gap-1 px-2 pb-0.5 pt-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <p className="min-w-0 truncate text-[9px] font-normal uppercase tracking-wide text-rimec-azul sm:text-[10px]">
              {marca}
            </p>
            {esPromo ? <PromoCasoBadge size="compact" /> : null}
          </div>
          {!hideStockBadge && (
            <span className="shrink-0 rounded-full bg-bazzar-naranja px-1.5 py-0.5 text-[9px] font-bold text-white sm:px-2 sm:text-[10px]">
              {Math.round(stockPares)} p
            </span>
          )}
        </div>

        {onImageClick ? (
          <button type="button" onClick={onImageClick} className={IMAGE_HOST_CLASS} aria-label={alt}>
            {image}
            {imageOverlay}
          </button>
        ) : (
          <div className={IMAGE_HOST_CLASS}>
            {image}
            {imageOverlay}
          </div>
        )}

        <div className="flex items-baseline justify-between gap-1 px-2 pb-2 pt-0.5">
          <p className="min-w-0 truncate font-mono text-[10px] text-slate-800 sm:text-[11px]">
            {linea}.{referencia}
          </p>
          {precio != null ? (
            <p className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-orange-600 sm:text-[11px]">
              {formatPrecioGs(precio)}
              <span className="text-[8px] font-normal text-slate-400"> {precioLabel}</span>
            </p>
          ) : (
            <p className="shrink-0 text-[8px] text-slate-400">Sin LPN</p>
          )}
        </div>
      </article>

      {ventaFooter ? (
        <div className={`mt-1.5 rounded-xl border px-2 py-2 shadow-sm ${footerShellClass}`}>
          {ventaFooter}
        </div>
      ) : null}
    </div>
  )
}
