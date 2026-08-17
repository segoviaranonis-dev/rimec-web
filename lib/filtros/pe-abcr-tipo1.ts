/**
 * AB-CR Tipo1 PE — merge sidebar (Carteras · Anteojos · Medias · Escolar + temporada + OTROS).
 * Solo opciones presentes en el stock / filas (filosofía Nexus · sin hardcode fantasma).
 * Canon: ACT PRENDAS · vacío → OTROS (Director 2026-08-16).
 */
import {
  ABCR_OTROS_ITEM,
  PE_TIPO1_ACT_PRENDAS,
  PE_TIPO1_OTROS_ID,
  canonPeTipo1Valorizado,
  esTipo1Vacio,
} from "@/lib/filtros/pe-valorizado-tipo1";
import {
  ABCR_MEDIAS_ITEM,
  esFilaMedias,
  esLabelMedias,
  PE_TIPO1_MEDIAS_ID,
} from "@/lib/filtros/pe-modulo-medias";
import {
  ABCR_ESCOLAR_ITEM,
  esFilaEscolar,
  PE_TIPO1_ESCOLAR_ID,
} from "@/lib/filtros/pe-modulo-escolar";
import {
  ACCESORIOS_SUBTIPO_SYNTHETIC_ID,
  accesoriosSubtipoOpcionesSidebar,
  esLabelModuloAccesorios,
  subtipoAccesoriosKey,
  type AccesoriosSubtipoKey,
} from "@/lib/filtros/modulo-accesorios";

const TEMPORADA_ORDER = [
  "ABIERTO",
  PE_TIPO1_ACT_PRENDAS,
  "CERRADO",
  "ESCOLAR",
  "INVIERNO",
  "VERANO",
  "OTROS",
] as const;

/**
 * Chip AB-CR → label canónico (única verdad).
 * En PE el mismo tipo_1_id mezcla labels (id 3 = CARTERAS mayoritario + CERRADO residual).
 * Match por label, no por FK. id 3 legado = chip CARTERAS (antes del sintético −1).
 */
export function peAbcrCanonLabelForChipId(id: number): string | null {
  if (id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID.CARTERAS || id === 3) return "CARTERAS";
  if (id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID.LENTES) return "ANTEOJOS";
  if (id === PE_TIPO1_ESCOLAR_ID) return "ESCOLAR";
  if (id === PE_TIPO1_MEDIAS_ID || id === 4) return "MEDIAS";
  if (id === PE_TIPO1_OTROS_ID) return "OTROS";
  if (id === 1) return "ABIERTO";
  if (id === 2) return "CERRADO";
  if (id === 5) return PE_TIPO1_ACT_PRENDAS;
  return null;
}

/** Labels crudos en BD/vista para densificar SQL (canon UI ≠ texto stock). */
export function peAbcrSqlLabelsForChipId(id: number): string[] {
  const canon = peAbcrCanonLabelForChipId(id);
  if (!canon) return [];
  if (canon === PE_TIPO1_ACT_PRENDAS) {
    return ["ACT PRENDAS", "ACT ROPAS", "PRENDAS", "ACT. ROPAS"];
  }
  if (canon === "ANTEOJOS") return ["ANTEOJOS", "LENTES", "OCULOS"];
  if (canon === "CARTERAS") return ["CARTERAS", "CARTERA"];
  return [canon];
}

/** URL/estado: id 3 legado → −1 CARTERAS (evita UI «seleccioné cartera y pasó a CERRADO»). */
export function sanitizePeAbcrTipoIds(ids: readonly number[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const raw of ids) {
    const id = Number(raw);
    if (!Number.isFinite(id)) continue;
    const fixed = id === 3 ? ACCESORIOS_SUBTIPO_SYNTHETIC_ID.CARTERAS : id;
    if (seen.has(fixed)) continue;
    seen.add(fixed);
    out.push(fixed);
  }
  return out;
}

export type PeAbcrStockSignals = {
  hasMedias?: boolean;
  hasEscolar?: boolean;
  hasCarteras?: boolean;
  hasLentes?: boolean;
  hasOtros?: boolean;
};

export function peAbcrSignalsFromRows(
  rows: ReadonlyArray<{
    tipo_1?: string | null;
    descp_tipo_1?: string | null;
    tipo_1_id?: number | null;
    sdrm_tipo1?: string | null;
    marca?: string | null;
    sdrm_marca?: string | null;
    cod_grupo?: string | null;
    linea_codigo_proveedor?: string | null;
    estilo?: string | null;
    descp_grupo_estilo?: string | null;
    descp_estilo?: string | null;
    codigo_barras?: string | null;
    proveedor_id?: number | null;
    referencia_codigo_proveedor?: string | null;
    cantidad?: number | null;
  }>,
): PeAbcrStockSignals {
  let hasMedias = false;
  let hasEscolar = false;
  let hasCarteras = false;
  let hasLentes = false;
  let hasOtros = false;
  for (const r of rows) {
    if ((r.cantidad ?? 1) <= 0) continue;
    if (!hasMedias && esFilaMedias(r)) hasMedias = true;
    if (!hasEscolar && esFilaEscolar(r)) hasEscolar = true;
    const sub = subtipoAccesoriosKey(r);
    if (sub === "CARTERAS") hasCarteras = true;
    if (sub === "LENTES") hasLentes = true;
    const rawTipo = r.tipo_1 ?? r.descp_tipo_1 ?? r.sdrm_tipo1;
    if (
      !hasOtros &&
      (r.tipo_1_id == null || esTipo1Vacio(rawTipo) || canonPeTipo1Valorizado(rawTipo) === "OTROS")
    ) {
      hasOtros = true;
    }
    if (hasMedias && hasEscolar && hasCarteras && hasLentes && hasOtros) break;
  }
  return { hasMedias, hasEscolar, hasCarteras, hasLentes, hasOtros };
}

export function mergePeAbcrTipo1Items(
  tipos: { id: number; label: string }[],
  signals?: PeAbcrStockSignals | null,
): { id: number; label: string }[] {
  const sig = signals ?? {};
  const accKeysWanted = new Set<AccesoriosSubtipoKey>();
  if (sig.hasCarteras) accKeysWanted.add("CARTERAS");
  if (sig.hasLentes) accKeysWanted.add("LENTES");

  const acc = accesoriosSubtipoOpcionesSidebar(tipos).filter((a) => {
    const u = String(a.label).trim().toUpperCase();
    const key: AccesoriosSubtipoKey | null =
      u === "CARTERAS" || u === "CARTERA"
        ? "CARTERAS"
        : u === "ANTEOJOS" || u === "LENTES" || u.includes("ANTEOJ")
          ? "LENTES"
          : null;
    if (!key) return false;
    if (accKeysWanted.has(key)) return true;
    return tipos.some((t) => {
      const tu = canonPeTipo1Valorizado(t.label);
      return key === "CARTERAS"
        ? tu === "CARTERAS" || tu === "CARTERA"
        : tu === "LENTES" || tu.includes("ANTEOJ") || tu.includes("LENT");
    });
  });

  for (const key of accKeysWanted) {
    if (
      acc.some(
        (a) =>
          a.id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID[key] ||
          a.label.toUpperCase().includes(key === "LENTES" ? "ANTEOJ" : "CARTER"),
      )
    ) {
      continue;
    }
    const label = key === "LENTES" ? "ANTEOJOS" : "CARTERAS";
    acc.push({ id: ACCESORIOS_SUBTIPO_SYNTHETIC_ID[key]!, label });
  }

  const accKeys = new Set(acc.map((a) => a.label.toUpperCase()));

  const byLabel = new Map<string, { id: number; label: string }>();
  for (const t of tipos) {
    const id = Number(t.id);
    const u = canonPeTipo1Valorizado(t.label);
    // Sintéticos AB-CR (id ≤ 0): conservar por label / id canónico — no inventar, no tirar.
    if (id === PE_TIPO1_ESCOLAR_ID || u === "ESCOLAR") {
      byLabel.set("ESCOLAR", { ...ABCR_ESCOLAR_ITEM });
      continue;
    }
    if (id === PE_TIPO1_MEDIAS_ID || u === "MEDIAS") {
      byLabel.set("MEDIAS", { ...ABCR_MEDIAS_ITEM });
      continue;
    }
    if (id <= 0) continue;
    if (!u || u === "OTROS") continue;
    if (accKeys.has(u) || esLabelModuloAccesorios(u)) continue;
    if (!byLabel.has(u)) byLabel.set(u, { id, label: u });
  }

  if (sig.hasMedias || byLabel.has("MEDIAS")) {
    byLabel.set("MEDIAS", { ...ABCR_MEDIAS_ITEM });
  }
  if (sig.hasEscolar || byLabel.has("ESCOLAR")) {
    byLabel.set("ESCOLAR", { ...ABCR_ESCOLAR_ITEM });
  }
  if (sig.hasOtros) {
    byLabel.set("OTROS", { ...ABCR_OTROS_ITEM });
  }

  const upper = (label: string) =>
    canonPeTipo1Valorizado(label) || String(label).trim().toUpperCase();

  const temporada = TEMPORADA_ORDER.filter((k) => byLabel.has(k)).map((k) => ({
    ...byLabel.get(k)!,
    label: upper(byLabel.get(k)!.label),
  }));

  const rest = [...byLabel.entries()]
    .filter(
      ([k]) =>
        !TEMPORADA_ORDER.includes(k as (typeof TEMPORADA_ORDER)[number]) &&
        k !== "MEDIAS" &&
        k !== "OTROS",
    )
    .map(([, v]) => ({ ...v, label: upper(v.label) }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  const mediasChip =
    sig.hasMedias || byLabel.has("MEDIAS")
      ? [{ id: PE_TIPO1_MEDIAS_ID, label: "MEDIAS" as const }]
      : [];

  return [
    ...acc.map((t) => ({
      ...t,
      // UI: ANTEOJOS (no colapsar a LENTES en chip)
      label: String(t.label).trim().toUpperCase().includes("ANTEOJ")
        ? "ANTEOJOS"
        : String(t.label).trim().toUpperCase() === "CARTERAS" ||
            String(t.label).trim().toUpperCase() === "CARTERA"
          ? "CARTERAS"
          : upper(t.label),
    })),
    ...mediasChip,
    ...temporada,
    ...rest,
  ];
}

export function rowMatchesPeAbcrTipo1(
  row: {
    tipo_1_id?: number | null;
    tipo_1?: string | null;
    descp_tipo_1?: string | null;
    sdrm_tipo1?: string | null;
    marca?: string | null;
    sdrm_marca?: string | null;
    cod_grupo?: string | null;
    linea_codigo?: string | null;
    linea_codigo_proveedor?: string | null;
    estilo?: string | null;
    descp_grupo_estilo?: string | null;
    descp_estilo?: string | null;
  },
  tipo1Ids: readonly number[],
): boolean {
  if (!tipo1Ids.length) return true;

  const raw = row.tipo_1 ?? row.descp_tipo_1 ?? row.sdrm_tipo1;
  const canon = canonPeTipo1Valorizado(raw);

  for (const id of sanitizePeAbcrTipoIds(tipo1Ids)) {
    if (id === PE_TIPO1_ESCOLAR_ID && esFilaEscolar(row)) return true;
    if (id === PE_TIPO1_MEDIAS_ID && esFilaMedias(row)) return true;
    if (id === PE_TIPO1_OTROS_ID) {
      if (row.tipo_1_id == null || esTipo1Vacio(raw) || canon === "OTROS") return true;
      continue;
    }
    if (id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID.CARTERAS) {
      if (subtipoAccesoriosKey(row) === "CARTERAS") return true;
      continue;
    }
    if (id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID.LENTES) {
      if (subtipoAccesoriosKey(row) === "LENTES") return true;
      continue;
    }
    const want = peAbcrCanonLabelForChipId(id);
    if (want) {
      if (esFilaEscolar(row) && want !== "ESCOLAR") continue;
      if (canon === want) return true;
      continue;
    }
    if (id > 0 && esLabelMedias(row.tipo_1) && id === PE_TIPO1_MEDIAS_ID) return true;
  }
  return false;
}
