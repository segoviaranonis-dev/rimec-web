/**
 * Scope de catálogo por login — aligerar grilla RIMEC Web.
 *
 * · Confecciones 638: PATRICIA · DARIO (solo 638 · 654 prohibido)
 * · Calzado 654: resto vendedores RIMEC (solo 654 · 638 prohibido)
 * · Libre: DIOS / ADMIN (salvo Patricia) / Bazzar / etc.
 */

export type CatalogoRamoScope = "libre" | "calzado" | "confecciones";

const SOLO_CONFECCIONES_LOGIN = new Set(["PATRICIA", "DARIO"]);

/** Vendedores RIMEC — solo calzado 654 (638 prohibido). */
const SOLO_CALZADO_LOGIN = new Set([
  "ATI",
  "CARINA",
  "CESAR",
  "DERLIS",
  "EDUARDO",
  "EDUARDO ARAUJO G",
  "EDUARDO ARAUJO G.",
  "ENRIQUE",
  "GIANINA",
  "GRICELDA",
  "HUGO",
  "IRMA",
  "LILI",
  "LILIANA",
  "LUIS",
  "LUISLV",
  "MARCELO",
  "MARIO",
  "YRMA",
]);

function normalizeLogin(name?: string | null): string {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCatalogoRamoScope(name?: string | null): CatalogoRamoScope {
  const n = normalizeLogin(name);
  if (!n) return "libre";
  if (SOLO_CONFECCIONES_LOGIN.has(n)) return "confecciones";
  const first = n.split(" ")[0] ?? n;
  if (SOLO_CONFECCIONES_LOGIN.has(first)) return "confecciones";
  if (SOLO_CALZADO_LOGIN.has(n) || SOLO_CALZADO_LOGIN.has(first)) return "calzado";
  return "libre";
}

export function esUsuarioSoloCalzado(name?: string | null): boolean {
  return resolveCatalogoRamoScope(name) === "calzado";
}

export function esUsuarioSoloConfecciones(name?: string | null): boolean {
  return resolveCatalogoRamoScope(name) === "confecciones";
}

type ConRamo = {
  ramo_tipo?: "" | "CALZADO" | "CONFECCIONES" | "ACCESORIOS";
};

/** Pisa ramo según scope del login (servidor + SSR). */
export function applyCatalogoScopeUsuario<T extends ConRamo>(
  filters: T,
  name?: string | null,
): T {
  const scope = resolveCatalogoRamoScope(name);
  if (scope === "calzado") {
    if (filters.ramo_tipo === "CALZADO") return filters;
    return { ...filters, ramo_tipo: "CALZADO" };
  }
  if (scope === "confecciones") {
    if (filters.ramo_tipo === "CONFECCIONES") return filters;
    return { ...filters, ramo_tipo: "CONFECCIONES" };
  }
  return filters;
}

/** @deprecated usar applyCatalogoScopeUsuario */
export function applyCatalogoScopeSoloCalzado<T extends ConRamo>(
  filters: T,
  name?: string | null,
): T {
  return applyCatalogoScopeUsuario(filters, name);
}
