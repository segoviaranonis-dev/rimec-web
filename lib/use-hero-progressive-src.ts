'use client'

import { useEffect, useState } from 'react'
import { isImageDecoded, preloadImageDecoded } from '@/lib/image-decode-cache'
import { pickHeroProgressive, type ImagenUrls } from '@/lib/productImage'

/** sm/ al instante; upgrade a lg/ en cuanto decode — paridad Tablet depósito. */
export function useHeroProgressiveSrc(
  urls: Pick<ImagenUrls, 'imagen_url_thumb' | 'imagen_url_hero' | 'imagen_url_flat'>,
  skuKey: string,
): {
  shown: string | null
  zoomSrc: string | null
  isHighQuality: boolean
} {
  const { preview, target, fallbacks } = pickHeroProgressive(urls)

  const [shown, setShown] = useState<string | null>(() => {
    if (target && isImageDecoded(target)) return target
    if (preview && isImageDecoded(preview)) return preview
    return preview ?? target ?? null
  })

  useEffect(() => {
    let cancelled = false

    if (target && isImageDecoded(target)) {
      setShown(target)
    } else if (preview && isImageDecoded(preview)) {
      setShown(preview)
    } else {
      setShown(preview ?? target ?? null)
    }

    if (preview && preview !== target) {
      void preloadImageDecoded(preview)
    }

    void (async () => {
      if (target) {
        const lgOk = await preloadImageDecoded(target)
        if (!cancelled && lgOk) {
          setShown(target)
          return
        }
      }

      if (cancelled) return

      for (const fb of fallbacks) {
        if (await preloadImageDecoded(fb)) {
          if (!cancelled) setShown(fb)
          return
        }
      }

      if (preview && preview !== target) {
        const smOk = await preloadImageDecoded(preview)
        if (!cancelled && smOk) setShown(preview)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [skuKey, preview, target, fallbacks.join('\0')])

  const zoomSrc = target ?? shown
  const isHighQuality = Boolean(target && shown === target)

  return { shown, zoomSrc, isHighQuality }
}
