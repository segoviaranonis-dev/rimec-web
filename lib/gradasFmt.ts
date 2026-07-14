/** Formato grada catálogo — grades_json (CP) o texto ppd.grada (PE). */

export type GradaRowInput = {
  grades_json?: Record<string, number> | null
  grada?: string | null
}

export function gradasFmtFromJson(
  grades_json: Record<string, number> | null | undefined,
): string {
  if (!grades_json) return ''
  const keys = Object.keys(grades_json).sort(
    (a, b) => parseFloat(a.split('/')[0]) - parseFloat(b.split('/')[0]),
  )
  if (keys.length === 0) return ''
  return `${keys[0]}(${keys.map(k => grades_json[k]).join('-')})${keys[keys.length - 1]}`
}

/** Normaliza `34(1 2 3 3 2 1)39` → `34(1-2-3-3-2-1)39`. */
export function gradasFmtFromText(grada: string | null | undefined): string {
  const raw = String(grada ?? '').trim()
  if (!raw) return ''
  const m = raw.match(/^(.+?)\(([^)]+)\)(.*)$/)
  if (!m) return raw
  const inner = m[2]
    .trim()
    .split(/[\s\-]+/)
    .filter(Boolean)
    .join('-')
  return `${m[1]}(${inner})${m[3]}`
}

export function gradasFmtFromRow(row: GradaRowInput): string {
  const fromJson = gradasFmtFromJson(row.grades_json)
  if (fromJson) return fromJson
  return gradasFmtFromText(row.grada)
}

export function sumGradaPares(row: GradaRowInput): number {
  if (row.grades_json && typeof row.grades_json === 'object') {
    const n = Object.values(row.grades_json).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    )
    if (n > 0) return Math.round(n)
  }
  const raw = String(row.grada ?? '').trim()
  const m = raw.match(/\(([^)]+)\)/)
  if (!m) return 0
  return m[1]
    .trim()
    .split(/[\s\-]+/)
    .reduce((s, v) => s + (Number(v) || 0), 0)
}
