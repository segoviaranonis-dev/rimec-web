import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { agruparTarjetasCatalogo } from '../lib/agruparTarjetasCatalogo.ts'
import { cajasDisponiblesDeFila } from '../lib/disponibilidad.ts'
import { applyMemoryFilters, applySqlFiltersToQuery } from '../lib/catalogoFilters.ts'

const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()
const key = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)[1].trim()
const sb = createClient(url, key)

const t0 = Date.now()
const { data, error } = await applySqlFiltersToQuery(
  sb.from('v_stock_rimec').select('*').gt('cajas_disponibles', 0),
  { grupo_estilo_id: '', marca_id: '', linea_ids: [], tipo_ids: [], colores: [], quincenas: [] },
)
  .order('det_id')
  .range(0, 199)

if (error) {
  console.error('FAIL query', error.message, `${Date.now() - t0}ms`)
  process.exit(1)
}

const filtered = applyMemoryFilters(data ?? [], {
  grupo_estilo_id: '', marca_id: '', linea_ids: [], tipo_ids: [], colores: [], quincenas: [],
})
const tarjetas = agruparTarjetasCatalogo(filtered, '', cajasDisponiblesDeFila)
const ms = Date.now() - t0
console.log('tarjetas', tarjetas.length, `${ms}ms`, 'filas', data?.length)
if (tarjetas[0]) {
  const t = tarjetas[0]
  console.log('sample', t.descp_marca, `${t.linea_codigo}-${t.referencia_codigo}`, 'col', t.variantes.length)
}
process.exit(tarjetas.length > 0 ? 0 : 1)
