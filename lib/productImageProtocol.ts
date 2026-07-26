/**
 * Protocolo Imágenes Nexus — ramas por proveedor (LEY 2.01.04.021 §2).
 * 654 calzado: linea-referencia-material-color.jpg
 * 638 Kyly:     linea_color.jpg
 */

export const PROVEEDOR_CALZADO = 654
export const PROVEEDOR_CONFECCIONES_KYLY = 638
export const TIPO_V2_CALZADO = 1
export const TIPO_V2_CONFECCIONES = 2

export type ProductImageProtocol = '654' | '638'

export function resolveProductImageProtocol(input: {
  proveedorImportacionId?: number | null
  tipoV2Id?: number | null
  imagenNombre?: string | null
}): ProductImageProtocol {
  const fromName = detectProtocolFromFileStem(input.imagenNombre)
  if (fromName) return fromName

  const p = input.proveedorImportacionId
  const t = input.tipoV2Id
  if (p === PROVEEDOR_CONFECCIONES_KYLY || t === TIPO_V2_CONFECCIONES) return '638'
  return '654'
}

/** Detecta rama por patrón del stem (underscore sin guiones → 638). */
export function detectProtocolFromFileStem(raw: string | null | undefined): ProductImageProtocol | null {
  const s = stripTierFromPath(String(raw ?? '').trim())
  if (!s) return null
  const stem = s.replace(/\.(jpe?g|png|webp)$/i, '')
  if (!stem) return null
  if (stem.includes('_') && !stem.includes('-')) return '638'
  if (stem.includes('-')) return '654'
  return null
}

function stripTierFromPath(path: string): string {
  let s = path
  const marker = '/storage/v1/object/public/productos/'
  const idx = s.indexOf(marker)
  if (idx >= 0) {
    try {
      s = decodeURIComponent(s.slice(idx + marker.length).split('?')[0]?.split('#')[0] ?? '')
    } catch {
      s = s.slice(idx + marker.length).split('?')[0]?.split('#')[0] ?? ''
    }
  }
  return s
    .replace(/^productos\//i, '')
    .replace(/^(sm|md|lg|thumbs)\//i, '')
    .replace(/^\/+/, '')
}

function canonNumSegment(v: string | number | null | undefined): string {
  if (v == null) return ''
  const t = String(v).trim().replace(/\s+/g, '')
  return /^\d+\.0$/.test(t) ? t.slice(0, -2) : t
}

/** Variantes color Kyly — strip K inicial · sin ceros a la izquierda · pad 4 dígitos. */
export function color638StemVariants(color: string | number | null | undefined): string[] {
  const raw = String(color ?? '').trim()
  if (!raw) return []
  const noK = raw.replace(/^k/i, '')
  const out = new Set<string>()
  out.add(noK)
  const stripped = noK.replace(/^0+/, '')
  if (stripped) out.add(stripped)
  if (/^\d+$/.test(noK)) out.add(noK.padStart(4, '0'))
  return [...out].filter(Boolean)
}

/** Stems 638 candidatos (sin extensión) — línea × variantes color. */
export function stems638(
  linea: string | number | null | undefined,
  color: string | number | null | undefined,
  lineaFallback?: string | number | null | undefined,
): string[] {
  const lineas = new Set<string>()
  for (const src of [linea, lineaFallback]) {
    const t = canonNumSegment(src)
    if (t) lineas.add(t)
  }
  const colors = color638StemVariants(color)
  if (!lineas.size || !colors.length) return []

  const stems = new Set<string>()
  for (const L of lineas) {
    for (const C of colors) {
      stems.add(`${L}_${C}`)
    }
  }
  return [...stems]
}

/** FK color legacy 638 (`638_001_*`) — no es código Kyly legible (K0460). */
export function isKylyColorFkHash(color: string | number | null | undefined): boolean {
  const s = String(color ?? '').trim()
  if (!/^\d+$/.test(s)) return false
  const n = Number(s)
  return n >= 638_001_000_000 && n <= 638_001_000_000 + 999_999_999
}

/**
 * Color legible 638 para etiqueta/imagen: descp (K0460) o stem de imagen_url,
 * nunca el hash FK 638001….
 * Si color_code es FK hash, prioriza stem de imagen (fuente Storage correcta).
 */
export function colorKylyEtiqueta(input: {
  color?: string | number | null
  descpColor?: string | null
  imagenNombre?: string | null
}): string {
  const normalize = (c: string) => {
    const t = c.trim()
    if (!t || isKylyColorFkHash(t)) return ''
    if (/^k/i.test(t)) return `K${t.slice(1)}`
    if (/^\d+$/.test(t)) return `K${t}`
    return t
  }

  let fromImg = ''
  const rawImg = String(input.imagenNombre ?? '').trim()
  if (rawImg) {
    const stem = rawImg
      .replace(/^.*\//, '')
      .replace(/^(sm|md|lg|thumbs)\//i, '')
      .replace(/\.(jpe?g|png|webp)$/i, '')
    const m = stem.match(/_([A-Za-z0-9]+)$/)
    if (m?.[1]) fromImg = normalize(m[1])
  }

  const fromDesc = normalize(String(input.descpColor ?? ''))
  const fromCode = normalize(String(input.color ?? ''))

  if (isKylyColorFkHash(input.color)) {
    return fromImg || fromDesc || fromCode
  }
  return fromDesc || fromImg || fromCode
}

/** Stem canónico 654 (sin extensión). */
export function stem654(
  linea: string | number | null | undefined,
  referencia: string | number | null | undefined,
  material: string | number | null | undefined,
  color: string | number | null | undefined,
): string | null {
  const parts = [linea, referencia, material, color]
    .map(v => canonNumSegment(v))
    .filter(Boolean)
  if (parts.length < 2) return null
  const stem4 = parts.slice(0, 4).join('-')
  if (parts.length >= 4) return stem4
  return parts.slice(0, 2).join('-') || null
}

/** Nombre archivo principal según protocolo. */
export function productImagePrimaryStem(input: {
  protocol?: ProductImageProtocol
  proveedorImportacionId?: number | null
  tipoV2Id?: number | null
  imagenNombre?: string | null
  /** Color Kyly legible (K0460) — evita pintar FK hash 638001… */
  descpColor?: string | null
  linea: string | number | null | undefined
  referencia?: string | number | null | undefined
  material?: string | number | null | undefined
  color?: string | number | null | undefined
}): string | null {
  const protocol = input.protocol ?? resolveProductImageProtocol(input)
  if (protocol === '638') {
    const etiqueta = colorKylyEtiqueta({
      color: input.color,
      descpColor: input.descpColor,
      imagenNombre: input.imagenNombre,
    })
    const fromEtiqueta = stems638(input.linea, etiqueta)[0]
    if (fromEtiqueta) return fromEtiqueta
    return stems638(input.linea, input.color)[0] ?? null
  }
  return stem654(input.linea, input.referencia, input.material, input.color)
}
