import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync("c:/Users/hecto/Nexus_Core/rimec-web/.env.local", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");

const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from("v_stock_rimec")
  .select("marca_id,descp_marca,descp_tipo_1,descp_grupo_estilo,genero_codigo,ramo_tipo,numero_preventa")
  .eq("pp_id", 49)
  .gt("cajas_disponibles", 0);

if (error) {
  console.error(error);
  process.exit(1);
}

const marcas = [...new Set(data.map((r) => r.descp_marca))];
const abcr = [...new Set(data.map((r) => r.descp_tipo_1).filter(Boolean))];
const estilos = [...new Set(data.map((r) => r.descp_grupo_estilo).filter(Boolean))];
const generos = [...new Set(data.map((r) => r.genero_codigo).filter(Boolean))];

console.log("filas", data.length);
console.log("marcas", marcas);
console.log("abcr", abcr);
console.log("estilos", estilos);
console.log("generos", generos);
console.log("sin_abcr", data.filter((r) => !r.descp_tipo_1).length);
