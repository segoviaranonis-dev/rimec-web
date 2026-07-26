/**
 * Smoke filtros catálogo — sin sesión (service role).
 * Uso: node scripts/smoke_filtros_catalogo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
};

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY") || get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!url || !key) {
  console.error("faltan env supabase");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function count(view, apply) {
  let q = sb.from(view).select("det_id", { count: "exact", head: true }).gt("cajas_disponibles", 0);
  q = apply(q);
  const { count, error } = await q;
  if (error) return { error: error.message };
  return { count };
}

const basePe = await count("v_stock_pe_rimec", (q) => q);
const peMarca = await count("v_stock_pe_rimec", (q) => q.eq("marca_id", 1));
const peGen = await count("v_stock_pe_rimec", (q) => q.eq("genero_codigo", "DAMAS"));
const peRamo = await count("v_stock_pe_rimec", (q) => q.eq("ramo_tipo", "CALZADO"));
const peConf = await count("v_stock_pe_rimec", (q) => q.eq("ramo_tipo", "CONFECCIONES"));
const peLiq = await count("v_stock_pe_rimec", (q) => q.eq("es_liquidacion", true));

const baseCp = await count("v_stock_rimec", (q) => q.eq("origen_tipo", "TRÁNSITO_PP"));
const cpMarca = await count("v_stock_rimec", (q) =>
  q.eq("origen_tipo", "TRÁNSITO_PP").eq("marca_id", 1),
);
const cpGen = await count("v_stock_rimec", (q) =>
  q.eq("origen_tipo", "TRÁNSITO_PP").eq("genero_codigo", "DAMAS"),
);

console.log("PE base", basePe);
console.log("PE marca_id=1", peMarca);
console.log("PE DAMAS", peGen);
console.log("PE CALZADO", peRamo);
console.log("PE CONFECCIONES", peConf);
console.log("PE LIQ", peLiq);
console.log("CP base", baseCp);
console.log("CP marca_id=1", cpMarca);
console.log("CP DAMAS", cpGen);

// Sample marcas with stock
const { data: marcas, error: me } = await sb
  .from("v_stock_pe_rimec")
  .select("marca_id, descp_marca")
  .gt("cajas_disponibles", 0)
  .eq("ramo_tipo", "CALZADO")
  .limit(200);
if (me) console.log("marcas err", me.message);
else {
  const m = new Map();
  for (const r of marcas ?? []) {
    if (!r.marca_id) continue;
    m.set(r.marca_id, (m.get(r.marca_id) || 0) + 1);
  }
  const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log("top marca_id PE calzado:", top);

  if (top[0]) {
    const mid = top[0][0];
    const filtered = await count("v_stock_pe_rimec", (q) =>
      q.eq("ramo_tipo", "CALZADO").eq("marca_id", mid),
    );
    console.log(`PE CALZADO + marca ${mid}`, filtered, "vs unfiltered", peRamo);
  }
}

// RPC meta
const { data: rpc, error: re } = await sb.rpc("rimec_catalogo_meta", {
  p_es_pe: true,
  p_marca_id: null,
  p_linea_ids: null,
  p_grupo_estilo_id: null,
  p_tipo_ids: null,
  p_genero_codigo: null,
  p_ramo_tipo: "CALZADO",
  p_deposito: null,
  p_quincena_ids: null,
});
console.log("RPC meta PE CALZADO:", re?.message || {
  marcas: rpc?.marcas?.length,
  lineas: rpc?.lineas?.length,
  estilos: rpc?.estilos?.length,
  generos: rpc?.generos?.length,
});

if (rpc?.marcas?.[0]?.id) {
  const mid = rpc.marcas[0].id;
  const { data: rpc2, error: re2 } = await sb.rpc("rimec_catalogo_meta", {
    p_es_pe: true,
    p_marca_id: mid,
    p_linea_ids: null,
    p_grupo_estilo_id: null,
    p_tipo_ids: null,
    p_genero_codigo: null,
    p_ramo_tipo: "CALZADO",
    p_deposito: null,
    p_quincena_ids: null,
  });
  console.log(`RPC meta PE + marca ${mid}:`, re2?.message || {
    marcas: rpc2?.marcas?.length,
    lineas: rpc2?.lineas?.length,
    firstLineas: rpc2?.lineas?.slice(0, 5),
  });
}
