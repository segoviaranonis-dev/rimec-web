import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchCatalogoRows } from '@/lib/catalogoData'
import { cargarAtributosDesdePilar, cargarMetaLineasDesdePilar, enriquecerMetaConLinea, enriquecerMetaConPilar } from '@/lib/atributosLinea'
import { cajasDisponiblesDeFila } from '@/lib/disponibilidad'
import { agruparTarjetasCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { resolveSupabaseUrl } from '@/lib/supabaseEnv'

const BUCKET = `${resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}/storage/v1/object/public/productos`

interface StockRow {
  det_id: number
  pp_nro: string
  quincena_arribo_id: number | null
  cantidad_pares: number
  saldo_pares: number
  cajas_disponibles: number
  linea_id: number
  referencia_id: number
  linea_codigo: string
  referencia_codigo: string
  material_code: string
  color_code: string
  descp_color: string
  marca_id: number
  descp_marca: string
  grupo_estilo_id: number
  descp_grupo_estilo: string
  tipo_1_id: number
  descp_tipo_1: string | null
  grades_json: Record<string, number> | null
  pares_por_caja: number
  [key: string]: any
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const ppFilter = sp.get('pp')
    const quincenaFilter = sp.get('quincena')

    // ETAPA 1: Query crudo desde fetchCatalogoRows
    const { data: rawRows, error } = await fetchCatalogoRows<StockRow>(supabase)

    if (error) {
      return NextResponse.json({
        error: 'Error fetching catalog data',
        message: error.message,
        details: error
      }, { status: 500 })
    }

    const allRawRows = rawRows || []

    // ETAPA 2: Filtrar por cajas disponibles > 0
    const activeRawRows = allRawRows.filter(r => cajasDisponiblesDeFila(r) > 0)

    // ETAPA 3: Filtrar por PP si se especifica
    const ppFilteredRows = ppFilter
      ? activeRawRows.filter(r => r.pp_nro === ppFilter)
      : activeRawRows

    // ETAPA 4: Enriquecer con pilares
    const paresCodigo = [
      ...new Map(
        activeRawRows.map(r => {
          const lc = String(r.linea_codigo ?? '').trim()
          const rc = String(r.referencia_codigo ?? '').trim()
          return [`${lc}:${rc}`, { linea_codigo: lc, referencia_codigo: rc }] as const
        }).filter(([k]) => k !== ':')
      ).values()
    ]
    const pilar = await cargarAtributosDesdePilar({ paresCodigo })
    const enrichedRows = enriquecerMetaConPilar(activeRawRows, pilar) as StockRow[]
    const lineaMeta = await cargarMetaLineasDesdePilar(enrichedRows.map(m => Number(m.linea_id)))
    const allRows = enriquecerMetaConLinea(enrichedRows, lineaMeta) as StockRow[]

    // ETAPA 5: Filtrar por PP después de enriquecer
    const ppEnrichedRows = ppFilter
      ? allRows.filter(r => r.pp_nro === ppFilter)
      : allRows

    // ETAPA 6: Filtrar por quincena si se especifica
    const quincenaId = quincenaFilter ? parseInt(quincenaFilter) : null
    const quincenaFilteredRows = quincenaId
      ? ppEnrichedRows.filter(r => r.quincena_arribo_id === quincenaId)
      : ppEnrichedRows

    // ETAPA 7: Agrupar en tarjetas
    const productos = agruparTarjetasCatalogo(quincenaFilteredRows, BUCKET, cajasDisponiblesDeFila)

    // Calcular total de pares en tarjetas
    const tarjetasPares = productos.reduce((sum, tarjeta) => {
      return sum + tarjeta.variantes.reduce((vsum, v) => {
        return vsum + (v.cajas_disponibles * v.pares_por_caja)
      }, 0)
    }, 0)

    // Detectar filas que se perdieron
    const detIdsInTarjetas = new Set(
      productos.flatMap(t => t.variantes.map(v => v.det_id))
    )
    const missingRows = quincenaFilteredRows
      .filter(r => !detIdsInTarjetas.has(r.det_id))
      .map(r => ({
        det_id: r.det_id,
        pp_nro: r.pp_nro,
        linea: r.linea_codigo,
        ref: r.referencia_codigo,
        material: r.material_code,
        color: r.color_code,
        cantidad_pares: r.cantidad_pares,
        cajas_disponibles: r.cajas_disponibles,
        cajasFn: cajasDisponiblesDeFila(r),
        grupo_estilo_id: r.grupo_estilo_id,
        tipo_1_id: r.tipo_1_id
      }))

    return NextResponse.json({
      pp: ppFilter || 'ALL',
      quincena: quincenaFilter || 'ALL',
      etapa1_rawRows: {
        count: allRawRows.length,
        cantidad_pares: allRawRows.reduce((s, r) => s + (r.cantidad_pares || 0), 0),
        saldo_pares: allRawRows.reduce((s, r) => s + (r.saldo_pares || 0), 0)
      },
      etapa2_activeRows: {
        count: activeRawRows.length,
        cantidad_pares: activeRawRows.reduce((s, r) => s + (r.cantidad_pares || 0), 0)
      },
      etapa3_ppFiltered: {
        count: ppFilteredRows.length,
        cantidad_pares: ppFilteredRows.reduce((s, r) => s + (r.cantidad_pares || 0), 0)
      },
      etapa4_enriched: {
        count: allRows.length,
        cantidad_pares: allRows.reduce((s, r) => s + (r.cantidad_pares || 0), 0)
      },
      etapa5_ppEnriched: {
        count: ppEnrichedRows.length,
        cantidad_pares: ppEnrichedRows.reduce((s, r) => s + (r.cantidad_pares || 0), 0)
      },
      etapa6_quincenaFiltered: {
        count: quincenaFilteredRows.length,
        cantidad_pares: quincenaFilteredRows.reduce((s, r) => s + (r.cantidad_pares || 0), 0),
        saldo_pares: quincenaFilteredRows.reduce((s, r) => s + (r.saldo_pares || 0), 0)
      },
      etapa7_tarjetas: {
        count: productos.length,
        pares_calculados: tarjetasPares
      },
      missingRows: {
        count: missingRows.length,
        pares_perdidos: missingRows.reduce((s, r) => s + r.cantidad_pares, 0),
        sample: missingRows.slice(0, 10)
      }
    })
  } catch (err) {
    return NextResponse.json({
      error: 'Critical error in debug endpoint',
      message: err instanceof Error ? err.message : String(err)
    }, { status: 500 })
  }
}
