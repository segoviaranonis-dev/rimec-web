'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isImageDecoded, preloadImageDecoded } from '@/lib/image-decode-cache'
import {
  HERO_VIEWPORT,
  isFlatOnlyImagenNombre,
  intrinsicDimsFromImageUrl,
  preferSmTierUrl,
  productImageFallbackStyle,
  resolveCanonicalImageUrl,
  resolveFlatImageUrl,
  toMdStorageUrl,
  type ImageVariant,
} from '@/lib/productImage'
import { useHeroProgressiveSrc } from '@/lib/use-hero-progressive-src'

type Props = {
  src?: string | null
  fallbackSrc?: string | null
  linea: string
  referencia: string
  material?: string
  color?: string
  imagenNombre?: string | null
  alt: string
  variant?: ImageVariant
  priority?: boolean
  className?: string
  /** Grilla catálogo: solo sm/md — flat recorta punta/tacón (4.90.03.002). */
  allowFlatFallback?: boolean
}

function markLoadedIfCached(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0)
}

/** Copia literal Tablet Bazzar depósito — cadena-thumb-frame / hero. */
export function ProductImage({
  src: srcProp,
  fallbackSrc: fallbackProp,
  linea,
  referencia,
  material = '',
  color = '',
  imagenNombre,
  alt,
  variant = 'thumb',
  priority = false,
  className = '',
  allowFlatFallback = false,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeSrc, setActiveSrc] = useState<string | null>(null)
  const usedMd = useRef(false)
  const usedFlat = useRef(false)

  const isHero = variant === 'hero'

  const canonicalSrc = useMemo(() => {
    if (isHero) return null
    const raw =
      srcProp ??
      resolveCanonicalImageUrl({
        linea,
        referencia,
        material,
        color,
        imagenNombre,
        variant,
      })
    return preferSmTierUrl(raw)
  }, [isHero, srcProp, linea, referencia, material, color, imagenNombre, variant])

  const flatFallback = useMemo(() => {
    if (isHero) return null
    if (fallbackProp) return fallbackProp
    return resolveFlatImageUrl({
      linea,
      referencia,
      material,
      color,
      imagenNombre,
    })
  }, [isHero, fallbackProp, linea, referencia, material, color, imagenNombre])

  const heroSkuKey = `${linea}|${referencia}|${material}|${color}`

  const heroFlatFallback = useMemo(
    () =>
      resolveFlatImageUrl({
        linea,
        referencia,
        material,
        color,
        imagenNombre,
      }),
    [linea, referencia, material, color, imagenNombre],
  )

  const flatOnlyHero = isFlatOnlyImagenNombre(imagenNombre)

  const heroUrls = useMemo(
    () => ({
      imagen_url_thumb: flatOnlyHero
        ? heroFlatFallback
        : resolveCanonicalImageUrl({
            linea,
            referencia,
            material,
            color,
            imagenNombre,
            variant: 'thumb',
          }),
      imagen_url_hero: flatOnlyHero
        ? heroFlatFallback
        : resolveCanonicalImageUrl({
            linea,
            referencia,
            material,
            color,
            imagenNombre,
            variant: 'hero',
          }),
      imagen_url_flat: heroFlatFallback,
    }),
    [linea, referencia, material, color, imagenNombre, flatOnlyHero, heroFlatFallback],
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

    usedMd.current = false
    usedFlat.current = false
    setActiveSrc(canonicalSrc)

    if (!canonicalSrc) {
      setLoaded(false)
      return
    }

    if (isImageDecoded(canonicalSrc)) {
      setLoaded(true)
      return
    }

    let cancelled = false
    setLoaded(false)

    void (async () => {
      if (await preloadImageDecoded(canonicalSrc)) {
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
  }, [canonicalSrc, isHero])

  const eager = isHero || priority

  const handleError = () => {
    if (isHero) return

    if (!usedMd.current && activeSrc) {
      const md = toMdStorageUrl(activeSrc)
      if (md && md !== activeSrc) {
        usedMd.current = true
        void (async () => {
          if (await preloadImageDecoded(md)) {
            setActiveSrc(md)
            setLoaded(true)
            return
          }
          setActiveSrc(md)
          setLoaded(false)
        })()
        return
      }
    }

    if (
      allowFlatFallback &&
      !usedFlat.current &&
      flatFallback &&
      activeSrc !== flatFallback &&
      flatFallback !== canonicalSrc
    ) {
      usedFlat.current = true
      void (async () => {
        if (await preloadImageDecoded(flatFallback)) {
          setActiveSrc(flatFallback)
          setLoaded(true)
          return
        }
        setActiveSrc(flatFallback)
        setLoaded(false)
      })()
      return
    }
    setLoaded(false)
  }

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true)
    void e.currentTarget.decode?.().catch(() => undefined)
  }

  if (isHero) {
    const dims = intrinsicDimsFromImageUrl(heroDisplaySrc)
    return (
      <div className={`relative h-full w-full min-h-0 min-w-0 ${className}`.trim()}>
        {heroDisplaySrc ? (
          <img
            key={heroDisplaySrc}
            ref={imgRef}
            src={heroDisplaySrc}
            alt={alt}
            width={dims.width}
            height={dims.height}
            className="absolute inset-0 h-full w-full object-contain object-center"
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
  const thumbKey = `${linea}|${referencia}|${material}|${color}`

  return (
    <div
      className={`cadena-thumb-frame ${className}`.trim()}
      style={productImageFallbackStyle(linea, referencia)}
    >
      {!ready && (
        <span
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5 text-center bg-[#F8FAFC]"
          aria-hidden
        >
          <span className="text-[10px] font-extrabold tracking-wide text-slate-400">
            {linea}·{referencia}
          </span>
        </span>
      )}
      {activeSrc ? (
        <img
          key={activeSrc ?? thumbKey}
          ref={imgRef}
          src={activeSrc}
          alt={alt}
          className={imgOpacity}
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
