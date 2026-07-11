'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { ProductHeroFrame } from '@/components/product/ProductHeroFrame'
import { ProductImage } from '@/components/ProductImage'
import { productImageCandidatesForUi } from '@/lib/productImage'

export type CatalogImageBlockProps = {
  mode?: 'thumb' | 'hero'
  linea: string
  referencia: string
  material?: string
  color?: string
  imagenNombre?: string | null
  thumbSrc?: string | null
  heroSrc?: string | null
  flatSrc?: string | null
  thumbCandidates?: string[]
  heroCandidates?: string[]
  alt: string
  priority?: boolean
  onClick?: () => void
  className?: string
  overlay?: ReactNode
}

export function CatalogImageBlock({
  mode = 'thumb',
  linea,
  referencia,
  material = '',
  color = '',
  imagenNombre,
  thumbSrc,
  flatSrc,
  thumbCandidates,
  heroCandidates,
  alt,
  priority = false,
  onClick,
  className = '',
  overlay,
}: CatalogImageBlockProps) {
  const isHero = mode === 'hero'
  const hostClass = [
    'relative aspect-square w-full min-h-0 overflow-hidden bg-white px-1',
    onClick ? 'cursor-zoom-in touch-manipulation active:opacity-90' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const thumbChain = useMemo(() => {
    if (thumbCandidates?.length) return thumbCandidates
    return productImageCandidatesForUi(linea, referencia, material, color, imagenNombre, 'thumb')
  }, [thumbCandidates, linea, referencia, material, color, imagenNombre])

  const heroChain = useMemo(() => {
    if (heroCandidates?.length) return heroCandidates
    return productImageCandidatesForUi(linea, referencia, material, color, imagenNombre, 'modal')
  }, [heroCandidates, linea, referencia, material, color, imagenNombre])

  const image = isHero ? (
    <ProductHeroFrame alt={alt} candidates={heroChain} className="max-h-full max-w-full shadow-none" />
  ) : (
    <ProductImage
      className="absolute inset-0"
      src={thumbSrc}
      fallbackSrc={flatSrc}
      candidates={thumbChain}
      linea={linea}
      referencia={referencia}
      material={material}
      color={color}
      imagenNombre={imagenNombre}
      alt={alt}
      priority={priority}
    />
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={hostClass} aria-label={alt}>
        {image}
        {overlay}
      </button>
    )
  }

  return (
    <div className={hostClass}>
      {image}
      {overlay}
    </div>
  )
}
