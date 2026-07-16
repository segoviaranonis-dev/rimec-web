/** Esquina imagen — PE liquidación SDRM. */
export function LiquidacionPeBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute top-2 left-2 z-10 rounded-md border border-emerald-600/80 bg-emerald-600 px-1 py-0.5 text-[8px] font-black uppercase leading-none tracking-wide text-white shadow-sm sm:text-[9px] ${className}`}
      title="Pronta entrega · liquidación"
    >
      Liq.
    </span>
  )
}
