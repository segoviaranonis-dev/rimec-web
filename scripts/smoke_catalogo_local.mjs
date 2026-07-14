/**
 * Smoke local :3001 — catálogo + filtros (sesión firmada).
 * Uso: node scripts/smoke_catalogo_local.mjs
 */
import fs from 'fs'
import { SignJWT } from 'jose'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3001'
const env = fs.readFileSync('.env.local', 'utf8')
const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim()
if (!secret) {
  console.error('FAIL: SESSION_SECRET en .env.local')
  process.exit(1)
}

const enc = new TextEncoder().encode(secret)
const token = await new SignJWT({
  id_usuario: 1,
  name: 'Smoke Test',
  role: 'VENDEDOR',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(enc)

const cookie = `rimec_session=${token}`

let fail = 0
async function get(path, label, check) {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(60000),
    })
    const ms = Date.now() - t0
    const ct = res.headers.get('content-type') ?? ''
    if (!res.ok) {
      const body = await res.text()
      console.log(` FAIL ${label} HTTP ${res.status} ${ms}ms — ${body.slice(0, 200)}`)
      fail++
      return null
    }
    if (!ct.includes('application/json')) {
      const body = await res.text()
      console.log(` FAIL ${label} no JSON (${ct}) ${ms}ms — ${body.slice(0, 120)}`)
      fail++
      return null
    }
    const json = await res.json()
    if (check && !check(json)) {
      console.log(` FAIL ${label} payload inválido ${ms}ms`)
      fail++
      return json
    }
    console.log(`  OK  ${label} ${ms}ms`)
    return json
  } catch (e) {
    console.log(` FAIL ${label} ${e.message}`)
    fail++
    return null
  }
}

console.log(`=== Smoke catálogo ${BASE} ===\n`)

try {
  const ping = await fetch(BASE, { signal: AbortSignal.timeout(10000) })
  console.log(ping.ok ? `  OK  servidor ${BASE} (${ping.status})` : ` FAIL servidor ${ping.status}`)
  if (!ping.ok) fail++
} catch (e) {
  console.log(` FAIL servidor no responde: ${e.message}`)
  process.exit(1)
}

const filtrosTodos = await get(
  '/api/catalogo/filtros?origen_tipo=TODOS&ramo_tipo=CALZADO',
  'filtros TODOS+CALZADO',
  j => (j.filtros?.todasMarcas?.length ?? 0) > 0 && j.metaSource === 'rpc',
)
if (filtrosTodos) {
  console.log(
    `       marcas=${filtrosTodos.filtros.todasMarcas.length} lineas=${filtrosTodos.filtros.todasLineas.length} tonos=${filtrosTodos.tonosDisponibles?.length ?? 0} source=${filtrosTodos.metaSource}`,
  )
}

const filtrosPe = await get(
  '/api/catalogo/filtros?origen_tipo=PRONTA_ENTREGA&ramo_tipo=CALZADO',
  'filtros PE+CALZADO',
  j => (j.filtros?.todasMarcas?.length ?? 0) > 0,
)

const filtrosCp = await get(
  '/api/catalogo/filtros?origen_tipo=TRÁNSITO_PP',
  'filtros CP',
  j => (j.filtros?.todasMarcas?.length ?? 0) > 0,
)

const filtrosGen = await get(
  '/api/catalogo/filtros?origen_tipo=TODOS&ramo_tipo=CALZADO&genero_codigo=DAMAS',
  'filtros TODOS+DAMAS',
  j => Array.isArray(j.filtros?.todasLineas),
)

await get(
  '/api/catalogo/header-filtros',
  'header-filtros',
  j => (j.todasMarcas?.length ?? 0) > 0 && j.header?.mujeres?.marcas?.length >= 0,
)

const tarjetasTodos = await get(
  '/api/catalogo/tarjetas?origen_tipo=TODOS&ramo_tipo=CALZADO&limit=5',
  'tarjetas TODOS limit=5',
  j => (j.tarjetas?.length ?? 0) > 0,
)

await get(
  '/api/catalogo/tarjetas?origen_tipo=PRONTA_ENTREGA&ramo_tipo=CALZADO&limit=5',
  'tarjetas PE limit=5',
  j => (j.tarjetas?.length ?? 0) > 0,
)

if (tarjetasTodos?.tarjetas?.[0]) {
  const t = tarjetasTodos.tarjetas[0]
  const hasGrada = Boolean(
    t.gradas_fmt || t.variantes?.[0]?.gradas_fmt || t.lotes?.some?.(() => true),
  )
  console.log(`       1ª tarjeta: ${t.cardKey?.slice?.(0, 40) ?? 'sku'}…`)
}

console.log(fail ? `\nFAIL ${fail} checks` : '\nTODOS OK')
process.exit(fail ? 1 : 0)
