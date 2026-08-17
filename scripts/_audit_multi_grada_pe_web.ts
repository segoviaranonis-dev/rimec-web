/**
 * Auditoría: misma L+R+M+C con ≥2 curvas/gradas distintas en PE.
 * Violación «mostrar todo» si Web mergea por color y pierde curvas.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { agruparTarjetasCatalogo } from "../lib/agruparTarjetasCatalogo";
import { gradasFmtFromRow } from "../lib/gradasFmt";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

type Row = {
  linea_codigo: string;
  referencia_codigo: string;
  material_code: string;
  color_code: string;
  descp_color?: string;
  grada?: string | null;
  grades_json?: unknown;
  cajas_disponibles?: number;
  saldo_pares?: number;
  det_id: number;
  descp_marca?: string;
  tipo_v2_id?: number;
  ramo_tipo?: string;
  origen_tipo?: string;
  [k: string]: unknown;
};

function molKey(r: Row) {
  return `${r.linea_codigo}-${r.referencia_codigo}-${r.material_code}-${r.color_code}`;
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const pages: Row[] = [];
  for (let page = 0; page < 12; page++) {
    const { data, error } = await sb
      .from("v_stock_pe_rimec")
      .select("*")
      .gt("cajas_disponibles", 0)
      .eq("ramo_tipo", "CALZADO")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    if (!data?.length) break;
    pages.push(...(data as Row[]));
    if (data.length < 1000) break;
  }

  console.log("PE_CALZADO_ROWS", pages.length);

  const byMol = new Map<string, Row[]>();
  for (const r of pages) {
    const k = molKey(r);
    if (!byMol.has(k)) byMol.set(k, []);
    byMol.get(k)!.push(r);
  }

  type Hit = {
    mol: string;
    marca: string;
    curvas: string[];
    pares: number[];
    totalP: number;
    dets: number[];
    webVariantes: number;
    webGradas: string[];
    lost: boolean;
  };

  const hits: Hit[] = [];
  for (const [mol, rows] of byMol) {
    if (rows.length < 2) continue;
    const curvas = new Map<string, number>();
    for (const r of rows) {
      const g =
        gradasFmtFromRow({
          grada: r.grada,
          grades_json: r.grades_json as never,
        }) ||
        String(r.grada ?? "").trim() ||
        "(sin)";
      curvas.set(g, (curvas.get(g) ?? 0) + Number(r.cajas_disponibles ?? r.saldo_pares ?? 0));
    }
    if (curvas.size < 2) continue;

    const cards = agruparTarjetasCatalogo(rows as never[], "PE", (r) =>
      Number((r as { cajas_disponibles?: number }).cajas_disponibles || 0),
    );
    const webGradas = cards.flatMap((c) => c.variantes.map((v) => v.gradas_fmt || "(sin)"));
    const webUnique = new Set(webGradas);
    const lost = webUnique.size < curvas.size;

    hits.push({
      mol,
      marca: String(rows[0].descp_marca ?? ""),
      curvas: [...curvas.keys()],
      pares: [...curvas.values()],
      totalP: [...curvas.values()].reduce((a, b) => a + b, 0),
      dets: rows.map((r) => r.det_id),
      webVariantes: cards.reduce((n, c) => n + c.variantes.length, 0),
      webGradas: [...webUnique],
      lost,
    });
  }

  hits.sort((a, b) => b.totalP - a.totalP);
  const lostHits = hits.filter((h) => h.lost);

  console.log("MOLS_MULTI_CURVA", hits.length);
  console.log("MOLS_WEB_PIERDE_CURVA", lostHits.length);
  console.log("\n=== CASOS QUE PIERDEN CURVA EN WEB (top 40) ===");
  for (const h of lostHits.slice(0, 40)) {
    console.log(
      `${h.mol} | ${h.marca} | stockCurvas=${h.curvas.length} ${h.curvas.map((c, i) => `${c}→${h.pares[i]}p`).join(" || ")} | webVars=${h.webVariantes} webGradas=[${h.webGradas.join(" | ")}] | dets=${h.dets.join(",")}`,
    );
  }

  const focus = hits.find((h) => h.mol.startsWith("1185-702"));
  console.log("\nFOCUS_1185_702", focus ?? "no hallado en sample");

  if (lostHits.length) {
    console.log(`\nFAIL_MOSTRAR_TODO_GRADAS n=${lostHits.length}`);
    process.exit(1);
  }
  console.log("\nPASS_TODAS_CURVAS_EN_WEB");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
