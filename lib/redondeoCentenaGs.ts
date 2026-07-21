/**
 * Redondeo comercial RIMEC — centena más próxima (Gs.).
 * 230.048 → 230.000 · 230.051 → 230.100
 * Doc: CHUSAR_REGLA_REDONDEO_CENTENA_PROXIMA.md (2.3.1.7.1.0.2)
 */
export function redondearCentenaGs(n: number): number {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x / 100) * 100
}
