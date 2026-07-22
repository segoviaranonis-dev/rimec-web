/**
 * Clave canónica FI = PP × Marca × Caso (R-FI-1).
 * `caso_id` manda; el nombre solo si no hay id.
 * Prohibido colapsar ids distintos bajo «Sin caso».
 */

export type CasoFragmentable = {
  caso?: string | null
  caso_id?: number | null
}

export function etiquetaCasoFi(item: CasoFragmentable): string {
  const nom = String(item.caso ?? "").trim()
  if (nom) return nom
  const id = item.caso_id
  if (id != null && Number.isFinite(Number(id)) && Number(id) > 0) {
    return `Caso #${Number(id)}`
  }
  return "Sin caso"
}

/** Clave interna de fragmentación (no es etiqueta UI). */
export function claveCasoFi(item: CasoFragmentable): string {
  const id = item.caso_id
  if (id != null && Number.isFinite(Number(id)) && Number(id) > 0) {
    return `id:${Number(id)}`
  }
  const nom = String(item.caso ?? "").trim().toUpperCase()
  if (nom) return `nom:${nom}`
  return "sin_caso"
}

/** True si dos ítems deben ir en la misma FI por caso. */
export function mismoCasoFi(a: CasoFragmentable, b: CasoFragmentable): boolean {
  return claveCasoFi(a) === claveCasoFi(b)
}
