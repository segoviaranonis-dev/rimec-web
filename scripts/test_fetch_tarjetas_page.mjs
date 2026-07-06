import fs from 'fs'

// Cargar env antes de importar supabase
const envText = fs.readFileSync('.env.local', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const { fetchTarjetasPage } = await import('../lib/catalogoPaginado.ts')

const t0 = Date.now()
const r = await fetchTarjetasPage({
  filters: {
    grupo_estilo_id: '',
    marca_id: '',
    linea_ids: [],
    tipo_ids: [],
    colores: [],
    quincenas: [],
  },
  rowFrom: 0,
  excludeCardKeys: [],
  limit: 30,
})
const ms = Date.now() - t0
console.log('fetchTarjetasPage', r.tarjetas.length, 'hasMore', r.hasMore, `${ms}ms`)
if (r.tarjetas[0]) {
  const t = r.tarjetas[0]
  console.log('sample', t.origen_tipo, t.descp_marca, `${t.linea_codigo}-${t.referencia_codigo}`, 'vars', t.variantes.length)
}
process.exit(r.tarjetas.length >= 30 ? 0 : 1)
