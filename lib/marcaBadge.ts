export type MarcaBadgeStyle = {
  backgroundColor: string
  color: string
  border?: string // ej. '2px solid #FFFFFF'
}

/** Mismo estilo que BR Sport (azul eléctrico + blanco). */
const ESTILO_BR_SPORT: MarcaBadgeStyle = {
  backgroundColor: '#0066FF',
  color: '#FFFFFF',
}

/** Rosa Moleca — compartido con Molekinha. */
const ESTILO_ROSA_MOLECA: MarcaBadgeStyle = {
  backgroundColor: '#D81B60',
  color: '#FFFFFF',
}

const MARCA_BADGE: Record<string, MarcaBadgeStyle> = {
  'VIZZANO': { backgroundColor: '#000000', color: '#FFFFFF' },
  'MOLECA': ESTILO_ROSA_MOLECA,
  'MOLEKINHA': ESTILO_ROSA_MOLECA,
  'MOLKINHA': ESTILO_ROSA_MOLECA, // alias typo histórico
  'ACTVITTA': { backgroundColor: '#374151', color: '#FFFFFF' },
  'ACTVITA': { backgroundColor: '#374151', color: '#FFFFFF' },
  'MOLEKINHO': ESTILO_BR_SPORT,
  'MOLKINHO': ESTILO_BR_SPORT, // alias typo histórico
  'MODARE': { backgroundColor: '#C4A574', color: '#FFFFFF' },
  'BEIRA RIO': { backgroundColor: '#F97316', color: '#FFFFFF' },
  'BR SPORT': ESTILO_BR_SPORT,
  'BRSPORT': ESTILO_BR_SPORT,
  '__default__': { backgroundColor: '#1E40AF', color: '#FFFFFF' },
}

export function normalizarMarcaKey(descp: string): string {
  return descp
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
}

export function estiloBadgeMarca(descp_marca: string | null | undefined): MarcaBadgeStyle {
  const key = normalizarMarcaKey(descp_marca ?? '')
  return MARCA_BADGE[key] ?? MARCA_BADGE['__default__']
}
