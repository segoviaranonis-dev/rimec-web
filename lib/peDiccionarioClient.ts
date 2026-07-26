/** Cliente — cache diccionario PE vía API (sin Supabase admin) */

export type PeCadenaCliente = {
  cadena_pe: string
  descuento_d1_pct: number
  es_liquidacion: boolean
  es_promo: boolean
  etiqueta_ui: string
}

export function etiquetaCadenaPeUi(cadena: string): string {
  const c = cadenaPeNorm(cadena)
  if (c === 'REGULAR') return 'NORMAL'
  return c
}

const FALLBACK: PeCadenaCliente[] = [
  { cadena_pe: 'REGULAR', descuento_d1_pct: 4, es_liquidacion: false, es_promo: false, etiqueta_ui: 'NORMAL' },
  { cadena_pe: 'PROMOCIONAL', descuento_d1_pct: 2, es_liquidacion: false, es_promo: true, etiqueta_ui: 'PROMOCIONAL' },
  { cadena_pe: 'LIQUIDACION', descuento_d1_pct: 2, es_liquidacion: true, es_promo: false, etiqueta_ui: 'LIQUIDACION' },
  { cadena_pe: 'COMUN', descuento_d1_pct: 4, es_liquidacion: false, es_promo: false, etiqueta_ui: 'COMUN' },
]

let cache: Map<string, PeCadenaCliente> | null = null
let inflight: Promise<Map<string, PeCadenaCliente>> | null = null

export function cadenaPeNorm(raw: string | null | undefined): string {
  const u = String(raw ?? 'REGULAR').trim().toUpperCase()
  if (u === 'LIQUIDACION' || u === 'LIQUIDACIÓN') return 'LIQUIDACION'
  if (u === 'PROMOCIONAL' || u === 'PROMO') return 'PROMOCIONAL'
  if (u === 'COMUN' || u === 'COMÚN') return 'COMUN'
  if (u === 'NORMAL') return 'REGULAR'
  return 'REGULAR'
}

function mapFromRows(rows: PeCadenaCliente[]): Map<string, PeCadenaCliente> {
  const map = new Map<string, PeCadenaCliente>()
  for (const row of rows) {
    map.set(cadenaPeNorm(row.cadena_pe), { ...row, cadena_pe: cadenaPeNorm(row.cadena_pe) })
  }
  return map
}

export async function warmPeDiccionarioClient(): Promise<Map<string, PeCadenaCliente>> {
  if (cache) return cache
  if (inflight) return inflight

  inflight = fetch('/api/pe/diccionario')
    .then((r) => r.json())
    .then((j) => {
      const rows = (j.cadenas ?? FALLBACK) as PeCadenaCliente[]
      cache = mapFromRows(rows.length ? rows : FALLBACK)
      return cache
    })
    .catch(() => {
      cache = mapFromRows(FALLBACK)
      return cache
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function descuentoD1PeClient(input: {
  cadena_comercial?: string | null
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
}): number {
  let cadena = cadenaPeNorm(input.cadena_comercial)
  if (input.es_liquidacion) cadena = 'LIQUIDACION'
  else if (input.es_promo && cadena === 'REGULAR') cadena = 'PROMOCIONAL'
  const map = cache ?? mapFromRows(FALLBACK)
  return map.get(cadena)?.descuento_d1_pct ?? 4
}
