import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
const sb = createClient(url, key, { auth: { persistSession: false } });

async function call(esPe, ramo) {
  const { data, error } = await sb.rpc("rimec_catalogo_meta", {
    p_es_pe: esPe,
    p_marca_id: null,
    p_linea_ids: null,
    p_grupo_estilo_id: null,
    p_tipo_ids: null,
    p_genero_codigo: null,
    p_ramo_tipo: ramo,
    p_deposito: null,
    p_quincena_ids: null,
  });
  if (error) return { error: error.message };
  return { marcas: data?.marcas?.length ?? 0, tipos: data?.tipos?.length ?? 0 };
}

console.log("CP", await call(false, "CALZADO"));
console.log("PE", await call(true, "CALZADO"));

const h = await sb.rpc("rimec_catalogo_header_meta");
console.log("header", h.error?.message ?? `marcas=${h.data?.global?.marcas?.length ?? 0}`);

await sb.from("v_stock_rimec").select("det_id", { count: "exact", head: true }).gt("cajas_disponibles", 0);
const cpCount = await sb.from("v_stock_rimec").select("det_id", { count: "exact", head: true }).gt("cajas_disponibles", 0);
console.log("v_stock_rimec cajas>0", cpCount.count, cpCount.error?.message);
