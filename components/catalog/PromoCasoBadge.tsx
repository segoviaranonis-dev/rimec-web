type Props = {
  size?: 'compact' | 'md'
  className?: string
}

/** Pill PROMO — Compra previa · biblioteca · borde fucsia + texto oscuro legible. */
export function PromoCasoBadge({ size = 'compact', className = '' }: Props) {
  const sizeClass =
    size === 'compact'
      ? 'px-1 py-px text-[7px] tracking-[0.14em]'
      : 'px-2 py-0.5 text-[9px] tracking-[0.18em]'

  return (
    <span
      className={`catalog-cp-promo-badge inline-flex shrink-0 items-center rounded-full border-2 border-fuchsia-700 bg-fuchsia-100 font-extrabold uppercase leading-none text-fuchsia-950 shadow-sm ${sizeClass} ${className}`}
      title="Compra previa · caso PROMOCIONAL · biblioteca · LPC03 = LPN"
    >
      PROMO
    </span>
  )
}
