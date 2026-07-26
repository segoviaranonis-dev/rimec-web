/** Columna + WHERE precio — sin dependencia de Supabase (testeable). */
import type { CatalogoFilterStateExtended } from '@/lib/catalogoFilters'

export type PrecioColumnaSql = 'lpn' | 'lpc02' | 'lpc03' | 'lpc04'

export function columnaPrecioSql(listaId: number | null | undefined): PrecioColumnaSql {
  switch (Number(listaId)) {
    case 2:
      return 'lpc02'
    case 3:
      return 'lpc03'
    case 4:
      return 'lpc04'
    default:
      return 'lpn'
  }
}

/** WHERE precio — acota el scan de filas (poder de consulta, no filtro de vista). */
export function applyPrecioSqlFilters(query: any, filters: CatalogoFilterStateExtended): any {
  const col = columnaPrecioSql(filters.lista_precio_id)
  const tope = filters.precio_tope
  const pMin = filters.precio_min
  const pMax = filters.precio_max

  let q = query
  if (tope != null && tope > 0) {
    return q.gt(col, 0).lte(col, tope)
  }
  if ((pMin != null && pMin > 0) || (pMax != null && pMax > 0)) {
    q = q.gt(col, 0)
    if (pMin != null && pMin > 0) q = q.gte(col, pMin)
    if (pMax != null && pMax > 0) q = q.lte(col, pMax)
    return q
  }
  return q
}
