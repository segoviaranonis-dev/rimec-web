import { resolveParesPorCaja } from '@/lib/prontaEntregaVenta'

export interface StockRowMin {
  cajas_disponibles?: number | null
  saldo_pares?: number | null
  cantidad_pares?: number
  pares_vendidos?: number | null
  pares_por_caja: number
  cantidad_cajas: number
  grades_json?: Record<string, number> | null
  origen_tipo?: string | null
  det_id?: number | null
  pp_id?: number | null
}

function saldoParesDeFila(item: StockRowMin): number {
  const base = item.saldo_pares ?? item.cantidad_pares
  if (base != null && Number.isFinite(Number(base))) {
    return Math.max(0, Number(base) - Number(item.pares_vendidos ?? 0))
  }
  return 0
}

function paresPorCajaDeFila(item: StockRowMin, saldoPares: number): number {
  return resolveParesPorCaja({
    pares_por_caja: item.pares_por_caja,
    cantidad_cajas: item.cantidad_cajas,
    cantidad_pares: item.cantidad_pares,
    saldo_pares: saldoPares,
    grades_json: item.grades_json,
    origen_tipo: item.origen_tipo,
    det_id: item.det_id,
    pp_id: item.pp_id,
  })
}

/** Cajas cerradas vendibles (PE = CP · Director 2026-07-13). */
export function cajasDisponiblesDeFila(item: StockRowMin): number {
  const saldoPares = saldoParesDeFila(item)
  if (saldoPares <= 0) return 0

  const ppc = paresPorCajaDeFila(item, saldoPares)
  if (ppc <= 0) return 0

  if (saldoPares > 0 && saldoPares < ppc) return 1

  const fromView = Number(item.cajas_disponibles)
  if (Number.isFinite(fromView) && fromView > 0 && fromView * ppc <= saldoPares + ppc) {
    return Math.max(0, Math.floor(fromView))
  }

  return Math.max(0, Math.floor(saldoPares / ppc))
}

/** Pares realmente vendibles, alineados con unidades de carrito. */
export function paresDisponiblesDeFila(item: StockRowMin): number {
  const saldoPares = saldoParesDeFila(item)
  const cajas = cajasDisponiblesDeFila(item)
  const ppc = paresPorCajaDeFila(item, saldoPares)
  if (cajas <= 0) return 0
  if (cajas === 1 && saldoPares > 0 && saldoPares < ppc) return saldoPares
  return cajas * ppc
}

/** Normaliza fila de vista (PE contamina columnas) antes de validar carrito. */
export function normalizarFilaStockVenta(row: StockRowMin): StockRowMin {
  const saldo = saldoParesDeFila(row)
  const cajas = cajasDisponiblesDeFila(row)
  const ppc = paresPorCajaDeFila(row, saldo)
  return {
    ...row,
    saldo_pares: saldo,
    pares_por_caja: ppc,
    cajas_disponibles: cajas,
  }
}
