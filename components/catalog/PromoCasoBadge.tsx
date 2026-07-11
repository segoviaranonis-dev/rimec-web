import type { CSSProperties } from 'react'

/** Verde esperanza — suave, sin saturar la tarjeta. */
export const PROMO_BADGE_STYLE: CSSProperties = {
  backgroundColor: '#ECFDF5',
  color: '#047857',
  border: '1px solid #6EE7B7',
  boxShadow: '0 1px 2px rgba(4, 120, 87, 0.08)',
}

type Props = {
  /** Tarjeta compacta catálogo vs lightbox / preview. */
  size?: 'compact' | 'md'
  className?: string
}

/** Pill «PROMO» — caso comercial PROMOCIONAL (LPC03 = LPN). */
export function PromoCasoBadge({ size = 'compact', className = '' }: Props) {
  const sizeClass =
    size === 'compact'
      ? 'px-1 py-px text-[7px] tracking-[0.14em]'
      : 'px-2 py-0.5 text-[9px] tracking-[0.18em]'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-extrabold uppercase leading-none ${sizeClass} ${className}`}
      style={PROMO_BADGE_STYLE}
      title="Caso promocional · LPC03 = LPN"
    >
      PROMO
    </span>
  )
}
