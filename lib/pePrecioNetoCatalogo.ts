/**
 * Precio neto PE en catálogo — paridad con factura interna (resolverDescuentosFiPe + cascada).
 * LPC03 (lista 3): D1=10% fijo · D2=dictado comercial Guido.
 */
import { precioNetoCascada, type Descuentos4 } from '@/lib/carritoDescuentosFi'
import { resolverDescuentosFiPe } from '@/lib/resolverDescuentosFiPe'

export function descuentosPeParaCatalogo(
  listaPrecioId: number,
  descuentoComercialPct: number | null | undefined,
): Descuentos4 {
  return resolverDescuentosFiPe({
    listaPrecioId,
    descuentosPrevios: [0, 0, 0, 0],
    dictadoComercialPct: descuentoComercialPct,
  })
}

export function precioNetoPeCatalogo(
  precioBase: number,
  listaPrecioId: number,
  descuentoComercialPct: number | null | undefined,
): number | null {
  if (!Number.isFinite(precioBase) || precioBase <= 0) return null
  const desc = descuentosPeParaCatalogo(listaPrecioId, descuentoComercialPct)
  if (!desc.some((d) => d > 0)) return null
  return precioNetoCascada(precioBase, desc)
}

/** Etiqueta cascada — ej. "10% + 17%" (no suma aritmética). */
export function etiquetaDescuentosPeCatalogo(
  listaPrecioId: number,
  descuentoComercialPct: number | null | undefined,
): string | null {
  const desc = descuentosPeParaCatalogo(listaPrecioId, descuentoComercialPct)
  const activos = desc.filter((d) => d > 0)
  if (!activos.length) return null
  return activos.map((d) => `${d}%`).join(' + ')
}

export function hayDescuentoPeCatalogo(
  listaPrecioId: number,
  descuentoComercialPct: number | null | undefined,
): boolean {
  return descuentosPeParaCatalogo(listaPrecioId, descuentoComercialPct).some((d) => d > 0)
}
