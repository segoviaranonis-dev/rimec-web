/**
 * Hotfix operativo: 10% D1 + validar + confirmar carrito PE Enrique.
 * Uso: node scripts/_cerrar_enrique_10pct.mjs [nombre_vendedor]
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
for (const envPath of [path.join(root, '.env.local'), path.join(root, '../report/.env.local')]) {
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim()
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const buscar = (process.argv[2] ?? 'enrique').toLowerCase()
const D1 = Number(process.argv[3] ?? 10)
const url = process.env.DATABASE_URL
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !sbUrl || !sbKey) {
  console.error('Faltan DATABASE_URL / SUPABASE')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

function normDesc(raw) {
  const src = Array.isArray(raw) ? raw : []
  return [0, 1, 2, 3].map((i) => Number(src[i]) || 0)
}

function calcNeto(base, d1, d2, d3, d4) {
  let p = Number(base) || 0
  for (const d of [d1, d2, d3, d4]) {
    const n = Number(d) || 0
    if (n > 0) p *= 1 - n / 100
  }
  return Math.floor(p / 100) * 100
}

function cadenaComercialFi(s) {
  if (s.es_liquidacion) return 'LIQUIDACION'
  if (s.es_promo) return 'PROMOCIONAL'
  const cc = String(s.cadena_comercial || '').toUpperCase()
  if (cc.includes('LIQUID')) return 'LIQUIDACION'
  if (cc.includes('PROMO')) return 'PROMOCIONAL'
  return 'REGULAR'
}

function etiquetaCelulaFi(s) {
  const caso =
    String(s.caso || '').trim() ||
    (s.caso_id > 0 ? `Caso #${s.caso_id}` : 'Sin caso')
  const cad = cadenaComercialFi(s)
  if (cad === 'REGULAR') return caso
  const up = caso.toUpperCase()
  if (up.includes('LIQUID') || up.includes('PROMO')) return caso
  return `${caso} · ${cad}`
}

function claveCelulaFi(s) {
  const promo = s.es_promo ? 'P' : s.es_liquidacion ? 'L' : 'R'
  const cad = (s.cadena_comercial || s.cod_grupo || 'STD').slice(0, 40)
  const caso = s.caso_id > 0 ? `id${s.caso_id}` : (s.caso || '—').slice(0, 60)
  return `${promo}|${cad}|${caso}`
}

function tierPrecioPe(listaId, row) {
  const lpn = Number(row.lpn) || 0
  const promo = Boolean(row.es_promo) || cadenaComercialFi(row) === 'PROMOCIONAL'
  switch (Number(listaId)) {
    case 1:
      return lpn
    case 2:
      return Number(row.lpc02) || 0
    case 3:
      return promo ? lpn : lpn > 0 ? Math.round(lpn * 1.12) : Number(row.lpc03) || 0
    case 4:
      return promo ? lpn : lpn > 0 ? Math.round(lpn * 1.2) : Number(row.lpc04) || 0
    default:
      return lpn
  }
}

async function fetchStock(detIds) {
  const expanded = new Set(detIds)
  for (const id of detIds) {
    if (id > 0 && id < 800_000_000) expanded.add(id + 800_000_000)
    if (id >= 800_000_000) expanded.add(id - 800_000_000)
  }
  const ids = [...expanded]
  const pe = await pool.query(
    `SELECT det_id, lpn, lpc02, lpc03, lpc04, descp_caso, caso_id, es_promo, es_liquidacion,
            cadena_comercial, cod_grupo, cajas_disponibles, linea_codigo, referencia_codigo,
            descp_color, pp_nro, proforma, quincena_desc, pares_por_caja, grades_json, pp_id, origen_tipo
     FROM v_stock_pe_rimec WHERE det_id = ANY($1::bigint[])`,
    [ids],
  )
  const cp = await pool.query(
    `SELECT det_id, lpn, lpc02, lpc03, lpc04, descp_caso, cajas_disponibles, linea_codigo,
            referencia_codigo, descp_color, pp_nro, proforma, quincena_desc, pares_por_caja,
            grades_json, pp_id, origen_tipo
     FROM v_stock_rimec WHERE det_id = ANY($1::bigint[])`,
    [ids],
  )
  const map = new Map()
  for (const r of [...cp.rows, ...pe.rows]) map.set(Number(r.det_id), r)
  return map
}

async function main() {
  const usuarios = (
    await pool.query(
      `SELECT id_usuario AS id, descp_usuario AS login, descp_vendedor, id_vendedor
       FROM usuario_v2
       WHERE descp_vendedor ILIKE $1 OR descp_usuario ILIKE $1
       ORDER BY id_usuario LIMIT 5`,
      [`%${buscar}%`],
    )
  ).rows

  if (!usuarios.length) {
    console.error('Sin usuario:', buscar)
    process.exit(1)
  }

  const u = usuarios[0]
  const idUsuario = Number(u.id)
  console.log('usuario', { id: idUsuario, vendedor: u.descp_vendedor })

  const sesionRes = await pool.query(`SELECT * FROM carrito_sesion WHERE id_usuario = $1`, [idUsuario])
  const sesion = sesionRes.rows[0]
  if (!sesion) {
    console.error('Sin carrito_sesion')
    process.exit(1)
  }

  const itemsRes = await pool.query(`SELECT * FROM carrito_item WHERE id_usuario = $1`, [idUsuario])
  const items = itemsRes.rows
  if (!items.length) {
    console.error('Carrito vacío — ¿ya confirmado?')
    process.exit(1)
  }

  console.log('items', items.length, 'cliente', sesion.cliente_nombre)

  const detIds = items.map((i) => Number(i.det_id))
  const stockMap = await fetchStock(detIds)

  // Regenerar facturas + 10% D1
  const cells = new Map()
  for (const raw of items) {
    const stock = stockMap.get(Number(raw.det_id))
    const marca = String(raw.marca_snapshot || '').trim() || 'Sin marca'
    const casoId =
      raw.caso_id_snapshot > 0
        ? Number(raw.caso_id_snapshot)
        : stock?.caso_id > 0
          ? Number(stock.caso_id)
          : null
    const celula = {
      caso: String(raw.caso_snapshot || stock?.descp_caso || ''),
      caso_id: casoId,
      es_promo: stock?.es_promo != null ? Boolean(stock.es_promo) : null,
      es_liquidacion: stock?.es_liquidacion != null ? Boolean(stock.es_liquidacion) : null,
      cadena_comercial: stock?.cadena_comercial ?? null,
      cod_grupo: stock?.cod_grupo ?? null,
    }
    const key = `${Number(raw.pp_id)}|${marca}|${claveCelulaFi(celula)}`
    const ex = cells.get(key)
    if (ex) ex.count += 1
    else
      cells.set(key, {
        pp_id: Number(raw.pp_id),
        marca,
        caso: etiquetaCelulaFi(celula),
        caso_id: casoId,
        lista_precio_id: Number(sesion.lista_precio_id) || 1,
        descuentos: [D1, 0, 0, 0],
        count: 1,
      })
  }

  const facturas = [...cells.values()].map((c) => ({
    pp_id: c.pp_id,
    marca: c.marca,
    marca_id: null,
    caso: c.caso,
    caso_id: c.caso_id,
    lista_precio_id: c.lista_precio_id,
    descuentos: c.descuentos,
    pre_autorizado: true,
    items_count: c.count,
  }))

  await pool.query(
    `UPDATE carrito_sesion SET descuentos_lote = $1::jsonb, descuentos = $2::jsonb,
      validacion_estado = NULL, validacion_token = NULL, validada_en = NULL, actualizada_en = now()
     WHERE id_usuario = $3`,
    [JSON.stringify({ facturas }), JSON.stringify([D1, 0, 0, 0]), idUsuario],
  )
  console.log('descuentos_aplicados', facturas.map((f) => `${f.marca} ${f.caso} D1=${f.descuentos[0]}%`))

  let recalculados = 0
  for (const item of items) {
    const detId = Number(item.det_id)
    const stock = stockMap.get(detId)
    if (!stock) {
      console.warn('sin stock det_id', detId)
      continue
    }
    const fi = facturas.find(
      (f) =>
        Number(f.pp_id) === Number(item.pp_id) &&
        String(f.marca) === String(item.marca_snapshot) &&
        (f.caso_id != null &&
        item.caso_id_snapshot != null &&
        Number(f.caso_id) === Number(item.caso_id_snapshot)
          ? true
          : String(f.caso).startsWith(String(item.caso_snapshot))),
    )
    const listaId = Number(fi?.lista_precio_id ?? sesion.lista_precio_id ?? 1)
    const desc = normDesc(fi?.descuentos ?? [D1, 0, 0, 0])
    const bruto = tierPrecioPe(listaId, stock)
    const neto = calcNeto(bruto, desc[0], desc[1], desc[2], desc[3])
    if (neto > 0) {
      await pool.query(
        `UPDATE carrito_item SET precio_snapshot = $1, actualizado_en = now()
         WHERE id_usuario = $2 AND det_id = $3`,
        [neto, idUsuario, detId],
      )
      item.precio_snapshot = neto
      recalculados++
    }
  }
  console.log('precios_recalculados', recalculados)

  const tokenRes = await pool.query(
    `UPDATE carrito_sesion
     SET validacion_token = gen_random_uuid(),
         validacion_estado = 'OK',
         validada_en = now(),
         actualizada_en = now()
     WHERE id_usuario = $1
     RETURNING validacion_token, cliente_id, plazo_id, lista_precio_id`,
    [idUsuario],
  )
  const token = tokenRes.rows[0].validacion_token
  console.log('validacion_OK', token)

  const descCab = [D1, 0, 0, 0]
  const byPp = new Map()
  for (const item of items) {
    const k = Number(item.pp_id)
    if (!byPp.has(k)) byPp.set(k, [])
    byPp.get(k).push(item)
  }

  const lotes = []
  let totalPares = 0
  let totalNeto = 0

  for (const [ppId, ppItems] of byPp) {
    const stock0 = stockMap.get(Number(ppItems[0].det_id))
    const byMarca = new Map()
    for (const it of ppItems) {
      const m = String(it.marca_snapshot || 'Sin marca')
      if (!byMarca.has(m)) byMarca.set(m, [])
      byMarca.get(m).push(it)
    }

    const marcasOut = []
    let lotePares = 0
    let loteMonto = 0

    for (const [marca, mItems] of byMarca) {
      const byCelula = new Map()
      for (const it of mItems) {
        const st = stockMap.get(Number(it.det_id))
        const casoId =
          it.caso_id_snapshot > 0
            ? Number(it.caso_id_snapshot)
            : st?.caso_id > 0
              ? Number(st.caso_id)
              : null
        const celula = {
          caso: String(it.caso_snapshot || st?.descp_caso || ''),
          caso_id: casoId,
          es_promo: st?.es_promo != null ? Boolean(st.es_promo) : null,
          es_liquidacion: st?.es_liquidacion != null ? Boolean(st.es_liquidacion) : null,
          cadena_comercial: st?.cadena_comercial ?? null,
          cod_grupo: st?.cod_grupo ?? null,
        }
        const key = claveCelulaFi(celula)
        if (!byCelula.has(key)) byCelula.set(key, [])
        byCelula.get(key).push(it)
      }

      const facturasOut = []
      for (const [, cItems] of byCelula) {
        const st0 = stockMap.get(Number(cItems[0].det_id))
        const casoId =
          cItems.find((i) => i.caso_id_snapshot > 0)?.caso_id_snapshot ??
          (st0?.caso_id > 0 ? Number(st0.caso_id) : null)
        const caso = etiquetaCelulaFi({
          caso: String(cItems[0].caso_snapshot || st0?.descp_caso || ''),
          caso_id: casoId,
          es_promo: st0?.es_promo != null ? Boolean(st0.es_promo) : null,
          es_liquidacion: st0?.es_liquidacion != null ? Boolean(st0.es_liquidacion) : null,
          cadena_comercial: st0?.cadena_comercial ?? null,
          cod_grupo: st0?.cod_grupo ?? null,
        })
        const fi = facturas.find(
          (f) =>
            Number(f.pp_id) === ppId &&
            String(f.marca) === marca &&
            ((casoId != null && f.caso_id != null && Number(f.caso_id) === Number(casoId)) ||
              String(f.caso) === caso),
        )
        const listaId = Number(fi?.lista_precio_id ?? sesion.lista_precio_id ?? 1)
        const desc = normDesc(fi?.descuentos ?? descCab)
        const itemsOut = cItems.map((it) => {
          const st = stockMap.get(Number(it.det_id))
          const cajas = Number(it.cantidad_cajas) || 0
          const ppc = Number(st?.pares_por_caja) || 12
          const pares = cajas * ppc
          const bruto = tierPrecioPe(listaId, st ?? {})
          const neto = Number(it.precio_snapshot) || calcNeto(bruto, desc[0], desc[1], desc[2], desc[3])
          return {
            det_id: Number(it.det_id),
            linea_codigo: String(st?.linea_codigo ?? ''),
            ref_codigo: String(st?.referencia_codigo ?? ''),
            color_nombre: String(st?.descp_color ?? ''),
            gradas_fmt: '',
            imagen_url: '',
            cajas,
            pares,
            precio_base: bruto,
            precio_neto: neto,
            subtotal: neto * pares,
          }
        })
        const fiPares = itemsOut.reduce((s, x) => s + x.pares, 0)
        const fiMonto = itemsOut.reduce((s, x) => s + x.subtotal, 0)
        facturasOut.push({
          marca,
          marca_id: cItems[0].marca_id_snapshot ?? null,
          caso,
          caso_id: casoId,
          lista_precio_id: listaId,
          descuento_1: desc[0],
          descuento_2: desc[1],
          descuento_3: desc[2],
          descuento_4: desc[3],
          total_pares: fiPares,
          total_monto: fiMonto,
          items: itemsOut,
        })
        lotePares += fiPares
        loteMonto += fiMonto
      }

      marcasOut.push({
        marca,
        marca_id: mItems[0].marca_id_snapshot ?? null,
        total_pares: facturasOut.reduce((s, f) => s + f.total_pares, 0),
        total_monto: facturasOut.reduce((s, f) => s + f.total_monto, 0),
        cantidad_facturas: facturasOut.length,
        facturas: facturasOut,
      })
    }

    totalPares += lotePares
    totalNeto += loteMonto
    lotes.push({
      pp_id: ppId,
      pp_nro: String(stock0?.pp_nro ?? 'PE'),
      proforma: String(stock0?.proforma ?? ''),
      quincena: String(stock0?.quincena_desc ?? 'Pronta entrega'),
      origen_pe: ppId < 0,
      total_pares: lotePares,
      total_monto: loteMonto,
      facturas: marcasOut.flatMap((m) => m.facturas),
    })
  }

  const payload = {
    cliente_id: Number(sesion.cliente_id),
    cliente_nombre: String(sesion.cliente_nombre ?? ''),
    vendedor_id: u.id_vendedor ?? null,
    vendedor_nombre: String(u.descp_vendedor ?? ''),
    plazo_id: Number(sesion.plazo_id),
    plazo_nombre: String(sesion.plazo_nombre ?? ''),
    cod_oper_carlos: sesion.cod_oper_carlos ?? null,
    lista_precio_id: Number(sesion.lista_precio_id ?? 1),
    lista_nombre: 'LPN',
    descuento_1: D1,
    descuento_2: 0,
    descuento_3: 0,
    descuento_4: 0,
    total_pares: totalPares,
    total_neto: totalNeto,
    fecha: new Date().toISOString(),
    lotes,
  }

  console.log('payload', { totalPares, totalNeto, lotes: lotes.length })

  const sb = createClient(sbUrl, sbKey)
  const { data, error } = await sb.rpc('confirmar_pedido_web', {
    p_cliente_id: Number(sesion.cliente_id),
    p_vendedor_id: u.id_vendedor ?? null,
    p_plazo_id: Number(sesion.plazo_id),
    p_lista_precio_id: Number(sesion.lista_precio_id ?? 1),
    p_descuento_1: D1,
    p_descuento_2: 0,
    p_descuento_3: 0,
    p_descuento_4: 0,
    p_total_pares: totalPares,
    p_total_monto: totalNeto,
    p_payload: payload,
    p_validacion_token: token,
  })

  if (error) {
    console.error('confirmar_FAIL', error.message, error.details)
    process.exit(1)
  }

  if (!data?.success) {
    console.error('confirmar_FAIL', JSON.stringify(data, null, 2))
    process.exit(1)
  }

  await pool.query(`DELETE FROM carrito_item WHERE id_usuario = $1`, [idUsuario])
  await pool.query(`DELETE FROM carrito_sesion WHERE id_usuario = $1`, [idUsuario])

  console.log('confirmar_OK', JSON.stringify(data, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => pool.end())
