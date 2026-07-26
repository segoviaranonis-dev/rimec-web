/**
 * Descuento comercial PE dictado (tabla pe_descuento_comercial_molecula).
 * ≠ comisión D1 del diccionario.
 */
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export function moleculeKeyPeDescuento(
  linea: string,
  referencia: string,
  material: string,
  color: string,
): string {
  return `${String(linea ?? '').trim()}-${String(referencia ?? '').trim()}-${String(material ?? '').trim()}-${String(color ?? '').trim()}`
}

export async function fetchPeDescuentoComercialMap(opts?: {
  batchLabel?: string | null
}): Promise<Map<string, number>> {
  const sb = getSupabaseAdmin()
  let q = sb
    .from('pe_descuento_comercial_molecula')
    .select('batch_label, linea_codigo, referencia_codigo, material_code, color_code, descuento_pct')
    .limit(20000)

  const batch = String(opts?.batchLabel ?? '').trim()
  if (batch) {
    q = q.or(`batch_label.eq.${batch},batch_label.eq.`)
  }

  const { data, error } = await q
  const map = new Map<string, number>()
  if (error || !data) return map

  // Preferir filas con batch concreto sobre global ''
  const scored = [...data].sort((a, b) => {
    const sa = String(a.batch_label ?? '').trim() ? 1 : 0
    const sb = String(b.batch_label ?? '').trim() ? 1 : 0
    return sb - sa
  })

  for (const r of scored) {
    const k = moleculeKeyPeDescuento(
      String(r.linea_codigo ?? ''),
      String(r.referencia_codigo ?? ''),
      String(r.material_code ?? ''),
      String(r.color_code ?? ''),
    )
    if (!map.has(k)) {
      const pct = Number(r.descuento_pct)
      if (Number.isFinite(pct) && pct > 0) map.set(k, pct)
    }
  }
  return map
}

export async function lookupPeDescuentoPct(input: {
  linea?: string | null
  referencia?: string | null
  material?: string | null
  color?: string | null
  map?: Map<string, number>
}): Promise<number | null> {
  const map = input.map ?? (await fetchPeDescuentoComercialMap())
  const k = moleculeKeyPeDescuento(
    input.linea ?? '',
    input.referencia ?? '',
    input.material ?? '',
    input.color ?? '',
  )
  return map.get(k) ?? null
}
