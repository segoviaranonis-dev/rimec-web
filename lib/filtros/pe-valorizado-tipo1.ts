/**
 * Tipo 1 canónico PE — paridad Report `pe-valorizado-tipo1.ts`.
 * Canon: ACT PRENDAS (ACT ROPAS+PRENDAS) · vacío → OTROS.
 */
import { codGrupoEsMedias, esMarcaMedias } from '@/lib/filtros/pe-modulo-medias'

export const PE_TIPO1_OTROS_ID = -9
export const PE_TIPO1_OTROS_LABEL = 'OTROS' as const
export const ABCR_OTROS_ITEM = {
  id: PE_TIPO1_OTROS_ID,
  label: PE_TIPO1_OTROS_LABEL,
} as const

export const PE_TIPO1_ACT_PRENDAS = 'ACT PRENDAS' as const

export const PE_TIPO1_VALORIZADO_ALIASES: Readonly<Record<string, string>> = {
  'ACT PRENDAS': PE_TIPO1_ACT_PRENDAS,
  'ACT ROPAS': PE_TIPO1_ACT_PRENDAS,
  'ACT. ROPAS': PE_TIPO1_ACT_PRENDAS,
  PRENDAS: PE_TIPO1_ACT_PRENDAS,
  PRENDA: PE_TIPO1_ACT_PRENDAS,
  CARTERA: 'CARTERAS',
  CARTERAS: 'CARTERAS',
  LENTES: 'LENTES',
  ANTEOJOS: 'LENTES',
  OCULOS: 'LENTES',
  ÓCULOS: 'LENTES',
  MEDIAS: 'MEDIAS',
  MEDIA: 'MEDIAS',
  ESCOLAR: 'ESCOLAR',
  OTROS: 'OTROS',
  '(SIN TIPO 1)': 'OTROS',
  'SIN TIPO 1': 'OTROS',
  'SIN TIPO': 'OTROS',
}

export type PeTipo1ResolveSignals = {
  tipo1Raw?: string | null
  tipo0?: string | null
  marca?: string | null
  cod_grupo?: string | null
}

export function esTipo1Vacio(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').trim()
  if (!t) return true
  const u = t.toUpperCase()
  return (
    u === '(SIN TIPO 1)' ||
    u === 'SIN TIPO 1' ||
    u === 'SIN TIPO' ||
    u === 'NULL' ||
    u === '-'
  )
}

export function resolvePeTipo1Canon(sig: PeTipo1ResolveSignals): string {
  if (esTipo1Vacio(sig.tipo1Raw)) return PE_TIPO1_OTROS_LABEL

  const raw = String(sig.tipo1Raw ?? '').trim().toUpperCase()
  const t0 = String(sig.tipo0 ?? '').trim().toUpperCase()

  if (esMarcaMedias(sig.marca) || codGrupoEsMedias(sig.cod_grupo)) return 'MEDIAS'
  if (raw === 'MEDIAS' || raw === 'MEDIA') return 'MEDIAS'
  if (raw === 'ESCOLAR') return 'ESCOLAR'

  if (raw === 'ACCESORIOS') {
    if (t0 === 'CALZADOS' || t0 === 'CALZADO') return 'MEDIAS'
    return PE_TIPO1_ACT_PRENDAS
  }

  return PE_TIPO1_VALORIZADO_ALIASES[raw] ?? raw
}

export function canonPeTipo1Valorizado(raw: string | null | undefined): string {
  return resolvePeTipo1Canon({ tipo1Raw: raw })
}

export function esCanonActPrendas(raw: string | null | undefined): boolean {
  return canonPeTipo1Valorizado(raw) === PE_TIPO1_ACT_PRENDAS
}

export function esCanonOtros(raw: string | null | undefined): boolean {
  return canonPeTipo1Valorizado(raw) === PE_TIPO1_OTROS_LABEL
}
