import { supabase } from '@/lib/supabase'
import { CatalogoGrid } from './CatalogoGrid'
import { FiltrosCatalogo } from './components/FiltrosCatalogo'
import { getFiltros } from '@/lib/filtros'

export const revalidate = 60

export interface StockRow {
  det_id:               number
  pp_id:                number
  pp_nro:               string
  proforma:             string
  eta:                  string | null
  marca:                string
  linea_codigo:         string
  referencia_codigo:    string
  nombre:               string
  material_code:        string
  material_descripcion: string
  color_code:           string
  color_nombre:         string
  grades_json:          Record<string, number> | null
  cantidad_cajas:       number
  cantidad_pares:       number
  pares_por_caja:       number
  pares_vendidos:       number
  pares_disponibles:    number
  cajas_disponibles:    number
  lpn:                  number | null
  lpc02:                number | null
  lpc03:                number | null
  lpc04:                number | null
  estilo:               string
  tipo_1:               string | null
}

const BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos`

function agruparProductos(items: StockRow[]) {
  const prodMap = new Map<string, any>()

  for (const item of items) {
    const prodKey = `${item.linea_codigo}-${item.referencia_codigo}-${item.material_code}`

    if (!prodMap.has(prodKey)) {
      prodMap.set(prodKey, {
        key:                  prodKey,
        linea_codigo:         item.linea_codigo,
        referencia_codigo:    item.referencia_codigo,
        nombre:               item.nombre,
        material_code:        item.material_code,
        material_descripcion: item.material_descripcion,
        marca:                item.marca,
        estilo:               item.estilo,
        variantes:            [],
      })
    }
    
    // Generar gradas_fmt a partir de grades_json
    let gradas_fmt = ""
    if (item.grades_json) {
      const g = item.grades_json
      const keys = Object.keys(g).sort((a,b) => parseFloat(a.split('/')[0]) - parseFloat(b.split('/')[0]))
      if (keys.length > 0) {
        gradas_fmt = `${keys[0]}(${keys.map(k => g[k]).join('-')})${keys[keys.length-1]}`
      }
    }

    prodMap.get(prodKey)!.variantes.push({
      det_id:         item.det_id,
      pp_id:          item.pp_id,
      pp_nro:         item.pp_nro,
      eta:            item.eta,
      material_code:  item.material_code,
      color_code:     item.color_code,
      color_nombre:   item.color_nombre,
      gradas_fmt:     gradas_fmt,
      imagen_url:     `${BUCKET}/${item.linea_codigo}-${item.referencia_codigo}-${item.material_code}-${item.color_code}.jpg`,
      cantidad_cajas: item.cantidad_cajas,
      pares_por_caja: item.pares_por_caja,
      cajas_disponibles: item.cajas_disponibles,
      lpn:            item.lpn,
      lpc02:          item.lpc02,
      lpc03:          item.lpc03,
      lpc04:          item.lpc04,
    })
  }

  return Array.from(prodMap.values())
}

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ linea?: string; marca?: string; tipo?: string; colores?: string }>
}) {
  const params = await searchParams
  const estiloFiltro  = params.linea   ?? '' // 'linea' param now mapped to 'estilo' bubbles
  const marcaFiltro   = params.marca   ?? ''
  const lineasFiltro  = params.lineas ? params.lineas.split(',').filter(Boolean) : []
  const tiposFiltro   = params.tipo   ? params.tipo.split(',').filter(Boolean) : []
  const coloresFiltro = params.colores ? params.colores.split(',').filter(Boolean) : []

  const { data, error } = await supabase
    .from('v_stock_rimec')
    .select('*')
    .order('marca')
    .order('linea_codigo')
    .order('referencia_codigo')

  if (error) console.error('[rimec-web]', error.message)

  const allRows = (data ?? []) as StockRow[]

  // Obtener filtros con mapas FK ANTES de filtrar
  const filtros = await getFiltros()
  const todasLineas = filtros?.todasLineas || []
  const todasMarcas = filtros?.todasMarcas || []
  const todosEstilos = filtros?.todosEstilos || []
  const todosTipos = filtros?.todosTipos || []

  let rows = [...allRows]

  // Aplicar filtros usando FK (mapas texto → lineas)
  if (estiloFiltro && filtros?.estiloLineasMap[estiloFiltro]) {
    const lineasValidas = new Set(filtros.estiloLineasMap[estiloFiltro])
    rows = rows.filter(r => lineasValidas.has(r.linea_codigo))
  }
  if (marcaFiltro && filtros?.marcaLineasMap[marcaFiltro]) {
    const lineasValidas = new Set(filtros.marcaLineasMap[marcaFiltro])
    rows = rows.filter(r => lineasValidas.has(r.linea_codigo))
  }
  if (lineasFiltro.length > 0) {
    rows = rows.filter(r => lineasFiltro.includes(r.linea_codigo))
  }
  if (tiposFiltro.length > 0 && filtros?.tipoLineasMap) {
    const lineasValidas = new Set<string>()
    tiposFiltro.forEach(tipo => {
      if (filtros.tipoLineasMap[tipo]) {
        filtros.tipoLineasMap[tipo].forEach(l => lineasValidas.add(l))
      }
    })
    rows = rows.filter(r => lineasValidas.has(r.linea_codigo))
  }
  if (coloresFiltro.length > 0) {
    rows = rows.filter(r => coloresFiltro.includes(r.color_nombre))
  }

  const productos = agruparProductos(rows)

  const todosColores = Array.from(new Set(allRows.map(r => r.color_nombre))).sort()

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
      <CatalogoGrid productos={productos} marcas={todasMarcas} pps={pps} />
    </div>
  )
}
