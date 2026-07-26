/**
 * Smoke hermanos siameses: Marca + Estilo + Tipo son multi-select en Web.
 * Uso: node scripts/_smoke_multiselect_siames_web.mjs
 */
import fs from 'fs'
import { SignJWT } from 'jose'

const BASE = 'http://localhost:3001'
const env = fs.readFileSync('.env.local', 'utf8')
const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim()
if (!secret) throw new Error('SESSION_SECRET ausente')

const token = await new SignJWT({
  id_usuario: 1,
  name: 'Smoke multiselect',
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

function lotes(card) {
  return card.lotes ?? [card]
}

const base = await get('origen_tipo=TODOS&limit=200')
const marcaIds = [...new Set(base.map((t) => Number(t.marca_id)).filter(Boolean))].slice(0, 2)
const estiloIds = [...new Set(base.map((t) => Number(t.grupo_estilo_id)).filter(Boolean))].slice(0, 2)

if (marcaIds.length < 2 || estiloIds.length < 2) {
  throw new Error(`Muestra insuficiente: marcas=${marcaIds.length}, estilos=${estiloIds.length}`)
}

const qs = new URLSearchParams({
  origen_tipo: 'TODOS',
  marca_ids: marcaIds.join(','),
  grupo_estilo_ids: estiloIds.join(','),
  tipo_grupos: 'normal,carteras',
  limit: '200',
})
const filtered = await get(qs.toString())

const badMarca = filtered.filter((t) => !marcaIds.includes(Number(t.marca_id)))
const badEstilo = filtered.filter((t) => !estiloIds.includes(Number(t.grupo_estilo_id)))
const badTipo = filtered.filter((t) =>
  lotes(t).some((l) =>
    l.es_liquidacion === true ||
    l.es_promo === true ||
    ['LIQUIDACION', 'PROMOCIONAL'].includes(String(l.cadena_comercial ?? '').toUpperCase()),
  ),
)

console.log({
  marcaIds,
  estiloIds,
  tarjetas: filtered.length,
  badMarca: badMarca.length,
  badEstilo: badEstilo.length,
  badTipo: badTipo.length,
})

if (!filtered.length || badMarca.length || badEstilo.length || badTipo.length) {
  process.exitCode = 1
  throw new Error('FAIL multiselect siamés')
}

console.log('PASS: Marca + Estilo + Tipo multiselect')
