import { unstable_cache } from 'next/cache'
import {
  normalizeOrigenCatalogo,
  type CatalogoFilterStateExtended,
} from '@/lib/catalogoFilters'
import { fetchTarjetasPage } from '@/lib/catalogoPaginado'

const WARM_TTL_SEC = 300

/** Página 1 sin scroll — perfiles warm cache (CAT-LAT-T5). */
export function isWarmTarjetasRequest(
  filters: CatalogoFilterStateExtended,
  rowFrom: number,
  exclude: string[],
): boolean {
  if (rowFrom !== 0 || exclude.length > 0) return false

  const hasExtraFilters =
    Boolean(filters.marca_id) ||
    Boolean(filters.grupo_estilo_id) ||
    Boolean(filters.buscar?.trim()) ||
    filters.linea_ids.length > 0 ||
    filters.tipo_ids.length > 0 ||
    filters.colores.length > 0 ||
    filters.quincenas.length > 0 ||
    Boolean(filters.genero_codigo?.trim()) ||
    Boolean(filters.deposito_codigo) ||
    (filters.tonos?.length ?? 0) > 0 ||
    Boolean(filters.sin_tono) ||
    Boolean(filters.cadena_comercial?.trim()) ||
    (filters.tipo_grupos?.length ?? 0) > 0 ||
    (filters.material_familias?.length ?? 0) > 0 ||
    (filters.color_familias?.length ?? 0) > 0

  if (hasExtraFilters) return false

  const o = normalizeOrigenCatalogo(filters.origen_tipo)
  if (o === 'TODOS' && filters.ramo_tipo === 'CALZADO') return true
  if (o === 'PRONTA_ENTREGA' && filters.ramo_tipo === 'CALZADO') return true
  if ((o === 'TRÁNSITO_PP' || o === '') && !filters.marca_id && !filters.buscar?.trim()) return true
  return false
}

const fetchWarmTarjetasInner = unstable_cache(
  async (key: string) => {
    const { filters, limit } = JSON.parse(key) as {
      filters: CatalogoFilterStateExtended
      limit: number
    }
    return fetchTarjetasPage({
      filters,
      rowFrom: 0,
      excludeCardKeys: [],
      limit,
    })
  },
  ['catalogo-tarjetas-warm-v2'],
  { revalidate: WARM_TTL_SEC },
)

export function fetchWarmTarjetasCached(
  filters: CatalogoFilterStateExtended,
  limit: number,
) {
  return fetchWarmTarjetasInner(JSON.stringify({ filters, limit }))
}
