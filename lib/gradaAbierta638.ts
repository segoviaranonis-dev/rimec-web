/**
 * Grada abierta Kyly 638 — notación Carlos (1(1)1 · P(1)M · 4/6/8).
 * Paridad Report: report/src/lib/deposito-rimec/grada-abierta-638.ts
 */

const RE_NUM = /^(\d+)\((\d+)\)(\d+)$/
const RE_LETRA = /^([A-Za-z]+)\((\d+)\)([A-Za-z]+)$/i

export function parseGradaAbierta638(raw: string | null | undefined): { talle: string; raw: string } | null {
  const text = String(raw ?? '').trim()
  if (!text || text === '—') return null

  let talle = text
  const mNum = text.match(RE_NUM)
  const mLet = text.match(RE_LETRA)
  if (mNum) {
    talle = mNum[1]
  } else if (mLet) {
    talle = mLet[1].toUpperCase()
  } else if (text.includes('/')) {
    talle = text
  } else {
    const lead = text.match(/^(\d+)/)
    if (lead) talle = lead[1]
  }

  return { talle, raw: text }
}

export function etiquetaTalleDesdeGrada(gradasFmt: string | null | undefined): string {
  const parsed = parseGradaAbierta638(gradasFmt)
  if (parsed) return parsed.talle
  const raw = String(gradasFmt ?? '').trim()
  if (!raw) return '—'
  const lead = raw.match(/^(\d+)/)
  return lead ? lead[1] : raw.slice(0, 10)
}

export function sortTalleKey(talle: string): number {
  const n = parseInt(String(talle).replace(/\D/g, ''), 10)
  if (Number.isFinite(n) && n > 0) return n
  return String(talle).charCodeAt(0) * 1000
}
