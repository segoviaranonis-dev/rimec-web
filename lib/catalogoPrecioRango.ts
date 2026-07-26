import type { StockRow } from '@/app/catalogo-types'
import type { CatalogoFilterStateExtended } from '@/lib/catalogoFilters'
import { redondearCentenaGs } from '@/lib/redondeoCentenaGs'

/** Fallback si aún no llegó meta del catálogo. */
export const PRECIO_RANGO_FALLBACK = {
  min: 50_000,
  max: 3_000_000,
  step: 10_000,
} as const

export type PrecioRangoCatalogo = {
  min: number
  max: number
  step: number
}

function pasoSlider(min: number, max: number): number {
  const span = max - min
  if (span <= 200_000) return 5_000
  if (span <= 800_000) return 10_000
  if (span <= 2_000_000) return 25_000
  return 50_000
}

/** Min / max LPN reales del stock vendible (centena comercial). */
export function buildPrecioRangoFromRows(rows: StockRow[]): PrecioRangoCatalogo | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const r of rows) {
    const n = Number(r.lpn)
    if (!Number.isFinite(n) || n <= 0) continue
    min = Math.min(min, n)
    max = Math.max(max, n)
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null

  const minR = redondearCentenaGs(min)
  const maxR = redondearCentenaGs(max)
  if (minR >= maxR) return null

  return {
    min: minR,
    max: maxR,
    step: pasoSlider(minR, maxR),
  }
}

/** Alcance del slider: origen + ramo + depósito (sin marca/línea/tono/precio). */
export function filtersParaPrecioRangoCatalogo(
  filters: CatalogoFilterStateExtended,
): CatalogoFilterStateExtended {
  return {
    ...filters,
    grupo_estilo_id: '',
    marca_id: '',
    grupo_estilo_ids: [],
    marca_ids: [],
    linea_ids: [],
    tipo_ids: [],
    colores: [],
    quincenas: [],
    genero_codigo: '',
    tonos: [],
    sin_tono: false,
    buscar: '',
    tipo_grupos: [],
    material_familias: [],
    color_familias: [],
    dato_duro_cp: [],
    preventas: [],
    precio_min: null,
    precio_max: null,
    precio_tope: null,
  }
}

export function precioRangoConFallback(rango: PrecioRangoCatalogo | null | undefined): PrecioRangoCatalogo {
  if (rango && rango.min < rango.max) return rango
  return { ...PRECIO_RANGO_FALLBACK }
}
