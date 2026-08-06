/**
 * Smoke: ESCOLAR filtra en SQL PE (no barrer universo + memoria).
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { applyNonOrigenSqlFilters } from '../lib/catalogoFilters'
import { PE_TIPO1_ESCOLAR_ID } from '../lib/filtros/pe-modulo-escolar'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  const filters = {
    tipo_ids: [PE_TIPO1_ESCOLAR_ID],
    linea_ids: [] as number[],
    colores: [] as string[],
    quincenas: [] as number[],
    marca_ids: [] as number[],
    grupo_estilo_ids: [] as number[],
    origen_tipo: 'PRONTA_ENTREGA',
    ramo_tipo: 'CALZADO' as const,
  }

  let q = sb
    .from('v_stock_pe_rimec')
    .select('descp_marca,cod_grupo,sdrm_tipo1,tipo_1_id,linea_codigo,cajas_disponibles')
    .gt('cajas_disponibles', 0)
  q = applyNonOrigenSqlFilters(q, filters as any, { peView: true, allowLiquidacion: true })
  const { data, error } = await q.limit(40)
  if (error) throw error
  const rows = data ?? []
  console.log('SQL_ESCOLAR_COUNT', rows.length)
  console.log(
    'SAMPLE',
    rows
      .slice(0, 5)
      .map((r) => `${r.descp_marca}|${r.cod_grupo}|${r.sdrm_tipo1}`)
      .join(' ;; '),
  )
  const allEsc = rows.every(
    (r) =>
      String(r.sdrm_tipo1 ?? '').toUpperCase() === 'ESCOLAR' ||
      String(r.cod_grupo ?? '').slice(4, 6) === '08',
  )
  if (!rows.length || !allEsc) throw new Error('FAIL_ESCOLAR_SQL')
  console.log('PASS_ESCOLAR_SQL')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
