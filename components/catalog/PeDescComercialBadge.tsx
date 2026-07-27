/** Esquina superior izquierda imagen — descuentos PE (LPC03 10% + comercial dictado). */
import { hayDescuentoPeCatalogo } from '@/lib/pePrecioNetoCatalogo'

export function PeDescComercialBadge({
  pct,
  listaPrecioId = 1,
  className = '',
}: {
  pct: number
  listaPrecioId?: number
  className?: string
}) {
  const esLpc03 = listaPrecioId === 3
  const dictado = Number.isFinite(pct) && pct > 0 ? pct : 0
  if (!esLpc03 && dictado <= 0) return null
  if (!hayDescuentoPeCatalogo(listaPrecioId, dictado > 0 ? dictado : null)) return null

  const partes: string[] = []
  if (esLpc03) partes.push('10%')
  if (dictado > 0) partes.push(`${dictado}%`)

  return (
    <span
      className={`pointer-events-none absolute left-1 top-1 z-10 rounded bg-white/90 px-1 py-0.5 text-[8px] font-semibold tabular-nums leading-none text-slate-600 shadow-sm ring-1 ring-slate-200/80 sm:left-1.5 sm:top-1.5 sm:text-[9px] ${className}`}
      title={esLpc03 ? 'LPC03: 10% fijo + descuento comercial PE' : 'Descuento comercial PE'}
    >
      −{partes.join('+')}
    </span>
  )
}
