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
import { enrichCatalogoRows } from '@/lib/catalogoEnrich'
import { getLineaCasoMapCached } from '@/lib/casoBibliotecaLoader'
import { calzadoExcluyeCarterasPorDefecto } from '@/lib/filtros/filtro-tipo-canonico'
import { peTieneSubfamiliaAccesorios } from '@/lib/filtros/modulo-accesorios'
import { peSoloFiltroEscolar } from '@/lib/filtros/pe-modulo-escolar'
import {
  enrichTarjetasPeDescuentoComercial,
  fetchPeDescuentoComercialMap,
} from '@/lib/peDescuentoComercial'

export const CATALOGO_CARD_PAGE = 30
const ROW_BATCH = 80
const ROW_BATCH_TODOS = 120
const MAX_SCAN_ROWS = 12000
const QUERY_RETRIES = 2

const BUCKET = `${resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}/storage/v1/object/public/productos`

type StockView = 'v_stock_rimec' | 'v_stock_pe_rimec'

/** Confecciones/accesorios: escaneo total agota statement_timeout en prod. */
function catalogoUsaRutaRapida(filters: CatalogoFilterStateExtended): boolean {
  const ramo = String(filters.ramo_tipo ?? '').toUpperCase()
  return ramo === 'CONFECCIONES' || ramo === 'ACCESORIOS'
}

function rowBatchSize(filters: CatalogoFilterStateExtended): number {
  if (catalogoUsaRutaRapida(filters)) return 40
  if (isCatalogoOrigenTodos(filters) && filters.ramo_tipo === 'CALZADO') return 50
  return isCatalogoOrigenTodos(filters) ? ROW_BATCH_TODOS : ROW_BATCH
}

function cpConfeccionesFilters(
  filters: CatalogoFilterStateExtended,
): CatalogoFilterStateExtended {
  return filtersForCpSql({
    ...filters,
    origen_tipo: 'TRÁNSITO_PP',
    ramo_tipo: 'CONFECCIONES',
    deposito_codigo: '',
    quincenas: [],
  })
}

function peConfeccionesFilters(
  filters: CatalogoFilterStateExtended,
): CatalogoFilterStateExtended {
  return filtersForPeSql({
    ...filters,
    origen_tipo: 'PRONTA_ENTREGA',
    ramo_tipo: 'CONFECCIONES',
    quincenas: [],
  })
}

function cpCalzadoFilters(filters: CatalogoFilterStateExtended): CatalogoFilterStateExtended {
  return filtersForCpSql({
    ...filters,
    origen_tipo: 'TRÁNSITO_PP',
    ramo_tipo: 'CALZADO',
    deposito_codigo: '',
    quincenas: [],
  })
}

function peCalzadoFilters(filters: CatalogoFilterStateExtended): CatalogoFilterStateExtended {
  return filtersForPeSql({
    ...filters,
    origen_tipo: 'PRONTA_ENTREGA',
    ramo_tipo: 'CALZADO',
    quincenas: [],
  })
}

/**
 * TODOS dual-vista: mismo rango rowFrom..rowTo en CP y PE (cursores independientes).
 * Antes: half-split + avanzar rowFrom por merge → saltaba la mitad de filas PE
 * (bug urgente LIQ: 10 tarjetas · hasMore false · faltaba MODARE).
 */
async function fetchStockBatchConfeccionesTodos(
  filters: CatalogoFilterStateExtended,
  rowFrom: number,
  rowTo: number,
): Promise<StockRow[]> {
  const [cpRows, peRows] = await Promise.all([
    fetchStockBatchFromView('v_stock_rimec', cpConfeccionesFilters(filters), rowFrom, rowTo).catch(
      () => [] as StockRow[],
    ),
    fetchStockBatchFromView('v_stock_pe_rimec', peConfeccionesFilters(filters), rowFrom, rowTo).catch(
      () => [] as StockRow[],
    ),
  ])
  return [...cpRows, ...peRows]
}

/** TODOS+Calzado = CP 654 + PE calzado — filtros ramo explícitos; tolera timeout parcial. */
async function fetchStockBatchCalzadoTodos(
  filters: CatalogoFilterStateExtended,
  rowFrom: number,
  rowTo: number,
): Promise<StockRow[]> {
  // ESCOLAR solo PE — no mezclar página CP (Vizzano) que “congela” la grilla.
  if (peSoloFiltroEscolar(filters.tipo_ids)) {
    return fetchStockBatchFromView(
      'v_stock_pe_rimec',
      peCalzadoFilters(filters),
      rowFrom,
      rowTo,
    ).catch(() => [] as StockRow[])
  }
  const [cpRows, peRows] = await Promise.all([
    fetchStockBatchFromView(
      'v_stock_rimec',
      cpCalzadoFilters(filters),
      rowFrom,
      rowTo,
    ).catch(() => [] as StockRow[]),
    fetchStockBatchFromView(
      'v_stock_pe_rimec',
      peCalzadoFilters(filters),
      rowFrom,
      rowTo,
    ).catch(() => [] as StockRow[]),
  ])
  return [...cpRows, ...peRows]
}

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

/** Primera gana — evita React “two children with the same key” al concatenar páginas / warm. */
export function dedupeTarjetasByCardKey(tarjetas: TarjetaGrilla[]): TarjetaGrilla[] {
  const seen = new Set<string>()
  const out: TarjetaGrilla[] = []
  for (const t of tarjetas) {
    const k = t.cardKey
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

function sortTarjetasLineaRef(tarjetas: TarjetaGrilla[]): TarjetaGrilla[] {
  return dedupeTarjetasByCardKey(tarjetas).sort((a, b) =>
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
                    peView: true,
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
  // Grupo uno: chip único → SQL positivo (densidad; no barrer REGULAR).
  if (sel.length === 1 && sel[0] === 'liquidacion') {
    return q.or('es_liquidacion.eq.true,cadena_comercial.eq.LIQUIDACION')
  }
  if (sel.length === 1 && sel[0] === 'promo') {
    return q.or('es_promo.eq.true,cadena_comercial.eq.PROMOCIONAL')
  }
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
    if (filters.ramo_tipo === 'CONFECCIONES') {
      return fetchStockBatchConfeccionesTodos(filters, rowFrom, rowTo)
    }
    if (filters.ramo_tipo === 'CALZADO') {
      return fetchStockBatchCalzadoTodos(filters, rowFrom, rowTo)
    }
    if (
      filters.ramo_tipo === 'ACCESORIOS' ||
      peTieneSubfamiliaAccesorios(filters.tipo_ids ?? [])
    ) {
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
  peDescMap?: Map<string, number>,
): Promise<TarjetaGrilla[]> {
  const active = rows.filter(r => cajasDisponiblesDeFila(r) > 0)
  // enrichCatalogoRows ya aplica preventa Carlos (evitar doble await por lote).
  let enriched = await enrichCatalogoRows(active)
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
    await enrichTarjetasPeDescuentoComercial(sorted, peDescMap)
  }
  return sorted
}

export async function fetchTarjetasPage(opts: {
  filters: CatalogoFilterStateExtended
  rowFrom: number
  excludeCardKeys: string[]
  limit: number
  /**
   * true = warm/sync overlay: 1–2 lotes rápidos con fotos (no escaneo total).
   * false = grilla UI: orden L+R+M+C numérico global (520 antes que 1122).
   */
  quick?: boolean
}): Promise<{
  tarjetas: TarjetaGrilla[]
  nextRowFrom: number
  hasMore: boolean
  excludeCardKeys: string[]
}> {
  if (opts.quick || catalogoUsaRutaRapida(opts.filters)) {
    return fetchTarjetasPageQuick(opts)
  }

  // Orden L+R+M+C numérico global — el ORDER BY texto de PostgREST pone "10000"/"1122" antes que "520".
  const sorted = await loadSortedCatalogCards(opts.filters)
  const excludeSet = new Set(opts.excludeCardKeys)
  const fresh = sorted.filter((c) => !excludeSet.has(c.cardKey))
  const page = fresh.slice(0, opts.limit)
  for (const c of page) excludeSet.add(c.cardKey)

  return {
    tarjetas: page,
    nextRowFrom: opts.excludeCardKeys.length + page.length,
    hasMore: fresh.length > opts.limit,
    excludeCardKeys: [...excludeSet],
  }
}

/** Warm / overlay sync — respuesta en ~1–3 s con tarjetas + imagen. */
async function fetchTarjetasPageQuick(opts: {
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
  const batchSize = rowBatchSize(opts.filters)

  // TODOS dual CP+PE: cada vista pagina el mismo offset. Avanzar SIEMPRE +batchSize
  // (no +batch.length del merge) — si no, se saltan filas PE y hasMore muere corto.
  const dualTodos =
    isCatalogoOrigenTodos(opts.filters) &&
    (opts.filters.ramo_tipo === 'CALZADO' || opts.filters.ramo_tipo === 'CONFECCIONES')

  while (tarjetas.length < opts.limit && hasMore && scanned < MAX_SCAN_ROWS) {
    const to = rowFrom + batchSize - 1
    const batch = await fetchStockBatch(opts.filters, rowFrom, to)
    if (!batch.length) {
      hasMore = false
      break
    }
    scanned += batch.length
    const grilla = await rowsToGrillaAsync(batch, opts.filters)
    // Ley TODOS 2.2.1.28: si el lote se corta a mitad de página → no avanzar cursor;
    // la siguiente página re-procesa el mismo lote con exclude (no perder MODARE/LIQ).
    let corteMitadLote = false
    for (const card of grilla) {
      if (excludeSet.has(card.cardKey)) continue
      excludeSet.add(card.cardKey)
      tarjetas.push(card)
      if (tarjetas.length >= opts.limit) {
        corteMitadLote = true
        hasMore = true
        break
      }
    }
    if (corteMitadLote) break
    rowFrom += dualTodos ? batchSize : batch.length
    if (batch.length < batchSize) hasMore = false
  }

  return {
    tarjetas: sortTarjetasLineaRef(tarjetas),
    nextRowFrom: rowFrom,
    hasMore: hasMore || tarjetas.length >= opts.limit,
    excludeCardKeys: [...excludeSet],
  }
}

const NUMERIC_SCAN_BATCH = 900
const SORT_CACHE_TTL_MS = 3 * 60 * 1000
const sortedCatalogCache = new Map<string, { cards: TarjetaGrilla[]; at: number }>()

function sortedCatalogCacheKey(filters: CatalogoFilterStateExtended): string {
  return JSON.stringify({
    o: filters.origen_tipo ?? '',
    r: filters.ramo_tipo ?? '',
    d: filters.deposito_codigo ?? '',
    m: filters.marca_ids ?? [],
    e: filters.grupo_estilo_ids ?? [],
    l: filters.linea_ids ?? [],
    t: filters.tipo_ids ?? [],
    tg: filters.tipo_grupos ?? [],
    g: filters.genero_codigos ?? filters.genero_codigo ?? '',
    c: filters.colores ?? [],
    q: filters.quincenas ?? [],
    b: filters.buscar ?? '',
    ton: filters.tonos ?? [],
    st: filters.sin_tono ? 1 : 0,
    mf: filters.material_familias ?? [],
    cf: filters.color_familias ?? [],
    dd: filters.dato_duro_cp ?? [],
    pv: filters.preventas ?? [],
    pmin: filters.precio_min ?? null,
    pmax: filters.precio_max ?? null,
    lp: filters.lista_precio_id ?? null,
  })
}

/** Escaneo + sort numérico L→R→M→C (cache corto servidor). */
async function loadSortedCatalogCards(
  filters: CatalogoFilterStateExtended,
): Promise<TarjetaGrilla[]> {
  const key = sortedCatalogCacheKey(filters)
  const hit = sortedCatalogCache.get(key)
  if (hit && Date.now() - hit.at < SORT_CACHE_TTL_MS) return hit.cards

  // Un solo fetch del mapa % (TTL en peDescuentoComercial) — no por lote.
  const peDescMap = await fetchPeDescuentoComercialMap()

  const seen = new Map<string, TarjetaGrilla>()
  let rowFrom = 0
  let scanned = 0
  const dualTodos =
    isCatalogoOrigenTodos(filters) &&
    (filters.ramo_tipo === 'CALZADO' || filters.ramo_tipo === 'CONFECCIONES')

  while (scanned < MAX_SCAN_ROWS) {
    const to = rowFrom + NUMERIC_SCAN_BATCH - 1
    const batch = await fetchStockBatch(filters, rowFrom, to)
    if (!batch.length) break
    scanned += batch.length
    rowFrom += dualTodos ? NUMERIC_SCAN_BATCH : batch.length
    const grilla = await rowsToGrillaAsync(batch, filters, peDescMap)
    for (const card of grilla) {
      if (!seen.has(card.cardKey)) seen.set(card.cardKey, card)
    }
    // Dual: merge puede ser > batch; fin = ninguna vista trajo página llena → batch < span
    // (si una vista sigue viva, batch suele ≥ span).
    if (batch.length < NUMERIC_SCAN_BATCH) break
  }

  const cards = sortTarjetasLineaRef([...seen.values()])
  sortedCatalogCache.set(key, { cards, at: Date.now() })
  return cards
}

export type { TarjetaGrilla }
