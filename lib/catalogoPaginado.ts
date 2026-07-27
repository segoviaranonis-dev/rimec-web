import { supabase } from '@/lib/supabase'
import { agruparTarjetasCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { fusionarTarjetasPorSku, isTarjetaFusionada, type TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'
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
import { applyPrecioSqlFilters } from '@/lib/catalogoPrecioSqlCore'
import { enrichCatalogoRows, enrichPreventaCatalogoRows } from '@/lib/catalogoEnrich'
import { getLineaCasoMapCached } from '@/lib/casoBibliotecaLoader'
import { calzadoExcluyeCarterasPorDefecto } from '@/lib/filtros/filtro-tipo-canonico'
import { enrichTarjetasPeDescuentoComercial } from '@/lib/peDescuentoComercial'

export const CATALOGO_CARD_PAGE = 30
const ROW_BATCH = 80
const ROW_BATCH_TODOS = 120
const MAX_SCAN_ROWS = 12000
const QUERY_RETRIES = 2

const BUCKET = `${resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}/storage/v1/object/public/productos`

type StockView = 'v_stock_rimec' | 'v_stock_pe_rimec'

/** Orden canónico grilla: Línea → Referencia → Material → Color (ascendente). */
export function compareLineaRefMatColor(
  a: {
    linea_codigo?: string | null
    referencia_codigo?: string | null
    material_code?: string | null
  },
  b: {
    linea_codigo?: string | null
    referencia_codigo?: string | null
    material_code?: string | null
  },
  colorA = '',
  colorB = '',
): number {
  const cmp = (x: string, y: string) =>
    x.localeCompare(y, 'es', { numeric: true, sensitivity: 'base' })
  const cL = cmp(String(a.linea_codigo ?? '').trim(), String(b.linea_codigo ?? '').trim())
  if (cL !== 0) return cL
  const cR = cmp(String(a.referencia_codigo ?? '').trim(), String(b.referencia_codigo ?? '').trim())
  if (cR !== 0) return cR
  const cM = cmp(String(a.material_code ?? '').trim(), String(b.material_code ?? '').trim())
  if (cM !== 0) return cM
  return cmp(String(colorA).trim(), String(colorB).trim())
}

/** @deprecated alias — preferir compareLineaRefMatColor */
export function compareLineaReferencia(
  a: { linea_codigo?: string | null; referencia_codigo?: string | null; material_code?: string | null },
  b: { linea_codigo?: string | null; referencia_codigo?: string | null; material_code?: string | null },
): number {
  return compareLineaRefMatColor(a, b)
}

function colorCodigoDeTarjeta(t: TarjetaGrilla): string {
  if (isTarjetaFusionada(t)) {
    for (const lote of t.lotes) {
      const v = lote.variantes.find((x) => x.cajas_disponibles > 0) ?? lote.variantes[0]
      if (v?.color_code) return String(v.color_code)
    }
    return ''
  }
  const v = t.variantes.find((x) => x.cajas_disponibles > 0) ?? t.variantes[0]
  return String(v?.color_code ?? '')
}

function sortTarjetasLineaRef(tarjetas: TarjetaGrilla[]): TarjetaGrilla[] {
  return [...tarjetas].sort((a, b) =>
    compareLineaRefMatColor(a, b, colorCodigoDeTarjeta(a), colorCodigoDeTarjeta(b)),
  )
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
        ? applyPrecioSqlFilters(
            applyPeTipoExclusionesSql(
              applyPeCommercialSqlFilters(
                applyPeDepositoQuery(
                  applyNonOrigenSqlFilters(query, filtersForPeSql(filters), {
                    allowLiquidacion: true,
                    skipTipoGruposSql: Boolean(filters.tipo_grupos?.length),
                  }),
                  filters,
                ),
                filters,
              ),
              filters,
            ),
            filters,
          )
        : applyPrecioSqlFilters(applySqlFiltersToQuery(query, filtersForCpSql(filters)), filters)
    // Director: grilla L → R → M → C (ascendente).
    query = query
      .order('linea_codigo', { ascending: true })
      .order('referencia_codigo', { ascending: true })
      .order('material_code', { ascending: true })
      .order('color_code', { ascending: true })
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

/** CP: quincenas en SQL; sin depósito PE. Ramo desde MIG-168 (638/654). */
function filtersForCpSql(filters: CatalogoFilterStateExtended): CatalogoFilterStateExtended {
  return {
    ...filters,
    origen_tipo: 'TRÁNSITO_PP',
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

/** Excluir LIQ/Promo/Común en SQL PE cuando el chip Tipo no los pide (memoria aplica OR multi). */
function applyPeTipoExclusionesSql(query: any, filters: CatalogoFilterStateExtended): any {
  const sel = filters.tipo_grupos ?? []
  if (!sel.length) return query
  let q = query
  if (!sel.includes('liquidacion')) {
    q = q.or('es_liquidacion.eq.false,es_liquidacion.is.null')
    q = q.neq('cadena_comercial', 'LIQUIDACION')
  }
  if (!sel.includes('promo')) {
    q = q.or('es_promo.eq.false,es_promo.is.null')
    q = q.neq('cadena_comercial', 'PROMOCIONAL')
  }
  if (!sel.includes('comun')) {
    q = q.neq('cadena_comercial', 'COMUN')
  }
  return q
}

async function fetchStockBatch(
  filters: CatalogoFilterStateExtended,
  rowFrom: number,
  rowTo: number,
): Promise<StockRow[]> {
  if (isCatalogoOrigenTodos(filters)) {
    if (filters.ramo_tipo === 'CONFECCIONES' || filters.ramo_tipo === 'ACCESORIOS') {
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
  // Preventa Carlos siempre — la vista puede traer género/tono sin nro_pedido_externo (MIG-151).
  let enriched = await enrichPreventaCatalogoRows(active)
  enriched = await enrichCatalogoRows(enriched)
  const lineaCasoMap =
    filters.tipo_grupos?.length || calzadoExcluyeCarterasPorDefecto(filters)
      ? await getLineaCasoMapCached()
      : null
  const filtered = applyMemoryFilters(enriched, filters, lineaCasoMap)
  const cards = agruparTarjetasCatalogo(filtered, BUCKET, cajasDisponiblesDeFila)
  const grilla = isCatalogoOrigenTodos(filters) ? fusionarTarjetasPorSku(cards) : cards
  const sorted = sortTarjetasLineaRef(grilla)
  const tienePe = sorted.some((t) =>
    isTarjetaFusionada(t)
      ? t.lotes.some((l) => l.origen_tipo === 'PRONTA_ENTREGA')
      : t.origen_tipo === 'PRONTA_ENTREGA',
  )
  if (tienePe) {
    await enrichTarjetasPeDescuentoComercial(sorted)
  }
  return sorted
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
    const batchStartRow = rowFrom
    const to = rowFrom + batchSize - 1
    const batch = await fetchStockBatch(opts.filters, rowFrom, to)
    if (!batch.length) {
      hasMore = false
      break
    }

    scanned += batch.length
    const batchEndRow = rowFrom + batch.length

    const grilla = await rowsToGrillaAsync(batch, opts.filters)

    let addedFromBatch = 0
    let hitLimit = false
    for (const card of grilla) {
      if (excludeSet.has(card.cardKey)) continue
      excludeSet.add(card.cardKey)
      tarjetas.push(card)
      addedFromBatch++
      if (tarjetas.length >= opts.limit) {
        hitLimit = true
        break
      }
    }

    if (hitLimit) {
      // Mismo lote en la siguiente página — exclude evita duplicados (carteras tras calzado).
      rowFrom = batchStartRow
      hasMore = true
      break
    }

    if (addedFromBatch === 0) {
      rowFrom = batchEndRow
      if (batch.length < batchSize) hasMore = false
      continue
    }

    rowFrom = batchEndRow
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
