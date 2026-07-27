import {
  partesDatoDuroCp,
  parseEtiquetaDatoDuroCp,
  type DatoDuroCpPartes,
} from '@/lib/datoDuroCabecera'
import { cromaticaCp, type RamoCpVisual } from '@/lib/cromaticaCpConfecciones'

type Props = {
  /** CP: partes explícitas. */
  preventa?: string | null
  quincena?: string | null
  /** PE / legacy: una sola línea. */
  fallbackLabel?: string
  /** Etiqueta combinada legacy «PP-4099 · 1ra Oct.». */
  labelCombinada?: string
  className?: string
  /** Catálogo acordeón — centrado y tipografía grande. */
  layout?: 'left' | 'center'
  /** Confecciones → quincena amarillo pastel; calzado → sky. */
  ramo?: RamoCpVisual
}

function resolverPartes(props: Props): DatoDuroCpPartes & { esCp: boolean; fallback: string } {
  if (props.preventa != null || props.quincena != null) {
    const p = partesDatoDuroCp(props.preventa, props.quincena)
    if (p.preventa || p.quincena) {
      return { ...p, esCp: true, fallback: props.fallbackLabel ?? 'Compra previa' }
    }
  }
  if (props.labelCombinada) {
    const p = parseEtiquetaDatoDuroCp(props.labelCombinada)
    if (p.preventa || p.quincena) {
      return { ...p, esCp: true, fallback: props.labelCombinada }
    }
  }
  return {
    preventa: '',
    quincena: '',
    esCp: false,
    fallback: props.fallbackLabel ?? props.labelCombinada ?? 'Compra previa',
  }
}

/**
 * Dato duro CP — OBLIGATORIO dos filas · colores distintos (Director 2026-07-20).
 * Fila 1: PP-NNNN naranja · Fila 2: quincena sky (calzado) o ámbar pastel (confecciones).
 */
export function DatoDuroCpFilas({
  preventa,
  quincena,
  fallbackLabel,
  labelCombinada,
  className = '',
  layout = 'left',
  ramo = 'calzado',
}: Props) {
  const { preventa: pv, quincena: q, esCp, fallback } = resolverPartes({
    preventa,
    quincena,
    fallbackLabel,
    labelCombinada,
  })
  const croma = cromaticaCp(ramo)

  const centered = layout === 'center'
  const colClass = centered
    ? 'flex w-full flex-col items-center justify-center gap-1 text-center'
    : 'flex min-w-0 flex-col gap-0.5'
  const preventaClass = centered
    ? `whitespace-nowrap text-[13px] font-black tabular-nums leading-none tracking-tight ${croma.textPreventa}`
    : `whitespace-nowrap text-[11px] font-black tabular-nums leading-none tracking-tight ${croma.textPreventa}`
  const quincenaClass = centered
    ? `whitespace-nowrap text-[12px] font-bold leading-none ${croma.textQuincena}`
    : `whitespace-nowrap text-[10px] font-bold leading-none ${croma.textQuincena}`

  if (!esCp) {
    return (
      <span
        className={`block font-semibold leading-snug text-slate-800 ${
          centered ? 'w-full text-center text-[11px]' : 'text-[10px]'
        } ${className}`}
      >
        {fallback}
      </span>
    )
  }

  return (
    <span className={`${colClass} ${className}`}>
      {pv ? (
        <span className={preventaClass} title={`Nº preventa Carlos · ${pv}`}>
          {pv}
        </span>
      ) : null}
      {q ? (
        <span className={quincenaClass} title={`Llegada · ${q}`}>
          {q}
        </span>
      ) : null}
      {!pv && !q ? (
        <span className={`font-semibold text-slate-800 ${centered ? 'text-[11px]' : 'text-[10px]'}`}>
          {fallback}
        </span>
      ) : null}
    </span>
  )
}
