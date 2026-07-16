import { NextRequest, NextResponse } from 'next/server'
import { fetchTarjetasPage, CATALOGO_CARD_PAGE } from '@/lib/catalogoPaginado'
import {
  parseCatalogoFiltersFromSearchParams,
  type CatalogoFilterStateExtended,
} from '@/lib/catalogoFilters'
import {
  fetchWarmTarjetasCached,
  isWarmTarjetasRequest,
} from '@/lib/catalogoServerCache'

export const dynamic = 'force-dynamic'

type TarjetasBody = {
  row_from?: number
  limit?: number
  exclude?: string[]
  filters?: CatalogoFilterStateExtended
}

async function runTarjetasQuery(opts: {
  filters: CatalogoFilterStateExtended
  rowFrom: number
  limit: number
  exclude: string[]
}) {
  const { filters, rowFrom, limit, exclude } = opts
  return isWarmTarjetasRequest(filters, rowFrom, exclude)
    ? await fetchWarmTarjetasCached(filters, limit)
    : await fetchTarjetasPage({
        filters,
        rowFrom,
        excludeCardKeys: exclude,
        limit,
      })
}

function parseFromSearchParams(sp: URLSearchParams) {
  const rowFrom = Math.max(0, Number(sp.get('row_from') ?? 0) || 0)
  const limit = Math.min(60, Math.max(1, Number(sp.get('limit') ?? CATALOGO_CARD_PAGE) || CATALOGO_CARD_PAGE))
  const exclude = (sp.get('exclude') ?? '').split(',').filter(Boolean)
  const filters = parseCatalogoFiltersFromSearchParams(sp)
  return { rowFrom, limit, exclude, filters }
}

/** GET — grilla paginada catálogo (página 1 · exclude corto). */
export async function GET(req: NextRequest) {
  try {
    const { rowFrom, limit, exclude, filters } = parseFromSearchParams(req.nextUrl.searchParams)
    const result = await runTarjetasQuery({ filters, rowFrom, limit, exclude })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[catalogo/tarjetas]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando catálogo' },
      { status: 500 },
    )
  }
}

/** POST — paginación con exclude largo (scroll infinito). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TarjetasBody
    const sp = req.nextUrl.searchParams
    const filters = body.filters ?? parseCatalogoFiltersFromSearchParams(sp)
    const rowFrom = Math.max(0, Number(body.row_from ?? sp.get('row_from') ?? 0) || 0)
    const limit = Math.min(
      60,
      Math.max(1, Number(body.limit ?? sp.get('limit') ?? CATALOGO_CARD_PAGE) || CATALOGO_CARD_PAGE),
    )
    const exclude = Array.isArray(body.exclude)
      ? body.exclude.filter(Boolean)
      : (sp.get('exclude') ?? '').split(',').filter(Boolean)

    const result = await runTarjetasQuery({ filters, rowFrom, limit, exclude })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[catalogo/tarjetas POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando catálogo' },
      { status: 500 },
    )
  }
}
