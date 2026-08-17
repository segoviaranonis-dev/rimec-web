/**
 * Facetas AB-CR desde stock PE vivo — paridad Report stock-pronta-entrega (2.3.5.9).
 * El RPC rimec_catalogo_meta a veces omite tipos (p.ej. CERRADO); PE gana.
 *
 * Atención: en v_stock_pe_rimec el mismo tipo_1_id puede llevar labels distintas
 * (ABIERTO/CERRADO/ACT PRENDAS). Tipificar por label canónica, no por id.
 */
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  mergePeAbcrTipo1Items,
  peAbcrSignalsFromRows,
  type PeAbcrStockSignals,
} from '@/lib/filtros/pe-abcr-tipo1'
import { canonPeTipo1Valorizado } from '@/lib/filtros/pe-valorizado-tipo1'
import type { CatalogoFilterStateExtended } from '@/lib/catalogoFilters'

const PAGE = 1000
const MAX_PAGES = 8

export async function loadPeAbcrTiposDesdeStock(
  filters: CatalogoFilterStateExtended,
): Promise<{ id: number; label: string }[] | null> {
  const admin = getSupabaseAdmin()
  /** label → Map<tipo_1_id, count> — el id más frecuente gana por etiqueta. */
  const labelIds = new Map<string, Map<number, number>>()
  const signalRows: Parameters<typeof peAbcrSignalsFromRows>[0][number][] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    let q = admin
      .from('v_stock_pe_rimec')
      .select(
        'tipo_1_id, descp_tipo_1, sdrm_tipo1, descp_marca, sdrm_marca, cod_grupo, cajas_disponibles, linea_codigo',
      )
      .gt('cajas_disponibles', 0)
      .range(page * PAGE, page * PAGE + PAGE - 1)

    const ramo = String(filters.ramo_tipo ?? '').trim().toUpperCase()
    if (ramo === 'CALZADO' || ramo === 'CONFECCIONES') {
      q = q.eq('ramo_tipo', ramo)
    }
    const dep = String(filters.deposito_codigo ?? '').trim()
    if (dep) q = q.eq('deposito_codigo', dep)

    const { data, error } = await q
    if (error) {
      console.error('[loadPeAbcrTiposDesdeStock]', error.message)
      return null
    }
    const rows = data ?? []
    if (!rows.length) break

    for (const r of rows) {
      const id = Number(r.tipo_1_id) || 0
      const raw = String(r.descp_tipo_1 ?? r.sdrm_tipo1 ?? '').trim()
      const lbl = canonPeTipo1Valorizado(raw)
      if (lbl && lbl !== 'OTROS') {
        let idCounts = labelIds.get(lbl)
        if (!idCounts) {
          idCounts = new Map()
          labelIds.set(lbl, idCounts)
        }
        const kid = id > 0 ? id : 0
        idCounts.set(kid, (idCounts.get(kid) ?? 0) + 1)
      }
      signalRows.push({
        tipo_1: r.descp_tipo_1,
        descp_tipo_1: r.descp_tipo_1,
        tipo_1_id: r.tipo_1_id,
        sdrm_tipo1: r.sdrm_tipo1,
        marca: r.descp_marca,
        sdrm_marca: r.sdrm_marca,
        cod_grupo: r.cod_grupo,
        linea_codigo: r.linea_codigo,
        cantidad: r.cajas_disponibles,
      })
    }
    if (rows.length < PAGE) break
  }

  if (!labelIds.size && !signalRows.length) return []

  const items: { id: number; label: string }[] = []
  for (const [label, idCounts] of labelIds) {
    let bestId = 0
    let bestN = -1
    for (const [id, n] of idCounts) {
      if (n > bestN || (n === bestN && id > bestId)) {
        bestN = n
        bestId = id
      }
    }
    items.push({ id: bestId > 0 ? bestId : items.length + 1, label })
  }

  const signals: PeAbcrStockSignals = peAbcrSignalsFromRows(signalRows)
  return mergePeAbcrTipo1Items(items, signals)
}
