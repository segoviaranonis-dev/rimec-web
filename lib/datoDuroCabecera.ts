/**
 * Dato duro cabecera CP — Nº preventa Carlos + quincena (24 elementos).
 * Formato Director 2026-07-20: "PP-4099 · 1ra Sep."
 */

const MESES_ABBR: Record<string, string> = {
  enero: 'Ene.',
  febrero: 'Feb.',
  marzo: 'Mar.',
  abril: 'Abr.',
  mayo: 'May.',
  junio: 'Jun.',
  julio: 'Jul.',
  agosto: 'Ago.',
  septiembre: 'Sep.',
  octubre: 'Oct.',
  noviembre: 'Nov.',
  diciembre: 'Dic.',
}

/** Unifica nro_pedido_externo → PP-NNNN (dígitos puros incluidos). */
export function formatNumeroPreventaCarlos(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''

  if (/^PP-\d+(-\d+)?$/i.test(s)) return `PP-${s.slice(3)}`

  if (/^\d+(-\d+)?$/.test(s)) return `PP-${s}`

  const ppMatch = s.match(/^PP\s*[-–]?\s*(.+)$/i)
  if (ppMatch) {
    const rest = ppMatch[1].replace(/\s+/g, '')
    if (/^\d+(-\d+)?$/.test(rest)) return `PP-${rest}`
    return `PP-${rest}`
  }

  return s
}

/** "1ra Q. de Octubre" → "1ra Oct." · sin "de" · mes abreviado. */
export function formatQuincenaCorta(desc: string | null | undefined): string {
  const s = String(desc ?? '').trim()
  if (!s) return ''
  if (/pronta entrega/i.test(s)) return s

  const m = s.match(/^(1ra|2da)\s+(?:Q\.\s+de\s+|Quincena\s+de\s+)?(\p{L}+)/iu)
  if (m) {
    const ord = m[1].toLowerCase().startsWith('1') ? '1ra' : '2da'
    const mesKey = m[2].toLowerCase()
    const abbr = MESES_ABBR[mesKey] ?? `${mesKey.slice(0, 3).replace(/^./, c => c.toUpperCase())}.`
    return `${ord}\u00A0${abbr}`
  }

  return s
    .replace(/\s+Q\.\s+de\s+/gi, ' ')
    .replace(/\s+Quincena\s+de\s+/gi, ' ')
    .replace(/\s+de\s+/gi, ' ')
    .trim()
}

/** Partes separadas — UI siamese: fila 1 preventa · fila 2 quincena (nunca una sola línea). */
export type DatoDuroCpPartes = {
  preventa: string
  quincena: string
}

export function partesDatoDuroCp(
  preventa: string | null | undefined,
  quincenaDesc: string | null | undefined,
): DatoDuroCpPartes {
  return {
    preventa: formatNumeroPreventaCarlos(preventa),
    quincena: formatQuincenaCorta(quincenaDesc),
  }
}

/** Parsea etiqueta combinada legacy (PDF / buckets agregados). */
export function parseEtiquetaDatoDuroCp(label: string): DatoDuroCpPartes {
  const s = String(label ?? '').trim()
  if (!s) return { preventa: '', quincena: '' }
  const sep = s.indexOf(' · ')
  if (sep >= 0) {
    return {
      preventa: s.slice(0, sep).trim(),
      quincena: s.slice(sep + 3).trim(),
    }
  }
  if (/^PP-/i.test(s)) return { preventa: s, quincena: '' }
  return { preventa: '', quincena: s }
}

/** Etiqueta acordeón / PDF / grilla CP — texto plano (PDF, keys). */
export function etiquetaDatoDuroCp(
  preventa: string | null | undefined,
  quincenaDesc: string | null | undefined,
): string {
  const parts: string[] = []
  const pv = formatNumeroPreventaCarlos(preventa)
  if (pv) parts.push(pv)
  const q = formatQuincenaCorta(quincenaDesc)
  if (q) parts.push(q)
  return parts.join(' · ') || 'Compra previa'
}
