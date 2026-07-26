/**
 * Coteo tarjetas VIZZANO (marca_id=2) — origen + módulo.
 * Ley: TODOS sin ramo = todo visible; filtros solo reducen.
 * Uso: node scripts/_audit_marca_vizzano_coteo.mjs
 */
import fs from 'fs'
import { SignJWT } from 'jose'

const BASE = 'http://localhost:3001'
const MARCA_ID = 2
const env = fs.readFileSync('.env.local', 'utf8')
const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim()
if (!secret) {
  console.error('FAIL: SESSION_SECRET')
  process.exit(1)
}

const enc = new TextEncoder().encode(secret)
const token = await new SignJWT({ id_usuario: 1, name: 'Audit', role: 'VENDEDOR' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(enc)
const cookie = `rimec_session=${token}`

function clasificarTarjeta(t) {
  const lotes = t.lotes ?? [t]
  let origen = 'DESCONOCIDO'
  let modulo = 'calzado'
  for (const l of lotes) {
    const ot = String(l.origen_tipo ?? t.origen_tipo ?? '').toUpperCase()
    if (ot.includes('PRONTA') || ot === 'PE') origen = 'PE'
    else if (ot.includes('TRÁNSITO') || ot.includes('TRANSITO') || ot === 'CP') origen = 'CP'
    else if (ot.includes('COMPRA')) origen = 'CP'

    const t1 = String(l.descp_tipo_1 ?? t.descp_tipo_1 ?? '').toUpperCase()
    const ge = String(l.descp_grupo_estilo ?? t.descp_grupo_estilo ?? '').toUpperCase()
    if (t1.includes('CARTER') || ge.includes('CARTER')) modulo = 'carteras'
    else if (t1.includes('ANTEOJ') || t1.includes('LENT') || t1.includes('OCUL')) modulo = 'anteojos'
    else if (String(l.ramo_tipo ?? t.ramo_tipo ?? '').toUpperCase() === 'CONFECCIONES') modulo = 'confecciones'
    else if (String(l.ramo_tipo ?? t.ramo_tipo ?? '').toUpperCase() === 'ACCESORIOS') modulo = 'accesorios'
  }
  return { origen, modulo }
}

async function fetchAllTarjetas(qsBase) {
  const all = []
  let rowFrom = 0
  let exclude = []
  const seen = new Set()
  const filtersQuery = new URLSearchParams(qsBase).toString()
  while (true) {
    const res =
      exclude.length > 0
        ? await fetch(`${BASE}/api/catalogo/tarjetas?${filtersQuery}`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({ row_from: rowFrom, limit: 60, exclude }),
            signal: AbortSignal.timeout(120000),
          })
        : await fetch(
            `${BASE}/api/catalogo/tarjetas?${filtersQuery}&row_from=${rowFrom}&limit=60`,
            { headers: { Cookie: cookie }, signal: AbortSignal.timeout(120000) },
          )
    const text = await res.text()
    if (!text.trim()) throw new Error(`HTTP ${res.status} vacío`)
    const json = JSON.parse(text)
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
    const batch = json.tarjetas ?? []
    if (!batch.length) break
    for (const t of batch) {
      const k = t.cardKey ?? ''
      if (k && seen.has(k)) continue
      if (k) seen.add(k)
      all.push(t)
    }
    rowFrom = json.nextRowFrom ?? rowFrom + batch.length
    exclude = json.excludeCardKeys ?? exclude
    if (!json.hasMore) break
    if (all.length > 8000) break
  }
  return all
}

async function coteo(label, qs) {
  console.log(`\n=== ${label} ===`)
  console.log(`URL: ${BASE}/api/catalogo/tarjetas?${qs}`)
  const tarjetas = await fetchAllTarjetas(Object.fromEntries(new URLSearchParams(qs)))
  const byOrigen = { CP: 0, PE: 0, DESCONOCIDO: 0 }
  const byModulo = { calzado: 0, carteras: 0, anteojos: 0, confecciones: 0, accesorios: 0, otro: 0 }
  for (const t of tarjetas) {
    const c = clasificarTarjeta(t)
    byOrigen[c.origen] = (byOrigen[c.origen] ?? 0) + 1
    byModulo[c.modulo] = (byModulo[c.modulo] ?? 0) + 1
  }
  console.log(`Total tarjetas: ${tarjetas.length}`)
  console.log('Por origen:', byOrigen)
  console.log('Por módulo:', byModulo)
  return { tarjetas, byOrigen, byModulo }
}

const qsFix = `origen_tipo=TODOS&marca_ids=${MARCA_ID}`
const qsBug = `origen_tipo=TODOS&ramo_tipo=CALZADO&marca_ids=${MARCA_ID}`

const fix = await coteo('FIX · TODOS + VIZZANO (sin ramo)', qsFix)
const bug = await coteo('ANTES · TODOS + CALZADO + VIZZANO', qsBug)

console.log('\n=== COMPARATIVA ===')
console.log(`CP:  fix=${fix.byOrigen.CP ?? 0}  bug=${bug.byOrigen.CP ?? 0}`)
console.log(`PE:  fix=${fix.byOrigen.PE ?? 0}  bug=${bug.byOrigen.PE ?? 0}`)
console.log(`Carteras: fix=${fix.byModulo.carteras}  bug=${bug.byModulo.carteras}`)
console.log(`Anteojos: fix=${fix.byModulo.anteojos}  bug=${bug.byModulo.anteojos}`)

const ok =
  (fix.byOrigen.CP ?? 0) > 0 &&
  fix.tarjetas.length > bug.tarjetas.length &&
  (fix.byModulo.carteras > 0 || fix.byModulo.anteojos > 0)

console.log(ok ? '\nPASS: TODOS sin ramo incluye más universo que CALZADO forzado' : '\nFAIL: revisar filtros')
process.exit(ok ? 0 : 1)
