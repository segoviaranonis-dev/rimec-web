/**
 * Guardia MIG-173 — FI PE = un solo pedido_proveedor por factura.
 * Auto-split si el carrito agrupó mal (pp_id sintético único para todo PE).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { PE_DET_ID_BASE } from '@/lib/prontaEntregaVenta'

type ItemPayload = { det_id?: number; pares?: number; subtotal?: number; [k: string]: unknown }

type FacturaPayload = {
  marca?: string
  caso?: string
  total_pares?: number
  total_monto?: number
  items?: ItemPayload[]
  [k: string]: unknown
}

type LotePayload = {
  pp_id?: number | null
  origen_pe?: boolean
  facturas?: FacturaPayload[]
  [k: string]: unknown
}

type PayloadPedido = {
  lotes?: LotePayload[]
  [k: string]: unknown
}

function esLotePe(lote: LotePayload): boolean {
  if (lote.origen_pe === true) return true
  const pp = Number(lote.pp_id)
  return Number.isFinite(pp) && pp < 0
}

async function loadPpIdPorDetId(
  sb: SupabaseClient,
  detIds: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  const uniq = [...new Set(detIds.filter((n) => Number.isFinite(n) && n > 0 && n < PE_DET_ID_BASE))]
  if (!uniq.length) return map

  const chunk = 80
  for (let i = 0; i < uniq.length; i += chunk) {
    const part = uniq.slice(i, i + chunk)
    const { data, error } = await sb.from('v_stock_pe_rimec').select('det_id, pp_id').in('det_id', part)
    if (error) throw new Error(`PE pp_id: ${error.message}`)
    for (const row of data ?? []) {
      const detId = Number(row.det_id)
      const ppId = Number(row.pp_id)
      if (detId > 0 && ppId > 0) map.set(detId, ppId)
    }
  }

  const missing = uniq.filter((id) => !map.has(id))
  for (let i = 0; i < missing.length; i += chunk) {
    const part = missing.slice(i, i + chunk)
    const { data, error } = await sb
      .from('pedido_proveedor_detalle')
      .select('id, pedido_proveedor_id')
      .in('id', part)
    if (error) throw new Error(`PPD pp_id: ${error.message}`)
    for (const row of data ?? []) {
      const detId = Number(row.id)
      const ppId = Number(row.pedido_proveedor_id)
      if (detId > 0 && ppId > 0) map.set(detId, ppId)
    }
  }

  return map
}

function splitFacturaPorPp(factura: FacturaPayload, ppMap: Map<number, number>): FacturaPayload[] {
  const items = Array.isArray(factura.items) ? factura.items : []
  if (items.length <= 1) return [factura]

  const byPp = new Map<number, ItemPayload[]>()
  for (const it of items) {
    const detId = Number(it.det_id)
    const ppId = ppMap.get(detId)
    if (!ppId) {
      throw new Error(
        `PE det ${detId}: no se pudo resolver PP. Vacá el carrito y recargá catálogo Pronta entrega.`,
      )
    }
    if (!byPp.has(ppId)) byPp.set(ppId, [])
    byPp.get(ppId)!.push(it)
  }

  if (byPp.size <= 1) return [factura]

  return [...byPp.entries()].map(([ppId, grupo]) => {
    const pares = grupo.reduce((s, i) => s + (Number(i.pares) || 0), 0)
    const monto = grupo.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)
    return {
      ...factura,
      total_pares: pares,
      total_monto: monto,
      items: grupo,
      _pe_pp_id: ppId,
    }
  })
}

export async function asegurarSegregacionPePpPayload(
  sb: SupabaseClient,
  payload: unknown,
): Promise<{ payload: unknown; facturas_spliteadas: number }> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { payload, facturas_spliteadas: 0 }
  }
  const p = payload as PayloadPedido
  if (!Array.isArray(p.lotes)) return { payload, facturas_spliteadas: 0 }

  const peDetIds: number[] = []
  for (const lote of p.lotes) {
    if (!esLotePe(lote)) continue
    for (const f of lote.facturas ?? []) {
      for (const it of f.items ?? []) {
        const id = Number(it.det_id)
        if (Number.isFinite(id) && id > 0 && id < PE_DET_ID_BASE) peDetIds.push(id)
      }
    }
  }
  if (!peDetIds.length) return { payload, facturas_spliteadas: 0 }

  const ppMap = await loadPpIdPorDetId(sb, peDetIds)
  let spliteadas = 0

  const lotes = p.lotes.map((lote) => {
    if (!esLotePe(lote)) return lote
    const facturasIn = Array.isArray(lote.facturas) ? lote.facturas : []
    const facturasOut: FacturaPayload[] = []
    for (const f of facturasIn) {
      const parts = splitFacturaPorPp(f, ppMap)
      if (parts.length > 1) spliteadas += parts.length - 1
      facturasOut.push(...parts)
    }
    return { ...lote, facturas: facturasOut }
  })

  return { payload: { ...p, lotes }, facturas_spliteadas: spliteadas }
}
