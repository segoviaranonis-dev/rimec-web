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
import { fetchCatalogoMetaViaRpcCascada, metaRpcToFiltrosResponse, acotarMetaRpcDesdeFilas } from '@/lib/catalogoMetaRpc'
import { peSoloFiltroEscolar } from '@/lib/filtros/pe-modulo-escolar'
import { peTieneSubfamiliaAccesorios } from '@/lib/filtros/modulo-accesorios'
import { supabase } from '@/lib/supabase'
import { unstable_cache } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { applyCatalogoScopeUsuario } from '@/lib/auth/catalogoScopeUsuario'

export const dynamic = 'force-dynamic'

async function rowsForFiltrosLegacy(filters: CatalogoFilterStateExtended): Promise<StockRow[]> {
  if (isCatalogoOrigenTodos(filters)) {
    const peFilters: CatalogoFilterStateExtended = {
      ...filters,
      origen_tipo: 'PRONTA_ENTREGA',
      quincenas: [],
    }

    const peSqlOpts = { allowLiquidacion: true as const, peView: true as const }

    if (filters.ramo_tipo === 'CONFECCIONES' || filters.ramo_tipo === 'ACCESORIOS') {
      const peRes = await fetchCatalogoMetaRows<StockRow>(supabase, 'v_stock_pe_rimec', {
        applySql: q =>
          applyPeDepositoQuery(
            applyNonOrigenSqlFilters(q, peFilters, peSqlOpts),
            filters,
          ),
      })
      if (peRes.error) throw new Error(peRes.error.message)
      const vendibles = (peRes.data ?? []).filter(r => cajasDisponiblesDeFila(r) > 0)
      const enriched = await enrichCatalogoRows(vendibles as StockRow[])
      return applyMemoryFilters(enriched, filters)
    }

    // ESCOLAR / Carteras / Anteojos = solo PE (misma ley que grilla).
    if (
      peSoloFiltroEscolar(filters.tipo_ids) ||
      peTieneSubfamiliaAccesorios(filters.tipo_ids ?? [])
    ) {
      const peRes = await fetchCatalogoMetaRows<StockRow>(supabase, 'v_stock_pe_rimec', {
        applySql: q =>
          applyPeCommercialSqlFilters(
            applyPeDepositoQuery(
              applyNonOrigenSqlFilters(q, peFilters, peSqlOpts),
              filters,
            ),
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
              applyNonOrigenSqlFilters(q, peFilters, peSqlOpts),
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
        return applyPeCommercialSqlFilters(
          applyPeDepositoQuery(
            applyNonOrigenSqlFilters(q, { ...filters, quincenas: [] }, {
              allowLiquidacion: true,
              peView: true,
            }),
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
  return fetchCatalogoMetaViaRpcCascada(filters)
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
  const session = await getSession()
  const filters = applyCatalogoScopeUsuario(
    parseCatalogoFiltersFromSearchParams(req.nextUrl.searchParams),
    session?.name,
  )
  try {
    const rpcMeta = await metaRpcParaFiltros(filters)
    if (
      rpcMeta &&
      (rpcMeta.marcas.length > 0 ||
        rpcMeta.lineas.length > 0 ||
        rpcMeta.tipos.length > 0 ||
        rpcMeta.estilos.length > 0 ||
        rpcMeta.generos.length > 0)
    ) {
      let metaFinal = rpcMeta
      let materialFamilias: Awaited<ReturnType<typeof buildMaterialFamiliasFromRows>> = []
      let colorFamilias: Awaited<ReturnType<typeof buildColorFamiliasFromRows>> = []
      let todasReferencias: { id: number; label: string }[] = []
      // Cascada CHUSAR: cualquier dimensión activa debe acotar meta (Marca→Línea…).
      // Antes solo Estilo/Línea/tipo_grupos → Marca ACTVITTA dejaba Línea en ~841.
      const needRowsScan =
        (filters.tipo_grupos?.length ?? 0) > 0 ||
        (filters.grupo_estilo_ids?.length ?? 0) > 0 ||
        Boolean(filters.grupo_estilo_id) ||
        (filters.linea_ids?.length ?? 0) > 0 ||
        (filters.referencia_ids?.length ?? 0) > 0 ||
        (filters.material_familias?.length ?? 0) > 0 ||
        (filters.color_familias?.length ?? 0) > 0 ||
        (filters.marca_ids?.length ?? 0) > 0 ||
        Boolean(filters.marca_id) ||
        (filters.tipo_ids?.length ?? 0) > 0 ||
        (filters.genero_codigos?.length ?? 0) > 0 ||
        Boolean(filters.genero_codigo) ||
        Boolean(filters.deposito_codigo) ||
        (filters.tonos?.length ?? 0) > 0 ||
        Boolean(filters.sin_tono) ||
        Boolean(filters.buscar?.trim())
      if (needRowsScan) {
        try {
          const rows = await rowsForFiltrosLegacy({
            ...filters,
            referencia_ids: [],
            material_familias: [],
            color_familias: [],
          })
          materialFamilias = buildMaterialFamiliasFromRows(rows)
          colorFamilias = buildColorFamiliasFromRows(rows)
          todasReferencias = buildFiltrosFromRows(rows, filters.ramo_tipo).todasReferencias
          // Filas 0 (bug ESCOLAR sin peView) no deben vaciar Estilo/Línea → «Sin opciones».
          if (rows.length > 0) {
            metaFinal = acotarMetaRpcDesdeFilas(metaFinal, rows, filters.ramo_tipo)
          }
        } catch (e) {
          console.error('[catalogo/filtros] cascada scan/acotar', e)
        }
      }
      const payload = metaRpcToFiltrosResponse(metaFinal, { todasReferencias })
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
        materialFamilias,
        colorFamilias,
        totalFilas: null,
        origen: filters.origen_tipo,
        metaSource: 'rpc',
      })
    }

    const facetFilters: CatalogoFilterStateExtended = {
      ...filters,
      referencia_ids: [],
      material_familias: [],
      color_familias: [],
    }
    const rows = await rowsForFiltrosLegacy(facetFilters)
    const precioRango = await precioRangoParaFiltros(filters)
    const filtrosLegacy = buildFiltrosFromRows(rows, filters.ramo_tipo)
    try {
      const { loadMaestrasTrianguloCatalogo } = await import('@/lib/pilares/loadMaestrasTriangulo')
      const maestras = await loadMaestrasTrianguloCatalogo(filters.ramo_tipo)
      if (maestras) {
        filtrosLegacy.todosEstilos = maestras.estilos
        filtrosLegacy.todosGeneros = maestras.generos
      }
    } catch (e) {
      console.error('[catalogo/filtros] maestras pilares', e)
    }
    return NextResponse.json({
      filtros: filtrosLegacy,
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
    try {
      const { loadMaestrasTrianguloCatalogo } = await import('@/lib/pilares/loadMaestrasTriangulo')
      const maestras = await loadMaestrasTrianguloCatalogo(filters.ramo_tipo)
      if (maestras?.estilos?.length || maestras?.generos?.length) {
        return NextResponse.json({
          filtros: {
            todasLineas: [],
            todasMarcas: [],
            todosEstilos: maestras.estilos,
            todosTipos: [],
            todosGeneros: maestras.generos,
          },
          colores: [],
          quincenas: [],
          preventas: [],
          paresDatoDuro: [],
          tonosDisponibles: [],
          materialFamilias: [],
          colorFamilias: [],
          precioRango: null,
          totalFilas: 0,
          origen: filters.origen_tipo,
          metaSource: 'degraded-maestras',
          degraded: true,
        })
      }
    } catch (e) {
      console.error('[catalogo/filtros] degraded maestras', e)
    }
    return NextResponse.json({
      filtros: { todasLineas: [], todasMarcas: [], todosEstilos: [], todosTipos: [], todosGeneros: [] },
      colores: [],
      quincenas: [],
      preventas: [],
      paresDatoDuro: [],
      tonosDisponibles: [],
      materialFamilias: [],
      colorFamilias: [],
      precioRango: null,
      totalFilas: 0,
      metaSource: 'degraded',
      degraded: true,
    })
  }
}
