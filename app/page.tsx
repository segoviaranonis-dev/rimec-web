import { supabase } from '@/lib/supabase'
import { CatalogoGrid } from './CatalogoGrid'
import { FiltrosCatalogo } from './components/FiltrosCatalogo'
import { getFiltros } from '@/lib/filtros'
import {
  cargarAtributosDesdePilar,
  cargarMetaLineasDesdePilar,
  enriquecerMetaConLinea,
  enriquecerMetaConPilar,
} from '@/lib/atributosLinea'
import { agruparTarjetasCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { resolveSupabaseUrl } from '@/lib/supabaseEnv'
import { cajasDisponiblesDeFila, paresDisponiblesDeFila } from '@/lib/disponibilidad'
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
  if (quincenasSel.length > 0) {
    rows = rows.filter(r => r.quincena_arribo_id && quincenasSel.includes(r.quincena_arribo_id))
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

  // Opciones de Llegada: quincenas únicas ordenadas
  const todasQuincenas = Array.from(
    new Map(
      allRows
        .filter(r => r.quincena_arribo_id && r.quincena_desc)
        .map(r => [r.quincena_arribo_id, { id: r.quincena_arribo_id!, label: r.quincena_desc! }])
    ).values()
  ).sort((a, b) => a.id - b.id)

  const pps = Array.from(
    new Map(rows.map(r => [r.pp_nro, { nro: r.pp_nro }])).values()
  ).sort((a, b) => a.nro.localeCompare(b.nro))

  const totalPares = rows.reduce((s, r) => s + paresDisponiblesDeFila(r), 0)

  return (
    <div>
      <FiltrosCatalogo
        estilos={todosEstilos}
        marcas={todasMarcas}
        lineas={todasLineas}
        tipos={todosTipos}
        colores={todosColores}
        quincenas={todasQuincenas}
        totalModelos={productos.length}
        totalPares={totalPares}
      />
      {productos.length === 0 && process.env.NODE_ENV === 'development' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold mb-1">Catálogo vacío — diagnóstico rápido (DEV)</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Filas en <code className="text-xs">v_stock_rimec</code>: <strong>{filasVista}</strong></li>
            <li>Tras filtros URL: <strong>{rows.length}</strong> · con cajas &gt; 0: <strong>{filasConCajas}</strong> · tarjetas: <strong>{productos.length}</strong></li>
            <li>App catálogo: <strong>http://localhost:3001</strong> (no :3000)</li>
            {error && (
              <li>
                Supabase: {error.message}
                {error.message.includes('invalid header value') && (
                  <span className="block mt-1 text-xs">
                    La clave ANON llegó duplicada en el entorno (no en el código). Revisá{' '}
                    <code className="text-xs">rimec-web/.env.local</code>: una sola línea{' '}
                    <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...</code> sin repetir el nombre.
                    Reiniciá <code className="text-xs">npm run dev</code>. Si persiste, borrá la variable en Windows
                    (Variables de entorno del usuario).
                  </span>
                )}
              </li>
            )}
            {filasVista === 0 && (
              <li>
                Si la vista está en 0: ejecutar migración{' '}
                <code className="text-xs">061_fix_v_stock_rimec_estados_catalogo.sql</code> en Supabase.
                Los PP deben estar <strong>ABIERTO</strong> o <strong>ENVIADO</strong> (no solo «aprobado»).
              </li>
            )}
            {quincenasSel.length > 0 && filasVista > 0 && productos.length === 0 && (
              <li>Probá quitar filtro Llegada en la URL (<code className="text-xs">quincenas</code>).</li>
            )}
          </ul>
        </div>
      )}

      {productos.length === 0 && process.env.NODE_ENV === 'production' && (
        <div className="mb-6 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <span className="mb-4 text-5xl" aria-hidden>📦</span>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Catálogo sin existencias por el momento</h2>
          <p className="mb-6 max-w-md text-sm text-slate-500">
            No hay artículos disponibles con los filtros aplicados. Probá quitar filtros o reintentá la carga.
          </p>
          <a
            href="/"
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            Reintentar
          </a>
        </div>
      )}
      <CatalogoGrid productos={productos} pps={pps} />
    </div>
  )
}
