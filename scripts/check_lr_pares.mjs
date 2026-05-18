import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const dir = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(join(dir, '..', '.env.local'), 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
const sb = createClient(url, key)

const pares = [
  ['1214', '1073'],
  ['1214', '1075'],
  ['1388', '500'],
]

async function main() {
  const { data: lineas } = await sb
    .from('linea')
    .select('id, codigo_proveedor, grupo_estilo_id')
    .in('codigo_proveedor', [1214, 1388])

  console.log('=== LINEAS ===')
  console.table(lineas)

  const lineaIds = (lineas ?? []).map(l => l.id)

  const { data: refs } = await sb
    .from('referencia')
    .select('id, linea_id, codigo_proveedor')
    .in('linea_id', lineaIds)
    .in('codigo_proveedor', [1073, 1075, 500])

  console.log('\n=== REFERENCIAS ===')
  console.table(refs)

  if (lineaIds.length) {
    const { data: lr } = await sb
      .from('linea_referencia')
      .select(
        'linea_id, referencia_id, grupo_estilo_id, tipo_1_id, descp_grupo_estilo, descp_tipo_1',
      )
      .in('linea_id', lineaIds)

    console.log('\n=== LINEA_REFERENCIA (por linea_id real) ===')
    for (const [lc, rc] of pares) {
      const l = lineas?.find(x => String(x.codigo_proveedor) === lc)
      const r = refs?.find(x => String(x.codigo_proveedor) === rc && x.linea_id === l?.id)
      const row = lr?.find(x => x.linea_id === l?.id && x.referencia_id === r?.id)
      console.log(`\n${lc}/${rc} → linea_id=${l?.id} ref_id=${r?.id}`)
      console.log(row ?? '(sin fila lr)')
    }

    // join erróneo vista: linea_id=1214
    const { data: lrBug } = await sb
      .from('linea_referencia')
      .select('*')
      .or('and(linea_id.eq.1214,referencia_id.eq.1073),and(linea_id.eq.1214,referencia_id.eq.1075),and(linea_id.eq.1388,referencia_id.eq.500)')

    console.log('\n=== LR join vista (linea_id=codigo) ===')
    console.table(lrBug)
  }

  const { data: stock } = await sb
    .from('v_stock_rimec')
    .select(
      'linea_codigo,referencia_codigo,linea_id,referencia_id,grupo_estilo_id,descp_grupo_estilo,tipo_1_id,descp_tipo_1',
    )
    .in('linea_codigo', ['1214', '1388'])
    .in('referencia_codigo', ['1073', '1075', '500'])

  console.log('\n=== V_STOCK_RIMEC ===')
  const seen = new Set()
  for (const row of stock ?? []) {
    const k = `${row.linea_codigo}-${row.referencia_codigo}`
    if (seen.has(k)) continue
    seen.add(k)
    if (pares.some(([a, b]) => row.linea_codigo === a && row.referencia_codigo === b)) {
      console.log(k, row)
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
