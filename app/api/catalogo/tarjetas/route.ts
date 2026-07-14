import { NextRequest, NextResponse } from 'next/server'
import { fetchTarjetasPage, CATALOGO_CARD_PAGE } from '@/lib/catalogoPaginado'
import { parseCatalogoFiltersFromSearchParams } from '@/lib/catalogoFilters'
import {
  fetchWarmTarjetasCached,
  isWarmTarjetasRequest,
} from '@/lib/catalogoServerCache'

export const dynamic = 'force-dynamic'

/** GET — grilla paginada catálogo. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const rowFrom = Math.max(0, Number(sp.get('row_from') ?? 0) || 0)
    const limit = Math.min(60, Math.max(1, Number(sp.get('limit') ?? CATALOGO_CARD_PAGE) || CATALOGO_CARD_PAGE))
    const exclude = (sp.get('exclude') ?? '').split(',').filter(Boolean)
    const filters = parseCatalogoFiltersFromSearchParams(sp)

    const result = isWarmTarjetasRequest(filters, rowFrom, exclude)
      ? await fetchWarmTarjetasCached(filters, limit)
      : await fetchTarjetasPage({
          filters,
          rowFrom,
          excludeCardKeys: exclude,
          limit,
        })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[catalogo/tarjetas]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando catálogo' },
      { status: 500 },
    )
  }
}
