/**
 * Diccionario Pronta Entrega — RIMEC Web (MIG-180 pe_diccionario_cadena)
 */
import { getSupabaseAdmin } from './supabaseAdmin'

export type PeDiccionarioCadena = {
  cadena_pe: string
  descuento_d1_pct: number
  es_liquidacion: boolean
  es_promo: boolean
  etiqueta_ui: string
}

const FALLBACK: PeDiccionarioCadena[] = [
  { cadena_pe: 'REGULAR', descuento_d1_pct: 4, es_liquidacion: false, es_promo: false, etiqueta_ui: 'NORMAL' },
  { cadena_pe: 'PROMOCIONAL', descuento_d1_pct: 2, es_liquidacion: false, es_promo: true, etiqueta_ui: 'PROMOCIONAL' },
  { cadena_pe: 'LIQUIDACION', descuento_d1_pct: 2, es_liquidacion: true, es_promo: false, etiqueta_ui: 'LIQUIDACION' },
  { cadena_pe: 'COMUN', descuento_d1_pct: 4, es_liquidacion: false, es_promo: false, etiqueta_ui: 'COMUN' },
]

let cache: { at: number; map: Map<string, PeDiccionarioCadena> } | null = null
const TTL_MS = 60_000

export function cadenaPeNorm(raw: string | null | undefined): string {
  const u = String(raw ?? 'REGULAR').trim().toUpperCase()
  if (u === 'LIQUIDACION' || u === 'LIQUIDACIÓN') return 'LIQUIDACION'
  if (u === 'PROMOCIONAL' || u === 'PROMO') return 'PROMOCIONAL'
  if (u === 'COMUN' || u === 'COMÚN') return 'COMUN'
  if (u === 'NORMAL') return 'REGULAR'
  return 'REGULAR'
}

export async function fetchPeDiccionarioMap(): Promise<Map<string, PeDiccionarioCadena>> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.map

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('pe_diccionario_cadena')
      .select('cadena_pe, descuento_d1_pct, es_liquidacion, es_promo, etiqueta_ui')
    if (!error && data?.length) {
      const map = new Map<string, PeDiccionarioCadena>()
      for (const row of data as PeDiccionarioCadena[]) {
        map.set(cadenaPeNorm(row.cadena_pe), {
          ...row,
          cadena_pe: cadenaPeNorm(row.cadena_pe),
          descuento_d1_pct: Number(row.descuento_d1_pct) || 4,
        })
      }
      cache = { at: now, map }
      return map
    }
  } catch {
    /* tabla pendiente */
  }

  const map = new Map(FALLBACK.map((r) => [r.cadena_pe, r]))
  cache = { at: now, map }
  return map
}

export async function descuentoD1PeDesdeDiccionario(input: {
  cadena_comercial?: string | null
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
}): Promise<number> {
  let cadena = cadenaPeNorm(input.cadena_comercial)
  if (input.es_liquidacion) cadena = 'LIQUIDACION'
  else if (input.es_promo && cadena === 'REGULAR') cadena = 'PROMOCIONAL'
  const map = await fetchPeDiccionarioMap()
  return map.get(cadena)?.descuento_d1_pct ?? 4
}

export function descuentoD1PeSync(input: {
  cadena_comercial?: string | null
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
}): number {
  let cadena = cadenaPeNorm(input.cadena_comercial)
  if (input.es_liquidacion) cadena = 'LIQUIDACION'
  else if (input.es_promo && cadena === 'REGULAR') cadena = 'PROMOCIONAL'
  const row = (cache?.map ?? new Map(FALLBACK.map((r) => [r.cadena_pe, r]))).get(cadena)
  return row?.descuento_d1_pct ?? 4
}

/**
 * Empalme comisiones (Director 2026-07-26).
 * `descuento_d1_pct` del diccionario PE = **comisión vendedor**, NO descuento comercial.
 * No rellena Descuentos4 de precio/FI. El % comercial lo pone Asignación de descuentos (Report).
 * Dato interno: `comisionD1PeDesdeDiccionario` / columna `pe_diccionario_cadena.descuento_d1_pct`.
 */
export function aplicarDescuentoDiccionarioPe(
  descCab: number[],
  _signals: {
    cadena_comercial?: string | null
    es_liquidacion?: boolean | null
    es_promo?: boolean | null
    esPe?: boolean
  },
): [number, number, number, number] {
  const padded = [...descCab, 0, 0, 0, 0].slice(0, 4)
  return [padded[0] ?? 0, padded[1] ?? 0, padded[2] ?? 0, padded[3] ?? 0]
}

/** Comisión D1 (%) — solo lectura para módulo comisiones (no UI carrito). */
export async function comisionD1PeDesdeDiccionario(input: {
  cadena_comercial?: string | null
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
}): Promise<number> {
  return descuentoD1PeDesdeDiccionario(input)
}
