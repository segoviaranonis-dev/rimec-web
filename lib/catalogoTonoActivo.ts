import { parseTonoCanon } from '@/lib/pilares/color-canon'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { varianteImagenPorTonoKey } from '@/lib/catalogoVarianteImagen'

export type VarianteTonoKey = {
  color_code?: string | null
  descp_color?: string | null
  tono_canon?: unknown
  /** Curva caja cerrada PE — desambigua misma L+R+M+C con 2 gradas (1185-702). */
  gradas_fmt?: string | null
}

/** Clave estable de tono entre lotes CP/PE (mismo color aunque cambie det_id). */
export function tonoKeyDeVariante(v: VarianteTonoKey | null | undefined): string {
  if (!v) return ''
  const code = String(v.color_code ?? '').trim()
  const grada = String(v.gradas_fmt ?? '').trim()
  // Curva importadora `34(…)39` — no talle suelto 638 (sin paréntesis).
  const curvaCerrada = grada.includes('(')
  let base = ''
  if (code) base = `c:${code}`
  else {
    const tono = parseTonoCanon(v.tono_canon)
    const et = String(tono?.etiqueta ?? '').trim().toUpperCase()
    if (et) base = `t:${et}`
    else {
      const descp = String(v.descp_color ?? '').trim().toUpperCase()
      base = descp ? `d:${descp}` : ''
    }
  }
  if (!base) return ''
  if (curvaCerrada) return `${base}|g:${grada}`
  return base
}

export function indiceVariantePorTonoKey<T extends VarianteTonoKey>(
  variantes: T[],
  tonoKey: string | null | undefined,
): number {
  if (!tonoKey) return -1
  return variantes.findIndex(v => tonoKeyDeVariante(v) === tonoKey)
}

/** Primero lote con stock del tono (para miniatura). 638 = representante por color. */
export function variantePorTonoKey(
  lotes: TarjetaCatalogo[],
  tonoKey: string | null | undefined,
): { lote: TarjetaCatalogo; variante: TarjetaCatalogo['variantes'][number] } | null {
  if (!tonoKey) return null
  for (const lote of lotes) {
    const v = varianteImagenPorTonoKey(lote, tonoKey)
    if (v) return { lote, variante: v }
  }
  return null
}
