'use client'

import { useEffect, useRef, useState } from 'react'
import { isImageDecoded, preloadImageDecoded } from '@/lib/image-decode-cache'
import { pickHeroProgressive, type ImagenUrls } from '@/lib/productImage'

/**
 * sm/ → lg/ sin flash blanco al cambiar color.
 * Regla: no cambiar `shown` hasta que la nueva URL esté en caché decode;
 * mientras tanto se mantiene la foto del color anterior.
 */
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
  const shownRef = useRef(shown)
  shownRef.current = shown
  const skuRef = useRef(skuKey)

  useEffect(() => {
    let cancelled = false
    const skuAtStart = skuKey
    skuRef.current = skuKey

    const commit = (url: string) => {
      if (cancelled || skuRef.current !== skuAtStart) return
      shownRef.current = url
      setShown(url)
    }

    const decodedNow =
      (target && isImageDecoded(target) ? target : null) ??
      (preview && isImageDecoded(preview) ? preview : null)

    if (decodedNow) {
      commit(decodedNow)
    }
    // Si no hay decode: NO pisar shown con URL fría (evita parpadeo / blanco).

    void (async () => {
      if (preview) {
        const ok = await preloadImageDecoded(preview)
        if (ok) commit(preview)
      }

      if (cancelled || skuRef.current !== skuAtStart) return

      if (target && target !== preview) {
        const lgOk = await preloadImageDecoded(target)
        if (lgOk) {
          commit(target)
          return
        }
      }

      if (cancelled || skuRef.current !== skuAtStart) return

      for (const fb of fallbacks) {
        if (await preloadImageDecoded(fb)) {
          commit(fb)
          return
        }
      }

      // Primera apertura sin hold: si aún no hay shown, forzar preview (onError del img no aplica aquí).
      if (!shownRef.current && (preview || target)) {
        commit(preview ?? target!)
      }
    })()

    return () => {
      cancelled = true
    }
    // fallbacks estable por join en deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuKey, preview, target, fallbacks.join('\0')])

  const zoomSrc = target ?? shown
  const isHighQuality = Boolean(target && shown === target)

  return { shown, zoomSrc, isHighQuality }
}
