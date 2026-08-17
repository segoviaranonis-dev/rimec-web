/**
 * Simula agruparTarjetasCatalogo para 1185-702-7286-15745
 * npx tsx scripts/_sim_agrupar_1185.ts
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { agruparTarjetasCatalogo } from "../lib/agruparTarjetasCatalogo";
import { resolveParesPorCaja } from "../lib/prontaEntregaVenta";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
};

async function main() {
  const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL")!, get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb
    .from("v_stock_pe_rimec")
    .select("*")
    .eq("linea_codigo", "1185")
    .eq("referencia_codigo", "702")
    .eq("material_code", "7286")
    .eq("color_code", "15745")
    .gt("cajas_disponibles", 0)
    .order("det_id");
  if (error) throw error;

  console.log(
    "raw",
    data!.map((r) => ({
      det: r.det_id,
      cajas: r.cajas_disponibles,
      saldo: r.saldo_pares,
      cant_cajas: r.cantidad_cajas,
      cant_pares: r.cantidad_pares,
      ppc_vista: r.pares_por_caja,
    })),
  );

  const cards = agruparTarjetasCatalogo(data as never[], "PE", (r) =>
    Number((r as { cajas_disponibles?: number }).cajas_disponibles || 0),
  );
  console.log("cards", cards.length);
  for (const c of cards) {
    console.log("cardKey", c.cardKey, "variantes", c.variantes.length);
    for (const v of c.variantes) {
      const ppc = resolveParesPorCaja({
        pares_por_caja: v.pares_por_caja,
        cantidad_cajas: v.cantidad_cajas,
        saldo_pares: v.saldo_pares,
        origen_tipo: c.origen_tipo,
        det_id: v.det_id,
        pp_id: v.pp_id,
      });
      console.log({
        det_id: v.det_id,
        cajas_ui: v.cajas_disponibles,
        saldo_pares_campo: v.saldo_pares,
        ppc,
        pares_ui_cajas_x_ppc: v.cajas_disponibles * ppc,
      });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
