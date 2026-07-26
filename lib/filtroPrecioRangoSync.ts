/**
 * Núcleo puro teclado ↔ slider ↔ SQL (misma consulta, dos representaciones).
 * Testeable sin React.
 */

export function clampPrecio(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Solo dígitos → monto Gs; vacío / basura → null. */
export function parsePrecioInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatPrecioGs(n: number | null): string {
  if (n == null) return ''
  return n.toLocaleString('es-PY')
}

/** Ordena y clampa: lo ≤ hi dentro de [piso, tope]. */
export function normalizarRangoDraft(
  loRaw: number,
  hiRaw: number,
  piso: number,
  tope: number,
): { lo: number; hi: number } {
  const lo = clampPrecio(Math.min(loRaw, hiRaw), piso, tope)
  const hi = clampPrecio(Math.max(loRaw, hiRaw), piso, tope)
  return { lo, hi }
}

/**
 * Draft UI → params SQL.
 * Extremos del catálogo (piso/tope) = null (sin WHERE en ese lado).
 */
export function draftASqlParams(
  lo: number,
  hi: number,
  piso: number,
  tope: number,
): { precio_min: number | null; precio_max: number | null } {
  return {
    precio_min: lo <= piso ? null : lo,
    precio_max: hi >= tope ? null : hi,
  }
}

/**
 * Teclado → draft slider.
 * Si un lado no parsea, conserva el draft actual de ese lado.
 */
export function tecladoADraft(
  minTxt: string,
  maxTxt: string,
  draftLo: number,
  draftHi: number,
  piso: number,
  tope: number,
): { lo: number; hi: number; minFmt: string; maxFmt: string } {
  const loRaw = parsePrecioInput(minTxt) ?? draftLo
  const hiRaw = parsePrecioInput(maxTxt) ?? draftHi
  const { lo, hi } = normalizarRangoDraft(loRaw, hiRaw, piso, tope)
  return { lo, hi, minFmt: formatPrecioGs(lo), maxFmt: formatPrecioGs(hi) }
}
