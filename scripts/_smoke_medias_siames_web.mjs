/**
 * Smoke Web — MEDIAS (tipo_ids=4) + sintéticos accesorios en catálogo TODOS.
 * Uso: node scripts/_smoke_medias_siames_web.mjs
 */
import fs from 'fs'
import { SignJWT } from 'jose'

const BASE = 'http://localhost:3001'
const env = fs.readFileSync('.env.local', 'utf8')
const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim()
if (!secret) throw new Error('SESSION_SECRET ausente')

const token = await new SignJWT({
  id_usuario: 1,
  name: 'Smoke medias',
  role: 'ADMIN',
  categoria: 'ADMIN',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(new TextEncoder().encode(secret))

const headers = { Cookie: `rimec_session=${token}` }

async function get(params) {
  const res = await fetch(`${BASE}/api/catalogo/tarjetas?${params}`, { headers })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body.tarjetas ?? []
}

const medias = await get('origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_ids=4&limit=30')
const badMedias = medias.filter((t) => Number(t.tipo_1_id) !== 4 && !String(t.tipo_1 ?? '').toUpperCase().includes('MEDIA'))

const acc = await get('origen_tipo=TODOS&ramo_tipo=ACCESORIOS&tipo_ids=-1&limit=30')
const calzadoCarteras = await get('origen_tipo=TODOS&ramo_tipo=CALZADO&marca_ids=2&tipo_ids=-1&limit=60')
const anteojos = await get('origen_tipo=TODOS&ramo_tipo=CALZADO&marca_ids=2&tipo_ids=-2&limit=30')
const calzado = await get('origen_tipo=TODOS&ramo_tipo=CALZADO&limit=5')

console.log({
  medias: medias.length,
  badMedias: badMedias.length,
  accesoriosSynth: acc.length,
  calzadoCarterasVizzano: calzadoCarteras.length,
  anteojosVizzano: anteojos.length,
  calzadoSample: calzado.length,
})

if (calzadoCarteras.length < 10) {
  console.error('FAIL: Vizzano CARTERAS en pill Calzado debe traer decenas de tarjetas')
  process.exit(1)
}

if (anteojos.length < 2) {
  console.error('FAIL: Vizzano ANTEOJOS (-2) debe traer línea 90000 vía traductor')
  process.exit(1)
}

if (badMedias.length) {
  console.error('FAIL: filas no-MEDIAS con tipo_ids=4')
  process.exit(1)
}

console.log('PASS smoke MEDIAS + accesorios sintético Web')
