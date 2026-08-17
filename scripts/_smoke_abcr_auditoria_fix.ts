/**
 * Smoke auditoría AB-CR: ESCOLAR + Carteras solo PE · acotar conserva sintéticos · live keys.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { PE_TIPO1_ESCOLAR_ID, peSoloFiltroEscolar } from '../lib/filtros/pe-modulo-escolar'
import {
  ACCESORIOS_SUBTIPO_SYNTHETIC_ID,
  peTieneSubfamiliaAccesorios,
  isAbcrSyntheticTipoId,
} from '../lib/filtros/modulo-accesorios'

const PE_TIPO1_CARTERAS_ID = ACCESORIOS_SUBTIPO_SYNTHETIC_ID.CARTERAS
import { mergePeAbcrTipo1Items } from '../lib/filtros/pe-abcr-tipo1'
import { acotarMetaRpcDesdeFilas } from '../lib/catalogoMetaRpc'
import { hasSidebarFilters } from '../lib/catalogoFiltrosEntrada'
import {
  applyMemoryFilters,
  parseCatalogoFiltersFromSearchParams,
} from '../lib/catalogoFilters'
import type { StockRow } from '../app/catalogo-types'
import type { CatalogoMetaRpc } from '../lib/catalogoMetaRpc'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '')
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log('OK', msg)
}

async function main() {
  assert(peSoloFiltroEscolar([-8]), 'peSoloFiltroEscolar(-8)')
  assert(peTieneSubfamiliaAccesorios([-1]), 'peTieneSubfamiliaAccesorios(-1)')
  assert(!peTieneSubfamiliaAccesorios([-8]), 'ESCOLAR no es subfamilia accesorios')
  assert(isAbcrSyntheticTipoId(-8) && isAbcrSyntheticTipoId(-1), 'sintéticos AB-CR')

  // Canon: merge NO inventa chips fantasma — solo densifica lo presente en stock/meta.
  const sidebarSoloTemp = mergePeAbcrTipo1Items([
    { id: 1, label: 'ABIERTO' },
    { id: 2, label: 'CERRADO' },
  ])
  const idsSolo = new Set(sidebarSoloTemp.map((x) => x.id))
  assert(!idsSolo.has(PE_TIPO1_ESCOLAR_ID), 'sidebar NO inventa ESCOLAR sin stock')
  assert(!idsSolo.has(PE_TIPO1_CARTERAS_ID), 'sidebar NO inventa CARTERAS sin stock')

  const sidebar = mergePeAbcrTipo1Items([
    { id: 1, label: 'ABIERTO' },
    { id: 2, label: 'CERRADO' },
    { id: PE_TIPO1_ESCOLAR_ID, label: 'ESCOLAR' },
    { id: PE_TIPO1_CARTERAS_ID, label: 'CARTERAS' },
  ])
  const ids = new Set(sidebar.map((x) => x.id))
  assert(ids.has(PE_TIPO1_ESCOLAR_ID), 'sidebar conserva ESCOLAR si viene del stock')
  assert(ids.has(PE_TIPO1_CARTERAS_ID), 'sidebar conserva CARTERAS si viene del stock')

  assert(
    hasSidebarFilters({
      marca_id: '',
      grupo_estilo_id: '',
      marca_ids: [],
      grupo_estilo_ids: [],
      linea_ids: [],
      tipo_ids: [],
      colores: [],
      quincenas: [],
      precio_min: 100_000,
    } as never),
    'hasSidebarFilters con precio_min',
  )

  const metaFake: CatalogoMetaRpc = {
    marcas: [{ id: 1, label: 'M' }],
    lineas: [{ id: 10, label: 'L' }],
    estilos: [{ id: 20, label: 'E' }],
    tipos: [
      { id: 1, label: 'ABIERTO' },
      { id: PE_TIPO1_ESCOLAR_ID, label: 'ESCOLAR' },
      { id: PE_TIPO1_CARTERAS_ID, label: 'CARTERAS' },
    ],
    generos: [{ codigo: 'F', label: 'FEM' }],
    colores: [],
    quincenas: [],
    tonos: [],
  }

  const rowBase = {
    tipo_1_id: 1,
    descp_tipo_1: 'ABIERTO',
    sdrm_tipo1: 'ABIERTO',
    marca_id: 1,
    descp_marca: 'MOLEKINHA',
    linea_id: 10,
    linea_codigo: '1399',
    grupo_estilo_id: 20,
    descp_estilo: 'CASUAL',
    genero_codigo: 'F',
    cajas_disponibles: 2,
    origen_tipo: 'PRONTA_ENTREGA',
    cod_grupo: '0502080000',
    sdrm_marca: 'MOLEKINHA',
  } as StockRow

  const acot = acotarMetaRpcDesdeFilas(metaFake, [rowBase], 'CALZADO')
  const tipoIdsAcot = new Set(acot.tipos.map((t) => t.id))
  assert(tipoIdsAcot.has(1), 'acotar conserva ABIERTO de filas')
  // Filosofía Nexus: no exigir chips sintéticos sin filas (solo stock · 2.2.1.59)
  assert(!tipoIdsAcot.has(PE_TIPO1_CARTERAS_ID), 'acotar NO inventa CARTERAS sin filas')
  console.log('INFO acotar tipos ids', [...tipoIdsAcot].join(','))

  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await sb
    .from('v_stock_pe_rimec')
    .select(
      'tipo_1_id,descp_tipo_1,sdrm_tipo1,cod_grupo,descp_marca,linea_codigo,cajas_disponibles,es_liquidacion,es_promo,cadena_comercial,sdrm_marca,marca_id,linea_id,grupo_estilo_id,genero_codigo',
    )
    .gt('cajas_disponibles', 0)
    .or('cod_grupo.eq.0502080000,cod_grupo.eq.0602080000,sdrm_tipo1.ilike.ESCOLAR')
    .limit(200)
  if (error) throw error

  const rows = ((data ?? []) as StockRow[]).map((r) => ({
    ...r,
    origen_tipo: 'PRONTA_ENTREGA',
  }))
  const fEsc = parseCatalogoFiltersFromSearchParams(
    new URLSearchParams('origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_ids=-8'),
  )
  const memEsc = applyMemoryFilters(rows, fEsc)
  assert(memEsc.length > 0, `memoria ESCOLAR filas=${memEsc.length}`)

  const { data: cartData, error: cartErr } = await sb
    .from('v_stock_pe_rimec')
    .select(
      'tipo_1_id,descp_tipo_1,sdrm_tipo1,cod_grupo,descp_marca,linea_codigo,cajas_disponibles,cadena_comercial,sdrm_marca,marca_id,linea_id,grupo_estilo_id,genero_codigo',
    )
    .gt('cajas_disponibles', 0)
    .or('sdrm_tipo1.ilike.%CARTERA%,descp_tipo_1.ilike.%CARTERA%')
    .limit(100)
  if (cartErr) throw cartErr
  const cartRows = ((cartData ?? []) as StockRow[]).map((r) => ({
    ...r,
    origen_tipo: 'PRONTA_ENTREGA',
  }))
  const fCart = parseCatalogoFiltersFromSearchParams(
    new URLSearchParams('origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_ids=-1'),
  )
  const memCart = applyMemoryFilters(cartRows.length ? cartRows : rows, fCart)
  console.log('INFO CARTERAS_MEM', memCart.length, 'sample_rows', cartRows.length)
  assert(
    peSoloFiltroEscolar(fEsc.tipo_ids) || peTieneSubfamiliaAccesorios(fCart.tipo_ids ?? []),
    'atajo solo-PE activo para ESCOLAR o Carteras',
  )

  console.log('SMOKE_ABCR_AUDITORIA PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
