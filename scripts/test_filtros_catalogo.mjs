/**
 * Verifica meta de filtros catálogo (875 filas CP post-MIG-138).
 * Uso: node scripts/test_filtros_catalogo.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
const key = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim()
if (!url || !key) {
  console.error('FAIL: falta NEXT_PUBLIC_SUPABASE_URL o ANON_KEY en .env.local')
  process.exit(1)
}

const sb = createClient(url, key)

function buildFiltros(rows) {
  const lineas = new Map()
  const marcas = new Map()
  const estilos = new Map()
  const tipos = new Map()
  for (const r of rows) {
    if (r.linea_id) lineas.set(r.linea_id, r.linea_codigo || `Línea ${r.linea_id}`)
    if (r.marca_id) marcas.set(r.marca_id, r.descp_marca || `Marca ${r.marca_id}`)
    if (r.grupo_estilo_id) estilos.set(r.grupo_estilo_id, r.descp_grupo_estilo || `Estilo ${r.grupo_estilo_id}`)
    if (r.tipo_1_id) tipos.set(r.tipo_1_id, r.descp_tipo_1 || `Tipo ${r.tipo_1_id}`)
  }
  return { lineas: lineas.size, marcas: marcas.size, estilos: estilos.size, tipos: tipos.size }
}

function buildQuincenas(rows) {
  return new Map(
    rows.filter(r => r.quincena_arribo_id && r.quincena_desc).map(r => [r.quincena_arribo_id, r.quincena_desc]),
  ).size
}

const t0 = Date.now()
const { data, error } = await sb
  .from('v_stock_rimec')
  .select(
    'marca_id, descp_marca, linea_id, linea_codigo, grupo_estilo_id, descp_grupo_estilo, tipo_1_id, descp_tipo_1, descp_color, origen_tipo, quincena_desc, quincena_arribo_id, cajas_disponibles',
  )
  .gt('cajas_disponibles', 0)
  .eq('origen_tipo', 'TRÁNSITO_PP')
  .range(0, 999)

const ms = Date.now() - t0
if (error) {
  console.error('FAIL query', error.message, `${ms}ms`)
  process.exit(1)
}

const rows = data ?? []
const f = buildFiltros(rows)
const q = buildQuincenas(rows)

console.log('OK  filas CP', rows.length, `${ms}ms`)
console.log('    marcas', f.marcas, '| estilos', f.estilos, '| lineas', f.lineas, '| tipos', f.tipos)
console.log('    quincenas', q, '(esperado 5)')

const ids = [...new Set(rows.map(r => r.linea_id))]
const { data: lineas, error: errL } = await sb
  .from('linea')
  .select('id, genero(codigo)')
  .in('id', ids.slice(0, 500))

const sec = { DAMAS: 0, NINAS: 0, NINOS: 0, CABALLEROS: 0 }
for (const l of lineas ?? []) {
  const c = l.genero?.codigo
  if (c && sec[c] !== undefined) sec[c]++
}

if (errL) console.warn('WARN linea pilar', errL.message)
else console.log('    header géneros (muestra)', JSON.stringify(sec))

const pass = rows.length >= 800 && f.marcas >= 5 && q === 5
console.log(pass ? '\nPASS filtros catálogo' : '\nFAIL revisar vista v_stock_rimec / MIG-138')
process.exit(pass ? 0 : 1)
