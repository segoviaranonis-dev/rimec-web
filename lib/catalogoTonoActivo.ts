import { parseTonoCanon } from '@/lib/pilares/color-canon'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'

export type VarianteTonoKey = {
  color_code?: string | null
  descp_color?: string | null
  tono_canon?: unknown
}

/** Clave estable de tono entre lotes CP/PE (mismo color aunque cambie det_id). */
export function tonoKeyDeVariante(v: VarianteTonoKey | null | undefined): string {
  if (!v) return ''
  const code = String(v.color_code ?? '').trim()
  if (code) return `c:${code}`
  const tono = parseTonoCanon(v.tono_canon)
  const et = String(tono?.etiqueta ?? '').trim().toUpperCase()
  if (et) return `t:${et}`
  const descp = String(v.descp_color ?? '').trim().toUpperCase()
  return descp ? `d:${descp}` : ''
}

export function indiceVariantePorTonoKey<T extends VarianteTonoKey>(
  variantes: T[],
  tonoKey: string | null | undefined,
): number {
  if (!tonoKey) return -1
  return variantes.findIndex(v => tonoKeyDeVariante(v) === tonoKey)
}

/** Primero lote con stock del tono (para miniatura). */
export function variantePorTonoKey(
  lotes: TarjetaCatalogo[],
  tonoKey: string | null | undefined,
): { lote: TarjetaCatalogo; variante: TarjetaCatalogo['variantes'][number] } | null {
  if (!tonoKey) return null
  for (const lote of lotes) {
    const vars = lote.variantes.filter(v => v.cajas_disponibles > 0)
    const idx = indiceVariantePorTonoKey(vars, tonoKey)
    if (idx >= 0) return { lote, variante: vars[idx] }
  }
  for (const lote of lotes) {
    const idx = indiceVariantePorTonoKey(lote.variantes, tonoKey)
    if (idx >= 0) return { lote, variante: lote.variantes[idx] }
  }
  return null
}
