'use client'

import { useEffect, useState } from 'react'

/** sm al instante · upgrade a lg en modal — paridad Tablet Bazzar. */
export function useProgressiveImageSrc(
  previewSrc: string | null,
  highSrc: string | null,
  key: string,
): { shown: string | null; isHighQuality: boolean } {
  const [shown, setShown] = useState<string | null>(previewSrc ?? highSrc)

  useEffect(() => {
    setShown(previewSrc ?? highSrc ?? null)
    if (!highSrc || highSrc === previewSrc) return

    let cancelled = false
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (!cancelled) setShown(highSrc)
    }
    img.src = highSrc

    return () => {
      cancelled = true
    }
  }, [key, previewSrc, highSrc])

  return {
    shown,
    isHighQuality: Boolean(highSrc && shown === highSrc),
  }
}
