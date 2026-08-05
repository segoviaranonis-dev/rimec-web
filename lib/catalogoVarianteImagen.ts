/**
 * Variante representante para miniatura — 638 = 1 por color (no por talle).
 * Doc: CONFECCIONES_638_VS_CALZADO_654.md · anti-patrón #5/#6.
 */
import type { RimecVariante, TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { indiceVariantePorTonoKey, tonoKeyDeVariante } from '@/lib/catalogoTonoActivo'
import { isConfecciones638Lote, variantesColorUnicas } from '@/lib/confeccionesCatalogo'

export function variantesImagenWarm(lote: TarjetaCatalogo): RimecVariante[] {
  const stock = lote.variantes.filter(v => v.cajas_disponibles > 0)
  const base = stock.length ? stock : lote.variantes
  if (isConfecciones638Lote(lote)) {
    return variantesColorUnicas({ ...lote, variantes: base })
  }
  const map = new Map<string, RimecVariante>()
  for (const v of base) {
    const k = tonoKeyDeVariante(v)
    if (k && !map.has(k)) map.set(k, v)
  }
  return map.size ? [...map.values()] : base.slice(0, 1)
}

/** Miniatura tarjeta/lightbox — 638 usa color único; 654 usa variante por tono. */
export function varianteImagenPorTonoKey(
  lote: TarjetaCatalogo,
  tonoKey: string | null | undefined,
): RimecVariante | null {
  const stock = lote.variantes.filter(v => v.cajas_disponibles > 0)
  const base = stock.length ? stock : lote.variantes
  if (!base.length) return null

  if (isConfecciones638Lote(lote)) {
    const pool = variantesColorUnicas({ ...lote, variantes: base })
    if (tonoKey) {
      const hit = pool.find(v => tonoKeyDeVariante(v) === tonoKey)
      if (hit) return hit
    }
    return pool[0] ?? null
  }

  if (tonoKey) {
    const idx = indiceVariantePorTonoKey(base, tonoKey)
    if (idx >= 0) return base[idx]
  }
  return base[0] ?? null
}

export function urlsWarmVariante(v: {
  imagen_candidates_thumb?: string[] | null
  imagen_url_thumb?: string | null
  imagen_url_flat?: string | null
  imagen_url?: string | null
}): string[] {
  const out: string[] = []
  for (const u of v.imagen_candidates_thumb ?? []) {
    if (u) out.push(u)
  }
  const primary = v.imagen_url_thumb ?? v.imagen_url_flat ?? v.imagen_url
  if (primary) out.push(primary)
  return [...new Set(out)]
}
