/**
 * Ley RIMEC: redondeo a centena más próxima.
 * @see .claude/1_fundamentos/1.1_protocolos/LEY_REDONDEO_MOTOR_PRECIOS.md
 * 1949 → 1900 · 1950 → 2000 · 1951 → 2000
 */
export function redondeoCentenaRimec(valor: number): number {
  return Math.round(valor / 100) * 100
}
