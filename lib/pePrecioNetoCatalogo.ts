/**
 * Precio neto PE en catálogo — paridad con factura interna (resolverDescuentosFiPe + cascada).
 * LPC03 (lista 3) no-PROMO: D1=10% fijo · D2=dictado comercial Guido.
 * PROMOCIONAL: sin +10 % LPC03 (anti doble descuento).
 */
import { precioNetoCascada, type Descuentos4 } from '@/lib/carritoDescuentosFi'
import { resolverDescuentosFiPe } from '@/lib/resolverDescuentosFiPe'

export function descuentosPeParaCatalogo(
  listaPrecioId: number,
  descuentoComercialPct: number | null | undefined,
  esPromocional = false,
): Descuentos4 {
  return resolverDescuentosFiPe({
    listaPrecioId,
    descuentosPrevios: [0, 0, 0, 0],
    dictadoComercialPct: descuentoComercialPct,
    esPromocional,
  })
}

export function precioNetoPeCatalogo(
  precioBase: number,
  listaPrecioId: number,
  descuentoComercialPct: number | null | undefined,
  esPromocional = false,
): number | null {
  if (!Number.isFinite(precioBase) || precioBase <= 0) return null
  const desc = descuentosPeParaCatalogo(listaPrecioId, descuentoComercialPct, esPromocional)
  if (!desc.some((d) => d > 0)) return null
  return precioNetoCascada(precioBase, desc)
}

/** Etiqueta cascada — ej. "10% + 17%" (no suma aritmética). */
export function etiquetaDescuentosPeCatalogo(
  listaPrecioId: number,
  descuentoComercialPct: number | null | undefined,
  esPromocional = false,
): string | null {
  const desc = descuentosPeParaCatalogo(listaPrecioId, descuentoComercialPct, esPromocional)
  const activos = desc.filter((d) => d > 0)
  if (!activos.length) return null
  return activos.map((d) => `${d}%`).join(' + ')
}

export function hayDescuentoPeCatalogo(
  listaPrecioId: number,
  descuentoComercialPct: number | null | undefined,
  esPromocional = false,
): boolean {
  return descuentosPeParaCatalogo(listaPrecioId, descuentoComercialPct, esPromocional).some(
    (d) => d > 0,
  )
}
