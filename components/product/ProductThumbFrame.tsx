'use client'

import { useCallback, useState } from 'react'

type Props = {
  alt: string
  candidates: string[]
  /** Tamaño fijo px — omitir con `fill` para ocupar el host aspect-square. */
  size?: number
  fill?: boolean
  className?: string
  onClick?: () => void
  priority?: boolean
}

/**
 * Marco sagrado Report `ProductThumbFrame` — grid + max-h/max-w + object-contain.
 * Sin width/height 100% en img (evita recorte lateral en fotos horizontales PE).
 */
export function ProductThumbFrame({
  alt,
  candidates,
  size = 56,
  fill = false,
  className = '',
  onClick,
  priority = false,
}: Props) {
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

  const boxStyle = fill ? undefined : { width: size, height: size }
  const frameClass = [
    'relative grid shrink-0 place-items-center overflow-hidden bg-white p-1.5',
    fill ? 'h-full w-full min-h-0 min-w-0' : 'rounded-lg border border-neutral-200',
    onClick ? 'ring-1 ring-gray-200 transition-shadow hover:ring-2 hover:ring-bazzar-naranja hover:shadow-md cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (!src || failed) {
    const placeholder = (
      <span className="text-lg text-neutral-400" aria-hidden>
        📷
      </span>
    )
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`flex items-center justify-center ${frameClass}`}
          style={boxStyle}
          aria-label={alt}
        >
          {placeholder}
        </button>
      )
    }
    return (
      <div className={`flex items-center justify-center ${frameClass}`} style={boxStyle} role="img" aria-label={alt}>
        {placeholder}
      </div>
    )
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="block max-h-full max-w-full object-contain object-center"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      onError={tryNextOrFail}
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget
        if (naturalWidth < 1 || naturalHeight < 1) tryNextOrFail()
      }}
    />
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={frameClass} style={boxStyle} aria-label={`Ampliar ${alt}`}>
        {img}
      </button>
    )
  }

  return (
    <div className={frameClass} style={boxStyle}>
      {img}
    </div>
  )
}
