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
  /** URL primaria resuelta en servidor (sm/ o flat). */
  src?: string | null
  fallbackSrc?: string | null
  /** Cadena sm→md→flat precomputada en servidor — paridad Tablet/Report. */
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

function markLoadedIfCached(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0)
}

/**
 * Imagen catálogo RIMEC Web — canon NIIF · paridad Tablet `TarjetaCajaDeposito`.
 * Cadena retry: candidatos servidor → fallback flat → sin inventar CSS.
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
  const [loaded, setLoaded] = useState(false)
  const [activeSrc, setActiveSrc] = useState<string | null>(null)
  const [candidateIdx, setCandidateIdx] = useState(0)

  const isHero = variant === 'hero'

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
  }, [candidatesProp, linea, referencia, material, color, imagenNombre, isHero])

  const primarySrc = useMemo(() => {
    if (isHero) return null
    if (chain.length) return chain[0] ?? null
    if (srcProp) return srcProp
    return fallbackProp ?? null
  }, [isHero, srcProp, chain, fallbackProp])

  const flatFallback = fallbackProp ?? null

  const heroSkuKey = `${linea}|${referencia}|${material}|${color}`

  const heroUrls = useMemo(
    () => ({
      imagen_url_thumb: chain.find(u => u.includes('/sm/')) ?? chain[0] ?? null,
      imagen_url_hero: chain.find(u => u.includes('/lg/')) ?? chain[0] ?? null,
      imagen_url_flat: flatFallback ?? chain.find(u => !/\/productos\/(sm|md|lg|thumbs)\//i.test(u)) ?? null,
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

    setCandidateIdx(0)
    setActiveSrc(primarySrc)

    if (!primarySrc) {
      setLoaded(false)
      return
    }

    if (isImageDecoded(primarySrc)) {
      setLoaded(true)
      return
    }

    let cancelled = false
    setLoaded(false)

    void (async () => {
      if (await preloadImageDecoded(primarySrc)) {
        if (!cancelled) setLoaded(true)
        return
      }
      const img = imgRef.current
      if (!cancelled) {
        setLoaded(markLoadedIfCached(img))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [primarySrc, isHero])

  const eager = isHero || priority

  const tryNextSrc = (next: string | null) => {
    if (!next) return
    void (async () => {
      if (await preloadImageDecoded(next)) {
        setActiveSrc(next)
        setLoaded(true)
        return
      }
      setActiveSrc(next)
      setLoaded(false)
    })()
  }

  const handleError = () => {
    if (isHero) return

    let nextIdx = candidateIdx + 1
    while (nextIdx < chain.length && /\/productos\/(sm|thumbs)\//i.test(chain[nextIdx] ?? '')) {
      nextIdx += 1
    }
    if (nextIdx < chain.length) {
      setCandidateIdx(nextIdx)
      tryNextSrc(chain[nextIdx] ?? null)
      return
    }

    if (flatFallback && activeSrc !== flatFallback && !chain.includes(flatFallback)) {
      tryNextSrc(flatFallback)
      return
    }

    setActiveSrc(null)
    setLoaded(false)
  }

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget
    if (naturalWidth < 1 || naturalHeight < 1) {
      handleError()
      return
    }
    setLoaded(true)
    void e.currentTarget.decode?.().catch(() => undefined)
  }

  if (isHero) {
    return (
      <div className={`cadena-hero-frame ${className}`.trim()} data-hero-frame="rimec-web">
        {heroDisplaySrc ? (
          <img
            key={heroDisplaySrc}
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

  const ready =
    loaded || priority || (activeSrc ? isImageDecoded(activeSrc) : false)
  const imgOpacity = ready ? 'opacity-100' : 'opacity-0'
  const thumbKey = `${linea}|${referencia}|${material}|${color}|${candidateIdx}`

  return (
    <div
      className={`cadena-thumb-frame ${className}`.trim()}
      style={productImageFallbackStyle(linea, referencia)}
    >
      {!ready && (
        <span
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5 text-center bg-white"
          aria-hidden
        >
          <span className="text-[10px] font-extrabold tracking-wide text-slate-400">
            {linea}·{referencia}
          </span>
        </span>
      )}
      {activeSrc ? (
        <img
          key={thumbKey}
          ref={imgRef}
          src={activeSrc}
          alt={alt}
          className={`block max-h-full max-w-full h-auto w-auto object-contain object-center bg-white/95 ${imgOpacity}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'low'}
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : null}
    </div>
  )
}
