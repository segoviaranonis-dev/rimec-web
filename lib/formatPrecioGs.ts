/** Paridad Tablet/Report depósito — precio en Gs. */
export function formatPrecioGs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}
