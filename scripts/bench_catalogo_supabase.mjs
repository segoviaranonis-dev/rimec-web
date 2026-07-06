import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();
if (!url || !key) {
  console.error("missing supabase env");
  process.exit(1);
}

const sb = createClient(url, key);

async function count(label, build) {
  const t0 = Date.now();
  let q = sb.from("v_stock_rimec").select("det_id", { count: "exact", head: true }).gt("cajas_disponibles", 0);
  q = build(q);
  const { count: n, error } = await q;
  if (error) {
    console.log("FAIL", label, error.message, `${Date.now() - t0}ms`);
    return;
  }
  console.log("OK ", label, n, "filas", `${Date.now() - t0}ms`);
}

await count("sin filtro PE", (q) => q);
await count("solo CP (filtro)", (q) =>
  q
    .or("origen_tipo.is.null,origen_tipo.neq.PRONTA_ENTREGA,origen_tipo.neq.PRONTA ENTREGA")
    .or("quincena_desc.is.null,quincena_desc.not.ilike.pronta entrega%"),
);

const t0 = Date.now();
const { data, error } = await sb
  .from("v_stock_rimec")
  .select("det_id")
  .gt("cajas_disponibles", 0)
  .or("origen_tipo.is.null,origen_tipo.neq.PRONTA_ENTREGA,origen_tipo.neq.PRONTA ENTREGA")
  .or("quincena_desc.is.null,quincena_desc.not.ilike.pronta entrega%")
  .order("descp_marca")
  .range(0, 999);
console.log("page1", data?.length ?? 0, error?.message ?? "ok", `${Date.now() - t0}ms`);
