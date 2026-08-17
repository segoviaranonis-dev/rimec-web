/**
 * Re-audit grillas Compra previa (CP) + Stock pronta entrega (PE) pre-deploy.
 * Multi-grada PE · sample CP calzado · cardKeys agrupar.
 *
 * npx tsx scripts/_audit_grillas_cp_pe_predeploy.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { agruparTarjetasCatalogo } from "../lib/agruparTarjetasCatalogo";
import { gradasFmtFromRow } from "../lib/gradasFmt";
import { cajasDisponiblesDeFila } from "../lib/disponibilidad";

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

type Row = Record<string, unknown> & {
  linea_codigo: string;
  referencia_codigo: string;
  material_code: string;
  color_code: string;
  det_id: number;
  grada?: string | null;
  grades_json?: unknown;
  cajas_disponibles?: number;
  saldo_pares?: number;
  ramo_tipo?: string;
  origen_tipo?: string;
  tipo_v2_id?: number;
};

function molKey(r: Row) {
  return `${r.linea_codigo}-${r.referencia_codigo}-${r.material_code}-${r.color_code}`;
}

async function fetchView(
  sb: ReturnType<typeof createClient>,
  view: string,
  maxPages: number,
): Promise<Row[]> {
  const pages: Row[] = [];
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await sb
      .from(view)
      .select("*")
      .gt("cajas_disponibles", 0)
      .eq("ramo_tipo", "CALZADO")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`${view}: ${error.message}`);
    if (!data?.length) break;
    pages.push(...(data as Row[]));
    if (data.length < 1000) break;
  }
  return pages;
}

function auditMultiGrada(label: string, pages: Row[]) {
  const byMol = new Map<string, Row[]>();
  for (const r of pages) {
    const k = molKey(r);
    if (!byMol.has(k)) byMol.set(k, []);
    byMol.get(k)!.push(r);
  }
  let multi = 0;
  let lose = 0;
  for (const [, rows] of byMol) {
    if (rows.length < 2) continue;
    const curvas = new Set<string>();
    for (const r of rows) {
      const g =
        gradasFmtFromRow({
          grada: r.grada,
          grades_json: r.grades_json as never,
        }) ||
        String(r.grada ?? "").trim() ||
        "(sin)";
      curvas.add(g);
    }
    if (curvas.size < 2) continue;
    multi++;
    const cards = agruparTarjetasCatalogo(rows as never, "PE", cajasDisponiblesDeFila);
    const webG = new Set<string>();
    for (const c of cards) {
      for (const v of c.variantes ?? []) {
        const g = String(v.gradas_fmt ?? "").trim() || "(sin)";
        webG.add(g);
      }
    }
    for (const g of curvas) {
      if (!webG.has(g)) {
        lose++;
        break;
      }
    }
  }
  console.log(`${label}_ROWS`, pages.length);
  console.log(`${label}_MOLS_MULTI_CURVA`, multi);
  console.log(`${label}_MOLS_WEB_PIERDE_CURVA`, lose);
  if (lose > 0) throw new Error(`FAIL ${label} pierde curvas: ${lose}`);
  console.log(`PASS_${label}_TODAS_CURVAS`);
}

function auditSampleAgrupar(label: string, pages: Row[]) {
  const sample = pages.slice(0, 800);
  const cards = agruparTarjetasCatalogo(sample as never, label, cajasDisponiblesDeFila);
  const dets = new Set(sample.map((r) => r.det_id));
  let varDets = 0;
  for (const c of cards) {
    for (const v of c.variantes ?? []) {
      if (dets.has(v.det_id)) varDets++;
    }
  }
  console.log(`${label}_SAMPLE_ROWS`, sample.length);
  console.log(`${label}_SAMPLE_CARDS`, cards.length);
  console.log(`${label}_SAMPLE_VARIANTES_CON_DET`, varDets);
  if (cards.length === 0 && sample.length > 0) {
    throw new Error(`FAIL ${label} agrupar vacío`);
  }
  console.log(`PASS_${label}_AGRUPAR_SAMPLE`);
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  console.log("=== PE CALZADO ===");
  const pe = await fetchView(sb, "v_stock_pe_rimec", 12);
  auditMultiGrada("PE", pe);
  auditSampleAgrupar("PE", pe);

  console.log("\n=== CP CALZADO (v_stock_rimec) ===");
  const cp = await fetchView(sb, "v_stock_rimec", 8);
  auditMultiGrada("CP", cp);
  auditSampleAgrupar("CP", cp);

  console.log("\nPASS_GRILLAS_CP_PE_PREDEPLOY");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
