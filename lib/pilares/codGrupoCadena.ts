/**
 * Cadena comercial desde COD.GRUPO (10 dígitos Carlos).
 * Calzado pos 5–6 (índice 4–5): 01 REGULAR · 02 PROMOCIONAL · 04 LIQUIDACION
 * Confecciones pos 7–8 (índice 6–7): 03 PROMOCIONAL · 04 LIQUIDACION
 * Fuente: report `cod-grupo-decode.ts` + MIG-171 `grupo_digito_mapa`.
 */
export type CadenaDesdeGrupo = 'LIQUIDACION' | 'PROMOCIONAL' | 'REGULAR'

const CONF_MARCAS = new Set(['10', '11', '12', '13', '14', '15'])

export function normalizeCodGrupo10(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '')
    .trim()
    .replace(/\.0$/, '')
    .replace(/\D/g, '')
  if (!digits || digits.length < 6) return null
  if (digits.length === 10) return digits
  if (digits.length < 10) return digits.padStart(10, '0')
  return digits.slice(0, 10)
}

/** Deriva cadena Tipo desde COD.GRUPO. null si no se puede leer. */
export function cadenaComercialDesdeCodGrupo(
  codGrupo: string | null | undefined,
): CadenaDesdeGrupo | null {
  const g = normalizeCodGrupo10(codGrupo)
  if (!g) return null
  const marca = g.slice(0, 2)
  const confecciones = CONF_MARCAS.has(marca)
  if (confecciones) {
    const d67 = g.slice(6, 8)
    if (d67 === '04') return 'LIQUIDACION'
    if (d67 === '03') return 'PROMOCIONAL'
    return 'REGULAR'
  }
  const d45 = g.slice(4, 6)
  if (d45 === '04') return 'LIQUIDACION'
  if (d45 === '02') return 'PROMOCIONAL'
  if (d45 === '01') return 'REGULAR'
  return null
}
