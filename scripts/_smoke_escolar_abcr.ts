/**
 * Smoke local AB-CR ESCOLAR — meta chip + filtro memoria + muestra PE.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { mergePeAbcrTipo1Items, rowMatchesPeAbcrTipo1 } from '../lib/filtros/pe-abcr-tipo1'
import { PE_TIPO1_ESCOLAR_ID } from '../lib/filtros/pe-modulo-escolar'
import {
  applyMemoryFilters,
  parseCatalogoFiltersFromSearchParams,
} from '../lib/catalogoFilters'
import type { StockRow } from '../app/catalogo-types'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const items = mergePeAbcrTipo1Items([
    { id: 1, label: 'ABIERTO' },
    { id: 2, label: 'CERRADO' },
    { id: 3, label: 'INVIERNO' },
  ])
  const labels = items.map((i) => i.label)
  console.log('SIDEBAR', labels.join('|'))
  console.log('HAS_ESCOLAR', labels.includes('ESCOLAR'), 'ID', PE_TIPO1_ESCOLAR_ID)

  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await sb
    .from('v_stock_pe_rimec')
    .select(
      'tipo_1_id,descp_tipo_1,sdrm_tipo1,cod_grupo,descp_marca,linea_codigo,cajas_disponibles,es_liquidacion,es_promo,cadena_comercial,sdrm_marca',
    )
    .gt('cajas_disponibles', 0)
    .or('cod_grupo.eq.0502080000,cod_grupo.eq.0602080000,sdrm_tipo1.ilike.ESCOLAR')
    .limit(500)

  if (error) throw error
  const rows = ((data ?? []) as StockRow[]).map((r) => ({
    ...r,
    origen_tipo: 'PRONTA_ENTREGA',
  }))
  const escolarRows = rows.filter((r) =>
    rowMatchesPeAbcrTipo1(
      {
        tipo_1_id: r.tipo_1_id,
        descp_tipo_1: r.descp_tipo_1,
        sdrm_tipo1: r.sdrm_tipo1,
        marca: r.descp_marca,
        sdrm_marca: r.sdrm_marca,
        cod_grupo: r.cod_grupo,
        linea_codigo: r.linea_codigo,
      },
      [PE_TIPO1_ESCOLAR_ID],
    ),
  )
  console.log('PE_ESCOLAR_ROWS', escolarRows.length)

  const decoy: StockRow = {
    ...rows[0],
    descp_marca: 'DECOY_CERRADO',
    sdrm_tipo1: 'CERRADO',
    cod_grupo: '0502010000',
    tipo_1_id: 2,
    origen_tipo: 'PRONTA_ENTREGA',
  } as StockRow

  const sp = new URLSearchParams(
    'origen_tipo=PRONTA_ENTREGA&ramo_tipo=CALZADO&tipo_ids=-8',
  )
  const f = parseCatalogoFiltersFromSearchParams(sp)
  const mem = applyMemoryFilters([...escolarRows, decoy], f)
  console.log('MEM_FILTER_ESCOLAR', mem.length)
  console.log('DECOY_EXCLUIDO', !mem.some((r) => r.descp_marca === 'DECOY_CERRADO'))
  console.log(
    'SAMPLE',
    mem.slice(0, 5).map((r) => `${r.descp_marca}|${r.cod_grupo}|${r.sdrm_tipo1}`).join(' ;; '),
  )
  if (!labels.includes('ESCOLAR') || escolarRows.length === 0 || mem.length === 0) {
    throw new Error('FAIL_ESCOLAR_ABCR')
  }
  console.log('PASS_ESCOLAR_ABCR')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
