/** Puente BCL → depósito: caso comercial por código línea (paridad Report). */

export type CasoBibliotecaLite = {
  id: number
  nombre_caso: string
  lineas: string[]
  lineas_count?: number
  indice_gs?: number
}

export function normLineaCodigo(raw: string | number | null | undefined): string {
  if (raw == null || raw === '') return ''
  const n = Number(String(raw).trim().replace(/,/g, '.'))
  if (!Number.isFinite(n)) return String(raw).trim()
  return String(Math.trunc(n))
}

export function buildLineaCasoMap(casos: readonly CasoBibliotecaLite[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const c of casos) {
    const nombre = c.nombre_caso?.trim()
    if (!nombre) continue
    for (const linea of c.lineas ?? []) {
      const cod = normLineaCodigo(linea)
      if (cod) map.set(cod, nombre)
    }
  }
  return map
}

export function lookupCasoLinea(
  map: Map<string, string> | null | undefined,
  lineaCodigo: string | number | null | undefined,
): string | null {
  if (!map?.size) return null
  const cod = normLineaCodigo(lineaCodigo)
  if (!cod) return null
  return map.get(cod) ?? null
}

export function normalizeCasoNombre(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase()
}
