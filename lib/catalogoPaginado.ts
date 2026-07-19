import { supabase } from '@/lib/supabase'
import { agruparTarjetasCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { fusionarTarjetasPorSku, type TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'
import { catalogoStockSelect } from '@/lib/catalogoData'
import type { StockRow } from '@/app/catalogo-types'
import { cajasDisponiblesDeFila } from '@/lib/disponibilidad'
import { resolveSupabaseUrl } from '@/lib/supabaseEnv'
import {
  applyMemoryFilters,
  applyNonOrigenSqlFilters,
  applyPeCommercialSqlFilters,
  applyPeDepositoQuery,
  applySqlFiltersToQuery,
  catalogoStockView,
  isCatalogoOrigenTodos,
  type CatalogoFilterStateExtended,
} from '@/lib/catalogoFilters'
import { enrichCatalogoRows, loteEnriquecidoDesdeVista } from '@/lib/catalogoEnrich'
import { getLineaCasoMapCached } from '@/lib/casoBibliotecaLoader'

export const CATALOGO_CARD_PAGE = 30
const ROW_BATCH = 80
const ROW_BATCH_TODOS = 120
const MAX_SCAN_ROWS = 12000
const QUERY_RETRIES = 2

const BUCKET = `${resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}/storage/v1/object/public/productos`

type StockView = 'v_stock_rimec' | 'v_stock_pe_rimec'

/** Orden canónico grilla: línea → referencia (numérico natural). */
export function compareLineaReferencia(
  a: { linea_codigo?: string | null; referencia_codigo?: string | null },
  b: { linea_codigo?: string | null; referencia_codigo?: string | null },
): number {
  const la = String(a.linea_codigo ?? '').trim()
  const lb = String(b.linea_codigo ?? '').trim()
  const c = la.localeCompare(lb, 'es', { numeric: true, sensitivity: 'base' })
  if (c !== 0) return c
  const ra = String(a.referencia_codigo ?? '').trim()
  const rb = String(b.referencia_codigo ?? '').trim()
  return ra.localeCompare(rb, 'es', { numeric: true, sensitivity: 'base' })
}

function sortTarjetasLineaRef(tarjetas: TarjetaGrilla[]): TarjetaGrilla[] {
  return [...tarjetas].sort(compareLineaReferencia)
}

export { sortTarjetasLineaRef }

async function fetchStockBatchFromView(
  view: StockView,
  filters: CatalogoFilterStateExtended,
  rowFrom: number,
  rowTo: number,
): Promise<StockRow[]> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= QUERY_RETRIES; attempt++) {
    let query = supabase
      .from(view)
      .select(catalogoStockSelect(view))
      .gt('cajas_disponibles', 0)

    query =
      view === 'v_stock_pe_rimec'
        ? applyPeCommercialSqlFilters(
            applyPeDepositoQuery(
              applyNonOrigenSqlFilters(query, filtersForPeSql(filters), {
                allowLiquidacion: true,
                skipTipoGruposSql: Boolean(filters.tipo_grupos?.length),
              }),
              filters,
            ),
            filters,
          )
        : applySqlFiltersToQuery(query, filtersForCpSql(filters))
    // Director: grilla por línea + referencia (no det_id).
    query = query
      .order('linea_codigo', { ascending: true })
      .order('referencia_codigo', { ascending: true })
      .order('det_id', { ascending: true })
      .range(rowFrom, rowTo)

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

/** CP: quincenas en SQL; sin ramo/depósito PE. */
function filtersForCpSql(filters: CatalogoFilterStateExtended): CatalogoFilterStateExtended {
  return {
    ...filters,
    origen_tipo: 'TRÁNSITO_PP',
    ramo_tipo: '',
    deposito_codigo: '',
    cadena_comercial: '',
  }
}

/** PE: ramo/depósito; sin quincenas CP. */
function filtersForPeSql(filters: CatalogoFilterStateExtended): CatalogoFilterStateExtended {
  return {
    ...filters,
    origen_tipo: 'PRONTA_ENTREGA',
    quincenas: [],
  }
}

async function fetchStockBatch(
  filters: CatalogoFilterStateExtended,
  rowFrom: number,
  rowTo: number,
): Promise<StockRow[]> {
  if (isCatalogoOrigenTodos(filters)) {
    // Confecciones Kyly = solo vista PE — CP no tiene ramo confecciones (MIG-152).
    if (filters.ramo_tipo === 'CONFECCIONES') {
      return fetchStockBatchFromView('v_stock_pe_rimec', filters, rowFrom, rowTo)
    }
    const [cpRows, peRows] = await Promise.all([
      fetchStockBatchFromView('v_stock_rimec', filters, rowFrom, rowTo),
      fetchStockBatchFromView('v_stock_pe_rimec', filters, rowFrom, rowTo),
    ])
    return [...cpRows, ...peRows]
  }

  const view = catalogoStockView(filters)
  return fetchStockBatchFromView(view, filters, rowFrom, rowTo)
}

async function rowsToGrillaAsync(
  rows: StockRow[],
  filters: CatalogoFilterStateExtended,
): Promise<TarjetaGrilla[]> {
  const active = rows.filter(r => cajasDisponiblesDeFila(r) > 0)
  const enriched = loteEnriquecidoDesdeVista(active)
    ? active
    : await enrichCatalogoRows(active)
  const lineaCasoMap =
    filters.tipo_grupos?.length ? await getLineaCasoMapCached() : null
  const filtered = applyMemoryFilters(enriched, filters, lineaCasoMap)
  const cards = agruparTarjetasCatalogo(filtered, BUCKET, cajasDisponiblesDeFila)
  const grilla = isCatalogoOrigenTodos(filters) ? fusionarTarjetasPorSku(cards) : cards
  return sortTarjetasLineaRef(grilla)
}

export async function fetchTarjetasPage(opts: {
  filters: CatalogoFilterStateExtended
  rowFrom: number
  excludeCardKeys: string[]
  limit: number
}): Promise<{
  tarjetas: TarjetaGrilla[]
  nextRowFrom: number
  hasMore: boolean
  excludeCardKeys: string[]
}> {
  const excludeSet = new Set(opts.excludeCardKeys)
  const tarjetas: TarjetaGrilla[] = []
  let rowFrom = Math.max(0, opts.rowFrom)
  let scanned = 0
  let hasMore = true

  const batchSize = isCatalogoOrigenTodos(opts.filters) ? ROW_BATCH_TODOS : ROW_BATCH

  while (tarjetas.length < opts.limit && hasMore && scanned < MAX_SCAN_ROWS) {
    const to = rowFrom + batchSize - 1
    const batch = await fetchStockBatch(opts.filters, rowFrom, to)
    if (!batch.length) {
      hasMore = false
      break
    }

    scanned += batch.length
    rowFrom += batch.length

    const grilla = await rowsToGrillaAsync(batch, opts.filters)

    for (const card of grilla) {
      if (excludeSet.has(card.cardKey)) continue
      excludeSet.add(card.cardKey)
      tarjetas.push(card)
      if (tarjetas.length >= opts.limit) break
    }

    if (batch.length < batchSize) hasMore = false
  }

  if (scanned >= MAX_SCAN_ROWS && tarjetas.length < opts.limit) {
    hasMore = false
  }

  return {
    tarjetas: sortTarjetasLineaRef(tarjetas),
    nextRowFrom: rowFrom,
    hasMore,
    excludeCardKeys: [...excludeSet],
  }
}

export type { TarjetaGrilla }
