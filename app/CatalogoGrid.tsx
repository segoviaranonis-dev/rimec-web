'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSesion, getPrecioActivo, getPrecioActivoPe, LISTAS, type ListaId } from '@/store/sesionVenta'
import { useRouter } from 'next/navigation'
import { DialogoActivacion } from '@/components/DialogoActivacion'
import { CatalogCarruselColores } from '@/components/catalog/CatalogCarruselColores'
import { CatalogGrillaDeposito } from '@/components/catalog/CatalogGrillaDeposito'
import { CatalogTarjetaDeposito } from '@/components/catalog/CatalogTarjetaDeposito'
import { PromoCasoBadge } from '@/components/catalog/PromoCasoBadge'
import { PeProBadge } from '@/components/catalog/PeProBadge'
import { ProductImage } from '@/components/ProductImage'
import {
  origenBadgePillStyle,
  origenChipStyle,
} from '@/lib/catalogCardChrome'
import { formatearQuincena } from '@/lib/fecha'
import { etiquetaDatoDuroCp } from '@/lib/datoDuroCabecera'
import { estiloBadgeMarca, labelMarcaCatalogo } from '@/lib/marcaBadge'
import { origenBadgeText } from '@/lib/catalogoOrigen'
import { resolveParesPorCaja, syntheticPpIdForPe, etiquetaProntaEntregaCatalogo } from '@/lib/prontaEntregaVenta'
import { productImagePrimaryStem } from '@/lib/productImageProtocol'
import { isConfecciones638Lote, stockEnLote, coloresUnicosEnLote, cantidadTallasConStock, subtitulo638Tarjeta, variantesColorUnicas, variantesPorColor, prendasDisponiblesVariante, unidadStockCorta } from '@/lib/confeccionesCatalogo'
import { esLiquidacionPe, esPromoTarjeta, resolveCatalogShellVariant } from '@/lib/catalogoComercial'
import { resolvePeVisualBadges } from '@/lib/catalogoPeVisual'
import { warmPeDiccionarioClient } from '@/lib/peDiccionarioClient'
import { PeDescComercialBadge } from '@/components/catalog/PeDescComercialBadge'
import { pctDescuentoDesdeTarjeta } from '@/lib/peDescuentoComercial'
import { hayDescuentoPeCatalogo } from '@/lib/pePrecioNetoCatalogo'
import type { RimecVariante, TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import {
  isTarjetaFusionada,
  varianteHeroFusionada,
  type TarjetaCatalogoFusionada,
  type TarjetaGrilla,
} from '@/lib/fusionTarjetasCatalogo'
import { CatalogLotesAcordeon } from '@/components/catalog/CatalogLotesAcordeon'
import {
  tonoKeyDeVariante,
  variantePorTonoKey,
  indiceVariantePorTonoKey,
} from '@/lib/catalogoTonoActivo'
import { varianteImagenPorTonoKey } from '@/lib/catalogoVarianteImagen'
import { preloadImageDecoded } from '@/lib/image-decode-cache'

export type { RimecVariante, TarjetaCatalogo }
/** @deprecated Usar TarjetaCatalogo — alias para compatibilidad interna */
export type RimecAgrupado = TarjetaCatalogo

const AZUL = '#0F172A'
const CELESTE = '#0EA5E9'
const DORADO = '#D4AF37'

const COLOR_MAP: [RegExp, string][] = [
  [/\bbranco\b|\bblanco\b|off\s?white|\bivory\b|\bmarfil\b/i, '#f5f5f0'],
  [/\bpreto\b|\bnegro\b|\bblack\b/i,                          '#1a1a1a'],
  [/\bcinza\b|\bgris\b|\bgrey\b|\bgray\b/i,                   '#9e9e9e'],
  [/\bprata\b|\bplata\b|\bplateado\b|\bsilver\b|\bplatino\b/i, '#b0bec5'],
  [/\bdourado\b|\bdorado\b|\boro\b|\bgold\b|\bgolden\b/i,     '#ffd54f'],
  [/\bchocolate\b|\bcacao\b|\bcocoa\b/i,                      '#4e2b0e'],
  [/\bmarrom\b|\bmarr[oó]n\b|\bbrown\b/i,                     '#6d4c41'],
  [/\bcouro\b|\bcuero\b|\bleather\b/i,                        '#a0785a'],
  [/\bmoca\b|\bmokka\b|\bmocha\b|\bcoffee\b|\bcaf[eé]\b/i,    '#5a3d2b'],
  [/\bcaramelo\b|\bcaramel\b/i,                               '#c19a6b'],
  [/\bcamel\b/i,                                              '#c19a6b'],
  [/\bcapuchino\b|\bcapu[cç]ino\b|\bcappucc?ino\b/i,          '#b7916a'],
  [/\btan\b/i,                                                '#d2a679'],
  [/\btaupe\b/i,                                              '#9e8e7e'],
  [/\bnude\b/i,                                               '#e8c9a0'],
  [/\bnatural\b/i,                                            '#d4b896'],
  [/\bbege\b|\bbeige\b/i,                                     '#e8d5b0'],
  [/\bcreme\b|\bcrema\b|\bcream\b/i,                          '#f5f0e0'],
  [/\bmarinha?\b|\bmarino\b|\bnavy\b/i,                       '#1e3a5f'],
  [/\bceleste\b|\baqua\b/i,                                   '#4fc3f7'],
  [/\bazul\b|\bblue\b/i,                                      '#1565c0'],
  [/\bvermelho\b|\brojo\b|\bred\b/i,                          '#c62828'],
  [/\bbord[oô]\b|\bburdeo\b|\bvino\b|\bwine\b|\bguinda\b/i,   '#880e4f'],
  [/\brosa\b|\bpink\b/i,                                      '#f48fb1'],
  [/\bcoral\b/i,                                              '#ff7043'],
  [/\blaranja\b|\bnaranja\b|\borange\b/i,                     '#ef6c00'],
  [/\bmostarda\b|\bmostaza\b|\bmustard\b/i,                   '#c8a227'],
  [/\bamarelo\b|\bamarillo\b|\byellow\b/i,                    '#f9a825'],
  [/\boliva\b|\bolive\b/i,                                    '#827717'],
  [/\bverde\b|\bgreen\b/i,                                    '#2e7d32'],
  [/\bvioleta\b|\bvioleth?\b|\bpurple\b/i,                    '#7b1fa2'],
  [/\bl[ií]l[aá]s?\b|\blilac\b/i,                             '#ab47bc'],
  [/\bturquesa\b|\bturquoise\b/i,                             '#00897b'],
]

function hexDesdeNombre(nombre: string): string {
  for (const [re, hex] of COLOR_MAP) {
    if (re.test(nombre)) return hex
  }
  return '#CBD5E1'
}

/**
 * Resuelve el hex de una variante. Prioridad:
 *   1. `color_hex` del pilar `color` en BD (fuente única de verdad).
 *   2. Heurística regex sobre `descp_color` (fallback hasta backfill completo).
 *   3. Gris default.
 */
function resolverHex(v: { color_hex?: string | null; descp_color?: string | null }): string {
  if (v.color_hex && /^#[0-9a-fA-F]{3,8}$/.test(v.color_hex)) return v.color_hex
  if (v.descp_color) return hexDesdeNombre(v.descp_color)
  return '#CBD5E1'
}

function etiquetaOrigenChip(
  origen: TarjetaCatalogo['origen_tipo'],
  quincenaDesc: string | null | undefined,
  linea?: string,
  referencia?: string,
  liquidacion?: boolean,
): string {
  // PE nunca muestra quincena de pedido proveedor (fuga visual CP bajo Pronta entrega)
  if (origen === 'PRONTA_ENTREGA') {
    return etiquetaProntaEntregaCatalogo(linea, referencia, { liquidacion })
  }
  if (quincenaDesc) return quincenaDesc
  return 'Compra previa'
}

/** Precio catálogo — PE: LPN si el tier de lista está vacío (LPC02-04 null en vista). */
function precioCatalogo(
  v: { lpn?: number | null; lpc02?: number | null; lpc03?: number | null; lpc04?: number | null; precio_web?: number | null },
  listaId: number,
  descpCaso: string | null | undefined,
  origenTipo: TarjetaCatalogo['origen_tipo'] | string | null | undefined,
): number | null {
  const row = {
    lpn: v.lpn ?? null,
    lpc02: v.lpc02 ?? null,
    lpc03: v.lpc03 ?? null,
    lpc04: v.lpc04 ?? null,
    precio_web: v.precio_web ?? null,
  }
  const ot = String(origenTipo ?? '').toUpperCase().replace(/\s+/g, '_')
  if (ot.includes('PRONTA')) return getPrecioActivoPe(row, listaId, descpCaso)
  return getPrecioActivo(row, listaId, descpCaso)
}

function ChipEta({
  label,
  shell,
  className = '',
}: {
  label: string
  shell: TarjetaCatalogo['shell']
  className?: string
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1',
        'text-[13px] sm:text-sm font-extrabold leading-none whitespace-nowrap',
        'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shrink-0',
        'shadow-sm',
        className,
      ].join(' ')}
      style={origenChipStyle(shell)}
      title={`ETA ${label}`}
    >
      {label}
    </span>
  )
}

function Lightbox({ producto: p, initialIdx, initialTonoKey, onClose }: {
  producto: TarjetaCatalogo; initialIdx: number; initialTonoKey?: string; onClose: () => void
}) {
  const esConf = isConfecciones638Lote(p)
  const variantesStock = p.variantes.filter(v => v.cajas_disponibles > 0)
  const variantesBase = variantesStock.length ? variantesStock : p.variantes
  const variantesNav = esConf ? variantesColorUnicas({ ...p, variantes: variantesBase }) : variantesBase

  const resolveInitialIdx = (): number => {
    if (variantesNav.length === 0) return 0
    if (initialTonoKey) {
      const byTono = variantesNav.findIndex(v => tonoKeyDeVariante(v) === initialTonoKey)
      if (byTono >= 0) return byTono
    }
    if (esConf) {
      const seed = variantesBase[initialIdx] ?? variantesBase[0]
      const tono = tonoKeyDeVariante(seed)
      const bySeed = variantesNav.findIndex(v => tonoKeyDeVariante(v) === tono)
      if (bySeed >= 0) return bySeed
    }
    return Math.min(Math.max(0, initialIdx), variantesNav.length - 1)
  }

  const [idx, setIdx] = useState(resolveInitialIdx)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const ventaActivaStore = useSesion(s =>
    s.hydrated && !s.hydrating && s.activa && (s.cliente?.id_cliente ?? 0) > 0,
  )
  const ventaActiva = mounted ? ventaActivaStore : false

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + variantesNav.length) % variantesNav.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % variantesNav.length)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose, variantesNav.length])

  /** Prefetch color actual ±1 — deps estables (no array nuevo cada render). */
  const prefetchSig = variantesNav
    .map(vv => `${vv.det_id}:${vv.imagen_url_thumb ?? ''}:${(vv.imagen_candidates_hero ?? [])[0] ?? ''}`)
    .join('|')
  useEffect(() => {
    if (variantesNav.length === 0) return
    const n = variantesNav.length
    const idxs = n === 1 ? [idx] : [idx, (idx + 1) % n, (idx - 1 + n) % n]
    for (const i of idxs) {
      const vv = variantesNav[i]
      if (!vv) continue
      const urls = [
        ...(vv.imagen_candidates_hero ?? []),
        ...(vv.imagen_candidates_thumb ?? []),
        vv.imagen_url_hero,
        vv.imagen_url_thumb,
        vv.imagen_url_flat,
      ].filter((u): u is string => Boolean(u))
      for (const u of urls.slice(0, 3)) void preloadImageDecoded(u)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, prefetchSig])

  const v = variantesNav[idx] ?? variantesNav[0]
  if (!v) return null
  const tonoActivo = tonoKeyDeVariante(v)
  const stockColor638 = esConf
    ? variantesPorColor({ ...p, variantes: variantesBase }, tonoActivo)
        .reduce((s, vv) => s + prendasDisponiblesVariante(vv), 0)
    : 0
  const tallasColor638 = esConf ? variantesPorColor({ ...p, variantes: variantesBase }, tonoActivo).length : 0
  const shell = p.shell
  const nombreImagen =
    productImagePrimaryStem({
      linea: p.linea_codigo,
      referencia: p.referencia_codigo,
      material: v.material_code,
      color: v.color_code,
      imagenNombre: v.imagen_nombre,
      imagenColorExcel: v.imagen_color_excel,
      tipoV2Id: esConf ? 2 : 1,
    }) ??
    (esConf
      ? `${p.linea_codigo}_${v.color_code}`
      : [p.linea_codigo, p.referencia_codigo, v.material_code, v.color_code].filter(Boolean).join('-'))

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ backgroundColor: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(6px)' }}
         onClick={onClose}>
      <div className="relative flex flex-col bg-white rounded-2xl overflow-hidden w-full max-w-lg"
           style={{ maxHeight: '92vh', boxShadow: '0 25px 80px rgba(0,0,0,0.45)' }}
           onClick={e => e.stopPropagation()}>

        <div className="relative w-full shrink-0 bg-white">
          <div className="cadena-hero-host mx-auto max-w-[440px]">
            <ProductImage
              variant="hero"
              className="cadena-hero-frame absolute inset-0"
              linea={p.linea_codigo}
              referencia={p.referencia_codigo}
              material={v.material_code}
              color={v.color_code}
              imagenNombre={v.imagen_nombre}
              src={v.imagen_url_hero ?? v.imagen_url_thumb}
              fallbackSrc={v.imagen_url_flat}
              candidates={v.imagen_candidates_hero}
              alt={`${p.linea_codigo}-${p.referencia_codigo}`}
            />
          </div>

          <CatalogCarruselColores
            variantes={variantesNav}
            activeIdx={idx}
            onSelect={setIdx}
            linea={p.linea_codigo}
            referencia={p.referencia_codigo}
          />

          <button onClick={onClose}
                  className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow"
                  style={{ color: '#64748b' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {variantesNav.length > 1 && (
            <>
              <button onClick={() => setIdx(i => (i - 1 + variantesNav.length) % variantesNav.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow"
                      style={{ color: AZUL }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={() => setIdx(i => (i + 1) % variantesNav.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow"
                      style={{ color: AZUL }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full uppercase shadow-sm"
                  style={origenBadgePillStyle(shell)}>
              {origenBadgeText(p.origen_tipo)}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm shrink-0"
                    style={estiloBadgeMarca(p.descp_marca)}>
                {p.descp_marca}
              </span>
              {p.origen_tipo === 'PRONTA_ENTREGA' && esPromoTarjeta(p) ? <PeProBadge /> : null}
              {p.origen_tipo !== 'PRONTA_ENTREGA' && esPromoTarjeta(p) ? <PromoCasoBadge size="md" /> : null}
              <div className="min-w-0 truncate font-mono text-[11px] font-extrabold text-slate-800" title={nombreImagen}>
                {nombreImagen}
              </div>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1 text-sm font-extrabold leading-none px-3 py-1.5 rounded-lg shadow-sm mb-1"
            style={origenChipStyle(shell, p.origen_tipo !== 'PRONTA_ENTREGA' && Boolean(v.quincena_desc))}
          >
            {etiquetaOrigenChip(
              p.origen_tipo,
              v.quincena_desc,
              p.linea_codigo,
              p.referencia_codigo,
              esLiquidacionPe(p),
            )}
          </span>

          <p className="text-[10px] text-slate-400 truncate mb-2">
            {esConf ? subtitulo638Tarjeta(p, v.descp_color) : `${p.descp_material} · ${v.descp_color}`}
          </p>
          {esConf ? (
            tallasColor638 > 0 ? (
              <p className="text-[10px] font-mono font-bold text-slate-500 mb-3 bg-slate-50 px-2 py-1 rounded">
                {tallasColor638} tallas · disp: {stockColor638} {unidadStockCorta(p)}
              </p>
            ) : (
              <div className="mb-3 min-h-[14px]" aria-hidden />
            )
          ) : (
            <p className="text-[10px] font-mono font-bold text-slate-500 mb-3 bg-slate-50 px-2 py-1 rounded">
              {v.gradas_fmt}
            </p>
          )}

          <div className="flex items-end justify-end gap-2">
            {!ventaActiva ? (
              <p className="text-[10px] font-semibold text-slate-500 mr-auto">🔒 Activá venta para ver precios</p>
            ) : null}
            {!esConf ? (
              <span className="text-[9px] font-bold px-1.5 py-1 rounded-md" style={{ backgroundColor: '#f0f9ff', color: CELESTE }}>
                disp: {v.cajas_disponibles} cjs
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function shellYBadgesPe(lote: TarjetaCatalogo, esFusion = false) {
  const peVis = resolvePeVisualBadges(lote)
  if (peVis) return peVis
  return {
    headerBadge: null as React.ReactNode,
    imageTopRightBadge: null as React.ReactNode,
    shellVariant: resolveCatalogShellVariant({
      esLiquidacion: esLiquidacionPe(lote),
      esPromo: esPromoTarjeta(lote),
      esPe: lote.origen_tipo === 'PRONTA_ENTREGA',
      esFusion,
    }),
    showCpPromoBadge: esPromoTarjeta(lote),
  }
}

function TarjetaProducto({
  producto: p,
  onNeedSession,
  descuentoPctPorMol,
}: {
  producto: TarjetaCatalogo
  onNeedSession: () => void
  descuentoPctPorMol?: Map<string, number> | null
}) {
  const variantesConStock = p.variantes.filter(v => v.cajas_disponibles > 0)
  const v0 = variantesConStock[0] || p.variantes[0]
  const [activeTonoKey, setActiveTonoKey] = useState(() => tonoKeyDeVariante(v0))
  const [lightbox, setLightbox] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Misma rigurosidad que Lightbox: sesión + cliente (4.01.04.001)
  const ventaActivaStore = useSesion(s =>
    s.hydrated && !s.hydrating && s.activa && (s.cliente?.id_cliente ?? 0) > 0,
  )
  const listaPrecioId = useSesion(s => s.listaPrecioId)
  const activa = mounted ? ventaActivaStore : false

  const loteStock = { ...p, variantes: variantesConStock.length ? variantesConStock : p.variantes }
  const v = varianteImagenPorTonoKey(loteStock, activeTonoKey) ?? v0
  const matchIdx = indiceVariantePorTonoKey(variantesConStock, activeTonoKey)
  const varIdx = matchIdx >= 0 ? matchIdx : 0

  const thumbPrefetchKey = `${activeTonoKey}|${v?.imagen_url_thumb ?? ''}|${(v?.imagen_candidates_thumb ?? []).slice(0, 2).join(',')}`
  useEffect(() => {
    const urls = [
      ...(v?.imagen_candidates_thumb ?? []),
      v?.imagen_url_thumb,
      v?.imagen_url_flat,
    ].filter((u): u is string => Boolean(u))
    for (const u of urls.slice(0, 3)) void preloadImageDecoded(u)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbPrefetchKey])

  const paresStock = paresEnTarjeta(p)
  const esConf = isConfecciones638Lote(p)
  const vis = shellYBadgesPe(p)
  const esPromoCp = vis.showCpPromoBadge
  const descPct = pctDescuentoDesdeTarjeta(p, descuentoPctPorMol)
  const esPe = p.origen_tipo === 'PRONTA_ENTREGA'
  const esPromoPe = esPe && esPromoTarjeta(p)
  const showDescBadge =
    esPe && hayDescuentoPeCatalogo(listaPrecioId, descPct, esPromoPe)

  const ventaFooter = (
    <CatalogLotesAcordeon
      lotes={[p]}
      activa={activa}
      listaPrecioId={listaPrecioId}
      onNeedSession={onNeedSession}
      activeTonoKey={activeTonoKey}
      onSelectTonoKey={setActiveTonoKey}
      descuentoPctPorMol={descuentoPctPorMol}
    />
  )

  return (
    <>
      <CatalogTarjetaDeposito
        marca={labelMarcaCatalogo(p.descp_marca)}
        esPromo={esPromoCp}
        stockPares={paresStock}
        stockUnidad={esConf ? 'prend' : 'p'}
        hideStockBadge
        shellVariant={vis.shellVariant}
        headerBadge={vis.headerBadge}
        imageTopRightBadge={vis.imageTopRightBadge}
        imageTopLeftBadge={
          showDescBadge ? (
            <PeDescComercialBadge
              pct={descPct ?? 0}
              listaPrecioId={listaPrecioId}
              esPromocional={esPromoPe}
            />
          ) : null
        }
        linea={p.linea_codigo}
        referencia={p.referencia_codigo}
        material={v.material_code}
        color={v.color_code}
        imagenNombre={v.imagen_nombre}
        imagenColorExcel={v.imagen_color_excel}
        descpColor={v.descp_color}
        thumbSrc={v.imagen_url_thumb}
        flatSrc={v.imagen_url_flat}
        thumbCandidates={v.imagen_candidates_thumb}
        alt={`${p.linea_codigo}-${p.referencia_codigo} ${v.descp_color}`}
        priority={varIdx === 0}
        compactGrid
        esConfecciones={esConf}
        onImageClick={() => setLightbox(true)}
        imageOverlay={
          esConf && cantidadTallasConStock(p) > 1 ? (
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-10 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm">
              {cantidadTallasConStock(p)} tall.
            </span>
          ) : !esConf && variantesConStock.length > 1 ? (
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-10 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm">
              {coloresUnicosEnLote(p).length} col.
            </span>
          ) : null
        }
        ventaFooter={ventaFooter}
      />

      {lightbox && (
        <Lightbox
          producto={{ ...p, variantes: variantesConStock }}
          initialIdx={varIdx}
          initialTonoKey={activeTonoKey}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  )
}

function paresEnTarjeta(p: TarjetaCatalogo): number {
  if (isConfecciones638Lote(p)) return stockEnLote(p)
  return p.variantes
    .filter(v => v.cajas_disponibles > 0)
    .reduce((s, v) => {
      const ppc = resolveParesPorCaja({
        pares_por_caja: v.pares_por_caja,
        cantidad_cajas: v.cantidad_cajas,
        saldo_pares: v.saldo_pares,
        origen_tipo: p.origen_tipo,
        det_id: v.det_id,
        pp_id: v.pp_id,
      })
      return s + Math.max(0, v.cajas_disponibles * ppc)
    }, 0)
}

function TarjetaProductoFusion({
  producto: p,
  onNeedSession,
  descuentoPctPorMol,
}: {
  producto: TarjetaCatalogoFusionada
  onNeedSession: () => void
  descuentoPctPorMol?: Map<string, number> | null
}) {
  const [lightbox, setLightbox] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const ventaActivaStore = useSesion(s =>
    s.hydrated && !s.hydrating && s.activa && (s.cliente?.id_cliente ?? 0) > 0,
  )
  const listaPrecioId = useSesion(s => s.listaPrecioId)
  const activa = mounted ? ventaActivaStore : false

  const { lote: loteHero0, variante: vHero0 } = varianteHeroFusionada(p)
  const [activeTonoKey, setActiveTonoKey] = useState(() => tonoKeyDeVariante(vHero0))

  const porTono = variantePorTonoKey(p.lotes, activeTonoKey)
  const loteHero = porTono?.lote ?? loteHero0
  const vHero = porTono?.variante ?? vHero0
  const paresStock = p.lotes.reduce((s, l) => s + paresEnTarjeta(l), 0)
  const esConf = p.lotes.every(l => isConfecciones638Lote(l))
  const lotePeHero = loteHero.origen_tipo === 'PRONTA_ENTREGA' ? loteHero : p.lotes.find(l => l.origen_tipo === 'PRONTA_ENTREGA')
  const peVis = lotePeHero ? resolvePeVisualBadges(lotePeHero) : null
  const esPromoFusion = p.lotes.some(l => esPromoTarjeta(l))
  const esLiquidacionFusion = p.lotes.some(l => esLiquidacionPe(l))
  const shellVariant = peVis?.shellVariant ?? resolveCatalogShellVariant({
    esLiquidacion: esLiquidacionFusion,
    esPromo: esPromoFusion,
    esFusion: true,
  })
  const esPromoCp = peVis ? false : esPromoFusion
  const descPct = lotePeHero
    ? pctDescuentoDesdeTarjeta(lotePeHero, descuentoPctPorMol)
    : null
  const esPromoPeBadge = lotePeHero != null && esPromoTarjeta(lotePeHero)
  const showDescBadge =
    lotePeHero != null && hayDescuentoPeCatalogo(listaPrecioId, descPct, esPromoPeBadge)

  const ventaFooter = (
    <CatalogLotesAcordeon
      lotes={p.lotes}
      activa={activa}
      listaPrecioId={listaPrecioId}
      onNeedSession={onNeedSession}
      activeTonoKey={activeTonoKey}
      onSelectTonoKey={setActiveTonoKey}
      descuentoPctPorMol={descuentoPctPorMol}
    />
  )

  return (
    <>
      <CatalogTarjetaDeposito
        marca={labelMarcaCatalogo(p.descp_marca)}
        esPromo={esPromoCp}
        stockPares={paresStock}
        stockUnidad={esConf ? 'prend' : 'p'}
        hideStockBadge
        shellVariant={shellVariant}
        headerBadge={peVis?.headerBadge ?? null}
        imageTopRightBadge={peVis?.imageTopRightBadge ?? null}
        imageTopLeftBadge={
          showDescBadge ? (
            <PeDescComercialBadge
              pct={descPct ?? 0}
              listaPrecioId={listaPrecioId}
              esPromocional={esPromoPeBadge}
            />
          ) : null
        }
        linea={p.linea_codigo}
        referencia={p.referencia_codigo}
        material={vHero.material_code}
        color={vHero.color_code}
        imagenNombre={vHero.imagen_nombre}
        imagenColorExcel={vHero.imagen_color_excel}
        descpColor={vHero.descp_color}
        thumbSrc={vHero.imagen_url_thumb}
        flatSrc={vHero.imagen_url_flat}
        thumbCandidates={vHero.imagen_candidates_thumb}
        alt={`${p.linea_codigo}-${p.referencia_codigo} ${vHero.descp_color}`}
        priority
        compactGrid
        esConfecciones={esConf}
        onImageClick={() => setLightbox(true)}
        ventaFooter={ventaFooter}
      />
      {lightbox && (
        <Lightbox
          producto={{
            ...loteHero,
            variantes: loteHero.variantes.filter(vv => vv.cajas_disponibles > 0),
          }}
          initialIdx={Math.max(
            0,
            loteHero.variantes
              .filter(vv => vv.cajas_disponibles > 0)
              .findIndex(vv => vv.det_id === vHero.det_id),
          )}
          initialTonoKey={activeTonoKey}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  )
}

function TarjetaGrillaItem({
  producto,
  onNeedSession,
  descuentoPctPorMol,
}: {
  producto: TarjetaGrilla
  onNeedSession: () => void
  descuentoPctPorMol?: Map<string, number> | null
}) {
  if (isTarjetaFusionada(producto)) {
    return (
      <TarjetaProductoFusion
        producto={producto}
        onNeedSession={onNeedSession}
        descuentoPctPorMol={descuentoPctPorMol}
      />
    )
  }
  return (
    <TarjetaProducto
      producto={producto}
      onNeedSession={onNeedSession}
      descuentoPctPorMol={descuentoPctPorMol}
    />
  )
}


function Pill({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
      backgroundColor: active ? AZUL : '#E2E8F0',
      color: active ? 'white' : '#475569',
      transition: 'all 0.2s',
    }}>
      {children}
    </button>
  )
}

export function CatalogoGrid({
  productos,
  pps,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  productos: TarjetaGrilla[]
  pps: any[]
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    void warmPeDiccionarioClient()
  }, [])

  const [descuentoPctPorMol, setDescuentoPctPorMol] = React.useState<Map<string, number>>(
    () => new Map(),
  )
  React.useEffect(() => {
    let cancelled = false

    const cargarMapa = async () => {
      try {
        const res = await fetch('/api/pe-descuento-comercial', { cache: 'no-store' })
        const json = (await res.json()) as { ok?: boolean; descuentos?: Record<string, number> }
        if (cancelled || !json.ok || !json.descuentos) return
        setDescuentoPctPorMol(new Map(Object.entries(json.descuentos)))
      } catch {
        /* sin mapa · UI sigue */
      }
    }

    void cargarMapa()
    const poll = window.setInterval(() => void cargarMapa(), 30_000)
    const onFocus = () => void cargarMapa()
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  React.useEffect(() => {
    if (!hasMore || !onLoadMore) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '400px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, onLoadMore, productos.length])
  const { activa, carrito, cliente, vendedor, listaPrecioId } = useSesion()
  const [mostrarDialogo, setMostrarDialogo] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)

  const filtered = productos

  const cartItems = Object.values(carrito)
  const totalCajas = cartItems.reduce((s, i) => s + i.cajas, 0)
  const totalParesCarrito = cartItems.reduce((s, i) => s + i.pares, 0)
  const cartCount = cartItems.length

  const grillaPares = filtered.reduce((sum, p) => {
    if (isTarjetaFusionada(p)) {
      return sum + p.lotes.reduce((s, l) => s + paresEnTarjeta(l), 0)
    }
    return sum + paresEnTarjeta(p)
  }, 0)

  const grillaStockLabel = filtered.length > 0 && filtered.every(p => {
    const lotes = isTarjetaFusionada(p) ? p.lotes : [p]
    return lotes.every(l => isConfecciones638Lote(l))
  })
    ? 'prendas'
    : 'pares'

  const handleGenerarPDFCatalogo = async () => {
    if (!activa || !cliente) return

    setGenerandoPDF(true)
    try {
      // Preparar datos: solo productos visibles (respetando filtros)
      const productosParaPDF = filtered.flatMap(p => {
        const lotes = isTarjetaFusionada(p) ? p.lotes : [p]
        return lotes.map(lote => ({
          linea_codigo: lote.linea_codigo,
          referencia_codigo: lote.referencia_codigo,
          descp_material: lote.descp_material,
          descp_marca: lote.descp_marca,
          quincena_desc: lote.variantes[0]?.quincena_desc || null,
          numero_preventa: lote.variantes[0]?.numero_preventa || null,
          dato_duro_label: etiquetaDatoDuroCp(
            lote.variantes[0]?.numero_preventa,
            lote.variantes[0]?.quincena_desc,
          ),
          variantes: lote.variantes
            .filter(v => v.cajas_disponibles > 0)
            .map(v => ({
              det_id: v.det_id,
              descp_color: v.descp_color,
              imagen_url: v.imagen_url,
              gradas_fmt: v.gradas_fmt,
              cajas_disponibles: v.cajas_disponibles,
              precio_base: precioCatalogo(v, listaPrecioId, lote.descp_caso, lote.origen_tipo) || 0,
              lista_precio_id: listaPrecioId,
            })),
        }))
      })

      const catalogoData = {
        cliente_nombre: cliente.descp_cliente || 'Cliente',
        vendedor_nombre: vendedor?.descp_vendedor || 'Vendedor',
        lista_precio: LISTAS.find(l => l.id === listaPrecioId)?.nombre || `Lista ${listaPrecioId}`,
        fecha_generacion: new Date().toLocaleDateString('es-PY', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }

      // Debug logging
      console.log('[Catálogo] Generando PDF con:', {
        productos: productosParaPDF.length,
        cliente: catalogoData.cliente_nombre,
        vendedor: catalogoData.vendedor_nombre,
        lista: catalogoData.lista_precio,
      })

      const response = await fetch('/api/pdf/catalogo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos: productosParaPDF, catalogoData }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[Catálogo] Error del servidor:', error)
        throw new Error(error.error || error.message || 'Error generando PDF')
      }

      // Descargar PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `catalogo-${cliente.descp_cliente.replace(/\s+/g, '_')}-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('[Catálogo] Error generando PDF:', error)
      alert('Error al generar el PDF. Intentá de nuevo.')
    } finally {
      setGenerandoPDF(false)
    }
  }

  return (
    <>
      <DialogoActivacion open={mostrarDialogo} onClose={() => setMostrarDialogo(false)} />
      {/* HeaderSesion vive en FiltrosCatalogo cabecera — cero hueco muerto */}

      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
        {filtered.length} tarjetas
        {!activa && (
          <span style={{ marginLeft: 10, color: '#64748B' }}>
            · precios tras activar venta
          </span>
        )}
      </p>

      {!activa && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}>
          <button onClick={() => setMostrarDialogo(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '16px 28px', borderRadius: 16,
            backgroundColor: AZUL, color: 'white',
            fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 28px rgba(30,64,175,0.45)',
          }}>
            🔑 Activar venta
          </button>
        </div>
      )}
      {activa && cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}>
          <a href="/carrito" style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 28px', borderRadius: 16,
            backgroundColor: AZUL, color: 'white',
            fontWeight: 700, fontSize: 16, textDecoration: 'none',
            boxShadow: '0 8px 28px rgba(30,64,175,0.45)',
          }}>
            🛒 {cartCount} ref · {totalCajas} cajas · {totalParesCarrito.toLocaleString('es-PY')} pares
          </a>
        </div>
      )}
      {activa && filtered.length > 0 && (
        <div style={{ position: 'fixed', bottom: 100, right: 24, zIndex: 50 }}>
          <button
            onClick={handleGenerarPDFCatalogo}
            disabled={generandoPDF}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 24px', borderRadius: 14,
              backgroundColor: generandoPDF ? '#94A3B8' : DORADO,
              color: generandoPDF ? 'white' : AZUL,
              fontWeight: 700, fontSize: 15, border: 'none',
              cursor: generandoPDF ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 20px rgba(212,175,55,0.35)',
              transition: 'all 0.2s',
            }}
            title="Generar PDF del catálogo visible (respetando filtros)"
          >
            {generandoPDF ? (
              <>
                <svg className="animate-spin h-5 w-5 inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando PDF ({filtered.length} modelos)...
              </>
            ) : (
              <>📄 PDF Catálogo ({filtered.length} modelos)</>
            )}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>📦</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#94A3B8' }}>Sin resultados</p>
        </div>
      ) : (
        <CatalogGrillaDeposito totalModelos={filtered.length} totalPares={grillaPares} stockLabel={grillaStockLabel} compactStats>
          {filtered.map(p => (
            <TarjetaGrillaItem
              key={p.cardKey}
              producto={p}
              onNeedSession={() => setMostrarDialogo(true)}
              descuentoPctPorMol={descuentoPctPorMol}
            />
          ))}
        </CatalogGrillaDeposito>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-10">
          {loadingMore ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          ) : (
            <p className="text-sm text-slate-500">Deslizá para cargar más modelos…</p>
          )}
        </div>
      )}
    </>
  )
}
