/**
 * Cromática CP/Programado — calzado vs confecciones.
 * Confecciones: amarillo pastel (misma familia LIQ oro / amber-50·yellow-50).
 * Calzado: sky/azul (dato duro histórico).
 */

export type RamoCpVisual = "calzado" | "confecciones";

/** Cabecera acordeón / pill quincena · confecciones. */
export const CP_CONF_PASTEL = {
  borderL: "border-l-amber-400",
  border: "border-amber-200/90",
  bg: "bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50/70",
  bgSoft: "bg-yellow-50/80",
  textQuincena: "text-amber-900",
  textPreventa: "text-orange-700",
  chip: "rounded-lg border border-amber-200/90 bg-yellow-50/90",
} as const;

/** Cabecera acordeón / pill · calzado (canon actual). */
export const CP_CALZADO = {
  borderL: "border-l-sky-600",
  border: "border-blue-200/80",
  bg: "bg-white",
  bgSoft: "bg-blue-50/45",
  textQuincena: "text-sky-800",
  textPreventa: "text-orange-600",
  chip: "rounded-lg border border-blue-200/80 bg-white",
} as const;

export function cromaticaCp(ramo: RamoCpVisual) {
  return ramo === "confecciones" ? CP_CONF_PASTEL : CP_CALZADO;
}

/** Heurística PP hub — marcas Kyly/Milon o proforma 638-*. */
export function ppMarcasOProformaConfecciones(input: {
  marcas?: string | null;
  numero_proforma?: string | null;
}): boolean {
  const m = String(input.marcas ?? "").toUpperCase();
  if (/\b(KYLY|MILON)\b/.test(m)) return true;
  const pf = String(input.numero_proforma ?? "").trim();
  return /^638\b/.test(pf) || pf.startsWith("638-");
}
