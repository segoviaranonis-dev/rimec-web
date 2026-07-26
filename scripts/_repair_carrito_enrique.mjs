/**
 * Repara descuentos_lote.facturas para carrito PE (Enrique / cualquier vendedor).
 * Uso: node scripts/_repair_carrito_enrique.mjs [nombre_vendedor]
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPaths = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../report/.env.local'),
]
for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim()
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('FAIL: sin DATABASE_URL')
  process.exit(1)
}

const nombreBuscar = (process.argv[2] || 'enrique').trim()

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

// Minimal inline asegurar (sin import TS)
function normalizarDescuentos4(raw) {
  const src = Array.isArray(raw) ? raw : []
  return [0, 1, 2, 3].map((i) => {
    const v = src[i]
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
  })
}

function claveCelulaFi(s) {
  const promo = s.es_promo ? 'P' : s.es_liquidacion ? 'L' : 'R'
  const cad = (s.cadena_comercial || s.cod_grupo || 'STD').slice(0, 40)
  const caso = s.caso_id > 0 ? `id${s.caso_id}` : (s.caso || '—').slice(0, 60)
  return `${promo}|${cad}|${caso}`
}

function etiquetaCelulaFi(s) {
  if (s.es_liquidacion) return 'LIQUIDACIÓN'
  if (s.es_promo) return 'PROMO'
  const c = String(s.caso || '').trim()
  return c || 'REGULAR'
}

async function main() {
  const { rows: vends } = await pool.query(
    `SELECT id_vendedor, descp_vendedor FROM vendedor_v2
     WHERE UPPER(descp_vendedor) LIKE $1
     ORDER BY id_vendedor`,
    [`%${nombreBuscar.toUpperCase()}%`],
  )
  if (!vends.length) {
    console.log('Sin vendedor matching:', nombreBuscar)
    process.exit(1)
  }
  console.log('Vendedores:', vends.map((v) => `${v.id_vendedor} ${v.descp_vendedor}`).join(' · '))

  for (const v of vends) {
    const { rows: users } = await pool.query(
      `SELECT id_usuario, descp_usuario AS name FROM usuario_v2
       WHERE id_vendedor = $1 OR UPPER(descp_usuario) LIKE $2
       LIMIT 5`,
      [v.id_vendedor, `%${nombreBuscar.toUpperCase()}%`],
    )
    for (const u of users) {
      const uid = u.id_usuario
      const { rows: ses } = await pool.query(
        `SELECT cliente_nombre, descuentos, descuentos_lote, validacion_estado FROM carrito_sesion WHERE id_usuario = $1`,
        [uid],
      )
      if (!ses.length) continue
      const s = ses[0]
      const { rows: items } = await pool.query(
        `SELECT det_id, pp_id, marca_snapshot, caso_snapshot, caso_id_snapshot FROM carrito_item WHERE id_usuario = $1`,
        [uid],
      )
      if (!items.length) {
        console.log(`Usuario ${uid} (${u.name}): sesión sin ítems`)
        continue
      }
      console.log(`\n=== Usuario ${uid} · ${u.name} · cliente: ${s.cliente_nombre} · ${items.length} ítems ===`)
      console.log('validacion_estado:', s.validacion_estado)
      const prev = s.descuentos_lote?.facturas ?? []
      console.log('facturas previas:', prev.length)

      const descCab = normalizarDescuentos4(s.descuentos)
      const cells = new Map()
      for (const raw of items) {
        const marca = String(raw.marca_snapshot || '').trim() || 'Sin marca'
        const celula = {
          caso: String(raw.caso_snapshot || ''),
          caso_id: raw.caso_id_snapshot > 0 ? Number(raw.caso_id_snapshot) : null,
          es_promo: null,
          es_liquidacion: null,
          cadena_comercial: null,
        }
        const key = `${Number(raw.pp_id)}|${marca}|${claveCelulaFi(celula)}`
        const ex = cells.get(key)
        if (ex) ex.count += 1
        else
          cells.set(key, {
            pp_id: Number(raw.pp_id),
            marca,
            caso: etiquetaCelulaFi(celula),
            caso_id: celula.caso_id,
            count: 1,
          })
      }

      const facturasOut = []
      for (const cell of cells.values()) {
        const old = prev.find(
          (f) =>
            String(f.marca) === cell.marca &&
            (String(f.caso) === cell.caso ||
              (cell.caso_id && f.caso_id && Number(f.caso_id) === cell.caso_id)),
        )
        facturasOut.push({
          pp_id: cell.pp_id,
          marca: cell.marca,
          marca_id: null,
          caso: cell.caso,
          caso_id: cell.caso_id,
          lista_precio_id: Number(old?.lista_precio_id) || Number(s.descuentos_lote?.lista) || 1,
          descuentos: old?.descuentos ?? descCab,
          pre_autorizado: Boolean(old?.pre_autorizado),
          items_count: cell.count,
        })
      }

      const lote = { ...(s.descuentos_lote || {}), facturas: facturasOut }
      await pool.query(
        `UPDATE carrito_sesion SET descuentos_lote = $1::jsonb,
          validacion_estado = NULL, validacion_token = NULL, validada_en = NULL,
          actualizada_en = now()
         WHERE id_usuario = $2`,
        [JSON.stringify(lote), uid],
      )
      console.log('REPARADO →', facturasOut.length, 'facturas')
      for (const f of facturasOut) {
        console.log(`  PP ${f.pp_id} · ${f.marca} · ${f.caso} · desc ${f.descuentos.join('/')}`)
      }
    }
  }
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
