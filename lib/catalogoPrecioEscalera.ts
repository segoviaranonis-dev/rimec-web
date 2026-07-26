import type { StockRow } from '@/app/catalogo-types'
import { normalizeOrigenCatalogo } from '@/lib/catalogoFilters'
import { getPrecioActivo, getPrecioActivoPe, type ListaPrecioId } from '@/lib/precioLista'
import type { TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'
import { isTarjetaFusionada } from '@/lib/fusionTarjetasCatalogo'
import { precioDeLoteCatalogo } from '@/lib/precioLoteCatalogo'

export type PrecioEscaleraCatalogo = {
  /** Valores únicos descendentes (mayor → menor) — saltos del slider */
  escalera: number[]
  listaPrecioId: ListaPrecioId
  max: number
  min: number
}

function precioVentaDesdeFila(row: StockRow, listaId: ListaPrecioId): number | null {
  const precioRow = {
    lpn: row.lpn ?? null,
    lpc02: row.lpc02 ?? null,
    lpc03: row.lpc03 ?? null,
    lpc04: row.lpc04 ?? null,
    precio_web: (row as StockRow & { precio_web?: number | null }).precio_web ?? null,
    descp_caso: row.descp_caso,
  }
  const origen = normalizeOrigenCatalogo(row.origen_tipo)
  if (origen === 'PRONTA_ENTREGA') {
    return getPrecioActivoPe(precioRow, listaId, row.descp_caso)
  }
  return getPrecioActivo(precioRow, listaId, row.descp_caso)
}

/** Escalera AM/lista sesión — precios comerciales únicos (centena) del stock vendible. */
export function buildEscaleraPreciosFromRows(
  rows: StockRow[],
  listaId: ListaPrecioId = 1,
): PrecioEscaleraCatalogo | null {
  const uniq = new Set<number>()
  for (const r of rows) {
    const p = precioVentaDesdeFila(r, listaId)
    if (p != null && p > 0) uniq.add(p)
  }
  if (uniq.size === 0) return null
  const escalera = [...uniq].sort((a, b) => b - a)
  return {
    escalera,
    listaPrecioId: listaId,
    max: escalera[0]!,
    min: escalera[escalera.length - 1]!,
  }
}

/** Escalera desde tarjetas ya renderizadas (refresco al paginar). */
export function buildEscaleraDesdeTarjetas(
  tarjetas: TarjetaGrilla[],
  listaId: ListaPrecioId,
): PrecioEscaleraCatalogo | null {
  const uniq = new Set<number>()
  for (const t of tarjetas) {
    const lotes = isTarjetaFusionada(t) ? t.lotes : [t]
    for (const l of lotes) {
      const p = precioDeLoteCatalogo(l, listaId)
      if (p != null && p > 0) uniq.add(p)
    }
  }
  if (uniq.size === 0) return null
  const escalera = [...uniq].sort((a, b) => b - a)
  return {
    escalera,
    listaPrecioId: listaId,
    max: escalera[0]!,
    min: escalera[escalera.length - 1]!,
  }
}

export function mergeEscaleras(a: PrecioEscaleraCatalogo | null, b: PrecioEscaleraCatalogo | null): PrecioEscaleraCatalogo | null {
  if (!a) return b
  if (!b) return a
  const uniq = new Set([...a.escalera, ...b.escalera])
  const escalera = [...uniq].sort((x, y) => y - x)
  return {
    escalera,
    listaPrecioId: a.listaPrecioId,
    max: escalera[0]!,
    min: escalera[escalera.length - 1]!,
  }
}

export { precioVentaDesdeFila }
