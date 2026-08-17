/** Smoke cascada meta — combinaciones CASOS / AB-CR / marca (creer ≠ saber). */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(__dirname, '../.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}

type Case = { name: string; qs: string; expectEstilosMax?: number; expectLineasMax?: number }

const CASES: Case[] = [
  { name: 'chi', qs: 'origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_grupos=chi', expectEstilosMax: 3, expectLineasMax: 20 },
  { name: 'liquidacion', qs: 'origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_grupos=liquidacion', expectEstilosMax: 15, expectLineasMax: 400 },
  { name: 'promo', qs: 'origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_grupos=promo', expectEstilosMax: 15, expectLineasMax: 400 },
  { name: 'normal', qs: 'origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_grupos=normal', expectEstilosMax: 20, expectLineasMax: 900 },
  { name: 'actual-638', qs: 'origen_tipo=TODOS&ramo_tipo=CONFECCIONES&tipo_grupos=actual', expectEstilosMax: 80, expectLineasMax: 500 },
  { name: 'landing-calzado', qs: 'origen_tipo=TODOS&ramo_tipo=CALZADO', expectEstilosMax: 20, expectLineasMax: 900 },
]

async function metaViaRouteLogic(qs: string) {
  const { parseCatalogoFiltersFromSearchParams, applyMemoryFilters, applyNonOrigenSqlFilters, applyPeCommercialSqlFilters, applyPeDepositoQuery, buildFiltrosFromRows } =
    await import('../lib/catalogoFilters')
  const { fetchCatalogoMetaViaRpcCascada, acotarMetaRpcDesdeFilas } = await import('../lib/catalogoMetaRpc')
  const { supabase } = await import('../lib/supabase')
  const { fetchCatalogoMetaRows } = await import('../lib/catalogoData')
  const { enrichCatalogoRows } = await import('../lib/catalogoEnrich')
  const { cajasDisponiblesDeFila } = await import('../lib/disponibilidad')
  const { isCatalogoOrigenTodos } = await import('../lib/catalogoFilters')

  const filters = parseCatalogoFiltersFromSearchParams(new URLSearchParams(qs))
  const rpc = await fetchCatalogoMetaViaRpcCascada(filters)
  if (!rpc) return { ok: false, reason: 'no-rpc' }

  const needScan = (filters.tipo_grupos?.length ?? 0) > 0
  if (!needScan) {
    return {
      ok: true,
      estilos: rpc.estilos.length,
      lineas: rpc.lineas.length,
      marcas: rpc.marcas.length,
      estiloLabels: rpc.estilos.map((e) => e.label),
      acotado: false,
    }
  }

  const peFilters = { ...filters, origen_tipo: 'PRONTA_ENTREGA' as const, quincenas: [] as number[] }
  const cpFilters = {
    ...filters,
    origen_tipo: 'TRÁNSITO_PP' as const,
    ramo_tipo: (filters.ramo_tipo === 'CALZADO' ? 'CALZADO' : filters.ramo_tipo || '') as any,
    deposito_codigo: '',
    cadena_comercial: '',
  }

  let rows: any[] = []
  if (isCatalogoOrigenTodos(filters) && filters.ramo_tipo === 'CONFECCIONES') {
    const peRes = await fetchCatalogoMetaRows(supabase, 'v_stock_pe_rimec', {
      applySql: (q: any) =>
        applyPeDepositoQuery(
          applyNonOrigenSqlFilters(q, peFilters, { allowLiquidacion: true, peView: true }),
          filters,
        ),
    })
    if (peRes.error) return { ok: false, reason: peRes.error.message }
    rows = (peRes.data ?? []) as any[]
  } else {
    const [cpRes, peRes] = await Promise.all([
      fetchCatalogoMetaRows(supabase, 'v_stock_rimec', {
        applySql: (q: any) =>
          applyNonOrigenSqlFilters(q, cpFilters, { allowLiquidacion: false, peView: false }),
      }),
      fetchCatalogoMetaRows(supabase, 'v_stock_pe_rimec', {
        applySql: (q: any) =>
          applyPeCommercialSqlFilters(
            applyPeDepositoQuery(
              applyNonOrigenSqlFilters(q, peFilters, { allowLiquidacion: true, peView: true }),
              filters,
            ),
            filters,
          ),
      }),
    ])
    if (cpRes.error && peRes.error) {
      return { ok: false, reason: cpRes.error.message || peRes.error.message }
    }
    rows = [...(cpRes.data ?? []), ...(peRes.data ?? [])] as any[]
  }

  const vendibles = rows.filter((r) => cajasDisponiblesDeFila(r) > 0)
  const enriched = await enrichCatalogoRows(vendibles)
  const filtered = applyMemoryFilters(enriched, filters)
  const acot = acotarMetaRpcDesdeFilas(rpc, filtered as any, filters.ramo_tipo)
  return {
    ok: true,
    estilos: acot.estilos.length,
    lineas: acot.lineas.length,
    marcas: acot.marcas.length,
    estiloLabels: acot.estilos.map((e) => e.label),
    marcaLabels: acot.marcas.map((m) => m.label),
    rows: filtered.length,
    acotado: true,
    cpPeOk: true,
  }
}

async function main() {
  const fails: string[] = []
  for (const c of CASES) {
    console.time(c.name)
    const r = await metaViaRouteLogic(c.qs)
    console.timeEnd(c.name)
    console.log(c.name, JSON.stringify(r))
    if (!r.ok) {
      fails.push(`${c.name}: ${r.reason}`)
      continue
    }
    // Sin filas vendibles: meta no se acota a propósito (evita sidebar vacío).
    if ((r as { rows?: number }).rows === 0) {
      console.log(c.name, 'SKIP max — 0 filas (meta universo)')
      continue
    }
    if (c.expectEstilosMax != null && (r.estilos as number) > c.expectEstilosMax) {
      fails.push(`${c.name}: estilos ${(r as any).estilos} > max ${c.expectEstilosMax}`)
    }
    if (c.expectLineasMax != null && (r.lineas as number) > c.expectLineasMax) {
      fails.push(`${c.name}: lineas ${(r as any).lineas} > max ${c.expectLineasMax}`)
    }
  }
  if (fails.length) {
    console.log('FAIL', fails)
    process.exit(1)
  }
  console.log('PASS_CASCADA_META_COMBOS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
