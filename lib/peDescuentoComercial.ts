/**
 * Descuento comercial PE dictado (tabla pe_descuento_comercial_molecula).
 * ≠ comisión D1 del diccionario.
 */
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { isTarjetaFusionada, type TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'

export function moleculeKeyPeDescuento(
  linea: string,
  referencia: string,
  material: string,
  color: string,
): string {
  return `${String(linea ?? '').trim()}-${String(referencia ?? '').trim()}-${String(material ?? '').trim()}-${String(color ?? '').trim()}`
}

const PAGE = 1000
const MAP_TTL_MS = 5 * 60_000

type MapCacheEntry = { map: Map<string, number>; at: number }
const mapCache = new Map<string, MapCacheEntry>()
const mapInflight = new Map<string, Promise<Map<string, number>>>()

function cacheKeyForBatch(batch: string): string {
  return batch || '__all__'
}

async function fetchPeDescuentoComercialMapUncached(batch: string): Promise<Map<string, number>> {
  const sb = getSupabaseAdmin()
  const map = new Map<string, number>()

  // Preferir batch concreto: primero filas con batch, luego globales.
  // Paginación — PostgREST limita ~1000 por request.
  let from = 0
  for (;;) {
    let q = sb
      .from('pe_descuento_comercial_molecula')
      .select('batch_label, linea_codigo, referencia_codigo, material_code, color_code, descuento_pct, updated_at')
      .order('updated_at', { ascending: false })
      .order('batch_label', { ascending: false })
      .range(from, from + PAGE - 1)

    if (batch) {
      q = q.or(`batch_label.eq.${batch},batch_label.eq.`)
    }

    const { data, error } = await q
    if (error) {
      console.error('[peDescuentoComercial]', error.message)
      break
    }
    if (!data?.length) break

    for (const r of data) {
      const k = moleculeKeyPeDescuento(
        String(r.linea_codigo ?? ''),
        String(r.referencia_codigo ?? ''),
        String(r.material_code ?? ''),
        String(r.color_code ?? ''),
      )
      const pct = Number(r.descuento_pct)
      if (!Number.isFinite(pct) || pct <= 0) continue
      // Orden updated_at DESC → primera fila = última asignación Guido
      if (!map.has(k)) map.set(k, pct)
    }

    if (data.length < PAGE) break
    from += PAGE
    if (from > 50000) break
  }

  return map
}

export async function fetchPeDescuentoComercialMap(opts?: {
  batchLabel?: string | null
}): Promise<Map<string, number>> {
  const batch = String(opts?.batchLabel ?? '').trim()
  const key = cacheKeyForBatch(batch)
  const hit = mapCache.get(key)
  if (hit && Date.now() - hit.at < MAP_TTL_MS) return hit.map

  const pending = mapInflight.get(key)
  if (pending) return pending

  const run = fetchPeDescuentoComercialMapUncached(batch)
    .then((map) => {
      mapCache.set(key, { map, at: Date.now() })
      return map
    })
    .finally(() => {
      mapInflight.delete(key)
    })

  mapInflight.set(key, run)
  return run
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

/** % dictado para una tarjeta PE (primera variante con stock). */
export function pctDescuentoDesdeTarjeta(
  lote: {
    linea_codigo: string
    referencia_codigo: string
    descuento_comercial_pct?: number | null
    variantes: Array<{ material_code: string; color_code: string; cajas_disponibles: number }>
  },
  map?: Map<string, number> | null,
): number | null {
  if (lote.descuento_comercial_pct != null && lote.descuento_comercial_pct > 0) {
    return Number(lote.descuento_comercial_pct)
  }
  if (!map?.size) return null
  // Cualquier variante del SKU con descuento
  for (const v of lote.variantes) {
    const k = moleculeKeyPeDescuento(
      lote.linea_codigo,
      lote.referencia_codigo,
      v.material_code,
      v.color_code,
    )
    const pct = map.get(k)
    if (pct != null && pct > 0) return pct
  }
  // Fallback: clave con material de tarjeta (sku)
  const v0 = lote.variantes.find(vv => vv.cajas_disponibles > 0) ?? lote.variantes[0]
  if (!v0) return null
  return map.get(
    moleculeKeyPeDescuento(
      lote.linea_codigo,
      lote.referencia_codigo,
      v0.material_code,
      v0.color_code,
    ),
  ) ?? null
}

function enrichLotePeDescuento(lote: TarjetaCatalogo, map: Map<string, number>): void {
  if (lote.origen_tipo !== 'PRONTA_ENTREGA') return
  const pct = pctDescuentoDesdeTarjeta(lote, map)
  if (pct != null && pct > 0) lote.descuento_comercial_pct = pct
}

/** Inyecta % dictado Guido en tarjetas PE (server-side catálogo). */
export async function enrichTarjetasPeDescuentoComercial(
  tarjetas: TarjetaGrilla[],
  map?: Map<string, number>,
): Promise<void> {
  const descMap = map ?? (await fetchPeDescuentoComercialMap())
  if (!descMap.size) return
  for (const t of tarjetas) {
    if (isTarjetaFusionada(t)) {
      for (const l of t.lotes) enrichLotePeDescuento(l, descMap)
    } else {
      enrichLotePeDescuento(t, descMap)
    }
  }
}
