import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { isConfecciones638Lote } from '@/lib/confeccionesCatalogo'
import { isTarjetaFusionada, type TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'

export function tarjetaGrillaKey(t: TarjetaGrilla): string {
  return isTarjetaFusionada(t) ? t.cardKey : t.cardKey
}

export function heroLoteDeGrilla(t: TarjetaGrilla): TarjetaCatalogo | null {
  if (isTarjetaFusionada(t)) {
    return t.lotes.find(l => isConfecciones638Lote(l)) ?? t.lotes[0] ?? null
  }
  return t
}

export function varianteHeroDeGrilla(t: TarjetaGrilla) {
  const p = heroLoteDeGrilla(t)
  if (!p) return null
  const v = p.variantes.find(x => x.cajas_disponibles > 0) ?? p.variantes[0]
  if (!v) return null
  return { lote: p, variante: v }
}

export function tarjetaTieneImagen(t: TarjetaGrilla): boolean {
  const hero = varianteHeroDeGrilla(t)
  if (!hero) return false
  const v = hero.variante
  return Boolean(
    v.imagen_url_thumb ||
      v.imagen_url_flat ||
      v.imagen_url ||
      v.imagen_candidates_thumb?.length ||
      v.imagen_nombre,
  )
}

export function priorizarTarjetasConImagen(
  tarjetas: TarjetaGrilla[],
  limit: number,
): TarjetaGrilla[] {
  // Primero con foto / stem; si faltan, rellenar con el resto (ProductImage resuelve por códigos).
  const conImagen = tarjetas.filter(tarjetaTieneImagen)
  const sinImagen = tarjetas.filter((t) => !tarjetaTieneImagen(t))
  return [...conImagen, ...sinImagen].slice(0, limit)
}

export function mergeMarqueeTarjetas(
  pool: TarjetaGrilla[],
  incoming: TarjetaGrilla[],
  max = 24,
): TarjetaGrilla[] {
  const seen = new Set(pool.map(tarjetaGrillaKey))
  const out = [...pool]
  const prefer = [
    ...incoming.filter(tarjetaTieneImagen),
    ...incoming.filter((t) => !tarjetaTieneImagen(t)),
  ]
  for (const t of prefer) {
    if (out.length >= max) break
    const key = tarjetaGrillaKey(t)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}
