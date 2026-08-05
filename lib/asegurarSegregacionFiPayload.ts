/**
 * Guardia servidor R-FI-2 — lee stock real por det_id y separa / rechaza
 * facturas que mezclen LIQUIDACION · PROMOCIONAL · REGULAR.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  cadenaComercialFi,
  etiquetaCelulaFi,
  type CadenaComercialFi,
  violacionSegregacionCadenas,
} from '@/lib/facturaCelulaClave'

type FacturaPayload = {
  marca?: string
  marca_id?: number | null
  caso?: string
  caso_id?: number | null
  lista_precio_id?: number
  descuento_1?: number
  descuento_2?: number
  descuento_3?: number
  descuento_4?: number
  total_pares?: number
  total_monto?: number
  items?: Array<{ det_id?: number; pares?: number; subtotal?: number; [k: string]: unknown }>
  [k: string]: unknown
}

type LotePayload = {
  facturas?: FacturaPayload[]
  [k: string]: unknown
}

type PayloadPedido = {
  lotes?: LotePayload[]
  [k: string]: unknown
}

type StockSignal = {
  det_id: number
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
  cadena_comercial?: string | null
  descp_caso?: string | null
  cod_grupo?: string | null
}

async function loadSignals(
  sb: SupabaseClient,
  detIds: number[],
): Promise<Map<number, StockSignal>> {
  const map = new Map<number, StockSignal>()
  if (!detIds.length) return map
  const uniq = [...new Set(detIds.filter((n) => Number.isFinite(n) && n > 0))]
  const colsPe = 'det_id, es_liquidacion, es_promo, cadena_comercial, descp_caso, cod_grupo'
  const colsCp = 'det_id, descp_caso'

  const [pe, cp] = await Promise.all([
    sb.from('v_stock_pe_rimec').select(colsPe).in('det_id', uniq),
    sb.from('v_stock_rimec').select(colsCp).in('det_id', uniq),
  ])

  for (const r of pe.data ?? []) {
    const row = r as StockSignal
    map.set(Number(row.det_id), row)
  }
  for (const r of cp.data ?? []) {
    const row = r as StockSignal
    const id = Number(row.det_id)
    if (!map.has(id)) map.set(id, row)
  }
  return map
}

function cadenaDeItem(
  detId: number,
  signals: Map<number, StockSignal>,
  fallbackCaso?: string | null,
): CadenaComercialFi {
  const s = signals.get(detId)
  return cadenaComercialFi({
    caso: fallbackCaso ?? s?.descp_caso ?? null,
    descp_caso: s?.descp_caso ?? fallbackCaso ?? null,
    es_liquidacion: s?.es_liquidacion ?? null,
    es_promo: s?.es_promo ?? null,
    cadena_comercial: s?.cadena_comercial ?? null,
    cod_grupo: s?.cod_grupo ?? null,
  })
}

function enriquecerCasoFactura(
  factura: FacturaPayload,
  signals: Map<number, StockSignal>,
  cad: CadenaComercialFi,
): FacturaPayload {
  const items = Array.isArray(factura.items) ? factura.items : []
  const first = items[0]
  const detId = first ? Number(first.det_id) : NaN
  const s = Number.isFinite(detId) ? signals.get(detId) : undefined
  const casoBase = String(factura.caso ?? s?.descp_caso ?? '').trim() || 'Sin caso'
  const caso = etiquetaCelulaFi({
    caso: casoBase,
    caso_id: factura.caso_id ?? null,
    descp_caso: s?.descp_caso ?? casoBase,
    es_liquidacion: cad === 'LIQUIDACION' ? true : s?.es_liquidacion ?? null,
    es_promo: cad === 'PROMOCIONAL' ? true : s?.es_promo ?? null,
    cadena_comercial: cad === 'REGULAR' || cad === 'COMUN' ? cad : s?.cadena_comercial ?? cad,
    cod_grupo: s?.cod_grupo ?? null,
  })
  return { ...factura, caso, _cadena_fi: cad }
}

function splitFacturaPorCadena(
  factura: FacturaPayload,
  signals: Map<number, StockSignal>,
): FacturaPayload[] {
  const items = Array.isArray(factura.items) ? factura.items : []
  if (!items.length) {
    return [enriquecerCasoFactura(factura, signals, 'REGULAR')]
  }

  const byCadena = new Map<CadenaComercialFi, typeof items>()
  for (const it of items) {
    const detId = Number(it.det_id)
    const cad = cadenaDeItem(detId, signals, typeof factura.caso === 'string' ? factura.caso : null)
    if (!byCadena.has(cad)) byCadena.set(cad, [])
    byCadena.get(cad)!.push(it)
  }

  return [...byCadena.entries()].map(([cad, grupo]) => {
    const pares = grupo.reduce((s, i) => s + (Number(i.pares) || 0), 0)
    const monto = grupo.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)
    return enriquecerCasoFactura(
      {
        ...factura,
        total_pares: pares,
        total_monto: monto,
        items: grupo,
      },
      signals,
      cad,
    )
  })
}

/**
 * Reparte facturas mezcladas. Si tras split aún detecta violación interna → throw.
 */
export async function asegurarSegregacionFiPayload(
  sb: SupabaseClient,
  payload: unknown,
): Promise<{ payload: unknown; facturas_spliteadas: number }> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { payload, facturas_spliteadas: 0 }
  }
  const p = payload as PayloadPedido
  if (!Array.isArray(p.lotes)) return { payload, facturas_spliteadas: 0 }

  const detIds: number[] = []
  for (const lote of p.lotes) {
    for (const f of lote.facturas ?? []) {
      for (const it of f.items ?? []) {
        const id = Number(it.det_id)
        if (Number.isFinite(id) && id > 0) detIds.push(id)
      }
    }
  }
  const signals = await loadSignals(sb, detIds)
  let spliteadas = 0

  const lotes = p.lotes.map((lote) => {
    const facturasIn = Array.isArray(lote.facturas) ? lote.facturas : []
    const facturasOut: FacturaPayload[] = []
    for (const f of facturasIn) {
      const parts = splitFacturaPorCadena(f, signals)
      if (parts.length > 1) spliteadas += parts.length - 1
      for (const part of parts) {
        const cadenas = (part.items ?? []).map((it) =>
          cadenaDeItem(Number(it.det_id), signals, typeof part.caso === 'string' ? part.caso : null),
        )
        if (violacionSegregacionCadenas(cadenas)) {
          throw new Error(
            'R-FI-2: una factura no puede mezclar PROMO y LIQUIDACIÓN (ni cadenas distintas). Revisá el carrito.',
          )
        }
        facturasOut.push(part)
      }
    }
    return { ...lote, facturas: facturasOut }
  })

  return { payload: { ...p, lotes }, facturas_spliteadas: spliteadas }
}
