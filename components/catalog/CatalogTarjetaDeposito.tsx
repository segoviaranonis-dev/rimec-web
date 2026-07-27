import type { ReactNode } from 'react'
import { ProductImage } from '@/components/ProductImage'
import { PromoCasoBadge } from '@/components/catalog/PromoCasoBadge'
import { productImagePrimaryStem } from '@/lib/productImageProtocol'
import {
  shellFooterLatidoClass,
  shellLatidoClass,
} from '@/lib/catalogoShellLatidos'

export const CATALOG_CARD_WIDTH_CLASS =
  'w-[calc(50%-0.375rem)] max-w-[220px] sm:w-[180px] md:w-[200px]'

export const CATALOG_CARD_COMPACT_CLASS =
  'w-[calc(33.333%-0.5rem)] max-w-[150px] sm:w-[calc(25%-0.5625rem)] sm:max-w-[160px]'

const IMAGE_HOST_CLASS =
  'relative aspect-square w-full min-h-0 overflow-hidden bg-white p-1 touch-manipulation active:opacity-90'

type Props = {
  marca: string
  stockPares: number
  /** Abreviatura badge stock: p | prend */
  stockUnidad?: 'p' | 'prend'
  linea: string
  referencia: string
  material: string
  color: string
  imagenNombre?: string | null
  imagenColorExcel?: string | null
  /** Color Kyly legible — no usar en stem 638 */
  descpColor?: string | null
  thumbSrc?: string | null
  flatSrc?: string | null
  thumbCandidates?: string[]
  alt: string
  /** @deprecated Precio solo en acordeón por lote. */
  precio?: number | null
  precioLabel?: string
  priority?: boolean
  compactGrid?: boolean
  esPromo?: boolean
  /** Confecciones 638 → Linea_color; calzado 654 → Linea-Ref-mat-color */
  esConfecciones?: boolean
  onImageClick?: () => void
  imageOverlay?: ReactNode
  ventaFooter?: ReactNode
  hideStockBadge?: boolean
  shellVariant?: 'cp' | 'pe' | 'fusion' | 'liquidacion' | 'promo' | 'cp-promo' | 'comun'
  /** Badge cabecera tras marca (PE PRO). */
  headerBadge?: ReactNode
  /** Badge esquina sup. derecha imagen (PE LIQ). */
  imageTopRightBadge?: ReactNode
  /** Badge esquina sup. izquierda imagen (descuento comercial). */
  imageTopLeftBadge?: ReactNode
  /** @deprecated Usar headerBadge / imageTopRightBadge */
  imageCornerBadge?: ReactNode
}

/** Tarjeta — sin precio en ficha (ley: precio por lote bajo el badge de pares). */
export function CatalogTarjetaDeposito({
  marca,
  stockPares,
  stockUnidad = 'p',
  linea,
  referencia,
  material,
  color,
  imagenNombre,
  imagenColorExcel,
  descpColor,
  thumbSrc,
  flatSrc,
  thumbCandidates,
  alt,
  priority = false,
  compactGrid = true,
  esPromo = false,
  esConfecciones = false,
  onImageClick,
  imageOverlay,
  ventaFooter,
  hideStockBadge = false,
  shellVariant,
  headerBadge,
  imageTopRightBadge,
  imageTopLeftBadge,
  imageCornerBadge,
}: Props) {
  const widthClass = compactGrid ? CATALOG_CARD_COMPACT_CLASS : CATALOG_CARD_WIDTH_CLASS

  const nombreImagen =
    productImagePrimaryStem({
      linea,
      referencia,
      material,
      color,
      imagenNombre,
      imagenColorExcel,
      descpColor,
      tipoV2Id: esConfecciones ? 2 : 1,
    }) ??
    (esConfecciones
      ? `${linea}_${color}`
      : [linea, referencia, material, color].filter(Boolean).join('-'))

  const shellClass = shellLatidoClass(shellVariant)
  const footerShellClass = shellFooterLatidoClass(shellVariant)

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
            {headerBadge}
            {esPromo && !headerBadge ? <PromoCasoBadge size="compact" /> : null}
          </div>
          {!hideStockBadge && (
            <span className="shrink-0 rounded-full bg-bazzar-naranja px-1.5 py-0.5 text-[9px] font-bold text-white sm:px-2 sm:text-[10px]">
              {Math.round(stockPares)} {stockUnidad}
            </span>
          )}
        </div>

        {onImageClick ? (
          <button type="button" onClick={onImageClick} className={IMAGE_HOST_CLASS} aria-label={alt}>
            {image}
            {imageTopLeftBadge}
            {imageTopRightBadge}
            {imageCornerBadge}
            {imageOverlay}
          </button>
        ) : (
          <div className={IMAGE_HOST_CLASS}>
            {image}
            {imageTopLeftBadge}
            {imageTopRightBadge}
            {imageCornerBadge}
            {imageOverlay}
          </div>
        )}

        <div className="flex items-baseline px-2 pb-2 pt-0.5">
          <p
            className="min-w-0 truncate font-mono text-[10px] text-slate-800 sm:text-[11px]"
            title={nombreImagen}
          >
            {nombreImagen}
          </p>
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
