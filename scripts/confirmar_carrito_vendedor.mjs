/**
 * Validar + confirmar carrito activo de un vendedor (hotfix operativo).
 * Uso: node scripts/confirmar_carrito_vendedor.mjs enrique
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
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

const buscar = (process.argv[2] ?? "enrique").toLowerCase();
const url = process.env.DATABASE_URL;
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !sbUrl || !sbKey) {
  console.error("Faltan DATABASE_URL / SUPABASE en .env.local");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

function calcNeto(base, d1, d2, d3, d4) {
  let p = Number(base) || 0;
  for (const d of [d1, d2, d3, d4]) {
    const n = Number(d) || 0;
    if (n > 0) p *= 1 - n / 100;
  }
  return Math.floor(p / 100) * 100;
}

function normDesc(raw) {
  const src = Array.isArray(raw) ? raw : [];
  return [0, 1, 2, 3].map((i) => Number(src[i]) || 0);
}

function tierPrecio(listaId, row) {
  const lpn = Number(row.lpn) || 0;
  const caso = String(row.descp_caso ?? "").trim().toUpperCase();
  const promo = caso === "PROMOCIONAL";
  switch (Number(listaId)) {
    case 1:
      return lpn;
    case 2:
      return Number(row.lpc02) || 0;
    case 3:
      return promo ? lpn : lpn > 0 ? Math.round(lpn * 1.12) : Number(row.lpc03) || 0;
    case 4:
      return promo ? lpn : lpn > 0 ? Math.round(lpn * 1.2) : Number(row.lpc04) || 0;
    default:
      return lpn;
  }
}

async function main() {
  const usuarios = (
    await pool.query(
      `SELECT id, login, descp_vendedor, id_vendedor
       FROM usuario_v2
       WHERE descp_vendedor ILIKE $1 OR login ILIKE $1
       ORDER BY id LIMIT 5`,
      [`%${buscar}%`],
    )
  ).rows;

  if (!usuarios.length) {
    console.error("Sin usuario para:", buscar);
    process.exit(1);
  }

  const u = usuarios[0];
  const idUsuario = Number(u.id);
  console.log("usuario", { id: idUsuario, login: u.login, vendedor: u.descp_vendedor });

  const sesionRes = await pool.query(`SELECT * FROM carrito_sesion WHERE id_usuario = $1`, [idUsuario]);
  const sesion = sesionRes.rows[0];
  if (!sesion) {
    console.error("Sin carrito_sesion activa");
    process.exit(1);
  }

  const itemsRes = await pool.query(`SELECT * FROM carrito_item WHERE id_usuario = $1`, [idUsuario]);
  const items = itemsRes.rows;
  if (!items.length) {
    console.error("Carrito vacío");
    process.exit(1);
  }

  console.log("items", items.length, "cliente", sesion.cliente_nombre);

  const detIds = items.map((i) => Number(i.det_id));
  const stockRes = await pool.query(
    `SELECT det_id, lpn, lpc02, lpc03, lpc04, descp_caso, cajas_disponibles,
            linea_codigo, referencia_codigo, descp_color, pp_nro, proforma, quincena_desc,
            pares_por_caja, grades_json, pp_id, origen_tipo
     FROM v_stock_rimec WHERE det_id = ANY($1::int[])`,
    [detIds],
  );
  const stockMap = new Map(stockRes.rows.map((r) => [Number(r.det_id), r]));

  const facturas = sesion.descuentos_lote?.facturas ?? [];
  let recalculados = 0;
  for (const item of items) {
    const detId = Number(item.det_id);
    const stock = stockMap.get(detId);
    if (!stock) continue;
    const fi = facturas.find(
      (f) =>
        Number(f.pp_id) === Number(item.pp_id) &&
        String(f.marca) === String(item.marca_snapshot) &&
        String(f.caso) === String(item.caso_snapshot),
    );
    const listaId = Number(fi?.lista_precio_id ?? sesion.lista_precio_id ?? 3);
    const desc = normDesc(fi?.descuentos ?? sesion.descuentos ?? []);
    const bruto = tierPrecio(listaId, stock);
    const neto = calcNeto(bruto, desc[0], desc[1], desc[2], desc[3]);
    if (neto > 0 && Number(item.precio_snapshot) !== neto) {
      await pool.query(
        `UPDATE carrito_item SET precio_snapshot = $1, actualizado_en = now() WHERE id_usuario = $2 AND det_id = $3`,
        [neto, idUsuario, detId],
      );
      item.precio_snapshot = neto;
      recalculados++;
    }
  }

  const tokenRes = await pool.query(
    `UPDATE carrito_sesion
     SET validacion_token = gen_random_uuid(),
         validacion_estado = 'OK',
         validada_en = now(),
         actualizada_en = now()
     WHERE id_usuario = $1
     RETURNING validacion_token, cliente_id, plazo_id, lista_precio_id, descuentos, descuentos_lote`,
    [idUsuario],
  );
  const token = tokenRes.rows[0].validacion_token;
  console.log("validar_ok", { token, recalculados });

  const descCab = normDesc(sesion.descuentos);
  const byPp = new Map();
  for (const item of items) {
    const k = Number(item.pp_id);
    if (!byPp.has(k)) byPp.set(k, []);
    byPp.get(k).push(item);
  }

  const lotes = [];
  let totalPares = 0;
  let totalNeto = 0;

  for (const [ppId, ppItems] of byPp) {
    const stock0 = stockMap.get(Number(ppItems[0].det_id));
    const byMarca = new Map();
    for (const it of ppItems) {
      const m = String(it.marca_snapshot || "Sin marca");
      if (!byMarca.has(m)) byMarca.set(m, []);
      byMarca.get(m).push(it);
    }

    const marcasOut = [];
    let lotePares = 0;
    let loteMonto = 0;
    let fiCount = 0;

    for (const [marca, mItems] of byMarca) {
      const byCaso = new Map();
      for (const it of mItems) {
        const id = it.caso_id_snapshot;
        let key;
        if (id != null && Number(id) > 0) key = `id:${Number(id)}`;
        else {
          const nom = String(it.caso_snapshot || "").trim().toUpperCase();
          key = nom ? `nom:${nom}` : "sin_caso";
        }
        if (!byCaso.has(key)) byCaso.set(key, []);
        byCaso.get(key).push(it);
      }

      const facturasOut = [];
      for (const [, cItems] of byCaso) {
        const casoId =
          cItems.find((i) => i.caso_id_snapshot != null && Number(i.caso_id_snapshot) > 0)
            ?.caso_id_snapshot ?? null;
        const nom =
          cItems.find((i) => String(i.caso_snapshot || "").trim())?.caso_snapshot || "";
        const caso =
          String(nom).trim() ||
          (casoId != null && Number(casoId) > 0 ? `Caso #${Number(casoId)}` : "Sin caso");
        const fi = facturas.find(
          (f) =>
            Number(f.pp_id) === ppId &&
            String(f.marca) === marca &&
            ((casoId != null &&
              f.caso_id != null &&
              Number(f.caso_id) === Number(casoId)) ||
              String(f.caso) === caso),
        );
        const listaId = Number(fi?.lista_precio_id ?? sesion.lista_precio_id ?? 3);
        const desc = normDesc(fi?.descuentos ?? descCab);
        const itemsOut = cItems.map((it) => {
          const st = stockMap.get(Number(it.det_id));
          const cajas = Number(it.cantidad_cajas) || 0;
          const ppc = Number(st?.pares_por_caja) || 12;
          const pares = cajas * ppc;
          const bruto = tierPrecio(listaId, st ?? {});
          const neto = calcNeto(bruto, desc[0], desc[1], desc[2], desc[3]);
          const subtotal = neto * pares;
          return {
            det_id: Number(it.det_id),
            linea_codigo: String(st?.linea_codigo ?? ""),
            ref_codigo: String(st?.referencia_codigo ?? ""),
            color_nombre: String(st?.descp_color ?? ""),
            gradas_fmt: "",
            imagen_url: "",
            cajas,
            pares,
            precio_base: bruto,
            precio_neto: neto,
            subtotal,
          };
        });
        const fiPares = itemsOut.reduce((s, x) => s + x.pares, 0);
        const fiMonto = itemsOut.reduce((s, x) => s + x.subtotal, 0);
        fiCount++;
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
        });
        lotePares += fiPares;
        loteMonto += fiMonto;
      }

      marcasOut.push({
        marca,
        marca_id: mItems[0].marca_id_snapshot ?? null,
        total_pares: facturasOut.reduce((s, f) => s + f.total_pares, 0),
        total_monto: facturasOut.reduce((s, f) => s + f.total_monto, 0),
        cantidad_facturas: facturasOut.length,
        facturas: facturasOut,
      });
    }

    totalPares += lotePares;
    totalNeto += loteMonto;
    lotes.push({
      pp_id: ppId,
      pp_nro: String(stock0?.pp_nro ?? ""),
      proforma: String(stock0?.proforma ?? ""),
      quincena: String(stock0?.quincena_desc ?? ""),
      origen_pe: ppId < 0,
      total_pares: lotePares,
      total_monto: loteMonto,
      facturas: marcasOut.flatMap((m) => m.facturas),
    });
  }

  const payload = {
    cliente_id: Number(sesion.cliente_id),
    cliente_nombre: String(sesion.cliente_nombre ?? ""),
    vendedor_id: u.id_vendedor ?? null,
    vendedor_nombre: String(u.descp_vendedor ?? ""),
    plazo_id: Number(sesion.plazo_id),
    plazo_nombre: String(sesion.plazo_nombre ?? ""),
    lista_precio_id: Number(sesion.lista_precio_id ?? 3),
    lista_nombre: "LPC03",
    descuento_1: descCab[0],
    descuento_2: descCab[1],
    descuento_3: descCab[2],
    descuento_4: descCab[3],
    total_pares: totalPares,
    total_neto: totalNeto,
    fecha: new Date().toISOString(),
    lotes,
  };

  const sb = createClient(sbUrl, sbKey);
  const { data, error } = await sb.rpc("confirmar_pedido_web", {
    p_cliente_id: Number(sesion.cliente_id),
    p_vendedor_id: u.id_vendedor ?? null,
    p_plazo_id: Number(sesion.plazo_id),
    p_lista_precio_id: Number(sesion.lista_precio_id ?? 3),
    p_descuento_1: descCab[0],
    p_descuento_2: descCab[1],
    p_descuento_3: descCab[2],
    p_descuento_4: descCab[3],
    p_total_pares: totalPares,
    p_total_monto: totalNeto,
    p_payload: payload,
    p_validacion_token: token,
  });

  if (error) {
    console.error("confirmar_FAIL", error.message);
    process.exit(1);
  }

  if (!data?.success) {
    console.error("confirmar_FAIL", data);
    process.exit(1);
  }

  await pool.query(`DELETE FROM carrito_item WHERE id_usuario = $1`, [idUsuario]);
  await pool.query(`DELETE FROM carrito_sesion WHERE id_usuario = $1`, [idUsuario]);

  console.log("confirmar_OK", JSON.stringify(data, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
