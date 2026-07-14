/**
 * Protocolo Imágenes Nexus — tiers sm/md/lg · LEY 2.01.04.021 · ramas 654/638
 * Paridad con report/src/lib/retail/product-image.ts
 */

import {
  productImagePrimaryStem,
  resolveProductImageProtocol,
  stems638,
  stem654,
  type ProductImageProtocol,
} from './productImageProtocol'
import { resolveSupabaseUrl } from './supabaseEnv'

export type ProductImageContext = {
  proveedorImportacionId?: number | null
  tipoV2Id?: number | null
  protocol?: ProductImageProtocol
  /** Color Excel Kyly (sin K) — stem 638 cuando color_code es bigint pilar. */
  imagenColorExcel?: string | null
}

export {
  PROVEEDOR_CALZADO,
  PROVEEDOR_CONFECCIONES_KYLY,
  resolveProductImageProtocol,
  type ProductImageProtocol,
} from './productImageProtocol'

export type ImageSize = 'sm' | 'md' | 'lg'
export type ImageVariant = 'thumb' | 'hero'

/** Hero — viewport 1:1 alineado al tier lg (800×800) en Storage. */
export const HERO_VIEWPORT = {
  width: 800,
  height: 800,
  aspectClass: 'aspect-square',
} as const

export type ImagenUrls = {
  imagen_url_thumb: string | null
  imagen_url_hero: string | null
  imagen_url_flat: string | null
  /** Resuelto en servidor — el cliente no reconstruye URLs por tarjeta. */
  imagen_candidates_thumb: string[]
  imagen_candidates_hero: string[]
}

const STAGING_SENTINEL_CODIGO_ABS = 999001

function isSentinelCodigoProveedor(norm: string): boolean {
  if (!norm) return false
  const n = Number(norm.replace(/^\+/, ''))
  return Number.isFinite(n) && Math.abs(Math.trunc(n)) === STAGING_SENTINEL_CODIGO_ABS
}

function normPillarSegmentStrict(v: string | number | null | undefined): string {
  const s = normCodigo(v)
  if (!s || isSentinelCodigoProveedor(s)) return ''
  return s
}

function variantToSize(variant: ImageVariant): ImageSize {
  return variant === 'hero' ? 'lg' : 'sm'
}

function resolveCtxProtocol(input: ProductImageContext & { imagenNombre?: string | null }): ProductImageProtocol {
  return input.protocol ?? resolveProductImageProtocol(input)
}

/** URL plana legacy — fallback único cuando sm/ falta (Tablet depósito). */
export function resolveFlatImageUrl(input: {
  linea: string
  referencia: string
  material: string | number
  color: string | number
  imagenNombre?: string | null
} & ProductImageContext): string | null {
  const excel = String(input.imagenNombre ?? '').trim()
  if (excel) {
    const direct = publicProductosUrlFromInput(excel)
    if (direct) return direct
    const file = normalizeImageFileName(excel)
    if (!file) return null
    return publicStorageObjectUrl('productos', file) || null
  }

  const protocol = resolveCtxProtocol(input)
  const colorFor638 = input.imagenColorExcel ?? input.color
  if (protocol === '638') {
    const stem = stems638(input.linea, colorFor638)[0]
    if (!stem) return null
    return publicStorageObjectUrl('productos', `${stem}.jpg`) || null
  }

  const stem =
    stem654(input.linea, input.referencia, input.material, input.color) ??
    (() => {
      const L = normPillarSegmentStrict(input.linea)
      const R = normPillarSegmentStrict(input.referencia)
      if (!L || !R) return null
      const M = normPillarSegmentStrict(input.material)
      const C = normPillarSegmentStrict(input.color)
      return joinPillarStem([L, R, M, C]) || joinPillarStem([L, R])
    })()
  if (!stem) return null

  return publicStorageObjectUrl('productos', `${stem}.jpg`) || null
}

/** Una URL canónica por tier — thumb=sm/ hero=lg/ (Tablet). */
export function resolveCanonicalImageUrl(input: {
  linea: string
  referencia: string
  material: string | number
  color: string | number
  imagenNombre?: string | null
  variant: ImageVariant
} & ProductImageContext): string | null {
  const size = variantToSize(input.variant)
  const excel = String(input.imagenNombre ?? '').trim()
  if (excel) {
    const file = normalizeImageFileName(excel)
    if (!file) return null
    const url = getProductImageUrl(file, size)
    return url || null
  }

  const protocol = resolveCtxProtocol(input)
  const colorFor638 = input.imagenColorExcel ?? input.color
  const stem =
    protocol === '638'
      ? stems638(input.linea, colorFor638)[0]
      : stem654(input.linea, input.referencia, input.material, input.color)
  if (!stem) return null

  const url = publicStorageObjectUrl('productos', `${size}/${stem}.jpg`)
  return url || null
}

/** Legacy thumbs/ → sm/ (Protocolo Imágenes · paridad Tablet). */
export function toThumbnailStorageUrl(publicUrl: string): string {
  if (!publicUrl.includes('/productos/')) return publicUrl
  if (publicUrl.includes('/productos/sm/')) return publicUrl
  if (publicUrl.includes('/productos/thumbs/')) {
    return publicUrl.replace('/productos/thumbs/', '/productos/sm/')
  }
  const after = publicUrl.split('/productos/')[1] ?? ''
  const clean = after.replace(/^(sm|md|lg)\//, '')
  if (!clean) return publicUrl
  return publicStorageObjectUrl('productos', `sm/${clean}`)
}

export function toMdStorageUrl(publicUrl: string): string | null {
  const sm = toThumbnailStorageUrl(publicUrl)
  if (!sm.includes('/productos/sm/')) return null
  return sm.replace('/productos/sm/', '/productos/md/')
}

/** Grilla catálogo: nunca usar flat como src primario — siempre sm/ primero. */
export function preferSmTierUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return toThumbnailStorageUrl(url)
}

export function productImageFallbackStyle(
  linea: string,
  referencia: string,
): { background: string } {
  void linea
  void referencia
  return {
    background: '#ffffff',
  }
}

export function pickHeroProgressive(
  urls: Pick<ImagenUrls, 'imagen_url_thumb' | 'imagen_url_flat' | 'imagen_url_hero'>,
): {
  preview: string | null
  target: string | null
  fallbacks: string[]
} {
  const preview = urls.imagen_url_thumb ?? null
  const target = urls.imagen_url_hero ?? null
  const flat = urls.imagen_url_flat ?? null
  const fallbacks: string[] = []
  if (flat && flat !== target && flat !== preview) fallbacks.push(flat)
  return { preview, target, fallbacks }
}

/** BD trae URL plana sin tier sm/md/lg — tiers aún no subidos (4.90.03.002). */
export function isFlatOnlyImagenNombre(imagenNombre?: string | null): boolean {
  const excel = String(imagenNombre ?? '').trim()
  if (!excel) return false
  const direct = publicProductosUrlFromInput(excel)
  if (!direct) return false
  return !/\/productos\/(sm|md|lg|thumbs)\//i.test(direct)
}

export function enrichImagenUrls(input: {
  linea: string
  referencia: string
  material: string | number
  color: string | number
  imagenNombre?: string | null
} & ProductImageContext): ImagenUrls {
  const ctx = { ...input, imagenNombre: input.imagenNombre ?? null }
  const base = ctx
  const flat = resolveFlatImageUrl(base)
  const thumbCandidates = productImageCandidatesForUi(
    input.linea,
    input.referencia,
    input.material,
    input.color,
    input.imagenNombre ?? null,
    'thumb',
    ctx,
  )
  const heroCandidates = productImageCandidatesForUi(
    input.linea,
    input.referencia,
    input.material,
    input.color,
    input.imagenNombre ?? null,
    'modal',
    ctx,
  )
  const thumbChain = dedupeUrls(thumbCandidates)
  const heroChain = dedupeUrls(heroCandidates)
  const flatFirstThumb =
    flat && (isFlatOnlyImagenNombre(input.imagenNombre) || thumbChain.includes(flat))
      ? [flat, ...thumbChain.filter((u) => u !== flat)]
      : thumbChain.length
        ? thumbChain
        : flat
          ? [flat]
          : []

  return {
    imagen_url_thumb: flatFirstThumb[0] ?? flat,
    imagen_url_hero: heroChain[0] ?? flat,
    imagen_url_flat: flat,
    imagen_candidates_thumb: flatFirstThumb,
    imagen_candidates_hero: heroChain.length ? heroChain : flat ? [flat] : [],
  }
}

function dedupeUrls(urls: string[]): string[] {
  const out: string[] = []
  for (const u of urls) {
    if (u && !out.includes(u)) out.push(u)
  }
  return out
}

/** Dimensiones intrínsecas Protocolo Imágenes Nexus (evita escalar sm a hero). */
export const IMAGE_INTRINSIC = {
  sm: { width: 200, height: 200 },
  md: { width: 400, height: 400 },
  lg: { width: 800, height: 800 },
} as const

export function intrinsicDimsFromImageUrl(url: string | null | undefined): {
  width: number
  height: number
} {
  if (!url) return IMAGE_INTRINSIC.sm
  if (url.includes('/productos/lg/')) return IMAGE_INTRINSIC.lg
  if (url.includes('/productos/md/')) return IMAGE_INTRINSIC.md
  return IMAGE_INTRINSIC.sm
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

function publicStorageObjectUrl(bucket: string, objectPath: string): string {
  const base = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '')
  if (!base) return ''
  const clean = objectPath.replace(/^\/+/, '')
  return `${base}/storage/v1/object/public/${bucket}/${clean}`
}

function normCodigo(v: string | number | null | undefined): string {
  if (v == null) return ''
  const n = Number(v)
  if (Number.isFinite(n) && n === Math.floor(n)) return String(Math.floor(n))
  return String(v).trim().replace(/\s+/g, '')
}

function normPillarSegment(v: string | number | null | undefined): string {
  return normCodigo(v)
}

function joinPillarStem(parts: string[]): string {
  return parts.filter(Boolean).join('-')
}

export function stripProductImageTier(path: string): string {
  let s = String(path ?? '').trim()
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

/** URL pública Supabase — si trae tier sm/md/lg, normalizar a flat raíz (no confundir recorte con flat). */
function publicProductosUrlFromInput(raw: string): string | null {
  const s = String(raw ?? '').trim()
  if (!s.includes('/storage/v1/object/public/productos/')) return null
  const url = s.split('?')[0]?.split('#')[0] ?? null
  if (!url) return null
  if (/\/productos\/(sm|md|lg|thumbs)\//i.test(url)) {
    const file = stripProductImageTier(url)
    if (!file) return null
    return publicStorageObjectUrl('productos', file)
  }
  return url
}

function normalizeImageFileName(raw: string): string | null {
  const base = stripProductImageTier(raw)
  if (!base) return null
  return /\.(jpe?g|png|webp)$/i.test(base) ? base : `${base}.jpg`
}

function variantToTiers(variant: ImageVariant): ImageSize[] {
  return variant === 'hero' ? ['lg', 'md', 'sm'] : ['sm', 'md']
}

function pushUnique(out: string[], value: string) {
  if (value && !out.includes(value)) out.push(value)
}

export function getProductImageUrl(imageName: string, size: ImageSize = 'sm'): string {
  const base = normalizeImageFileName(imageName)
  if (!base) return ''
  return publicStorageObjectUrl('productos', `${size}/${base}`)
}

export function tieredStorageCandidates(
  filePath: string,
  variant: ImageVariant = 'thumb',
): string[] {
  const clean = normalizeImageFileName(filePath)
  if (!clean) return []

  const urls: string[] = []
  for (const tier of variantToTiers(variant)) {
    pushUnique(urls, publicStorageObjectUrl('productos', `${tier}/${clean}`))
  }
  pushUnique(urls, publicStorageObjectUrl('productos', clean))
  pushUnique(urls, publicStorageObjectUrl('productos', `thumbs/${clean}`))
  return urls
}

function stemCandidates(stem: string, variant: ImageVariant = 'thumb'): string[] {
  const urls: string[] = []
  for (const ext of IMAGE_EXTENSIONS) {
    for (const u of tieredStorageCandidates(`${stem}${ext}`, variant)) {
      pushUnique(urls, u)
    }
  }
  return urls
}

export function productImageCandidates(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  variant: ImageVariant = 'thumb',
  ctx?: ProductImageContext & { imagenNombre?: string | null },
): string[] {
  const protocol = ctx ? resolveCtxProtocol({ ...ctx, imagenNombre: ctx.imagenNombre }) : '654'

  if (protocol === '638') {
    const colorFor638 = ctx?.imagenColorExcel ?? colorCode
    const urls: string[] = []
    for (const stem of stems638(lineaCodigo, colorFor638)) {
      for (const u of stemCandidates(stem, variant)) pushUnique(urls, u)
    }
    return urls
  }

  const L = normPillarSegment(lineaCodigo)
  const R = normPillarSegment(referenciaCodigo)
  const M = normPillarSegment(materialCode)
  const C = normPillarSegment(colorCode)
  if (!L || !R) return []

  const urls: string[] = []
  const stem4 = joinPillarStem([L, R, M, C])
  if (stem4) {
    for (const u of stemCandidates(stem4, variant)) pushUnique(urls, u)
  }
  const stemLr = joinPillarStem([L, R])
  for (const u of stemCandidates(stemLr, variant)) pushUnique(urls, u)
  return urls
}

export function productImagePrimary(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  variant: ImageVariant = 'thumb',
): string {
  return (
    productImageCandidates(lineaCodigo, referenciaCodigo, materialCode, colorCode, variant)[0] ?? ''
  )
}

export function imagenNombreToCandidates(
  imagenNombre: string | null | undefined,
  variant: ImageVariant = 'thumb',
): string[] {
  const raw = String(imagenNombre ?? '').trim()
  if (!raw) return []

  const base = stripProductImageTier(raw)
  const urls: string[] = []

  if (/\.(jpe?g|png|webp)$/i.test(base)) {
    for (const u of tieredStorageCandidates(base, variant)) pushUnique(urls, u)
    return urls
  }

  for (const ext of IMAGE_EXTENSIONS) {
    for (const u of tieredStorageCandidates(`${base}${ext}`, variant)) pushUnique(urls, u)
  }
  return urls
}

export function productImageCandidatesForRow(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  imagenNombre?: string | null,
  variant: ImageVariant = 'thumb',
  ctx?: ProductImageContext,
): string[] {
  const fromExcel = imagenNombreToCandidates(imagenNombre, variant)
  const fromMolecule = productImageCandidates(
    lineaCodigo,
    referenciaCodigo,
    materialCode,
    colorCode,
    variant,
    { ...ctx, imagenNombre },
  )
  const out = [...fromExcel]
  for (const u of fromMolecule) {
    if (!out.includes(u)) out.push(u)
  }
  return out
}

/** Solo tiers NIIF — nunca flat legacy (recorte punta/tacón · 4.90.03). */
export function productImageTierCandidatesForRow(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  imagenNombre?: string | null,
  variant: ImageVariant = 'thumb',
): string[] {
  return productImageCandidatesForRow(
    lineaCodigo,
    referenciaCodigo,
    materialCode,
    colorCode,
    imagenNombre,
    variant,
  ).filter(u => /\/productos\/(sm|md|lg|thumbs)\//i.test(u))
}

const loggedTierViolations = new Set<string>()

/** Dev/runtime — pecado integridad visual: grilla sin tier sm/md/lg. */
export function logImageTierViolation(skuKey: string, tried: string[]) {
  if (process.env.NODE_ENV === 'production') return
  if (loggedTierViolations.has(skuKey)) return
  loggedTierViolations.add(skuKey)
  console.error(
    '[IMG-FAIL-TIER-GAP] Sin sm/md/lg en Storage — prohibido flat en grilla PE/depósito',
    { skuKey, tried: tried.slice(0, 6) },
  )
}

export function productImagePrimaryFileName(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  ctx?: ProductImageContext & { imagenNombre?: string | null },
): string | null {
  const stem = productImagePrimaryStem({
    ...ctx,
    linea: lineaCodigo,
    referencia: referenciaCodigo,
    material: materialCode,
    color: ctx?.imagenColorExcel ?? colorCode,
  })
  if (!stem) return null
  return `${stem}.jpg`
}

/** Candidatos ordenados por tier NIIF según superficie UI. */
export function productImageCandidatesForUi(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  imagenNombre: string | null | undefined,
  ui: 'thumb' | 'card' | 'modal',
  ctx?: ProductImageContext,
): string[] {
  const variant: ImageVariant = ui === 'modal' ? 'hero' : 'thumb'
  const base = productImageCandidatesForRow(
    lineaCodigo,
    referenciaCodigo,
    materialCode,
    colorCode,
    imagenNombre,
    variant,
    ctx,
  )

  const file = productImagePrimaryFileName(
    lineaCodigo,
    referenciaCodigo,
    materialCode,
    colorCode,
    { ...ctx, imagenNombre },
  )

  if (ui === 'thumb' || ui === 'card') {
    const flat = resolveFlatImageUrl({
      linea: lineaCodigo,
      referencia: referenciaCodigo,
      material: materialCode,
      color: colorCode,
      imagenNombre,
      ...ctx,
    })
    const ordered: string[] = []
    if (flat) pushUnique(ordered, flat)
    if (file) {
      pushUnique(ordered, getProductImageUrl(file, 'md'))
      pushUnique(ordered, getProductImageUrl(file, 'lg'))
    }
    for (const u of base) {
      if (!/\/productos\/(sm|thumbs)\//i.test(u)) pushUnique(ordered, u)
    }
    return ordered.length ? ordered : base.filter(u => !/\/productos\/(sm|thumbs)\//i.test(u))
  }

  if (!file) return base

  const prefer: ImageSize[] = ['lg', 'md', 'sm']
  const ordered: string[] = []
  for (const tier of prefer) {
    const u = getProductImageUrl(file, tier)
    if (u) pushUnique(ordered, u)
  }
  for (const u of base) pushUnique(ordered, u)
  return ordered
}
