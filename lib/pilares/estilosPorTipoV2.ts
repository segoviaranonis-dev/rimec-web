/**
 * Paridad Report `lib/pilares/constants.ts` — Estilos por tipo_v2 (654 / 638).
 * Siamese AM · DPE · Web. Fuente: Administrador de Pilares.
 */

export const ESTILOS_POR_TIPO_V2: Record<1 | 2, readonly string[]> = {
  1: [
    'BOTAS',
    'CARTERAS',
    'CHATITA',
    'CROCS',
    'OTROS',
    'PAPETTE',
    'RASTRERAS',
    'SANDALIA',
    'SEMIABIERTO',
    'STILETTO',
    'TACO ALTO',
    'TACO BAJO',
    'TACO MEDIO',
    'TENIS',
    'ZAPATILLA',
  ],
  2: ['CONFECCIONES', 'OTROS'],
}

export function normMaestraLabel(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export function tipoV2IdFromRamoTipo(ramoTipo: string | null | undefined): 1 | 2 | null {
  const u = String(ramoTipo ?? '')
    .trim()
    .toUpperCase()
  if (u === 'CALZADO' || u === 'CALZADOS') return 1
  if (u === 'CONFECCIONES' || u === 'CONFECCION') return 2
  return null
}
