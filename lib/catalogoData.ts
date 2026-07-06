import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000
const MAX_CATALOGO_ROWS = 15000

/** Catálogo mayorista: solo compra previa — excluir PE en la query (no post-fetch). */
export const CATALOGO_SOLO_COMPRA_PREVIA = true

/** Hotfix: catálogo mayorista solo compra previa — excluir PE de v_stock_rimec (MIG-134). */
function esFilaProntaEntrega(row: Record<string, unknown>): boolean {
  const t = String(row.origen_tipo ?? '').trim().toUpperCase()
  const qd = String(row.quincena_desc ?? '').trim().toLowerCase()
  return t === 'PRONTA_ENTREGA' || t === 'PRONTA ENTREGA' || qd.startsWith('pronta entrega')
}

function sinProntaEntrega<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.filter(r => !esFilaProntaEntrega(r))
}

/** Filtros PostgREST — evita timeout por UNION PE en v_stock_rimec. */
function applyFiltroCompraPrevia(query: any): any {
  if (!CATALOGO_SOLO_COMPRA_PREVIA) return query
  return query
    .or('origen_tipo.is.null,origen_tipo.neq.PRONTA_ENTREGA,origen_tipo.neq.PRONTA ENTREGA')
    .or('quincena_desc.is.null,quincena_desc.not.ilike.pronta entrega%')
}

async function fetchAllPages<T>(
  supabase: SupabaseClient,
  selectSql: string,
  orderBy?: (query: any) => any,
): Promise<{ data: T[]; error: any | null }> {
  const all: T[] = []

  for (let from = 0; from < MAX_CATALOGO_ROWS; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from('v_stock_rimec')
      .select(selectSql)
      .gt('cajas_disponibles', 0)

    query = applyFiltroCompraPrevia(query)
    query = orderBy ? orderBy(query) : query
    query = query.range(from, to)

    const { data, error } = await query
    if (error) return { data: all, error }

    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  const filtered = CATALOGO_SOLO_COMPRA_PREVIA
    ? sinProntaEntrega(all as Record<string, unknown>[]) as T[]
    : all
  return { data: filtered, error: null }
}

/** Lee todas las filas vendibles del catálogo; Supabase limita a 1000 por request. */
export function fetchCatalogoRows<T>(supabase: SupabaseClient) {
  return fetchAllPages<T>(
    supabase,
    '*',
    query => query.order('descp_marca').order('linea_codigo').order('referencia_codigo'),
  )
}

/** Lee metadata completa para construir filtros desde el mismo universo vendible. */
export function fetchCatalogoMetaRows<T>(supabase: SupabaseClient) {
  return fetchAllPages<T>(
    supabase,
    `
      marca_id, descp_marca,
      linea_id, linea_codigo, referencia_id, referencia_codigo,
      grupo_estilo_id, descp_grupo_estilo,
      tipo_1_id, descp_tipo_1,
      origen_tipo, quincena_desc,
      cajas_disponibles, saldo_pares, cantidad_pares, pares_vendidos, pares_por_caja, cantidad_cajas
    `,
  )
}
