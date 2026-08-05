'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isImageDecoded, preloadImageDecoded } from '@/lib/image-decode-cache'
import {
  HERO_VIEWPORT,
  productImageCandidatesForUi,
  productImageFallbackStyle,
  type ImageVariant,
} from '@/lib/productImage'
import { useHeroProgressiveSrc } from '@/lib/use-hero-progressive-src'

type Props = {
  src?: string | null
  fallbackSrc?: string | null
  candidates?: string[]
  linea: string
  referencia: string
  material?: string
  color?: string
  imagenNombre?: string | null
  alt: string
  variant?: ImageVariant
  priority?: boolean
  className?: string
}

/**
 * Imagen catálogo RIMEC Web.
 * - Sin skeleton con nombre (era el parpadeo “20 veces/s”).
 * - Solo cambia src cuando la URL ya está en caché decode.
 * - Fallbacks se prueban en silencio (Image()), sin pintar URLs rotas.
 */
export function ProductImage({
  src: srcProp,
  fallbackSrc: fallbackProp,
  candidates: candidatesProp,
  linea,
  referencia,
  material = '',
  color = '',
  imagenNombre,
  alt,
  variant = 'thumb',
  priority = false,
  className = '',
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const displaySrcRef = useRef<string | null>(null)
  const probeGen = useRef(0)
  const [displaySrc, setDisplaySrc] = useState<string | null>(null)

  const isHero = variant === 'hero'

  const candidatesKey = candidatesProp?.join('\0') ?? ''

  const chain = useMemo(() => {
    if (candidatesProp?.length) return candidatesProp
    return productImageCandidatesForUi(
      linea,
      referencia,
      material,
      color,
      imagenNombre,
      isHero ? 'modal' : 'thumb',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesKey, linea, referencia, material, color, imagenNombre, isHero])

  const flatFallback = fallbackProp ?? null

  const heroSkuKey = `${linea}|${referencia}|${material}|${color}`

  const heroUrls = useMemo(
    () => ({
      imagen_url_thumb: chain.find(u => u.includes('/sm/')) ?? chain[0] ?? null,
      imagen_url_hero: chain.find(u => u.includes('/lg/')) ?? chain[0] ?? null,
      imagen_url_flat:
        flatFallback ??
        chain.find(u => !/\/productos\/(sm|md|lg|thumbs)\//i.test(u)) ??
        null,
    }),
    [chain, flatFallback],
  )

  const emptyHeroUrls = useMemo(
    () => ({
      imagen_url_thumb: null as string | null,
      imagen_url_hero: null as string | null,
      imagen_url_flat: null as string | null,
    }),
    [],
  )

  const { shown: heroDisplaySrc } = useHeroProgressiveSrc(
    isHero ? heroUrls : emptyHeroUrls,
    heroSkuKey,
  )

  useLayoutEffect(() => {
    if (isHero) return

    const gen = ++probeGen.current
    const tryList = [
      ...chain,
      ...(srcProp ? [srcProp] : []),
      ...(flatFallback ? [flatFallback] : []),
    ].filter((u, i, arr) => Boolean(u) && arr.indexOf(u) === i)

    if (tryList.length === 0) {
      // Mantener foto anterior si existía; no mostrar nombre.
      return
    }

    const already =
      tryList.find(u => u === displaySrcRef.current && isImageDecoded(u)) ??
      tryList.find(u => isImageDecoded(u))

    if (already) {
      displaySrcRef.current = already
      setDisplaySrc(already)
      return
    }

    // Thumb: pintar 1.ª candidata de inmediato (candidates API / warm) y validar en background.
    // Evita waterfall serial md/lg en first paint de grilla.
    const hasApiCandidates = candidatesKey.length > 0
    const first = tryList[0]!
    if (variant === 'thumb' && hasApiCandidates && !displaySrcRef.current) {
      displaySrcRef.current = first
      setDisplaySrc(first)
    }

    let cancelled = false
    void (async () => {
      const probeList =
        variant === 'thumb' && hasApiCandidates
          ? tryList.slice(0, Math.min(2, tryList.length))
          : tryList
      for (const url of probeList) {
        if (cancelled || probeGen.current !== gen) return
        const ok = await preloadImageDecoded(url)
        if (cancelled || probeGen.current !== gen) return
        if (ok) {
          if (displaySrcRef.current !== url) {
            displaySrcRef.current = url
            setDisplaySrc(url)
          }
          return
        }
      }
      // Falló la corta: seguir con el resto solo si aún no hay foto.
      if (displaySrcRef.current) return
      for (const url of tryList.slice(probeList.length)) {
        if (cancelled || probeGen.current !== gen) return
        const ok = await preloadImageDecoded(url)
        if (cancelled || probeGen.current !== gen) return
        if (ok) {
          displaySrcRef.current = url
          setDisplaySrc(url)
          return
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // Tamaño fijo siempre (HMR no debe mezclar 8 vs 10). candidatesKey = string estable.
  }, [isHero, chain, srcProp, flatFallback, variant, candidatesKey])

  if (isHero) {
    return (
      <div className={`cadena-hero-frame ${className}`.trim()} data-hero-frame="rimec-web">
        {heroDisplaySrc ? (
          <img
            ref={imgRef}
            src={heroDisplaySrc}
            alt={alt}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div
            className="absolute inset-0 bg-white"
            style={{ aspectRatio: `${HERO_VIEWPORT.width} / ${HERO_VIEWPORT.height}` }}
            aria-hidden
          />
        )}
      </div>
    )
  }

  const eager = priority

  return (
    <div
      className={`cadena-thumb-frame ${className}`.trim()}
      style={productImageFallbackStyle(linea, referencia)}
    >
      {displaySrc ? (
        <img
          ref={imgRef}
          src={displaySrc}
          alt={alt}
          className="block max-h-full max-w-full h-auto w-auto object-contain object-center bg-white/95 opacity-100"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'low'}
        />
      ) : (
        <div className="absolute inset-0 bg-white" aria-hidden />
      )}
    </div>
  )
}
