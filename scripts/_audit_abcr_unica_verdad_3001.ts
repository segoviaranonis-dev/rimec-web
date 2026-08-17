/**
 * Auditoría única verdad AB-CR: PE Report (código) vs rimec-web :3001 API.
 * Canon: 2.3.5.9 · 2.2.1.47 · PE gana · sesión JWT (proxy auth).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SignJWT } from "jose";

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

const WEB = process.env.RIMEC_WEB_URL || "http://localhost:3001";

async function authHeaders(): Promise<Record<string, string>> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET ausente");
  const token = await new SignJWT({
    id_usuario: 1,
    name: "Audit",
    role: "ADMIN",
    categoria: "ADMIN",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  return { Cookie: `rimec_session=${token}` };
}

async function fetchWebFiltros(qs: string, headers: Record<string, string>) {
  const url = `${WEB}/api/catalogo/filtros?${qs}`;
  const t0 = Date.now();
  const res = await fetch(url, { cache: "no-store", headers });
  const ms = Date.now() - t0;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    const text = await res.text();
    return {
      ok: false,
      status: res.status,
      ms,
      j: { error: `non-json ${ct} head=${text.slice(0, 80)}` },
      url,
    };
  }
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, ms, j, url };
}

function labelsTipos(j: any): string[] {
  const t = j?.filtros?.todosTipos ?? j?.tipos ?? [];
  return (t as { label?: string }[])
    .map((x) => String(x.label ?? "").trim().toUpperCase())
    .filter(Boolean);
}

function labelsEstilos(j: any): string[] {
  const t = j?.filtros?.todosEstilos ?? j?.estilos ?? [];
  return (t as { label?: string }[])
    .map((x) => String(x.label ?? "").trim().toUpperCase())
    .filter(Boolean);
}

async function peCanonAbcr(): Promise<string[]> {
  const { loadPeAbcrTiposDesdeStock } = await import("../lib/catalogoPeAbcrTipos");
  const pe = await loadPeAbcrTiposDesdeStock({
    ramo_tipo: "CALZADO",
    deposito_codigo: "",
  } as never);
  return (pe ?? []).map((t) => String(t.label).trim().toUpperCase());
}

async function main() {
  console.log("WEB", WEB);
  const headers = await authHeaders();

  const peLabels = await peCanonAbcr();
  console.log("PE_CANON_ABCR", peLabels.join("|"));

  const land = await fetchWebFiltros("origen_tipo=TODOS&ramo_tipo=CALZADO", headers);
  const webLand = labelsTipos(land.j);
  console.log(
    "WEB_LANDING_ABCR",
    webLand.join("|") || `(vacío err=${land.j?.error ?? ""})`,
    `status=${land.status} ${land.ms}ms metaSource=${land.j?.metaSource ?? "?"}`,
  );

  const need = ["CARTERAS", "MEDIAS", "ABIERTO", "ACT PRENDAS", "CERRADO"];
  const missingLand = need.filter((n) => !webLand.includes(n));
  const orderOk =
    peLabels.length === webLand.length && peLabels.every((l, i) => l === webLand[i]);

  const carterasId = (land.j?.filtros?.todosTipos ?? []).find((t: { label?: string }) =>
    /CARTERA/i.test(String(t.label ?? "")),
  )?.id;
  console.log("CARTERAS_ID", carterasId);

  let carterasEstilos: string[] = [];
  let carterasMs = 0;
  let carterasCards = -1;
  if (carterasId != null) {
    const c = await fetchWebFiltros(
      `origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_ids=${encodeURIComponent(String(carterasId))}`,
      headers,
    );
    carterasEstilos = labelsEstilos(c.j);
    carterasMs = c.ms;
    console.log(
      "WEB_CARTERAS_ESTILOS",
      carterasEstilos.slice(0, 12).join("|") || "(VACIO)",
      `n=${carterasEstilos.length} ${c.ms}ms`,
    );

    const tr = await fetch(
      `${WEB}/api/catalogo/tarjetas?origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_ids=${carterasId}&limit=40&quick=1`,
      { headers, cache: "no-store" },
    );
    const tj = await tr.json().catch(() => ({}));
    carterasCards = (tj.tarjetas ?? []).length;
    console.log("WEB_CARTERAS_CARDS", carterasCards, `hasMore=${tj.hasMore}`);
  }

  // Legado URL tipo_ids=3 debe comportarse como CARTERAS (−1), no CERRADO
  const c3 = await fetchWebFiltros(
    "origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_ids=3",
    headers,
  );
  const estilos3 = labelsEstilos(c3.j);
  const tipos3 = labelsTipos(c3.j);
  console.log("WEB_TIPO_IDS_3_LEGADO", `tipos=${tipos3.join("|")} estilos=${estilos3.join("|")}`);

  const peOnly = await fetchWebFiltros("origen_tipo=PRONTA_ENTREGA&ramo_tipo=CALZADO", headers);
  const webPe = labelsTipos(peOnly.j);
  console.log("WEB_PE_ONLY_ABCR", webPe.join("|"), `${peOnly.ms}ms`);

  const fails: string[] = [];
  if (tipos3.includes("CERRADO") && !tipos3.includes("CARTERAS") && estilos3.includes("TENIS")) {
    fails.push("LEGADO_3_AUN_CERRADO");
  }
  if (!estilos3.includes("CARTERAS") && estilos3.length === 0) {
    fails.push("LEGADO_3_SIN_CARTERAS");
  }
  if (missingLand.length) fails.push(`LANDING_MISSING:${missingLand.join(",")}`);
  if (!orderOk) fails.push(`LANDING_ORDER_DIFF pe=${peLabels.join("|")} web=${webLand.join("|")}`);
  if (carterasId != null && carterasEstilos.length === 0) {
    fails.push("CARTERAS_ESTILO_VACIO (cascada rota vs PE)");
  }
  if (carterasId != null && carterasCards === 0) fails.push("CARTERAS_GRILLA_VACIA");
  if (carterasId != null && Number(carterasId) !== -1) {
    fails.push(`CARTERAS_ID_NO_SINTETICO got=${carterasId} want=-1`);
  }
  // Paridad PE: ~170 cards carteras; umbral bajo evita flaky por depósito/sesión.
  if (carterasId != null && carterasCards >= 0 && carterasCards < 20) {
    fails.push(`CARTERAS_GRILLA_POCAS cards=${carterasCards} (PE~170 · sospecha id BD)`);
  }
  if (webPe.length && need.some((n) => !webPe.includes(n))) {
    fails.push(`PE_ONLY_MISSING:${need.filter((n) => !webPe.includes(n)).join(",")}`);
  }

  console.log("\n=== AUDIT_ABCR_UNICA_VERDAD ===");
  if (fails.length) {
    for (const f of fails) console.log("FAIL", f);
    console.log("RESULT FAIL");
    process.exit(1);
  }
  console.log("PASS_ABCR_PE_WEB_PARIDAD");
  console.log(`latency_landing=${land.ms}ms carteras_meta=${carterasMs}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
