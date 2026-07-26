import type { StockRow } from '@/app/catalogo-types'
import { formatNumeroPreventaCarlos } from './datoDuroCabecera'
import { cargarMetaLineasDesdePilar, enriquecerMetaConLinea } from './atributosLinea'
import { supabase } from './supabase'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function filaTieneEnrichVista(row: StockRow): boolean {
  const genero = String(row.genero_codigo ?? '').trim()
  const tono = row.color_tono_canon
  return Boolean(genero || tono)
}

/** Fallback tono_canon si la vista no trajo dato (legacy). */
async function cargarTonoCanonPorCodigos(codes: string[]): Promise<Map<string, unknown>> {
  const uniq = [...new Set(codes.map(c => String(c).trim()).filter(Boolean))]
  const out = new Map<string, unknown>()
  if (!uniq.length) return out

  for (const batch of chunk(uniq, 200)) {
    const nums = batch.map(Number).filter(n => Number.isFinite(n))
    if (!nums.length) continue

    const { data, error } = await supabase
      .from('color')
      .select('codigo_proveedor, tono_canon')
      .in('codigo_proveedor', nums)

    if (error) {
      console.error('[catalogoEnrich] color tono:', error.message)
      continue
    }

    for (const row of data ?? []) {
      const cod = String(row.codigo_proveedor ?? '').trim()
      if (cod && row.tono_canon) out.set(cod, row.tono_canon)
    }
  }

  return out
}

let preventaCache: Map<number, string> | null = null
let preventaCacheAt = 0
const PREVENTA_CACHE_MS = 60_000

async function cargarPreventaPorPpId(): Promise<Map<number, string>> {
  const now = Date.now()
  if (preventaCache && now - preventaCacheAt < PREVENTA_CACHE_MS) return preventaCache

  const { data, error } = await supabase
    .from('pedido_proveedor')
    .select('id, nro_pedido_externo')
    .not('nro_pedido_externo', 'is', null)

  const map = new Map<number, string>()
  if (error) {
    console.error('[catalogoEnrich] preventa PP:', error.message)
    return map
  }
  for (const row of data ?? []) {
    const id = Number(row.id)
    const pv = formatNumeroPreventaCarlos(String(row.nro_pedido_externo ?? ''))
    if (id > 0 && pv) map.set(id, pv)
  }
  preventaCache = map
  preventaCacheAt = now
  return map
}

/** Nº preventa Carlos por pp_id — catálogo CP (dato duro siamese). */
export async function enrichPreventaCatalogoRows(rows: StockRow[]): Promise<StockRow[]> {
  if (!rows.length) return rows
  const need = rows.some(r => r.pp_id && !String(r.numero_preventa ?? '').trim())
  if (!need) return rows

  const map = await cargarPreventaPorPpId()
  if (!map.size) return rows

  return rows.map(row => {
    const ppId = Number(row.pp_id)
    if (!ppId) return row
    const pv = map.get(ppId)
    if (!pv) return row
    return { ...row, numero_preventa: pv }
  })
}

/**
 * Género + tono_canon — MIG-151 expone columnas en vista.
 * Solo consulta pilares si faltan datos (filas legacy / vista vieja).
 */
export async function enrichCatalogoRows(rows: StockRow[]): Promise<StockRow[]> {
  if (!rows.length) return rows

  let enriched = await enrichPreventaCatalogoRows(rows)

  const needsGenero = enriched.some(
    r => !String(r.genero_codigo ?? '').trim() && Number(r.linea_id) > 0,
  )
  const needsTono = enriched.some(
    r => !r.color_tono_canon && String(r.color_code ?? '').trim(),
  )

  if (!needsGenero && !needsTono) return enriched

  if (needsGenero) {
    const lineaIds = [...new Set(enriched.map(r => Number(r.linea_id)).filter(id => id > 0))]
    const lineas = await cargarMetaLineasDesdePilar(lineaIds)
    enriched = enriquecerMetaConLinea(enriched, lineas)
  }

  if (needsTono) {
    const tonoMap = await cargarTonoCanonPorCodigos(enriched.map(r => String(r.color_code ?? '')))
    if (tonoMap.size) {
      enriched = enriched.map(row => {
        const cod = String(row.color_code ?? '').trim()
        const tono = tonoMap.get(cod)
        return tono && !row.color_tono_canon ? { ...row, color_tono_canon: tono } : row
      })
    }
  }

  return enriched
}

/** Indica si el lote ya viene enriquecido desde BD (CAT-LAT-T1). */
export function loteEnriquecidoDesdeVista(rows: StockRow[]): boolean {
  return rows.length > 0 && rows.every(filaTieneEnrichVista)
}
