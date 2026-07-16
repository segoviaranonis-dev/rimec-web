import type { RimecVariante, TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { getPrecioActivo, getPrecioActivoPe } from '@/lib/precioLista'
import type { ListaId } from '@/store/sesionVenta'
import { tonoKeyDeVariante } from '@/lib/catalogoTonoActivo'
import { etiquetaTalleDesdeGrada, sortTalleKey } from '@/lib/gradaAbierta638'

/**
 * REGLA 638 — Peras ≠ manzanas (654).
 * En confecciones cada fila PPD/vista = 1 SKU = 1 talle (grada abierta).
 * `variantes[]` de la tarjeta = TALLAS, no colores. No usar CatalogTonosFila ni badge «N col.» por conteo de variantes.
 * Doc: rimec-web/docs/CONFECCIONES_638_VS_CALZADO_654.md
 */

export function isConfecciones638Lote(lote: TarjetaCatalogo): boolean {
  if (lote.tipo_v2_id === 2) return true
  if (lote.ramo_tipo === 'CONFECCIONES') return true
  const mat = String(lote.material_code ?? '').trim()
  return mat.startsWith('638') || mat.startsWith('K638')
}

export function unidadStockLabel(lote: TarjetaCatalogo): 'prendas' | 'pares' {
  return isConfecciones638Lote(lote) ? 'prendas' : 'pares'
}

export function unidadStockCorta(lote: TarjetaCatalogo): 'prend' | 'p' {
  return isConfecciones638Lote(lote) ? 'prend' : 'p'
}

export function stockEnLote(lote: TarjetaCatalogo): number {
  return lote.variantes
    .filter(v => v.cajas_disponibles > 0)
    .reduce((s, v) => s + prendasDisponiblesVariante(v), 0)
}

/** Saldo real prenda — prioriza saldo_pares sobre cajas_disponibles normalizado. */
export function prendasDisponiblesVariante(v: RimecVariante): number {
  const saldo = Number(v.saldo_pares ?? NaN)
  if (Number.isFinite(saldo) && saldo >= 0) return Math.floor(saldo)
  return Math.max(0, Math.floor(v.cajas_disponibles))
}

/** Colores distintos en la tarjeta (solo si >1 mostrar selector de color). */
export function coloresUnicosEnLote(lote: TarjetaCatalogo): string[] {
  const keys = new Set<string>()
  for (const v of lote.variantes) {
    if (v.cajas_disponibles <= 0) continue
    const k = tonoKeyDeVariante(v)
    if (k) keys.add(k)
  }
  return Array.from(keys)
}

export function cantidadTallasConStock(lote: TarjetaCatalogo): number {
  return lote.variantes.filter(v => v.cajas_disponibles > 0).length
}

export function variantesPorColor(
  lote: TarjetaCatalogo,
  tonoKey: string,
): RimecVariante[] {
  return lote.variantes.filter(
    v => v.cajas_disponibles > 0 && tonoKeyDeVariante(v) === tonoKey,
  )
}

/** Una fila por color real (638) — no confundir con tallas. */
export function variantesColorUnicas(lote: TarjetaCatalogo): RimecVariante[] {
  const map = new Map<string, RimecVariante>()
  for (const v of lote.variantes) {
    if (v.cajas_disponibles <= 0) continue
    const k = tonoKeyDeVariante(v)
    if (!map.has(k)) map.set(k, v)
  }
  return Array.from(map.values())
}

export function precioVarianteCatalogo(
  lote: TarjetaCatalogo,
  v: RimecVariante,
  listaId: ListaId,
): number | null {
  const row = {
    lpn: v.lpn ?? null,
    lpc02: v.lpc02 ?? null,
    lpc03: v.lpc03 ?? null,
    lpc04: v.lpc04 ?? null,
    precio_web: null as number | null,
    descp_caso: lote.descp_caso,
  }
  const ot = String(lote.origen_tipo ?? '').toUpperCase().replace(/\s+/g, '_')
  const precio = ot.includes('PRONTA')
    ? getPrecioActivoPe(row, listaId, lote.descp_caso)
    : getPrecioActivo(row, listaId, lote.descp_caso)
  return precio != null && precio > 0 ? precio : null
}

export type TallaVentaLine = {
  det_id: number
  talle: string
  gradas_fmt: string
  stock: number
  precio: number
  variante: RimecVariante
}

export type GrupoPrecioTallas = {
  precio: number
  tallas: TallaVentaLine[]
}

export function agruparTallasPorPrecio(
  variantes: RimecVariante[],
  lote: TarjetaCatalogo,
  listaId: ListaId,
): GrupoPrecioTallas[] {
  const map = new Map<number, TallaVentaLine[]>()

  for (const v of variantes) {
    if (v.cajas_disponibles <= 0) continue
    const precio = precioVarianteCatalogo(lote, v, listaId)
    if (precio == null) continue

    const line: TallaVentaLine = {
      det_id: v.det_id,
      talle: etiquetaTalleDesdeGrada(v.gradas_fmt),
      gradas_fmt: v.gradas_fmt,
      stock: prendasDisponiblesVariante(v),
      precio,
      variante: v,
    }
    const bucket = map.get(precio) ?? []
    bucket.push(line)
    map.set(precio, bucket)
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([precio, tallas]) => ({
      precio,
      tallas: tallas.sort((a, b) => sortTalleKey(a.talle) - sortTalleKey(b.talle)),
    }))
}
