import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync("c:/Users/hecto/Nexus_Core/rimec-web/.env.local", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");

const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from("v_stock_rimec")
  .select("descp_grupo_estilo,descp_material,descp_color,genero_codigo,descp_tipo_1")
  .eq("pp_id", 49)
  .gt("cajas_disponibles", 0);

if (error) {
  console.error(error);
  process.exit(1);
}

const estilos = [...new Set(data.map((r) => r.descp_grupo_estilo).filter(Boolean))].sort();
const generos = [...new Set(data.map((r) => r.genero_codigo).filter(Boolean))].sort();
const abcr = [...new Set(data.map((r) => r.descp_tipo_1).filter(Boolean))].sort();

console.log("filas", data.length);
console.log("estilos_sidebar", estilos);
console.log("generos", generos);
console.log("abcr", abcr);
console.log("material_fam_sample", [...new Set(data.map((r) => r.descp_material))].slice(0, 5));
