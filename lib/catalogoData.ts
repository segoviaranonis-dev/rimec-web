import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000
const MAX_CATALOGO_ROWS = 15000

/** Catálogo mayorista: solo compra previa — excluir PE en la query (no post-fetch). */
export const CATALOGO_SOLO_COMPRA_PREVIA = true

/** Columnas comunes CP + PE. */
const CATALOGO_STOCK_SELECT_BASE = `
  det_id, pp_id, pp_nro, proforma,
  quincena_arribo_id, quincena_desc,
  marca_id, descp_marca, caso_id, descp_caso,
  linea_id, linea_codigo, referencia_id, referencia_codigo, nombre,
  material_code, descp_material, color_code, descp_color, color_hex,
  grades_json, cantidad_cajas, cantidad_pares, pares_vendidos, saldo_pares,
  cajas_disponibles, pares_por_caja, lpn, lpc02, lpc03, lpc04,
  grupo_estilo_id, descp_grupo_estilo, tipo_1_id, descp_tipo_1,
  imagen_url, origen_tipo, deposito_id, deposito_nombre, pp_estado
`.replace(/\s+/g, ' ').trim()

/** Compra previa — v_stock_rimec (MIG-138). Sin imagen_color_excel (solo PE · MIG-149). */
export const CATALOGO_STOCK_SELECT_CP = CATALOGO_STOCK_SELECT_BASE

/** Pronta entrega — v_stock_pe_rimec · dual 654/638 · excel_color Kyly. */
export const CATALOGO_STOCK_SELECT_PE = `${CATALOGO_STOCK_SELECT_BASE}, proveedor_importacion_id, tipo_v2_id, imagen_color_excel`

/** @deprecated Usar catalogoStockSelect(view). */
export const CATALOGO_STOCK_SELECT = CATALOGO_STOCK_SELECT_CP

export function catalogoStockSelect(
  view: 'v_stock_rimec' | 'v_stock_pe_rimec',
): string {
  return view === 'v_stock_pe_rimec' ? CATALOGO_STOCK_SELECT_PE : CATALOGO_STOCK_SELECT_CP
}

/** Hotfix: catálogo mayorista solo compra previa — excluir PE de v_stock_rimec (MIG-134). */
function esFilaProntaEntrega(row: Record<string, unknown>): boolean {
  const t = String(row.origen_tipo ?? '').trim().toUpperCase()
  const qd = String(row.quincena_desc ?? '').trim().toLowerCase()
  return t === 'PRONTA_ENTREGA' || t === 'PRONTA ENTREGA' || qd.startsWith('pronta entrega')
}

function sinProntaEntrega<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.filter(r => !esFilaProntaEntrega(r))
}

/** Filtros PostgREST — solo rama TRÁNSITO_PP (evita escanear UNION PE). */
function applyFiltroCompraPrevia(query: any): any {
  if (!CATALOGO_SOLO_COMPRA_PREVIA) return query
  return query.eq('origen_tipo', 'TRÁNSITO_PP')
}

async function fetchAllPages<T>(
  supabase: SupabaseClient,
  selectSql: string,
  orderBy?: (query: any) => any,
  maxPages = 2,
): Promise<{ data: T[]; error: any | null }> {
  return fetchAllPagesFromView<T>(supabase, 'v_stock_rimec', selectSql, orderBy, maxPages)
}

/** Lee todas las filas vendibles del catálogo; Supabase limita a 1000 por request. */
export function fetchCatalogoRows<T>(supabase: SupabaseClient) {
  return fetchAllPages<T>(
    supabase,
    '*',
    query => query.order('descp_marca').order('linea_codigo').order('referencia_codigo'),
  )
}

export type CatalogoMetaFetchOpts = {
  maxPages?: number
  applySql?: (query: any) => any
}

/** Meta sidebar — CP: 2 páginas · PE: escaneo completo (~12k filas post MIG-143). */
export function fetchCatalogoMetaRows<T>(
  supabase: SupabaseClient,
  view: 'v_stock_rimec' | 'v_stock_pe_rimec' = 'v_stock_rimec',
  opts?: CatalogoMetaFetchOpts,
) {
  const maxPages = opts?.maxPages ?? (view === 'v_stock_pe_rimec' ? 13 : 2)
  return fetchAllPagesFromView<T>(
    supabase,
    view,
    `
      marca_id, descp_marca,
      linea_id, linea_codigo, referencia_id, referencia_codigo,
      grupo_estilo_id, descp_grupo_estilo,
      tipo_1_id, descp_tipo_1,
      descp_color, nombre, material_code,
      origen_tipo, quincena_desc, quincena_arribo_id,
      deposito_nombre,
      cajas_disponibles, saldo_pares, cantidad_pares, pares_vendidos, pares_por_caja, cantidad_cajas
    `,
    undefined,
    maxPages,
    opts?.applySql,
  )
}

async function fetchAllPagesFromView<T>(
  supabase: SupabaseClient,
  view: 'v_stock_rimec' | 'v_stock_pe_rimec',
  selectSql: string,
  orderBy?: (query: any) => any,
  maxPages = 2,
  applySql?: (query: any) => any,
): Promise<{ data: T[]; error: any | null }> {
  const all: T[] = []

  for (let page = 0; page < maxPages; page++) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from(view)
      .select(selectSql)
      .gt('cajas_disponibles', 0)

    if (view === 'v_stock_rimec') {
      query = applyFiltroCompraPrevia(query)
    }
    if (applySql) query = applySql(query)
    query = orderBy ? orderBy(query) : query.order('det_id')
    query = query.range(from, to)

    const { data, error } = await query
    if (error) return { data: all, error }

    const batch = (data ?? []) as T[]
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  const filtered = view === 'v_stock_rimec' && CATALOGO_SOLO_COMPRA_PREVIA
    ? sinProntaEntrega(all as Record<string, unknown>[]) as T[]
    : all
  return { data: filtered, error: null }
}
