import { NextRequest, NextResponse } from 'next/server'
import { fetchTarjetasPage, CATALOGO_CARD_PAGE } from '@/lib/catalogoPaginado'
import type { CatalogoFilterStateExtended } from '@/lib/catalogoFilters'
import { normalizeOrigenCatalogo } from '@/lib/catalogoFilters'

export const dynamic = 'force-dynamic'

function parseFilters(searchParams: URLSearchParams): CatalogoFilterStateExtended {
  const ramoRaw = String(searchParams.get('ramo_tipo') ?? '').trim().toUpperCase()

  return {
    grupo_estilo_id: searchParams.get('grupo_estilo_id') ?? '',
    marca_id: searchParams.get('marca_id') ?? '',
    linea_ids: (searchParams.get('linea_ids') ?? '').split(',').filter(Boolean).map(Number),
    tipo_ids: (searchParams.get('tipo_ids') ?? '').split(',').filter(Boolean).map(Number),
    colores: (searchParams.get('colores') ?? '').split(',').filter(Boolean),
    quincenas: (searchParams.get('quincenas') ?? '').split(',').filter(Boolean).map(Number),
    origen_tipo: normalizeOrigenCatalogo(searchParams.get('origen_tipo')),
    ramo_tipo:
      ramoRaw === 'CONFECCIONES' ? 'CONFECCIONES' : ramoRaw === 'CALZADO' ? 'CALZADO' : '',
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const rowFrom = Math.max(0, Number(sp.get('row_from') ?? 0) || 0)
    const limit = Math.min(60, Math.max(1, Number(sp.get('limit') ?? CATALOGO_CARD_PAGE) || CATALOGO_CARD_PAGE))
    const exclude = (sp.get('exclude') ?? '').split(',').filter(Boolean)

    const result = await fetchTarjetasPage({
      filters: parseFilters(sp),
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
