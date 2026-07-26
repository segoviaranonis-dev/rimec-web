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
  buildPreventasFromRows,
  buildTonosDisponiblesFromRows,
  isCatalogoOrigenCp,
  isCatalogoOrigenTodos,
  normalizeOrigenCatalogo,
  parseCatalogoFiltersFromSearchParams,
  type CatalogoFilterStateExtended,
} from '@/lib/catalogoFilters'
import { buildParesDatoDuroFromRows } from '@/lib/datoDuroCpFiltro'
import { fetchPrecioMinMaxSql } from '@/lib/catalogoPrecioSql'
import type { ListaPrecioId } from '@/lib/precioLista'
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

    if (filters.ramo_tipo === 'CONFECCIONES' || filters.ramo_tipo === 'ACCESORIOS') {
      const peRes = await fetchCatalogoMetaRows<StockRow>(supabase, 'v_stock_pe_rimec', {
        applySql: q =>
          applyPeDepositoQuery(
            applyNonOrigenSqlFilters(q, peFilters, { allowLiquidacion: true }),
            filters,
          ),
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
            applyPeDepositoQuery(
              applyNonOrigenSqlFilters(q, peFilters, { allowLiquidacion: true }),
              filters,
            ),
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
        return           applyPeCommercialSqlFilters(
            applyPeDepositoQuery(
              applyNonOrigenSqlFilters(q, { ...filters, quincenas: [] }, { allowLiquidacion: true }),
              filters,
            ),
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

/** RPC directo — sin unstable_cache (hotfix 2026-07-24: cache/null + timeout bloqueaban sidebar). */
async function metaRpcParaFiltros(filters: CatalogoFilterStateExtended) {
  return fetchCatalogoMetaViaRpc(filters)
}

const cachedPrecioRango = unstable_cache(
  async (key: string) => {
    const filters = JSON.parse(key) as CatalogoFilterStateExtended
    return fetchPrecioMinMaxSql(filters)
  },
  ['catalogo-precio-rango-sql-v1'],
  { revalidate: 300 },
)

async function precioRangoParaFiltros(filters: CatalogoFilterStateExtended) {
  const listaRaw = Number(filters.lista_precio_id ?? 1)
  const listaId = (listaRaw === 1 || listaRaw === 2 || listaRaw === 3 || listaRaw === 4
    ? listaRaw
    : 1) as ListaPrecioId
  const scopeKey = JSON.stringify({
    origen_tipo: filters.origen_tipo ?? '',
    ramo_tipo: filters.ramo_tipo ?? '',
    deposito_codigo: filters.deposito_codigo ?? '',
    cadena_comercial: filters.cadena_comercial ?? '',
    lista_precio_id: listaId,
  })
  return cachedPrecioRango(scopeKey)
}

async function paresDatoDuroParaFiltros(filters: CatalogoFilterStateExtended) {
  const wantCp =
    isCatalogoOrigenCp(filters) ||
    (isCatalogoOrigenTodos(filters) && filters.ramo_tipo !== 'CONFECCIONES')
  if (!wantCp) return []

  const facetFilters: CatalogoFilterStateExtended = {
    ...filters,
    material_familias: [],
    color_familias: [],
    dato_duro_cp: [],
    quincenas: [],
    preventas: [],
  }
  const rows = await rowsForFiltrosLegacy(facetFilters)
  return buildParesDatoDuroFromRows(rows)
}

/** GET — meta sidebar en cascada (marca → líneas → tonos · familias Material/Color). */
export async function GET(req: NextRequest) {
  try {
    const filters = parseCatalogoFiltersFromSearchParams(req.nextUrl.searchParams)

    const rpcMeta = await metaRpcParaFiltros(filters)
    if (rpcMeta && (rpcMeta.marcas.length > 0 || rpcMeta.lineas.length > 0 || rpcMeta.tipos.length > 0)) {
      const payload = metaRpcToFiltrosResponse(rpcMeta)
      // Hotfix: no escanear 6k+ filas en TODOS — bloqueaba prod (>10s) y dejaba filtros vacíos.
      let paresDatoDuro: Awaited<ReturnType<typeof paresDatoDuroParaFiltros>> = []
      if (isCatalogoOrigenCp(filters)) {
        try {
          paresDatoDuro = await paresDatoDuroParaFiltros(filters)
        } catch (e) {
          console.error('[catalogo/filtros] paresDatoDuro CP', e)
        }
      }
      let precioRango: Awaited<ReturnType<typeof precioRangoParaFiltros>> = null
      try {
        precioRango = await precioRangoParaFiltros(filters)
      } catch (e) {
        console.error('[catalogo/filtros] precioRango', e)
      }
      return NextResponse.json({
        ...payload,
        paresDatoDuro,
        precioRango,
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
    const precioRango = await precioRangoParaFiltros(filters)
    return NextResponse.json({
      filtros: buildFiltrosFromRows(rows, filters.ramo_tipo),
      colores: buildColoresFromRows(rows),
      quincenas: buildQuincenasFromRows(rows),
      preventas: buildPreventasFromRows(rows),
      paresDatoDuro: buildParesDatoDuroFromRows(rows),
      tonosDisponibles: buildTonosDisponiblesFromRows(rows),
      materialFamilias: buildMaterialFamiliasFromRows(rows),
      colorFamilias: buildColorFamiliasFromRows(rows),
      precioRango,
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
