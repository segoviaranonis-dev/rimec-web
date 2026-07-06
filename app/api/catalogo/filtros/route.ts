import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchCatalogoMetaRows } from '@/lib/catalogoData'
import {
  buildColoresFromRows,
  buildFiltrosFromRows,
  buildQuincenasFromRows,
} from '@/lib/catalogoFilters'
import { cajasDisponiblesDeFila } from '@/lib/disponibilidad'
import type { StockRow } from '@/app/catalogo-types'

export const dynamic = 'force-dynamic'

/** Sidebar catálogo — meta ligera desde vista, sin enrich pilar (evita timeout). */
export async function GET() {
  try {
    const { data, error } = await fetchCatalogoMetaRows<StockRow>(supabase)
    if (error) throw new Error(error.message)

    const rows = (data ?? []).filter(r => cajasDisponiblesDeFila(r) > 0)

    return NextResponse.json({
      filtros: buildFiltrosFromRows(rows),
      colores: buildColoresFromRows(rows),
      quincenas: buildQuincenasFromRows(rows),
      totalFilas: rows.length,
    })
  } catch (err) {
    console.error('[catalogo/filtros]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando filtros' },
      { status: 500 },
    )
  }
}
