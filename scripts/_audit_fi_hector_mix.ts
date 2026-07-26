import fs from "fs"
import path from "path"
import { createRequire } from "module"
import {
  cadenaComercialFi,
  violacionSegregacionCadenas,
  type CadenaComercialFi,
} from "../lib/facturaCelulaClave"

const require = createRequire(import.meta.url)
const pg = require(path.resolve("C:/Users/hecto/Nexus_Core/report/node_modules/pg"))

async function main() {
  const env = fs.readFileSync("C:/Users/hecto/Nexus_Core/report/.env.local", "utf8")
  const url = env.match(/^DATABASE_URL=(.+)$/m)![1].trim().replace(/^["']|["']$/g, "")
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const ses = await c.query(`SELECT * FROM carrito_sesion WHERE id_usuario = 1`)
  console.log("SESION_HECTOR", JSON.stringify(ses.rows, null, 2))

  const items = await c.query(`
    SELECT det_id, pp_id, cantidad_cajas, precio_snapshot, caso_snapshot, caso_id_snapshot,
           marca_snapshot, marca_id_snapshot, agregado_en::text
    FROM carrito_item WHERE id_usuario = 1
    ORDER BY actualizado_en DESC NULLS LAST
  `)
  console.log("CART_ITEMS_N", items.rows.length)

  if (items.rows.length) {
    const detIds = items.rows.map((r: { det_id: number }) => Number(r.det_id))
    const pe = await c.query(
      `
      SELECT det_id, es_liquidacion, es_promo, cadena_comercial, descp_caso, caso_id,
             linea_codigo, referencia_codigo
      FROM v_stock_pe_rimec
      WHERE det_id = ANY($1::bigint[])
      `,
      [detIds],
    )
    const sig = new Map(pe.rows.map((r: { det_id: number }) => [Number(r.det_id), r]))

    const cont: Record<string, number> = {}
    const detail: unknown[] = []
    const cadenas: CadenaComercialFi[] = []
    for (const it of items.rows) {
      const s = sig.get(Number(it.det_id)) as
        | {
            es_liquidacion?: boolean
            es_promo?: boolean
            cadena_comercial?: string
            descp_caso?: string
            caso_id?: number
            linea_codigo?: string
          }
        | undefined
      const cad = cadenaComercialFi({
        caso: it.caso_snapshot ?? s?.descp_caso ?? null,
        descp_caso: s?.descp_caso ?? it.caso_snapshot ?? null,
        caso_id: it.caso_id_snapshot ?? s?.caso_id ?? null,
        es_liquidacion: s?.es_liquidacion ?? null,
        es_promo: s?.es_promo ?? null,
        cadena_comercial: s?.cadena_comercial ?? null,
      })
      cadenas.push(cad)
      cont[cad] = (cont[cad] ?? 0) + 1
      detail.push({
        det_id: it.det_id,
        pp_id: it.pp_id,
        cajas: it.cantidad_cajas,
        caso_snap: it.caso_snapshot,
        caso_id: it.caso_id_snapshot,
        cad,
        pe: s
          ? {
              es_liq: s.es_liquidacion,
              es_promo: s.es_promo,
              cadena: s.cadena_comercial,
              descp_caso: s.descp_caso,
              linea: s.linea_codigo,
            }
          : null,
      })
    }
    console.log("CART_CADENAS", cont)
    console.log("CART_VIOLACION", violacionSegregacionCadenas(cadenas))
    console.log("CART_DETAIL", JSON.stringify(detail, null, 2))
  }

  // Wide scan: FIs Héctor last 3d — classify via ppd → stock? Or via PE match codes
  // For CP: join pedido_proveedor_detalle? Better: match PE by L+R+M+C from snapshot
  const mixFi = await c.query(`
    WITH det AS (
      SELECT fi.id AS fi_id, fi.caso AS fi_caso, fi.caso_id, fi.estado, fi.total_pares,
             count(*) OVER (PARTITION BY fi.id) AS n_lineas,
             d.ppd_id,
             d.linea_snapshot->>'linea_codigo' AS linea,
             d.linea_snapshot->>'ref_codigo' AS ref,
             d.linea_snapshot->>'material_code' AS mat,
             d.linea_snapshot->>'color_code' AS color
      FROM factura_interna fi
      JOIN factura_interna_detalle d ON d.factura_id = fi.id
      WHERE fi.vendedor_id = 1
        AND fi.created_at > now() - interval '3 days'
        AND fi.estado IN ('RESERVADA','CONFIRMADA')
    ),
    ranked AS (
      SELECT d.*,
        pe.es_liquidacion, pe.es_promo, pe.cadena_comercial, pe.descp_caso AS pe_caso,
        CASE
          WHEN COALESCE(pe.es_liquidacion, false)
            OR upper(COALESCE(pe.cadena_comercial,'')) = 'LIQUIDACION' THEN 'LIQUIDACION'
          WHEN COALESCE(pe.es_promo, false)
            OR upper(COALESCE(pe.cadena_comercial,'')) = 'PROMOCIONAL'
            OR upper(COALESCE(pe.descp_caso,'')) = 'PROMOCIONAL' THEN 'PROMOCIONAL'
          WHEN upper(COALESCE(d.fi_caso,'')) LIKE '%LIQUID%' THEN 'LIQUIDACION'
          WHEN upper(COALESCE(d.fi_caso,'')) LIKE '%PROMO%' THEN 'PROMOCIONAL'
          ELSE 'REGULAR'
        END AS cadena
      FROM det d
      LEFT JOIN LATERAL (
        SELECT es_liquidacion, es_promo, cadena_comercial, descp_caso
        FROM v_stock_pe_rimec pe
        WHERE pe.linea_codigo::text = d.linea
          AND pe.referencia_codigo::text = d.ref
          AND pe.material_code::text = d.mat
          AND pe.color_code::text = d.color
        LIMIT 1
      ) pe ON true
    )
    SELECT fi_id, fi_caso, estado, max(n_lineas) AS n_lineas, max(total_pares) AS pares,
           count(*) FILTER (WHERE cadena='LIQUIDACION') AS n_liq,
           count(*) FILTER (WHERE cadena='PROMOCIONAL') AS n_promo,
           count(*) FILTER (WHERE cadena='REGULAR') AS n_reg
    FROM ranked
    GROUP BY fi_id, fi_caso, estado
    HAVING count(DISTINCT cadena) > 1
    ORDER BY n_lineas DESC
    LIMIT 40
  `)
  console.log("FI_MIX_BY_PE_MATCH", JSON.stringify(mixFi.rows, null, 2))

  // Also classify by FI header caso alone is useless — check caso names LIQUIDACION in BD
  const casos = await c.query(`
    SELECT id, descripcion FROM caso_precio
    WHERE upper(descripcion) LIKE '%PROMO%' OR upper(descripcion) LIKE '%LIQUID%'
    ORDER BY id
  `).catch(async () => {
    const t = await c.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name ILIKE '%caso%' ORDER BY 1 LIMIT 30
    `)
    console.log("CASO_TABLES", t.rows)
    return { rows: [] as unknown[] }
  })
  console.log("CASOS_PROMO_LIQ", casos.rows)

  await c.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
