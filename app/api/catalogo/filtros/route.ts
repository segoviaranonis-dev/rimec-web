import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchCatalogoMetaRows } from '@/lib/catalogoData'
import {
  applyMemoryFilters,
  applyPeDepositoQuery,
  buildColoresFromRows,
  buildFiltrosFromRows,
  buildQuincenasFromRows,
  catalogoStockView,
  normalizeOrigenCatalogo,
  type CatalogoFilterStateExtended,
} from '@/lib/catalogoFilters'
import { cajasDisponiblesDeFila } from '@/lib/disponibilidad'
import type { StockRow } from '@/app/catalogo-types'
import { enrichCatalogoRows } from '@/lib/catalogoEnrich'

export const dynamic = 'force-dynamic'

function parseFilters(req: NextRequest): CatalogoFilterStateExtended {
  const sp = req.nextUrl.searchParams
  return {
    grupo_estilo_id: sp.get('grupo_estilo_id') ?? '',
    marca_id: sp.get('marca_id') ?? '',
    linea_ids: [],
    tipo_ids: [],
    colores: [],
    quincenas: [],
    origen_tipo: normalizeOrigenCatalogo(sp.get('origen_tipo')),
    ramo_tipo: (sp.get('ramo_tipo') as CatalogoFilterStateExtended['ramo_tipo']) ?? '',
    deposito_codigo: (sp.get('deposito_codigo') as CatalogoFilterStateExtended['deposito_codigo']) ?? '',
  }
}

/** Sidebar catálogo — meta alineada con filtros activos (origen · ramo · depósito). */
export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req)
    const view = catalogoStockView(filters)

    const { data, error } = await fetchCatalogoMetaRows<StockRow>(supabase, view, {
      applySql: q => {
        let query = q
        if (filters.marca_id) query = query.eq('marca_id', Number(filters.marca_id))
        if (view === 'v_stock_pe_rimec') {
          query = applyPeDepositoQuery(query, filters)
        }
        return query
      },
    })
    if (error) throw new Error(error.message)

    const vendibles = (data ?? []).filter(r => cajasDisponiblesDeFila(r) > 0)
    const enriched = await enrichCatalogoRows(vendibles as StockRow[])
    const rows = applyMemoryFilters(enriched, filters)

    return NextResponse.json({
      filtros: buildFiltrosFromRows(rows),
      colores: buildColoresFromRows(rows),
      quincenas: buildQuincenasFromRows(rows),
      totalFilas: rows.length,
      origen: filters.origen_tipo,
    })
  } catch (err) {
    console.error('[catalogo/filtros]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando filtros' },
      { status: 500 },
    )
  }
}
