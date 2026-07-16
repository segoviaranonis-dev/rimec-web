import { getPrecioActivo, getPrecioActivoPe, type ListaPrecioId } from '@/lib/precioLista'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'

/** Precio de venta del lote (variante con stock) — CP/PE + lista. */
export function precioDeLoteCatalogo(
  lote: TarjetaCatalogo,
  listaId: ListaPrecioId | number,
): number | null {
  const v = lote.variantes.find(vv => vv.cajas_disponibles > 0) ?? lote.variantes[0]
  if (!v) return null
  const row = {
    lpn: v.lpn ?? null,
    lpc02: v.lpc02 ?? null,
    lpc03: v.lpc03 ?? null,
    lpc04: v.lpc04 ?? null,
    precio_web: null as number | null,
    descp_caso: lote.descp_caso,
  }
  const ot = String(lote.origen_tipo ?? '').toUpperCase().replace(/\s+/g, '_')
  if (ot.includes('PRONTA')) return getPrecioActivoPe(row, listaId, lote.descp_caso)
  return getPrecioActivo(row, listaId, lote.descp_caso)
}
