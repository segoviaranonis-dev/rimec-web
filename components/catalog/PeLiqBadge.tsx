/** Esquina superior derecha imagen PE — LIQUIDACIÓN · latido casino oro */
export function PeLiqBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`catalog-pe-liq-badge pointer-events-none absolute right-1 top-1 z-10 rounded px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-wider sm:right-1.5 sm:top-1.5 sm:text-[9px] ${className}`}
      title="Pronta entrega · liquidación · D1 2%"
    >
      LIQ
    </span>
  )
}
