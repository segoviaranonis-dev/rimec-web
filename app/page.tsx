import { supabase } from '@/lib/supabase'
import { CatalogoGrid } from './CatalogoGrid'

export const revalidate = 60

interface StockRow {
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
}

export type { StockRow }

export default async function HomePage() {
  const { data, error } = await supabase
    .from('v_stock_rimec')
    .select('*')
    .order('marca')
    .order('linea_codigo')
    .order('referencia_codigo')

  if (error) console.error('[rimec-web]', error.message)

  const rows = (data ?? []) as StockRow[]
  const marcas = Array.from(new Set(rows.map(r => r.marca))).sort()
  const pps = Array.from(
    new Map(rows.map(r => [r.pp_nro, { nro: r.pp_nro, eta: r.eta }])).values()
  ).sort((a, b) => a.nro.localeCompare(b.nro))

  const totalPares = rows.reduce((s, r) => s + r.cantidad_pares, 0)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: '#06B6D4' }}>
          Stock Disponible
        </h1>
        <div className="flex items-center gap-4 text-sm" style={{ color: '#94A3B8' }}>
          <span style={{ color: '#06B6D4', fontWeight: 700 }}>{rows.length} referencias</span>
          <span>·</span>
          <span>{totalPares.toLocaleString('es-PY')} pares en camino</span>
        </div>
      </div>
      <CatalogoGrid rows={rows} marcas={marcas} pps={pps} />
    </div>
  )
}
