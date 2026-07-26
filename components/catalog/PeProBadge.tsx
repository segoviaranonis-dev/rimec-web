/** Cabecera tarjeta PE — diccionario PROMOCIONAL · PRO · fucsia claro legible (≠ PROMO CP). */
export function PeProBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`catalog-pe-pro-badge inline-flex shrink-0 items-center rounded px-1 py-0.5 text-[7px] font-black uppercase leading-none tracking-wider shadow-sm sm:text-[8px] ${className}`}
      title="Pronta entrega · diccionario PROMOCIONAL · D1 2% · motor PE"
    >
      PRO
    </span>
  )
}
