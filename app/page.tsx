import { supabase } from '@/lib/supabase'
import { CatalogoClient } from './CatalogoClient'
import { getFiltros } from '@/lib/filtros'
import {
  cargarAtributosDesdePilar,
  cargarMetaLineasDesdePilar,
  enriquecerMetaConLinea,
  enriquecerMetaConPilar,
} from '@/lib/atributosLinea'
import { resolveSupabaseUrl } from '@/lib/supabaseEnv'
import { cajasDisponiblesDeFila } from '@/lib/disponibilidad'
import { fetchCatalogoRows } from '@/lib/catalogoData'

export const revalidate = 30

export interface StockRow {
  det_id:               number
  pp_id:                number
  pp_nro:               string
  proforma:             string
  quincena_arribo_id:   number | null                   // Dato duro (FK)
  quincena_desc:        string | null                   // Descripción legible
  marca_id:             number
  descp_marca:          string
  caso_id:              number | null
  descp_caso:           string | null
  linea_id:             number
  linea_codigo:         string
  referencia_id:        number
  referencia_codigo:    string
  nombre:               string
  material_code:        string
  descp_material:       string
  color_code:           string
  descp_color:          string
  /** Hex HTML del pilar `color` (ej. "#1a1a1a"). null si el operador no lo configuró aún. */
  color_hex:            string | null
  grades_json:          Record<string, number> | null
  cantidad_cajas:       number
  cantidad_pares:       number
  pares_vendidos?:      number
  saldo_pares?:         number
  cajas_disponibles?:   number
  pares_por_caja:       number
  lpn:                  number | null
  lpc02:                number | null
  lpc03:                number | null
  lpc04:                number | null
  grupo_estilo_id:      number
  descp_grupo_estilo:   string
  tipo_1_id:            number
  descp_tipo_1:         string | null
  imagen_url:           string | null
  origen_tipo?:          string | null
  deposito_id?:         number | null
  clasificacion_stock_id?: number | null
  pp_estado?:           string | null
}

const BUCKET = `${resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}/storage/v1/object/public/productos`

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ grupo_estilo_id?: string; marca_id?: string; linea_ids?: string; tipo_ids?: string; colores?: string; quincenas?: string }>
}) {
  const params = await searchParams
  const estiloId  = params.grupo_estilo_id ?? ''
  const marcaId   = params.marca_id  ?? ''
  const lineasIds = params.linea_ids ? params.linea_ids.split(',').filter(Boolean).map(Number) : []
  const tiposIds  = params.tipo_ids  ? params.tipo_ids.split(',').filter(Boolean).map(Number) : []
  const coloresFiltro = params.colores ? params.colores.split(',').filter(Boolean) : []
  const quincenasSel = params.quincenas?.split(',').filter(Boolean).map(Number) ?? []

  // Solo filas con stock vendible. Supabase limita a 1000 filas por request:
  // usar paginación explícita para que catálogo y filtros no pierdan pares.
  const { data, error } = await fetchCatalogoRows<StockRow>(supabase)

  if (error) console.error('[rimec-web]', error.message)

  const rawRows = (data ?? []) as StockRow[]
  const activeRawRows = rawRows.filter(r => cajasDisponiblesDeFila(r) > 0)
  const paresCodigo = [
    ...new Map(
      activeRawRows.map(r => {
        const lc = String(r.linea_codigo ?? '').trim()
        const rc = String(r.referencia_codigo ?? '').trim()
        return [`${lc}:${rc}`, { linea_codigo: lc, referencia_codigo: rc }] as const
      }).filter(([k]) => k !== ':'),
    ).values(),
  ]
  const pilar = await cargarAtributosDesdePilar({ paresCodigo })
  const rowsConPilar = enriquecerMetaConPilar(activeRawRows, pilar) as StockRow[]
  const lineaMeta = await cargarMetaLineasDesdePilar(rowsConPilar.map(r => Number(r.linea_id)))
  const allRows = enriquecerMetaConLinea(rowsConPilar, lineaMeta) as StockRow[]

  // Obtener filtros normalizados
  const filtros = await getFiltros()
  const todasLineas  = filtros?.todasLineas || []
  const todasMarcas  = filtros?.todasMarcas || []
  const todosEstilos = filtros?.todosEstilos || []
  const todosTipos   = filtros?.todosTipos || []

  // Limpiar colores: descartar null/undefined/empty y trimear para evitar
  // duplicados visuales (ej. "NEGRO" vs "NEGRO ") y `key={null}` en el dropdown.
  const todosColores = Array.from(
    new Set(
      allRows
        .map(r => (typeof r.descp_color === 'string' ? r.descp_color.trim() : ''))
        .filter((c): c is string => c.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

  // Opciones de Llegada: quincenas únicas ordenadas
  const todasQuincenas = Array.from(
    new Map(
      allRows
        .filter(r => r.quincena_arribo_id && r.quincena_desc)
        .map(r => [r.quincena_arribo_id, { id: r.quincena_arribo_id!, label: r.quincena_desc! }])
    ).values()
  ).sort((a, b) => a.id - b.id)

  return (
    <CatalogoClient
      rows={allRows}
      bucketUrl={BUCKET}
      filtros={{ todasLineas, todasMarcas, todosEstilos, todosTipos }}
      colores={todosColores}
      quincenas={todasQuincenas}
      initialFilters={{
        grupo_estilo_id: estiloId,
        marca_id: marcaId,
        linea_ids: lineasIds,
        tipo_ids: tiposIds,
        colores: coloresFiltro,
        quincenas: quincenasSel,
      }}
    />
  )
}
