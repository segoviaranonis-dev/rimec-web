/**
 * Snapshot carrito + stock PPD/PE para reversión prueba E2E → Bazzar Web.
 * Uso: node scripts/prueba_e2e_snapshot_carrito.mjs [etiqueta]
 * Salida: ../ot/en_curso/PRUEBA-BAZZAR-SNAPSHOT-{etiqueta}.json
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no encontrada en rimec-web/.env.local");
  process.exit(1);
}

const tag = process.argv[2] ?? `T${Date.now()}`;
const outDir = path.resolve(root, "..", "ot", "en_curso");
const outFile = path.join(outDir, `PRUEBA-BAZZAR-SNAPSHOT-${tag}.json`);

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

async function main() {
  const sesiones = (
    await pool.query(`
      SELECT cs.*, u.login, u.categoria, u.rol_id, cv.cliente_id, cv.codigo AS cliente_codigo
      FROM carrito_sesion cs
      JOIN usuario_v2 u ON u.id = cs.id_usuario
      LEFT JOIN carrito_vinculo cv ON cv.id_usuario = cs.id_usuario
      ORDER BY cs.actualizado_en DESC NULLS LAST
    `)
  ).rows;

  const items = (
    await pool.query(`
      SELECT ci.*, u.login
      FROM carrito_item ci
      JOIN usuario_v2 u ON u.id = ci.id_usuario
      ORDER BY ci.id_usuario, ci.det_id, ci.pp_id
    `)
  ).rows;

  const detIds = [...new Set(items.map((i) => i.det_id).filter(Boolean))];
  let ppd = [];
  if (detIds.length) {
    ppd = (
      await pool.query(
        `
        SELECT ppd.id AS ppd_id, ppd.pedido_proveedor_id, ppd.det_id,
               ppd.cantidad_inicial, ppd.cantidad_pares AS saldo,
               ppd.pares_vendidos, pp.pp_nro, pp.categoria_id
        FROM pedido_proveedor_detalle ppd
        JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
        WHERE ppd.det_id = ANY($1::int[])
        ORDER BY ppd.det_id, ppd.id
      `,
        [detIds],
      )
    ).rows;
  }

  const recientesFi = (
    await pool.query(`
      SELECT fi.id, fi.nro, fi.estado, fi.cliente_id, fi.creado_en, u.login AS creado_por
      FROM factura_interna fi
      LEFT JOIN usuario_v2 u ON u.id = fi.usuario_id
      WHERE fi.creado_en > NOW() - INTERVAL '6 hours'
      ORDER BY fi.creado_en DESC
      LIMIT 30
    `)
  ).rows;

  const payload = {
    capturado_en: new Date().toISOString(),
    etiqueta: tag,
    proposito: "Reversión E2E RIMEC Web → FI → Bazzar Web · dejar stock limpio para pruebas",
    sesiones,
    carrito_items: items,
    ppd_por_det: ppd,
    fi_ultimas_6h: recientesFi,
    totales: {
      lineas_carrito: items.length,
      cajas_carrito: items.reduce((s, i) => s + Number(i.cantidad_cajas || 0), 0),
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
  console.log("snapshot_ok", outFile);
  console.log(
    JSON.stringify({
      lineas: payload.totales.lineas_carrito,
      cajas: payload.totales.cajas_carrito,
      sesiones: sesiones.length,
      fi_recientes: recientesFi.length,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
