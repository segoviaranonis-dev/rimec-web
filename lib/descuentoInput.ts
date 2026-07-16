/** Campo vacío cuando el descuento es 0 — UX tablet. */
export function descuentoInputDisplay(v: number | null | undefined): string {
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return ''
  return String(n)
}

/** Enteros o decimales; vacío → 0. */
export function parseDescuentoInput(raw: string): number {
  const t = raw.trim().replace(',', '.')
  if (!t) return 0
  const n = parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(100, n)
}

/** Solo dígitos y un punto decimal (mientras escribe). */
export function sanitizeDescuentoTyping(raw: string): string {
  const t = raw.replace(',', '.')
  if (t === '') return ''
  if (!/^\d*\.?\d*$/.test(t)) return raw.slice(0, -1)
  return t
}
