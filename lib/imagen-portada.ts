/**
 * Imagen de portada (marca) — siamese con bazzar-web/lib/imagen-portada.ts
 * Prefijo: productos/portada/{tier?}/{stem}.jpg
 * Keyword: **imagen de portada** · CHUSAR 2.01.04.024
 */

export type PortadaTier = 'flat' | 'sm' | 'md' | 'lg'

export const PORTADA_STEM_BY_MARCA: Record<string, string> = {
  VIZZANO: 'vizzano',
  MOLECA: 'moleca',
  MOLEKINHA: 'molekinha',
  MOLEKINHO: 'molekinho',
  MODARE: 'modare',
  ACTVITTA: 'actvitta',
  'BEIRA RIO': 'beira-rio',
  BEIRA_RIO: 'beira-rio',
  'BR SPORT': 'br-sport',
  BR_SPORT: 'br-sport',
  KYLY: 'kyly',
  MILON: 'milon',
}

function resolveSupabaseUrl(raw: string | undefined): string | null {
  if (!raw) return null
  const value = raw.replace(/^NEXT_PUBLIC_SUPABASE_URL=/i, '').trim().replace(/\/$/, '')
  return value || null
}

export function portadaStemFromMarca(marca: string): string | null {
  const key = marca.trim().toUpperCase().replace(/\+/g, ' ').replace(/\s+/g, ' ')
  if (PORTADA_STEM_BY_MARCA[key]) return PORTADA_STEM_BY_MARCA[key]
  const compact = key.replace(/\s+/g, '_')
  if (PORTADA_STEM_BY_MARCA[compact]) return PORTADA_STEM_BY_MARCA[compact]
  const slug = key.toLowerCase().replace(/\s+/g, '-')
  return slug || null
}

export function imagenPortadaUrl(
  marcaOrStem: string,
  tier: PortadaTier = 'md',
): string | null {
  const base = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!base) return null
  const stem =
    PORTADA_STEM_BY_MARCA[marcaOrStem.trim().toUpperCase()] ??
    portadaStemFromMarca(marcaOrStem) ??
    marcaOrStem.trim().toLowerCase()
  if (!stem) return null
  if (tier === 'flat') {
    return `${base}/storage/v1/object/public/productos/portada/${stem}.jpg`
  }
  return `${base}/storage/v1/object/public/productos/portada/${tier}/${stem}.jpg`
}

export function imagenPortadaCandidates(
  marca: string,
  preferred: PortadaTier = 'lg',
): string[] {
  const order: PortadaTier[] =
    preferred === 'sm'
      ? ['sm', 'md', 'lg', 'flat']
      : preferred === 'md'
        ? ['md', 'lg', 'flat', 'sm']
        : preferred === 'flat'
          ? ['flat', 'lg', 'md', 'sm']
          : ['lg', 'md', 'flat', 'sm']
  const out: string[] = []
  for (const t of order) {
    const u = imagenPortadaUrl(marca, t)
    if (u) out.push(u)
  }
  return out
}
