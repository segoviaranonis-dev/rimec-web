/**
 * Familias Material/Color — paridad Report (agrupar-etiqueta-pilar).
 * Texto + NN · Napa/Verniz · orden por recurrencia.
 */
import { colorPredominante, normalizarEtiqueta } from '@/lib/pilares/color-canon'

export const FAMILIA_NN_KEY = 'NN'
export const FAMILIA_NN_LABEL = 'NN'

const TOKEN_A_CANON: Record<string, string> = {
  NAPA: 'NAPA',
  NAP: 'NAPA',
  NP: 'NAPA',
  VZ: 'VERNIZ',
  VERNIZ: 'VERNIZ',
  VERNIS: 'VERNIZ',
  VERNI: 'VERNIZ',
  VERNIZADO: 'VERNIZ',
}

const CANON_LABEL: Record<string, string> = {
  NAPA: 'Napa',
  VERNIZ: 'Verniz',
}

export type FamiliaPilarItem = {
  key: string
  label: string
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

export function normFamiliaToken(raw: string): string {
  return stripAccents(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function esTokenNumerico(raw: string | null | undefined): boolean {
  const n = normFamiliaToken(raw ?? '')
  return n.length > 0 && /^[0-9]+$/.test(n)
}

export function primeraPalabraPilar(descripcion: string | null | undefined): string {
  return colorPredominante(descripcion)
}

export function canonSinonimoToken(raw: string): string {
  const n = normFamiliaToken(raw)
  if (!n) return n
  return TOKEN_A_CANON[n] ?? n
}

export function labelCanonFamilia(key: string, fallbackRaw: string): string {
  if (key === FAMILIA_NN_KEY) return FAMILIA_NN_LABEL
  const forced = CANON_LABEL[key]
  if (forced) return forced
  return normalizarEtiqueta(fallbackRaw)
}

export function mismaFamiliaPilar(a: string, b: string): boolean {
  if (esTokenNumerico(a) || esTokenNumerico(b)) return false
  const A = canonSinonimoToken(a)
  const B = canonSinonimoToken(b)
  if (!A || !B) return false
  if (A === B) return true
  const [short, long] = A.length <= B.length ? [A, B] : [B, A]
  if (short.length >= 2 && long.startsWith(short)) return true
  if (A.length >= 3 && B.length >= 3 && A.slice(0, 3) === B.slice(0, 3)) return true
  const cA = A.replace(/[AEIOU]/g, '')
  const cB = B.replace(/[AEIOU]/g, '')
  if (!cA || !cB) return false
  if (cA === cB) return true
  const [cShort, cLong] = cA.length <= cB.length ? [cA, cB] : [cB, cA]
  if (cShort.length >= 2 && cLong.startsWith(cShort)) return true
  return false
}

export function buildFamiliaClusters(tokens: string[]): Map<string, string> {
  const tokenToKey = new Map<string, string>()
  const textRaw: string[] = []
  for (const t of tokens) {
    const trimmed = t.trim()
    if (!trimmed) continue
    const n = normFamiliaToken(trimmed)
    if (!n) continue
    if (n === FAMILIA_NN_KEY || esTokenNumerico(trimmed)) {
      tokenToKey.set(n, FAMILIA_NN_KEY)
      continue
    }
    textRaw.push(trimmed)
  }

  const uniq = Array.from(new Set(textRaw))
  const norms = uniq.map((raw) => ({ raw, n: canonSinonimoToken(raw) }))
  const parent = norms.map((_, i) => i)
  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]!)
    return parent[i]!
  }
  function unite(i: number, j: number) {
    const a = find(i)
    const b = find(j)
    if (a !== b) parent[a] = b
  }
  for (let i = 0; i < norms.length; i++) {
    for (let j = i + 1; j < norms.length; j++) {
      if (mismaFamiliaPilar(norms[i]!.n, norms[j]!.n)) unite(i, j)
    }
  }

  const groups = new Map<number, { tokens: string[]; displayRaw: string }>()
  for (let i = 0; i < norms.length; i++) {
    const r = find(i)
    const item = norms[i]!
    let g = groups.get(r)
    if (!g) {
      g = { tokens: [], displayRaw: item.raw }
      groups.set(r, g)
    }
    g.tokens.push(item.raw)
    if (normFamiliaToken(item.raw).length > normFamiliaToken(g.displayRaw).length) {
      g.displayRaw = item.raw
    }
  }

  for (const g of groups.values()) {
    let key = normFamiliaToken(g.displayRaw)
    for (const t of g.tokens) {
      const c = canonSinonimoToken(t)
      if (CANON_LABEL[c]) {
        key = c
        break
      }
    }
    key = canonSinonimoToken(key)
    const canon = esTokenNumerico(key) ? FAMILIA_NN_KEY : key
    for (const t of g.tokens) {
      tokenToKey.set(normFamiliaToken(t), canon)
      tokenToKey.set(canonSinonimoToken(t), canon)
    }
  }
  return tokenToKey
}

export function buildFamiliaItems(tokens: string[]): FamiliaPilarItem[] {
  const tokenToKey = buildFamiliaClusters(tokens)
  const byKey = new Map<string, Set<string>>()
  const countByKey = new Map<string, number>()

  for (const t of tokens) {
    const n = normFamiliaToken(t)
    if (!n) continue
    const syn = canonSinonimoToken(t)
    let key =
      tokenToKey.get(n) ?? tokenToKey.get(syn) ?? (esTokenNumerico(t) ? FAMILIA_NN_KEY : syn)
    if (/^[0-9]+$/.test(key)) key = FAMILIA_NN_KEY
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1)
    if (key === FAMILIA_NN_KEY) continue
    let set = byKey.get(key)
    if (!set) {
      set = new Set()
      byKey.set(key, set)
    }
    set.add(n)
  }

  const rawByNorm = new Map<string, string>()
  for (const t of tokens) {
    if (esTokenNumerico(t) || normFamiliaToken(t) === FAMILIA_NN_KEY) continue
    const n = normFamiliaToken(t)
    if (!n) continue
    const prev = rawByNorm.get(n)
    if (!prev || t.length > prev.length) rawByNorm.set(n, t)
  }

  const out: FamiliaPilarItem[] = []
  for (const [key, set] of byKey) {
    let best = key
    for (const n of set) {
      const raw = rawByNorm.get(n) ?? n
      if (normFamiliaToken(raw).length > normFamiliaToken(best).length) best = raw
    }
    const label = labelCanonFamilia(key, best)
    if (!label || /^[0-9]+$/.test(normFamiliaToken(label))) {
      countByKey.set(
        FAMILIA_NN_KEY,
        (countByKey.get(FAMILIA_NN_KEY) ?? 0) + (countByKey.get(key) ?? 0),
      )
      countByKey.delete(key)
      continue
    }
    out.push({ key, label })
  }
  if ((countByKey.get(FAMILIA_NN_KEY) ?? 0) > 0) {
    out.push({ key: FAMILIA_NN_KEY, label: FAMILIA_NN_LABEL })
  }
  out.sort((a, b) => {
    const ca = countByKey.get(a.key) ?? 0
    const cb = countByKey.get(b.key) ?? 0
    if (cb !== ca) return cb - ca
    return a.label.localeCompare(b.label, 'es')
  })
  return out
}

export function familiaKeyFromDescripcion(
  descripcion: string | null | undefined,
  tokenToKey: Map<string, string>,
): string | null {
  const word = primeraPalabraPilar(descripcion)
  if (!word) return null
  if (esTokenNumerico(word)) return FAMILIA_NN_KEY
  const n = normFamiliaToken(word)
  if (!n) return null
  if (/^[0-9]+$/.test(n)) return FAMILIA_NN_KEY
  const syn = canonSinonimoToken(word)
  return tokenToKey.get(n) ?? tokenToKey.get(syn) ?? syn
}

export function toggleFamiliaKey(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((x) => x !== key) : [...list, key]
}
