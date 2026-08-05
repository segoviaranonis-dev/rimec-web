import { NextRequest, NextResponse } from 'next/server'
import { fetchTarjetasPage, CATALOGO_CARD_PAGE } from '@/lib/catalogoPaginado'
import {
  parseCatalogoFiltersFromSearchParams,
  isCatalogoOrigenTodos,
  type CatalogoFilterStateExtended,
} from '@/lib/catalogoFilters'
import {
  fetchWarmTarjetasCached,
  isWarmTarjetasRequest,
} from '@/lib/catalogoServerCache'
import { getSession } from '@/lib/auth/session'
import { applyCatalogoScopeUsuario } from '@/lib/auth/catalogoScopeUsuario'

export const dynamic = 'force-dynamic'

type TarjetasBody = {
  row_from?: number
  limit?: number
  exclude?: string[]
  filters?: CatalogoFilterStateExtended
  quick?: boolean
}

function esTimeoutTarjetas(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  return /statement timeout|57014|canceling statement|schema cache|transaction is aborted/i.test(raw)
}

function tarjetasVaciasPorTimeout(limit: number) {
  return {
    tarjetas: [],
    nextRowFrom: 0,
    hasMore: false,
    excludeCardKeys: [] as string[],
    degraded: true,
    limit,
  }
}

async function runTarjetasQuery(opts: {
  filters: CatalogoFilterStateExtended
  rowFrom: number
  limit: number
  exclude: string[]
  quick?: boolean
}) {
  const { filters, rowFrom, limit, exclude, quick } = opts
  const useQuick =
    quick ||
    Boolean(String(filters.buscar ?? '').trim()) ||
    filters.ramo_tipo === 'CONFECCIONES' ||
    filters.ramo_tipo === 'ACCESORIOS' ||
    (isCatalogoOrigenTodos(filters) && filters.ramo_tipo === 'CALZADO')
  if (useQuick) {
    return fetchTarjetasPage({
      filters,
      rowFrom,
      excludeCardKeys: exclude,
      limit,
      quick: true,
    })
  }
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
  const quick = sp.get('quick') === '1'
  return { rowFrom, limit, exclude, filters, quick }
}

/** GET — grilla paginada catálogo (página 1 · exclude corto). */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    const parsed = parseFromSearchParams(req.nextUrl.searchParams)
    const filters = applyCatalogoScopeUsuario(parsed.filters, session?.name)
    const result = await runTarjetasQuery({
      filters,
      rowFrom: parsed.rowFrom,
      limit: parsed.limit,
      exclude: parsed.exclude,
      quick: parsed.quick,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[catalogo/tarjetas]', err)
    if (esTimeoutTarjetas(err)) {
      const parsed = parseFromSearchParams(req.nextUrl.searchParams)
      return NextResponse.json(tarjetasVaciasPorTimeout(parsed.limit))
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando catálogo' },
      { status: 500 },
    )
  }
}

/** POST — paginación con exclude largo (scroll infinito). */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    const body = (await req.json()) as TarjetasBody
    const sp = req.nextUrl.searchParams
    const rawFilters = body.filters ?? parseCatalogoFiltersFromSearchParams(sp)
    const filters = applyCatalogoScopeUsuario(rawFilters, session?.name)
    const rowFrom = Math.max(0, Number(body.row_from ?? sp.get('row_from') ?? 0) || 0)
    const limit = Math.min(
      60,
      Math.max(1, Number(body.limit ?? sp.get('limit') ?? CATALOGO_CARD_PAGE) || CATALOGO_CARD_PAGE),
    )
    const exclude = Array.isArray(body.exclude)
      ? body.exclude.filter(Boolean)
      : (sp.get('exclude') ?? '').split(',').filter(Boolean)
    const quick = Boolean(body.quick) || sp.get('quick') === '1'

    const result = await runTarjetasQuery({ filters, rowFrom, limit, exclude, quick })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[catalogo/tarjetas POST]', err)
    if (esTimeoutTarjetas(err)) {
      const sp = req.nextUrl.searchParams
      const limit = Math.min(
        60,
        Math.max(1, Number(sp.get('limit') ?? CATALOGO_CARD_PAGE) || CATALOGO_CARD_PAGE),
      )
      return NextResponse.json(tarjetasVaciasPorTimeout(limit))
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando catálogo' },
      { status: 500 },
    )
  }
}
