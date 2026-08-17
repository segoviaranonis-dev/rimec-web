/**
 * Auditoría herramienta de venta — 100% cardKey
 * Combos: MODARE×LIQ · MODARE×LIQ×CERRADO · 3 marcas×LIQ
 */
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '')
}
process.env.NEXT_PUBLIC_SUPABASE_URL = get('NEXT_PUBLIC_SUPABASE_URL') || ''
process.env.SUPABASE_SERVICE_ROLE_KEY = get('SUPABASE_SERVICE_ROLE_KEY') || ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY') || ''

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { parseCatalogoFiltersFromSearchParams, applyMemoryFilters } = await import(
    '../lib/catalogoFilters'
  )
  const { fetchTarjetasPage } = await import('../lib/catalogoPaginado')
  const { agruparTarjetasCatalogo } = await import('../lib/agruparTarjetasCatalogo')
  const { fusionarTarjetasPorSku } = await import('../lib/fusionTarjetasCatalogo')
  const { cajasDisponiblesDeFila } = await import('../lib/disponibilidad')
  const { enrichCatalogoRows } = await import('../lib/catalogoEnrich')
  const { resolveSupabaseUrl } = await import('../lib/supabaseEnv')
  const { cadenaComercialDesdeCodGrupo } = await import('../lib/pilares/codGrupoCadena')
  type StockRow = import('../app/catalogo-types').StockRow

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const bucket = `${resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}/storage/v1/object/public/productos`

  async function fetchAllPe(marcaIds: number[]) {
    const { data, error } = await sb
      .from('v_stock_pe_rimec')
      .select('*')
      .in('marca_id', marcaIds)
      .gt('cajas_disponibles', 0)
      .limit(5000)
    if (error) throw error
    return (data ?? []) as StockRow[]
  }

  function isLiq(r: StockRow) {
    const cad = cadenaComercialDesdeCodGrupo(String((r as { cod_grupo?: string }).cod_grupo || ''))
    return (
      r.es_liquidacion === true ||
      String(r.cadena_comercial || '').toUpperCase() === 'LIQUIDACION' ||
      cad === 'LIQUIDACION'
    )
  }

  function isCerrado(r: StockRow) {
    const g = String((r as { cod_grupo?: string }).cod_grupo || '').replace(/\D/g, '').padStart(10, '0')
    const t1 = String(r.descp_tipo_1 || '').toUpperCase()
    return g.slice(2, 4) === '02' || t1.includes('CERRADO')
  }

  async function verdadCards(filtersQs: Record<string, string>, marcaIds: number[]) {
    const f = parseCatalogoFiltersFromSearchParams(new URLSearchParams(filtersQs))
    let rows = (await fetchAllPe(marcaIds)).filter(isLiq)
    if (f.tipo_ids?.length) {
      const ids = new Set(f.tipo_ids.filter((id) => id > 0))
      rows = rows.filter((r) => ids.has(Number(r.tipo_1_id)))
    }
    const enriched = await enrichCatalogoRows(rows)
    const mem = applyMemoryFilters(enriched, f)
    const cards = agruparTarjetasCatalogo(mem, bucket, cajasDisponiblesDeFila)
    const fused = fusionarTarjetasPorSku(cards)
    return { f, rows: mem, cards, fused }
  }

  async function apiAllCards(f: ReturnType<typeof parseCatalogoFiltersFromSearchParams>) {
    const keys = new Map<string, { marca: string; linea: string; colores: number }>()
    let exclude: string[] = []
    let rowFrom = 0
    let hasMore = true
    let pages = 0
    while (hasMore && pages < 40) {
      pages++
      const page = await fetchTarjetasPage({
        filters: f,
        rowFrom,
        excludeCardKeys: exclude,
        limit: 30,
        quick: true,
      })
      for (const t of page.tarjetas) {
        const row = t as {
          cardKey?: string
          descp_marca?: string
          linea_codigo?: string
          variantes?: unknown[]
        }
        const ck = String(row.cardKey || '')
        if (!ck || keys.has(ck)) continue
        keys.set(ck, {
          marca: String(row.descp_marca || '?'),
          linea: String(row.linea_codigo || ''),
          colores: Array.isArray(row.variantes) ? row.variantes.length : 0,
        })
      }
      exclude = page.excludeCardKeys
      rowFrom = page.nextRowFrom
      hasMore = page.hasMore
      if (!page.tarjetas.length) break
    }
    const sorted = await fetchTarjetasPage({
      filters: f,
      rowFrom: 0,
      excludeCardKeys: [],
      limit: 500,
      quick: false,
    })
    const sortedKeys = new Set(
      sorted.tarjetas.map((t) => String((t as { cardKey?: string }).cardKey || '')).filter(Boolean),
    )
    return { quick: keys, sortedKeys, pages }
  }

  function report(
    label: string,
    truth: Awaited<ReturnType<typeof verdadCards>>,
    api: Awaited<ReturnType<typeof apiAllCards>>,
  ) {
    const truthKeys = new Set(truth.fused.map((c) => c.cardKey))
    const apiKeys = new Set(api.quick.keys())
    const missing = [...truthKeys].filter((k) => !apiKeys.has(k))
    const extra = [...apiKeys].filter((k) => !truthKeys.has(k))
    const byMarca: Record<string, number> = {}
    for (const v of api.quick.values()) byMarca[v.marca] = (byMarca[v.marca] || 0) + 1

    // SKU L:R:M
    const skuTruth = new Set(
      truth.rows.map(
        (r) => `${r.linea_id}:${r.referencia_id}:${String(r.material_code || '').trim()}`,
      ),
    )

    console.log(`\n########## ${label} ##########`)
    console.log('filas PE', truth.rows.length)
    console.log('SKU L:R:M', skuTruth.size)
    console.log('tarjetas agrupar', truth.cards.length, 'fusionadas', truth.fused.length)
    console.log('API quick cardKeys', apiKeys.size, byMarca, 'pages', api.pages)
    console.log('API sorted cardKeys', api.sortedKeys.size)
    console.log('MISSING en API', missing.length, missing.slice(0, 8))
    console.log('EXTRA en API', extra.length, extra.slice(0, 8))

    // colores por tarjeta verdad
    const coloresTot = truth.rows.length
    const coloresApi = [...api.quick.values()].reduce((a, v) => a + v.colores, 0)
    console.log('filas/colores verdad', coloresTot, 'suma variantes API', coloresApi)

    const pass =
      missing.length === 0 &&
      apiKeys.size === truthKeys.size &&
      api.sortedKeys.size === truthKeys.size
    console.log(pass ? '✅ PASS 100% cardKey' : '❌ FAIL')
    return { pass, missing, truthKeys, apiKeys, skuTruth }
  }

  // A MODARE LIQ
  {
    const qs = {
      ramo_tipo: 'CALZADO',
      origen_tipo: 'TODOS',
      marca_ids: '3',
      tipo_grupos: 'liquidacion',
    }
    const t = await verdadCards(qs, [3])
    const a = await apiAllCards(t.f)
    report('A MODARE × LIQUIDACION (grupo uno)', t, a)
    console.log(
      'detalle SKU MODARE LIQ',
      [...new Set(t.rows.map((r) => `${r.linea_codigo}-${r.referencia_codigo}-${r.material_code} · ${r.descp_tipo_1}`))].sort(),
    )
  }

  // B MODARE LIQ CERRADO
  {
    const qs = {
      ramo_tipo: 'CALZADO',
      origen_tipo: 'TODOS',
      marca_ids: '3',
      tipo_grupos: 'liquidacion',
      tipo_ids: '2',
    }
    const t = await verdadCards(qs, [3])
    // forzar solo cerrado por si tipo_ids falla
    t.rows = t.rows.filter(isCerrado)
    const cards = agruparTarjetasCatalogo(t.rows, bucket, cajasDisponiblesDeFila)
    t.cards = cards
    t.fused = fusionarTarjetasPorSku(cards)
    const a = await apiAllCards(t.f)
    const r = report('B MODARE × LIQUIDACION × CERRADO', t, a)
    console.log(
      'CSV esperaba 5 arts / 3 SKU (2 colores×2 + 1). SKU verdad',
      r.skuTruth.size,
    )
    console.log(
      'detalle CERRADO',
      [...new Set(t.rows.map((r) => `${r.linea_codigo}-${r.referencia_codigo}-${r.material_code} · cols=${r.color_code}`))].sort(),
    )
  }

  // C 3 marcas LIQ
  {
    const qs = {
      ramo_tipo: 'CALZADO',
      origen_tipo: 'TODOS',
      marca_ids: '8,9,3',
      tipo_grupos: 'liquidacion',
    }
    const t = await verdadCards(qs, [8, 9, 3])
    const a = await apiAllCards(t.f)
    report('C BR+CHINELO+MODARE × LIQUIDACION', t, a)
  }

  // Facetas sidebar LÍNEA count
  console.log('\n########## D FACETA LÍNEA (meta acotar) ##########')
  const { fetchCatalogoMetaViaRpcCascada, acotarMetaRpcDesdeFilas } = await import(
    '../lib/catalogoMetaRpc'
  )
  const fC = parseCatalogoFiltersFromSearchParams(
    new URLSearchParams({
      ramo_tipo: 'CALZADO',
      origen_tipo: 'TODOS',
      marca_ids: '8,9,3',
      tipo_grupos: 'liquidacion',
    }),
  )
  const rpc = await fetchCatalogoMetaViaRpcCascada(fC)
  const pe = (await fetchAllPe([8, 9, 3])).filter(isLiq)
  const en = await enrichCatalogoRows(pe)
  const mem = applyMemoryFilters(en, fC)
  const acot = acotarMetaRpcDesdeFilas(rpc!, mem, 'CALZADO')
  console.log('LÍNEA acotada', acot.lineas.length, 'marcas', acot.marcas.map((m) => m.label).join(','))
  console.log(
    'esperado líneas distintas en filas',
    new Set(mem.map((r) => r.linea_id)).size,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
