/** Pilar color — tono_canon · paridad Report `/pilares/color` · CHUSAR_PILAR_COLOR_TONO_CANON */

export type TonoCanonSolido = {
  tipo: 'solido'
  etiqueta: string
  hex: string
}

export type TonoCanonPaleta = {
  tipo: 'paleta'
  etiqueta: string
  swatches: string[]
}

export type TonoCanon = TonoCanonSolido | TonoCanonPaleta

function normHex(h: string): string {
  const x = h.trim()
  if (!x) return '#94a3b8'
  return (x.startsWith('#') ? x : `#${x}`).toLowerCase()
}

export function tonoSolido(etiqueta: string, hex: string): TonoCanonSolido {
  const t = etiqueta.trim()
  const label = t.length > 1 ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t.toUpperCase()
  return { tipo: 'solido', etiqueta: label, hex: normHex(hex) }
}

export function tonoPaleta(etiqueta: string, swatches: string[]): TonoCanonPaleta {
  const t = etiqueta.trim()
  const label = t.length > 1 ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t.toUpperCase()
  return {
    tipo: 'paleta',
    etiqueta: label,
    swatches: swatches.map(normHex).filter(Boolean),
  }
}

export function parseTonoCanon(raw: unknown): TonoCanon | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const etiqueta = String(o.etiqueta ?? '').trim()
  if (!etiqueta) return null
  if (o.tipo === 'solido' && typeof o.hex === 'string') return tonoSolido(etiqueta, o.hex)
  if (o.tipo === 'paleta' && Array.isArray(o.swatches)) {
    return tonoPaleta(etiqueta, o.swatches.map(String))
  }
  return null
}

/** CSS background para círculo tono (solido o gradiente paleta / Otros). */
export function tonoCircleStyle(tono: TonoCanon | null): { background?: string; backgroundColor?: string } {
  if (!tono) return { backgroundColor: '#e2e8f0' }
  if (tono.tipo === 'solido') return { backgroundColor: tono.hex }
  if (tono.swatches.length === 0) return { backgroundColor: '#e2e8f0' }
  if (tono.swatches.length === 1) return { backgroundColor: tono.swatches[0] }
  const step = 100 / tono.swatches.length
  const stops = tono.swatches.map((h, i) => `${h} ${i * step}% ${(i + 1) * step}%`).join(', ')
  return { background: `conic-gradient(${stops})` }
}

/** Etiqueta tono desde JSON `color.tono_canon`. */
export function etiquetaTonoFromRaw(raw: unknown): string | null {
  const t = parseTonoCanon(raw)
  const e = t?.etiqueta?.trim()
  return e || null
}
