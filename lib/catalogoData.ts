import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000
const MAX_CATALOGO_ROWS = 50000

/** Hotfix: catálogo mayorista solo compra previa — excluir PE de v_stock_rimec (MIG-134). */
function esFilaProntaEntrega(row: Record<string, unknown>): boolean {
  const t = String(row.origen_tipo ?? '').trim().toUpperCase()
  const qd = String(row.quincena_desc ?? '').trim().toLowerCase()
  return t === 'PRONTA_ENTREGA' || t === 'PRONTA ENTREGA' || qd.startsWith('pronta entrega')
}

function sinProntaEntrega<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.filter(r => !esFilaProntaEntrega(r))
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
      .range(from, to)

    query = orderBy ? orderBy(query) : query

    const { data, error } = await query
    if (error) return { data: all, error }

    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return { data: sinProntaEntrega(all as Record<string, unknown>[]) as T[], error: null }
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
