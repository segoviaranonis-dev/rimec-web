import { supabase } from '@/lib/supabase'
import { CatalogoGrid } from './CatalogoGrid'
import { FiltrosCatalogo } from './components/FiltrosCatalogo'
import { getFiltros } from '@/lib/filtros'
import { cargarAtributosDesdePilar, enriquecerMetaConPilar } from '@/lib/atributosLinea'

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
}

const BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos`

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

function agruparProductos(items: StockRow[]) {
  const prodMap = new Map<string, any>()
  const detIdsPorProd = new Map<string, Set<number>>()

  for (const item of items) {
    const cajasDisp = cajasDisponiblesDeFila(item)
    if (cajasDisp <= 0) continue

    const prodKey = `${item.linea_id}-${item.referencia_id}-${item.material_code}`

    if (!prodMap.has(prodKey)) {
      prodMap.set(prodKey, {
        key:                  prodKey,
        linea_id:             item.linea_id,
        linea_codigo:         item.linea_codigo,
        referencia_id:        item.referencia_id,
        referencia_codigo:    item.referencia_codigo,
        nombre:               item.nombre,
        material_code:        item.material_code,
        descp_material:       item.descp_material,
        descp_marca:          item.descp_marca,
        marca_id:             item.marca_id,
        descp_caso:           item.descp_caso,
        caso_id:              item.caso_id,
        descp_grupo_estilo:   item.descp_grupo_estilo,
        variantes:            [],
      })
      detIdsPorProd.set(prodKey, new Set())
    }

    const seen = detIdsPorProd.get(prodKey)!
    if (seen.has(item.det_id)) continue
    seen.add(item.det_id)

    let gradas_fmt = ""
    if (item.grades_json) {
      const g = item.grades_json
      const keys = Object.keys(g).sort((a,b) => parseFloat(a.split('/')[0]) - parseFloat(b.split('/')[0]))
      if (keys.length > 0) {
        gradas_fmt = `${keys[0]}(${keys.map(k => g[k]).join('-')})${keys[keys.length-1]}`
      }
    }

    prodMap.get(prodKey)!.variantes.push({
      det_id:            item.det_id,
      pp_id:             item.pp_id,
      pp_nro:            item.pp_nro,
      eta:               item.eta,
      material_code:     item.material_code,
      color_code:        item.color_code,
      descp_color:       item.descp_color,
      color_hex:         item.color_hex,
      gradas_fmt,
      imagen_url:        item.imagen_url
                         ?? `${BUCKET}/${item.linea_codigo}-${item.referencia_codigo}-${item.material_code}-${item.color_code}.jpg`,
      cantidad_cajas:    item.cantidad_cajas,
      pares_por_caja:    item.pares_por_caja,
      cajas_disponibles: cajasDisp,
      lpn:               item.lpn,
      lpc02:             item.lpc02,
      lpc03:             item.lpc03,
      lpc04:             item.lpc04,
    })
  }

  return Array.from(prodMap.values()).filter(p => p.variantes.length > 0)
}

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ grupo_estilo_id?: string; marca_id?: string; linea_ids?: string; tipo_ids?: string; colores?: string }>
}) {
  const params = await searchParams
  const estiloId  = params.grupo_estilo_id ?? ''
  const marcaId   = params.marca_id  ?? ''
  const lineasIds = params.linea_ids ? params.linea_ids.split(',').filter(Boolean).map(Number) : []
  const tiposIds  = params.tipo_ids  ? params.tipo_ids.split(',').filter(Boolean).map(Number) : []
  const coloresFiltro = params.colores ? params.colores.split(',').filter(Boolean) : []

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

  const productos = agruparProductos(rows)
  // Limpiar colores: descartar null/undefined/empty y trimear para evitar
  // duplicados visuales (ej. "NEGRO" vs "NEGRO ") y `key={null}` en el dropdown.
  const todosColores = Array.from(
    new Set(
      allRows
        .map(r => (typeof r.descp_color === 'string' ? r.descp_color.trim() : ''))
        .filter((c): c is string => c.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

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
        totalModelos={productos.length}
        totalPares={totalPares}
      />
      <CatalogoGrid productos={productos} pps={pps} />
    </div>
  )
}
