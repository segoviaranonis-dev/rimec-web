'use client'

import { useCallback, useState } from 'react'

type Props = {
  alt: string
  candidates: string[]
  className?: string
}

/** Modal / ampliación — paridad Report `ProductHeroFrame`. */
export function ProductHeroFrame({ alt, candidates, className = '' }: Props) {
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const src = candidates[idx]

  const tryNextOrFail = useCallback(() => {
    setIdx((i) => {
      if (i + 1 < candidates.length) return i + 1
      setFailed(true)
      return i
    })
  }, [candidates.length])

  if (!src || failed) {
    return (
      <div
        className={`flex min-h-[280px] items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 ${className}`}
      >
        Sin imagen disponible
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`mx-auto h-auto max-h-[600px] w-full max-w-[600px] rounded-lg object-contain object-center shadow-sm ${className}`}
      decoding="async"
      onError={tryNextOrFail}
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget
        if (naturalWidth < 1 || naturalHeight < 1) tryNextOrFail()
      }}
    />
  )
}
