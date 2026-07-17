import { NextRequest, NextResponse } from 'next/server'
import { fetchCatalogoMetaRows } from '@/lib/catalogoData'
import {
  applyMemoryFilters,
  applyPeCommercialSqlFilters,
  applyPeDepositoQuery,
  applyNonOrigenSqlFilters,
  applySqlFiltersToQuery,
  buildColoresFromRows,
  buildColorFamiliasFromRows,
  buildFiltrosFromRows,
  buildMaterialFamiliasFromRows,
  buildQuincenasFromRows,
  buildTonosDisponiblesFromRows,
  isCatalogoOrigenTodos,
  normalizeOrigenCatalogo,
  parseCatalogoFiltersFromSearchParams,
  type CatalogoFilterStateExtended,
} from '@/lib/catalogoFilters'
import { cajasDisponiblesDeFila } from '@/lib/disponibilidad'
import type { StockRow } from '@/app/catalogo-types'
import { enrichCatalogoRows } from '@/lib/catalogoEnrich'
import { fetchCatalogoMetaViaRpc, metaRpcToFiltrosResponse } from '@/lib/catalogoMetaRpc'
import { supabase } from '@/lib/supabase'
import { unstable_cache } from 'next/cache'

export const dynamic = 'force-dynamic'

async function rowsForFiltrosLegacy(filters: CatalogoFilterStateExtended): Promise<StockRow[]> {
  if (isCatalogoOrigenTodos(filters)) {
    const peFilters: CatalogoFilterStateExtended = {
      ...filters,
      origen_tipo: 'PRONTA_ENTREGA',
      quincenas: [],
    }

    if (filters.ramo_tipo === 'CONFECCIONES') {
      const peRes = await fetchCatalogoMetaRows<StockRow>(supabase, 'v_stock_pe_rimec', {
        applySql: q => applyPeDepositoQuery(applyNonOrigenSqlFilters(q, peFilters), filters),
      })
      if (peRes.error) throw new Error(peRes.error.message)
      const vendibles = (peRes.data ?? []).filter(r => cajasDisponiblesDeFila(r) > 0)
      const enriched = await enrichCatalogoRows(vendibles as StockRow[])
      return applyMemoryFilters(enriched, filters)
    }

    const cpFilters: CatalogoFilterStateExtended = {
      ...filters,
      origen_tipo: 'TRÁNSITO_PP',
      ramo_tipo: filters.ramo_tipo === 'CALZADO' ? 'CALZADO' : '',
      deposito_codigo: '',
      cadena_comercial: '',
    }

    const [cpRes, peRes] = await Promise.all([
      fetchCatalogoMetaRows<StockRow>(supabase, 'v_stock_rimec', {
        applySql: q => applyNonOrigenSqlFilters(q, cpFilters),
      }),
      fetchCatalogoMetaRows<StockRow>(supabase, 'v_stock_pe_rimec', {
        applySql: q =>
          applyPeCommercialSqlFilters(
            applyPeDepositoQuery(applyNonOrigenSqlFilters(q, peFilters), filters),
            filters,
          ),
      }),
    ])
    if (cpRes.error) throw new Error(cpRes.error.message)
    if (peRes.error) throw new Error(peRes.error.message)

    const merged = [...(cpRes.data ?? []), ...(peRes.data ?? [])]
    const vendibles = merged.filter(r => cajasDisponiblesDeFila(r) > 0)
    const enriched = await enrichCatalogoRows(vendibles as StockRow[])
    return applyMemoryFilters(enriched, filters)
  }

  const view = normalizeOrigenCatalogo(filters.origen_tipo) === 'PRONTA_ENTREGA'
    ? 'v_stock_pe_rimec'
    : 'v_stock_rimec'

  const { data, error } = await fetchCatalogoMetaRows<StockRow>(supabase, view, {
    applySql: q => {
      if (view === 'v_stock_pe_rimec') {
        return applyPeCommercialSqlFilters(
          applyPeDepositoQuery(applyNonOrigenSqlFilters(q, { ...filters, quincenas: [] }), filters),
          filters,
        )
      }
      return applySqlFiltersToQuery(q, { ...filters, cadena_comercial: '' })
    },
  })
  if (error) throw new Error(error.message)

  const vendibles = (data ?? []).filter(r => cajasDisponiblesDeFila(r) > 0)
  const enriched = await enrichCatalogoRows(vendibles as StockRow[])
  return applyMemoryFilters(enriched, filters)
}

const cachedMetaRpc = unstable_cache(
  async (key: string) => {
    const filters = JSON.parse(key) as CatalogoFilterStateExtended
    return fetchCatalogoMetaViaRpc(filters)
  },
  ['catalogo-meta-rpc'],
  { revalidate: 300 },
)

/** GET — meta sidebar en cascada (marca → líneas → tonos · familias Material/Color). */
export async function GET(req: NextRequest) {
  try {
    const filters = parseCatalogoFiltersFromSearchParams(req.nextUrl.searchParams)
    const cacheKey = JSON.stringify(filters)

    const rpcMeta = await cachedMetaRpc(cacheKey)
    if (rpcMeta) {
      const payload = metaRpcToFiltrosResponse(rpcMeta)
      return NextResponse.json({
        ...payload,
        materialFamilias: [],
        colorFamilias: [],
        totalFilas: null,
        origen: filters.origen_tipo,
        metaSource: 'rpc',
      })
    }

    const facetFilters: CatalogoFilterStateExtended = {
      ...filters,
      material_familias: [],
      color_familias: [],
    }
    const rows = await rowsForFiltrosLegacy(facetFilters)
    return NextResponse.json({
      filtros: buildFiltrosFromRows(rows),
      colores: buildColoresFromRows(rows),
      quincenas: buildQuincenasFromRows(rows),
      tonosDisponibles: buildTonosDisponiblesFromRows(rows),
      materialFamilias: buildMaterialFamiliasFromRows(rows),
      colorFamilias: buildColorFamiliasFromRows(rows),
      totalFilas: rows.length,
      origen: filters.origen_tipo,
      metaSource: 'legacy',
    })
  } catch (err) {
    console.error('[catalogo/filtros]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando filtros' },
      { status: 500 },
    )
  }
}
