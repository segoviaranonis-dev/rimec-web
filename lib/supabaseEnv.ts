/** JWT típico de Supabase (anon / service). */
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g

const SUPABASE_URL_RE = /https:\/\/[a-z0-9]+\.supabase\.co/i

/**
 * Corrige valores corruptos, p. ej. cuando la variable de entorno contiene:
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`
 * (copiar/pegar duplicado en Windows o en Vercel).
 */
export function resolveSupabaseAnonKey(raw: string | undefined): string {
  if (!raw?.trim()) return ''
  const t = raw.trim()
  const jwts = [...t.matchAll(JWT_RE)]
  if (jwts.length > 0) return jwts[0][0]
  const stripped = t.replace(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=/i, '').trim()
  if (stripped.startsWith('eyJ')) return stripped.split(/\s+/)[0] ?? stripped
  return t
}

export function resolveSupabaseUrl(raw: string | undefined): string {
  if (!raw?.trim()) return ''
  const t = raw.trim()
  const m = t.match(SUPABASE_URL_RE)
  if (m) return m[0]
  const stripped = t.replace(/^NEXT_PUBLIC_SUPABASE_URL=/i, '').trim()
  const m2 = stripped.match(SUPABASE_URL_RE)
  if (m2) return m2[0]
  return stripped.split(/\s+/)[0] ?? t
}

export function isAnonKeyCorrupted(raw: string | undefined): boolean {
  if (!raw?.trim()) return false
  const t = raw.trim()
  if (t.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) return true
  const jwts = [...t.matchAll(JWT_RE)]
  return jwts.length > 1
}
