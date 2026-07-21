import type { StockRow } from '@/app/catalogo-types'
import { formatNumeroPreventaCarlos, formatQuincenaCorta } from '@/lib/datoDuroCabecera'

function esFilaCp(origen: string | null | undefined): boolean {
  const t = String(origen ?? '').trim().toUpperCase()
  return (
    t === 'TRÁNSITO_PP' ||
    t === 'TRANSITO_PP' ||
    t === 'TRANSITO PP' ||
    t === 'CP' ||
    t === 'COMPRA_PREVIA' ||
    t === ''
  )
}

/** Par casado CP — clave estable alineada con catalogoOrigen.referenciaId. */
export type DatoDuroCpParItem = {
  key: string
  quincenaId: number
  quincenaLabel: string
  preventa: string
}

export function datoDuroCpKey(quincenaId: number, preventa: string): string {
  const pv = formatNumeroPreventaCarlos(preventa)
  return `q:${quincenaId}:${pv}`
}

export function parseDatoDuroCpKey(key: string): { quincenaId: number; preventa: string } | null {
  const m = String(key ?? '').trim().match(/^q:(\d+):(.+)$/)
  if (!m) return null
  const quincenaId = Number(m[1])
  const preventa = formatNumeroPreventaCarlos(m[2])
  if (!Number.isFinite(quincenaId) || quincenaId <= 0 || !preventa) return null
  return { quincenaId, preventa }
}

export function quincenasIdsFromDatoDuroCp(keys: string[] | undefined): number[] {
  if (!keys?.length) return []
  const ids = new Set<number>()
  for (const k of keys) {
    const p = parseDatoDuroCpKey(k)
    if (p) ids.add(p.quincenaId)
  }
  return [...ids]
}

export function buildParesDatoDuroFromRows(rows: StockRow[]): DatoDuroCpParItem[] {
  const map = new Map<string, DatoDuroCpParItem>()
  for (const r of rows) {
    if (!esFilaCp(r.origen_tipo)) continue
    const qid = r.quincena_arribo_id
    const qdesc = r.quincena_desc
    const pv = formatNumeroPreventaCarlos(r.numero_preventa)
    if (!qid || !qdesc || !pv) continue
    const key = datoDuroCpKey(qid, pv)
    if (!map.has(key)) {
      map.set(key, {
        key,
        quincenaId: qid,
        quincenaLabel: formatQuincenaCorta(qdesc),
        preventa: pv,
      })
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.quincenaId !== b.quincenaId) return a.quincenaId - b.quincenaId
    return a.preventa.localeCompare(b.preventa, 'es', { numeric: true })
  })
}

export function rowMatchesDatoDuroCp(row: StockRow, keys: string[]): boolean {
  if (!keys.length) return true
  const qid = row.quincena_arribo_id
  const pv = formatNumeroPreventaCarlos(row.numero_preventa)
  if (!qid || !pv) return false
  const key = datoDuroCpKey(qid, pv)
  return keys.includes(key)
}
