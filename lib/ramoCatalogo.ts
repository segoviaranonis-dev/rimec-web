/** Marcas Kyly / confección — espejo report pilar-proveedor-index */
const MARCAS_CONFECCION = new Set([10, 11, 12, 13, 14, 15])

export type RamoCatalogo = 'CALZADO' | 'CONFECCIONES'

export function clasificarRamo(row: {
  marca_id?: number | null
  linea_codigo?: string | null
  referencia_codigo?: string | null
  nombre?: string | null
}): RamoCatalogo {
  const marcaId = Number(row.marca_id ?? 0)
  if (MARCAS_CONFECCION.has(marcaId)) return 'CONFECCIONES'

  const ref = String(row.referencia_codigo ?? '').trim()
  const linea = String(row.linea_codigo ?? '').trim()
  if (/^k$/i.test(ref)) return 'CONFECCIONES'
  if (/^k/i.test(linea) && ref) return 'CONFECCIONES'

  const nombre = String(row.nombre ?? '').trim()
  if (/-K$/i.test(nombre)) return 'CONFECCIONES'

  return 'CALZADO'
}
