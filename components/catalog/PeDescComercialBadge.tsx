/** Esquina superior izquierda imagen — % comercial dictado (discreto). */
export function PeDescComercialBadge({
  pct,
  className = '',
}: {
  pct: number
  className?: string
}) {
  if (!Number.isFinite(pct) || pct <= 0) return null
  return (
    <span
      className={`pointer-events-none absolute left-1 top-1 z-10 rounded bg-white/90 px-1 py-0.5 text-[8px] font-semibold tabular-nums leading-none text-slate-600 shadow-sm ring-1 ring-slate-200/80 sm:left-1.5 sm:top-1.5 sm:text-[9px] ${className}`}
      title="Descuento comercial PE"
    >
      −{pct}%
    </span>
  )
}
