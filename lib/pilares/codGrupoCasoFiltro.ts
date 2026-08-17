/**
 * Caso filtro desde COD.GRUPO — canon 2.2.1.56 (paridad Report).
 */
export type CasoFiltroId =
  | 'chi'
  | 'normal'
  | 'actual'
  | 'anterior'
  | 'promo'
  | 'liquidacion'
  | 'comun'

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

export function casoFiltroIdsDesdeCodGrupo(
  codGrupo: string | null | undefined,
): CasoFiltroId[] {
  const g = normalizeCodGrupo10(codGrupo)
  if (!g) return []

  const prefijo = g.slice(0, 2)
  const confecciones = CONF_MARCAS.has(prefijo)
  const out: CasoFiltroId[] = []

  if (prefijo === '09') {
    out.push('chi')
    const d45 = g.slice(4, 6)
    if (d45 === '04') out.push('liquidacion')
    else if (d45 === '02') out.push('promo')
    return out
  }

  if (confecciones) {
    const d67 = g.slice(6, 8)
    if (d67 === '04') out.push('liquidacion')
    else if (d67 === '03') out.push('promo')
    else if (d67 === '02') out.push('anterior')
    else if (d67 === '01') out.push('actual')
    else out.push('actual')
    return out
  }

  const d45 = g.slice(4, 6)
  if (d45 === '04') out.push('liquidacion')
  else if (d45 === '02') out.push('promo')
  else if (d45 === '06') out.push('comun')
  else out.push('normal')
  return out
}

export function esPrefijoChinelo(codGrupo: string | null | undefined): boolean {
  const g = normalizeCodGrupo10(codGrupo)
  return Boolean(g && g.slice(0, 2) === '09')
}
