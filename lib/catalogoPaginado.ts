import { supabase } from '@/lib/supabase'
import { agruparTarjetasCatalogo, type TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { CATALOGO_STOCK_SELECT } from '@/lib/catalogoData'
import type { StockRow } from '@/app/catalogo-types'
import { cajasDisponiblesDeFila } from '@/lib/disponibilidad'
import { resolveSupabaseUrl } from '@/lib/supabaseEnv'
import {
  applyMemoryFilters,
  applySqlFiltersToQuery,
  type CatalogoFilterStateExtended,
} from '@/lib/catalogoFilters'

export const CATALOGO_CARD_PAGE = 30
const ROW_BATCH = 80
const MAX_SCAN_ROWS = 8000
const QUERY_RETRIES = 2

const BUCKET = `${resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}/storage/v1/object/public/productos`

async function fetchStockBatch(
  filters: CatalogoFilterStateExtended,
  rowFrom: number,
  rowTo: number,
) {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= QUERY_RETRIES; attempt++) {
    let query = supabase
      .from('v_stock_rimec')
      .select(CATALOGO_STOCK_SELECT)
      .gt('cajas_disponibles', 0)

    query = applySqlFiltersToQuery(query, filters)
    query = query.order('det_id').range(rowFrom, rowTo)

    const { data, error } = await query
    if (!error) return (data ?? []) as unknown as StockRow[]
    lastError = new Error(error.message)
    if (error.code === '57014' && attempt < QUERY_RETRIES) {
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
      continue
    }
    throw lastError
  }
  throw lastError ?? new Error('Error cargando catálogo')
}

export async function fetchTarjetasPage(opts: {
  filters: CatalogoFilterStateExtended
  rowFrom: number
  excludeCardKeys: string[]
  limit: number
}): Promise<{
  tarjetas: TarjetaCatalogo[]
  nextRowFrom: number
  hasMore: boolean
  excludeCardKeys: string[]
}> {
  const excludeSet = new Set(opts.excludeCardKeys)
  const tarjetas: TarjetaCatalogo[] = []
  let rowFrom = Math.max(0, opts.rowFrom)
  let scanned = 0
  let hasMore = true

  while (tarjetas.length < opts.limit && hasMore && scanned < MAX_SCAN_ROWS) {
    const to = rowFrom + ROW_BATCH - 1
    const batch = await fetchStockBatch(opts.filters, rowFrom, to)
    if (!batch.length) {
      hasMore = false
      break
    }

    scanned += batch.length
    rowFrom += batch.length

    const active = batch.filter(r => cajasDisponiblesDeFila(r) > 0)
    const filtered = applyMemoryFilters(active, opts.filters)
    const cards = agruparTarjetasCatalogo(filtered, BUCKET, cajasDisponiblesDeFila)

    for (const card of cards) {
      if (excludeSet.has(card.cardKey)) continue
      excludeSet.add(card.cardKey)
      tarjetas.push(card)
      if (tarjetas.length >= opts.limit) break
    }

    if (batch.length < ROW_BATCH) hasMore = false
  }

  if (scanned >= MAX_SCAN_ROWS && tarjetas.length < opts.limit) {
    hasMore = false
  }

  return {
    tarjetas,
    nextRowFrom: rowFrom,
    hasMore,
    excludeCardKeys: [...excludeSet],
  }
}
