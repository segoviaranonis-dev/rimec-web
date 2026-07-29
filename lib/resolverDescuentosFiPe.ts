/**
 * Descuentos FI PE — comerciales vs comisión diccionario.
 * Comisión (2%/4%) NUNCA ocupa Descuentos4 de precio.
 * PROMOCIONAL + LPC03: sin Grado 1 (+10 %) — solo dictado (anti doble descuento).
 */
import { normalizarDescuentos4, type Descuentos4 } from '@/lib/carritoDescuentosFi'

/** Valores típicos de comisión D1 en pe_diccionario_cadena (no comerciales). */
const COMISION_D1 = new Set([2, 4])

export function esDescuentoSoloComisionDiccionario(raw: unknown): boolean {
  const d = normalizarDescuentos4(raw)
  if ((Number(d[1]) || 0) !== 0 || (Number(d[2]) || 0) !== 0 || (Number(d[3]) || 0) !== 0) {
    return false
  }
  return COMISION_D1.has(Number(d[0]) || 0)
}

/** Suma Descuentos4 comerciales (excluye filas vacías / solo comisión). */
export function sumaDescuentosComerciales(raw: unknown): number {
  const d = normalizarDescuentos4(raw)
  if (esDescuentoSoloComisionDiccionario(d)) return 0
  return d.reduce((s, x) => s + (Number(x) || 0), 0)
}

/**
 * pre_autorizado solo bloquea si el vendedor fijó descuentos comerciales reales.
 * [0,0,0,0] o solo comisión 2/4 congelados por validación → re-sincronizar dictado Report.
 */
export function preAutorizadoBloqueaResolver(raw: unknown, preAutorizado?: boolean): boolean {
  if (!preAutorizado) return false
  return sumaDescuentosComerciales(raw) > 0
}

/** Descuentos4 canónicos PE desde lista + dictado Report (sin comisión diccionario). */
export function calcularDescuentosPeCanonicos(input: {
  listaPrecioId: number
  dictadoComercialPct: number | null | undefined
  esPromocional?: boolean
}): Descuentos4 {
  return resolverDescuentosFiPe({
    listaPrecioId: input.listaPrecioId,
    descuentosPrevios: [0, 0, 0, 0],
    dictadoComercialPct: input.dictadoComercialPct,
    preAutorizado: false,
    esPromocional: input.esPromocional,
  })
}

/**
 * Resuelve Descuentos4 para FI PE.
 * · LPC03 (lista 3) no-PROMO: D1=10% fijo · D2=dictado comercial
 * · LPC03 + PROMOCIONAL: sin +10 % · D1=dictado (igual que LPN)
 * · resto: D1=dictado comercial
 * · Si previos son solo comisión (2/4) → pisar con dictado
 * · pre_autorizado → no tocar solo si hay descuento comercial real (edición vendedor)
 */
export function resolverDescuentosFiPe(input: {
  listaPrecioId: number
  descuentosPrevios: unknown
  dictadoComercialPct: number | null | undefined
  preAutorizado?: boolean
  /** Cadena / caso PROMOCIONAL — no apilar Grado 1 LP03 (+10 %). */
  esPromocional?: boolean
}): Descuentos4 {
  const prev = normalizarDescuentos4(input.descuentosPrevios)
  if (preAutorizadoBloqueaResolver(prev, input.preAutorizado)) return prev

  const dictado =
    input.dictadoComercialPct != null &&
    Number.isFinite(Number(input.dictadoComercialPct)) &&
    Number(input.dictadoComercialPct) > 0
      ? Math.round(Number(input.dictadoComercialPct) * 100) / 100
      : null

  const sum = prev.reduce((s, x) => s + (Number(x) || 0), 0)
  const soloComision = esDescuentoSoloComisionDiccionario(prev)
  const lista = Number(input.listaPrecioId) || 1
  const promo = input.esPromocional === true

  // PROMOCIONAL bajo LPC03: mismo camino que LPN (sin Grado 1 +10 %)
  if (lista === 3 && !promo) {
    // LPC03 normal: grado 1 = +10% · dictado en grado 2 · comisión 2/4 nunca queda en D1/D2
    const d2Actual = Number(prev[1]) || 0
    const d2EsBasura = d2Actual === 0 || COMISION_D1.has(d2Actual)
    if (sum === 0 || soloComision || Number(prev[0]) !== 10 || (dictado != null && d2EsBasura)) {
      return [10, dictado ?? (d2EsBasura ? 0 : d2Actual), 0, 0]
    }
    return prev
  }

  // LPN / otras / PROMOCIONAL(+LPC03): dictado comercial en D1 · si solo hay comisión (2/4) sin dictado → limpiar
  if (dictado != null && (sum === 0 || soloComision)) {
    return [dictado, 0, 0, 0]
  }
  if (soloComision) {
    return [0, 0, 0, 0]
  }

  // PROMO + LPC03 con D1=10 residual (ley vieja) → limpiar grado 1 y dejar dictado
  if (lista === 3 && promo && Number(prev[0]) === 10) {
    const d2 = Number(prev[1]) || 0
    const comercial = dictado ?? (d2 > 0 && !COMISION_D1.has(d2) ? d2 : null)
    if (comercial != null) return [comercial, 0, 0, 0]
    return [0, 0, 0, 0]
  }

  return prev
}
