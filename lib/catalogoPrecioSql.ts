/**
 * Filtro precio catálogo — límites MIN/MAX por consulta SQL.
 */
import { supabase } from '@/lib/supabase'
import type { CatalogoFilterStateExtended } from '@/lib/catalogoFilters'
import {
  applyNonOrigenSqlFilters,
  applyOrigenTipoQuery,
  applyPeCommercialSqlFilters,
  applyPeDepositoQuery,
  catalogoStockView,
  isCatalogoOrigenTodos,
} from '@/lib/catalogoFilters'
import { filtersParaPrecioRangoCatalogo, PRECIO_RANGO_FALLBACK, type PrecioRangoCatalogo } from '@/lib/catalogoPrecioRango'
import { redondearCentenaGs } from '@/lib/redondeoCentenaGs'
import {
  applyPrecioSqlFilters,
  columnaPrecioSql,
  type PrecioColumnaSql,
} from '@/lib/catalogoPrecioSqlCore'

export { applyPrecioSqlFilters, columnaPrecioSql, type PrecioColumnaSql }

function pasoSlider(min: number, max: number): number {
  const span = max - min
  if (span <= 200_000) return 5_000
  if (span <= 800_000) return 10_000
  if (span <= 2_000_000) return 25_000
  return 50_000
}

async function extremoPrecioVista(
  view: 'v_stock_rimec' | 'v_stock_pe_rimec',
  filters: CatalogoFilterStateExtended,
  col: PrecioColumnaSql,
  extremo: 'min' | 'max',
): Promise<number | null> {
  let query = supabase.from(view).select(col).gt('cajas_disponibles', 0).gt(col, 0)

  if (view === 'v_stock_pe_rimec') {
    query = applyPeCommercialSqlFilters(
      applyPeDepositoQuery(
        applyNonOrigenSqlFilters(query, filters, {
          allowLiquidacion: true,
          skipTipoGruposSql: Boolean(filters.tipo_grupos?.length),
        }),
        filters,
      ),
      filters,
    )
  } else {
    query = applyOrigenTipoQuery(
      applyNonOrigenSqlFilters(query, filters, {
        allowLiquidacion: false,
        skipTipoGruposSql: Boolean(filters.tipo_grupos?.length),
      }),
      filters,
    )
  }

  query = query.order(col, { ascending: extremo === 'min' }).limit(1)
  const { data, error } = await query
  if (error || !data?.length) return null
  const row = data[0] as Record<string, unknown>
  const n = Number(row[col])
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * MIN/MAX reales de la vista (artículo más barato → más caro) para el alcance
 * origen/ramo/depósito — sin marca/línea/tono/precio.
 */
export async function fetchPrecioMinMaxSql(
  filters: CatalogoFilterStateExtended,
): Promise<PrecioRangoCatalogo | null> {
  const scope = filtersParaPrecioRangoCatalogo(filters)
  const col = columnaPrecioSql(scope.lista_precio_id)
  const views: Array<'v_stock_rimec' | 'v_stock_pe_rimec'> = isCatalogoOrigenTodos(scope)
    ? scope.ramo_tipo === 'CONFECCIONES'
      ? ['v_stock_pe_rimec']
      : ['v_stock_rimec', 'v_stock_pe_rimec']
    : [catalogoStockView(scope)]

  const mins: number[] = []
  const maxs: number[] = []
  await Promise.all(
    views.map(async (view) => {
      const scoped: CatalogoFilterStateExtended =
        view === 'v_stock_pe_rimec'
          ? { ...scope, origen_tipo: 'PRONTA_ENTREGA' }
          : {
              ...scope,
              origen_tipo: 'TRÁNSITO_PP',
              ramo_tipo: '',
              deposito_codigo: '',
            }
      const [lo, hi] = await Promise.all([
        extremoPrecioVista(view, scoped, col, 'min'),
        extremoPrecioVista(view, scoped, col, 'max'),
      ])
      if (lo != null) mins.push(lo)
      if (hi != null) maxs.push(hi)
    }),
  )

  if (!mins.length || !maxs.length) return null
  const minR = redondearCentenaGs(Math.min(...mins))
  const maxR = redondearCentenaGs(Math.max(...maxs))
  if (minR >= maxR) {
    return { min: minR, max: minR + PRECIO_RANGO_FALLBACK.step, step: PRECIO_RANGO_FALLBACK.step }
  }
  return { min: minR, max: maxR, step: pasoSlider(minR, maxR) }
}
