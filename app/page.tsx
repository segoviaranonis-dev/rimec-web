import { supabase } from '@/lib/supabase'
import { CatalogoGrid } from './CatalogoGrid'
import { FiltrosCatalogo } from './components/FiltrosCatalogo'
import { getFiltros } from '@/lib/filtros'
import { cargarAtributosDesdePilar, enriquecerMetaConPilar } from '@/lib/atributosLinea'
import { agruparTarjetasCatalogo } from '@/lib/agruparTarjetasCatalogo'

export const revalidate = 60

export interface StockRow {
  det_id:               number
  pp_id:                number
  pp_nro:               string
  proforma:             string
  eta:                  string | null
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

const BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos`

/** Formatea fecha ISO YYYY-MM-DD a DD-MM para display. */
function formatearEtaLabel(isoFecha: string): string {
  const [, mes, dia] = isoFecha.split('-')
  return `${dia}-${mes}`
}

/** Cajas vendibles: usa columna de la vista o calcula desde saldo de pares. */
function cajasDisponiblesDeFila(item: StockRow): number {
  if (item.cajas_disponibles != null && !Number.isNaN(Number(item.cajas_disponibles))) {
    return Math.max(0, Number(item.cajas_disponibles))
  }
  const saldoPares = Math.max(
    0,
    Number(item.saldo_pares ?? (item.cantidad_pares - (item.pares_vendidos ?? 0))),
  )
  const ppc = Number(item.pares_por_caja)
    || (item.cantidad_cajas > 0 ? item.cantidad_pares / item.cantidad_cajas : 0)
  if (ppc <= 0) return saldoPares > 0 ? Math.max(0, item.cantidad_cajas) : 0
  return Math.max(0, Math.floor(saldoPares / ppc))
}

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ grupo_estilo_id?: string; marca_id?: string; linea_ids?: string; tipo_ids?: string; colores?: string; eta_fechas?: string }>
}) {
  const params = await searchParams
  const estiloId  = params.grupo_estilo_id ?? ''
  const marcaId   = params.marca_id  ?? ''
  const lineasIds = params.linea_ids ? params.linea_ids.split(',').filter(Boolean).map(Number) : []
  const tiposIds  = params.tipo_ids  ? params.tipo_ids.split(',').filter(Boolean).map(Number) : []
  const coloresFiltro = params.colores ? params.colores.split(',').filter(Boolean) : []
  const etasSel = params.eta_fechas?.split(',').filter(Boolean) ?? []

  const { data, error } = await supabase
    .from('v_stock_rimec')
    .select('*')
    .order('descp_marca')
    .order('linea_codigo')
    .order('referencia_codigo')

  if (error) console.error('[rimec-web]', error.message)

  const rawRows = (data ?? []) as StockRow[]
  const paresCodigo = [
    ...new Map(
      rawRows.map(r => {
        const lc = String(r.linea_codigo ?? '').trim()
        const rc = String(r.referencia_codigo ?? '').trim()
        return [`${lc}:${rc}`, { linea_codigo: lc, referencia_codigo: rc }] as const
      }).filter(([k]) => k !== ':'),
    ).values(),
  ]
  const pilar = await cargarAtributosDesdePilar({ paresCodigo })
  const allRows = enriquecerMetaConPilar(rawRows, pilar) as StockRow[]

  // Obtener filtros normalizados
  const filtros = await getFiltros()
  const todasLineas  = filtros?.todasLineas || []
  const todasMarcas  = filtros?.todasMarcas || []
  const todosEstilos = filtros?.todosEstilos || []
  const todosTipos   = filtros?.todosTipos || []

  let rows = [...allRows]

  // Aplicar filtros usando IDs directamente
  if (estiloId) {
    rows = rows.filter(r => r.grupo_estilo_id === Number(estiloId))
  }
  if (marcaId) {
    rows = rows.filter(r => r.marca_id === Number(marcaId))
  }
  if (lineasIds.length > 0) {
    rows = rows.filter(r => lineasIds.includes(r.linea_id))
  }
  if (tiposIds.length > 0) {
    rows = rows.filter(r => r.tipo_1_id && tiposIds.includes(r.tipo_1_id))
  }
  if (coloresFiltro.length > 0) {
    rows = rows.filter(r => coloresFiltro.includes(r.descp_color))
  }
  if (etasSel.length > 0) {
    rows = rows.filter(r => {
      const etaFecha = r.eta?.slice(0, 10)
      return etaFecha && etasSel.includes(etaFecha)
    })
  }

  const productos = agruparTarjetasCatalogo(rows, BUCKET, cajasDisponiblesDeFila)
  const filasVista = rawRows.length
  const filasConCajas = rows.filter(r => cajasDisponiblesDeFila(r) > 0).length
  // Limpiar colores: descartar null/undefined/empty y trimear para evitar
  // duplicados visuales (ej. "NEGRO" vs "NEGRO ") y `key={null}` en el dropdown.
  const todosColores = Array.from(
    new Set(
      allRows
        .map(r => (typeof r.descp_color === 'string' ? r.descp_color.trim() : ''))
        .filter((c): c is string => c.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

  // Opciones ETA: fechas únicas ordenadas cronológicamente
  const todasEtas = Array.from(
    new Set(
      allRows
        .map(r => r.eta?.slice(0, 10))
        .filter((e): e is string => !!e)
    )
  )
    .sort()
    .map(isoFecha => ({
      id: isoFecha,
      label: formatearEtaLabel(isoFecha)
    }))

  const pps = Array.from(
    new Map(rows.map(r => [r.pp_nro, { nro: r.pp_nro, eta: r.eta }])).values()
  ).sort((a, b) => a.nro.localeCompare(b.nro))

  const totalPares = rows.reduce((s, r) => s + r.cantidad_pares, 0)

  return (
    <div>
      <FiltrosCatalogo
        estilos={todosEstilos}
        marcas={todasMarcas}
        lineas={todasLineas}
        tipos={todosTipos}
        colores={todosColores}
        etas={todasEtas}
        totalModelos={productos.length}
        totalPares={totalPares}
      />
      {productos.length === 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold mb-1">Catálogo vacío — diagnóstico rápido</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Filas en <code className="text-xs">v_stock_rimec</code>: <strong>{filasVista}</strong></li>
            <li>Tras filtros URL: <strong>{rows.length}</strong> · con cajas &gt; 0: <strong>{filasConCajas}</strong> · tarjetas: <strong>{productos.length}</strong></li>
            <li>App catálogo: <strong>http://localhost:3001</strong> (no :3000)</li>
            {error && <li>Supabase: {error.message}</li>}
            {filasVista === 0 && (
              <li>
                Si la vista está en 0: ejecutar migración{' '}
                <code className="text-xs">061_fix_v_stock_rimec_estados_catalogo.sql</code> en Supabase.
                Los PP deben estar <strong>ABIERTO</strong> o <strong>ENVIADO</strong> (no solo «aprobado»).
              </li>
            )}
            {etasSel.length > 0 && filasVista > 0 && productos.length === 0 && (
              <li>Probá quitar filtro ETA en la URL (<code className="text-xs">eta_fechas</code>).</li>
            )}
          </ul>
        </div>
      )}
      <CatalogoGrid productos={productos} pps={pps} />
    </div>
  )
}
