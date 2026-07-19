/**
 * Conteo tarjetas por grupo TIPO en catálogo Todos — smoke bancario.
 * Uso: node scripts/conteo_tipo_tarjetas.mjs
 */
import fs from 'fs'
import { SignJWT } from 'jose'

const BASE = 'http://localhost:3001'
const env = fs.readFileSync('.env.local', 'utf8')
const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim()
if (!secret) {
  console.error('FAIL: SESSION_SECRET')
  process.exit(1)
}

const enc = new TextEncoder().encode(secret)
const token = await new SignJWT({ id_usuario: 1, name: 'Conteo', role: 'VENDEDOR' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(enc)
const cookie = `rimec_session=${token}`

const SET_NORMAL = new Set(['ACT-BRSPORT', 'BR-VZ-MD-MKA-O', 'BR-VZ-MD-ML-MKA-O'])

function clasificarLote(l) {
  const caso = String(l.descp_caso ?? '').trim().toUpperCase()
  const liq =
    l.es_liquidacion === true ||
    String(l.cadena_comercial ?? '').trim().toUpperCase() === 'LIQUIDACION'
  const promo =
    caso === 'PROMOCIONAL' ||
    l.es_promo === true ||
    String(l.cadena_comercial ?? '').trim().toUpperCase() === 'PROMOCIONAL'
  const carteras = caso === 'CARTERAS'
  const normal = SET_NORMAL.has(caso)
  return { liq, promo, carteras, normal, caso: caso || '—' }
}

function gruposTarjeta(t) {
  const lotes = t.lotes ?? [t]
  const flags = { liq: false, promo: false, carteras: false, normal: false }
  for (const l of lotes) {
    const c = clasificarLote(l)
    if (c.liq) flags.liq = true
    if (c.promo) flags.promo = true
    if (c.carteras) flags.carteras = true
    if (c.normal) flags.normal = true
  }
  return flags
}

async function fetchTarjetas(limit = 500) {
  const all = []
  let rowFrom = 0
  let exclude = []
  while (all.length < limit) {
    const qs = new URLSearchParams({
      origen_tipo: 'TODOS',
      ramo_tipo: 'CALZADO',
      limit: '60',
      row_from: String(rowFrom),
    })
    const res = await fetch(`${BASE}/api/catalogo/tarjetas?${qs}`, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(120000),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
    const batch = json.tarjetas ?? []
    if (!batch.length) break
    all.push(...batch)
    rowFrom = json.nextRowFrom ?? rowFrom + batch.length
    exclude = json.excludeCardKeys ?? exclude
    if (!json.hasMore) break
  }
  return all.slice(0, limit)
}

console.log('=== Conteo TIPO · Todos CALZADO ===\n')
const tarjetas = await fetchTarjetas(600)
console.log(`Tarjetas escaneadas: ${tarjetas.length}\n`)

const counts = { normal: 0, carteras: 0, promo: 0, liquidacion: 0, sin_clase: 0 }
const pulse = { promo: 0, liquidacion: 0, sin_pulse: 0 }

for (const t of tarjetas) {
  const g = gruposTarjeta(t)
  if (g.liq) counts.liquidacion++
  else if (g.promo) counts.promo++
  else if (g.carteras) counts.carteras++
  else if (g.normal) counts.normal++
  else counts.sin_clase++

  if (g.liq) pulse.liquidacion++
  else if (g.promo) pulse.promo++
  else pulse.sin_pulse++
}

console.log('Por grupo TIPO (prioridad LIQ > Promo > Carteras > Normal):')
console.log(`  Normal:      ${counts.normal}`)
console.log(`  Carteras:    ${counts.carteras}`)
console.log(`  Promo:       ${counts.promo}  ← deben latir ámbar`)
console.log(`  Liquidación: ${counts.liquidacion}  ← deben latir verde`)
console.log(`  Sin clase:   ${counts.sin_clase}`)
console.log('\nLatido en grilla (post-fix):')
console.log(`  Promo pulse: ${pulse.promo}`)
console.log(`  LIQ pulse:   ${pulse.liquidacion}`)
console.log(`  Sin latido:  ${pulse.sin_pulse} (normal + carteras + resto)`)

// Filtros API cruzados
for (const tipo of ['normal', 'carteras', 'promo', 'liquidacion']) {
  const r = await fetch(
    `${BASE}/api/catalogo/tarjetas?origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_grupos=${tipo}&limit=60`,
    { headers: { Cookie: cookie } },
  )
  const j = await r.json()
  console.log(`\nFiltro API tipo=${tipo}: ${j.tarjetas?.length ?? 0} tarjetas (pág 1)`)
}
