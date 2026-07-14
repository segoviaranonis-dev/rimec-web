'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSesion, getPrecioActivo, getPrecioActivoPe, LISTAS, esSesionDeOtroDia, type ListaId } from '@/store/sesionVenta'
import { useRouter } from 'next/navigation'
import { DialogoActivacion } from '@/components/DialogoActivacion'
import { CatalogCarruselColores } from '@/components/catalog/CatalogCarruselColores'
import { CatalogGrillaDeposito } from '@/components/catalog/CatalogGrillaDeposito'
import { CatalogTarjetaDeposito } from '@/components/catalog/CatalogTarjetaDeposito'
import { PromoCasoBadge } from '@/components/catalog/PromoCasoBadge'
import { ProductImage } from '@/components/ProductImage'
import {
  origenBadgePillStyle,
  origenChipStyle,
} from '@/lib/catalogCardChrome'
import { formatearQuincena } from '@/lib/fecha'
import { estiloBadgeMarca } from '@/lib/marcaBadge'
import { origenBadgeText } from '@/lib/catalogoOrigen'
import { resolveParesPorCaja, syntheticPpIdForPe } from '@/lib/prontaEntregaVenta'
import { esCasoPromocional } from '@/lib/precioLista'
import type { RimecVariante, TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import {
  isTarjetaFusionada,
  varianteHeroFusionada,
  type TarjetaCatalogoFusionada,
  type TarjetaGrilla,
} from '@/lib/fusionTarjetasCatalogo'
import { CatalogLotesAcordeon } from '@/components/catalog/CatalogLotesAcordeon'

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

function etiquetaOrigenChip(origen: TarjetaCatalogo['origen_tipo'], quincenaDesc: string | null | undefined): string {
  if (quincenaDesc) return quincenaDesc
  return origen === 'PRONTA_ENTREGA' ? 'Pronta entrega' : 'Compra previa'
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

function HeaderSesion() {
  const activa        = useSesion(s => s.activa)
  const cliente       = useSesion(s => s.cliente)
  const vendedorDesc  = useSesion(s => s.vendedor?.descp_vendedor)
  const plazoDesc     = useSesion(s => s.plazo?.descp_plazo)
  const listaPrecioId = useSesion(s => s.listaPrecioId)
  const activatedAt   = useSesion(s => s.activatedAt)
  const desactivar    = useSesion(s => s.desactivar)
  const cerrarVenta   = () => { void desactivar() }
  const router        = useRouter()

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!activa) return null

  const clienteNombre = cliente?.descp_cliente || 'Cliente no asignado'
  const listaNombre   = LISTAS.find(l => l.id === listaPrecioId)?.nombre ?? '—'
  // Sesión activada en un día calendario anterior: precios pueden haber cambiado en Nexus Core.
  const sesionVieja   = mounted && esSesionDeOtroDia(activatedAt)
  const fechaActiv    = activatedAt ? new Date(activatedAt) : null
  const fechaActivStr = fechaActiv
    ? fechaActiv.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', backgroundColor: AZUL, color: 'white',
        borderRadius: sesionVieja ? '16px 16px 0 0' : 16,
        boxShadow: '0 4px 12px rgba(30,64,175,0.2)',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            backgroundColor: 'white', color: AZUL,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, flexShrink: 0,
          }}>
            {clienteNombre.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 10, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 2 }}>
              Venta a cliente
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clienteNombre}
            </p>
            <p style={{ fontSize: 11, color: '#93C5FD', marginTop: 2 }}>
              Lista <strong style={{ color: 'white' }}>{listaNombre}</strong>
              {plazoDesc ? <> · Plazo <strong style={{ color: 'white' }}>{plazoDesc}</strong></> : null}
              {vendedorDesc ? <> · Vendedor <strong style={{ color: 'white' }}>{vendedorDesc}</strong></> : null}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => router.refresh()}
            title="Volver a consultar precios y stock al servidor"
            style={{
              padding: '8px 14px', borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.16)', color: 'white',
              border: '1px solid rgba(255,255,255,0.22)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            🔄 Revalidar
          </button>
          <button
            onClick={cerrarVenta}
            title="Cerrar la sesión de venta (sigue logueado como vendedor)"
            style={{
              padding: '8px 16px', borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.12)', color: 'white',
              border: '1px solid rgba(255,255,255,0.18)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Cerrar venta
          </button>
        </div>
      </div>

      {sesionVieja && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap',
            padding: '12px 20px',
            backgroundColor: '#FEF3C7',
            color: '#78350F',
            border: '1px solid #FCD34D',
            borderTop: 'none',
            borderRadius: '0 0 16px 16px',
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 800 }}>
                Sesión iniciada el {fechaActivStr}
              </p>
              <p style={{ fontSize: 12, marginTop: 2 }}>
                Los precios o disponibilidad pueden haber cambiado desde anoche. Refrescá el catálogo;
                las tarjetas que aparezcan como <em>Sin precio</em> ya no están vigentes en la lista <strong>{listaNombre}</strong>.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => router.refresh()}
              style={{
                padding: '8px 14px', borderRadius: 8,
                backgroundColor: '#78350F', color: 'white',
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
              }}
            >
              Refrescar catálogo
            </button>
            <button
              onClick={cerrarVenta}
              title="Descarta sesión y carrito vencidos para empezar de cero"
              style={{
                padding: '8px 14px', borderRadius: 8,
                backgroundColor: 'transparent', color: '#78350F',
                border: '1px solid #B45309', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
              }}
            >
              Iniciar venta nueva
            </button>
          </div>
        </div>
      )}
    </div>
  )
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

function Lightbox({ producto: p, initialIdx, onClose }: {
  producto: TarjetaCatalogo; initialIdx: number; onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIdx)
  const v = p.variantes[idx]
  const shell = p.shell

  const listaPrecioId = useSesion(s => s.listaPrecioId)
  const precioVal = precioCatalogo(v, listaPrecioId, p.descp_caso, p.origen_tipo)
  const precio = precioVal ? new Intl.NumberFormat('es-PY').format(precioVal) : null

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + p.variantes.length) % p.variantes.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % p.variantes.length)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose, p.variantes.length])

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
            variantes={p.variantes}
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

          {p.variantes.length > 1 && (
            <>
              <button onClick={() => setIdx(i => (i - 1 + p.variantes.length) % p.variantes.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow"
                      style={{ color: AZUL }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={() => setIdx(i => (i + 1) % p.variantes.length)}
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
              {esCasoPromocional(p.descp_caso) ? <PromoCasoBadge size="md" /> : null}
              <div className="flex items-center gap-1 text-[11px] font-extrabold truncate">
                <span style={{ color: AZUL }}>{p.linea_codigo}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-700">{p.referencia_codigo}</span>
              </div>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1 text-sm font-extrabold leading-none px-3 py-1.5 rounded-lg shadow-sm mb-1"
            style={origenChipStyle(shell, Boolean(v.quincena_desc))}
          >
            {v.quincena_desc ? `📦 ${v.quincena_desc}` : 'NULL'}
          </span>

          <p className="text-[10px] text-slate-400 truncate mb-2">
            {p.descp_material} · {v.descp_color}
          </p>
          <p className="text-[10px] font-mono font-bold text-slate-500 mb-3 bg-slate-50 px-2 py-1 rounded">
            {v.gradas_fmt}
          </p>

          <div className="flex items-end justify-between gap-2">
            {precio && (
              <div>
                <p className="text-[9px] font-semibold uppercase text-slate-400 leading-none mb-0.5">Precio Gs.</p>
                <div className="text-lg font-extrabold" style={{ color: CELESTE }}>{precio}</div>
              </div>
            )}
            <div className="text-right">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#f0f9ff', color: CELESTE }}>
                disp: {v.cajas_disponibles} cjs
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function TarjetaProducto({ producto: p, onNeedSession }: { producto: TarjetaCatalogo; onNeedSession: () => void }) {
  const variantesConStock = p.variantes.filter(v => v.cajas_disponibles > 0)
  const [varIdx, setVarIdx] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const activaStore = useSesion(s => s.activa)
  const listaPrecioId = useSesion(s => s.listaPrecioId)
  const activa = mounted ? activaStore : false

  const v = variantesConStock[varIdx] || p.variantes[0]
  const precioVal = precioCatalogo(v, listaPrecioId, p.descp_caso, p.origen_tipo)
  const tienePrecio = precioVal !== null && precioVal > 0
  const precioTarjeta = activa && tienePrecio ? (precioVal as number) : null
  const paresStock = paresEnTarjeta(p)
  const esPe = p.origen_tipo === 'PRONTA_ENTREGA'
  const esPromo = esCasoPromocional(p.descp_caso)
  const shellVariant = esPe ? 'pe' as const : 'cp' as const

  const ventaFooter = (
    <CatalogLotesAcordeon
      lotes={[p]}
      activa={activa}
      listaPrecioId={listaPrecioId}
      onNeedSession={onNeedSession}
    />
  )

  return (
    <>
      <CatalogTarjetaDeposito
        marca={p.descp_marca}
        esPromo={esPromo}
        stockPares={paresStock}
        hideStockBadge
        shellVariant={shellVariant}
        linea={p.linea_codigo}
        referencia={p.referencia_codigo}
        material={v.material_code}
        color={v.color_code}
        imagenNombre={v.imagen_nombre}
        thumbSrc={v.imagen_url_thumb}
        flatSrc={v.imagen_url_flat}
        thumbCandidates={v.imagen_candidates_thumb}
        alt={`${p.linea_codigo}-${p.referencia_codigo} ${v.descp_color}`}
        precio={precioTarjeta}
        priority={varIdx === 0}
        compactGrid
        onImageClick={() => setLightbox(true)}
        imageOverlay={
          variantesConStock.length > 1 ? (
            <span className="pointer-events-none absolute top-2.5 right-2.5 z-10 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm">
              {variantesConStock.length} col.
            </span>
          ) : null
        }
        ventaFooter={ventaFooter}
      />

      {lightbox && (
        <Lightbox
          producto={{ ...p, variantes: variantesConStock }}
          initialIdx={varIdx}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  )
}

function paresEnTarjeta(p: TarjetaCatalogo): number {
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
}: {
  producto: TarjetaCatalogoFusionada
  onNeedSession: () => void
}) {
  const [lightbox, setLightbox] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const activaStore = useSesion(s => s.activa)
  const listaPrecioId = useSesion(s => s.listaPrecioId)
  const activa = mounted ? activaStore : false

  const { lote: loteHero, variante: vHero } = varianteHeroFusionada(p)
  const paresStock = p.lotes.reduce((s, l) => s + paresEnTarjeta(l), 0)
  const precioHero = precioCatalogo(vHero, listaPrecioId, loteHero.descp_caso, loteHero.origen_tipo)
  const precioTarjeta = activa && precioHero && precioHero > 0 ? precioHero : null
  const esPromo = p.lotes.some(l => esCasoPromocional(l.descp_caso))

  const ventaFooter = (
    <CatalogLotesAcordeon
      lotes={p.lotes}
      activa={activa}
      listaPrecioId={listaPrecioId}
      onNeedSession={onNeedSession}
    />
  )

  return (
    <>
      <CatalogTarjetaDeposito
        marca={p.descp_marca}
        esPromo={esPromo}
        stockPares={paresStock}
        hideStockBadge
        shellVariant="fusion"
        linea={p.linea_codigo}
        referencia={p.referencia_codigo}
        material={vHero.material_code}
        color={vHero.color_code}
        imagenNombre={vHero.imagen_nombre}
        thumbSrc={vHero.imagen_url_thumb}
        flatSrc={vHero.imagen_url_flat}
        thumbCandidates={vHero.imagen_candidates_thumb}
        alt={`${p.linea_codigo}-${p.referencia_codigo}`}
        precio={precioTarjeta}
        priority
        compactGrid
        onImageClick={() => setLightbox(true)}
        ventaFooter={ventaFooter}
      />
      {lightbox && (
        <Lightbox
          producto={loteHero}
          initialIdx={Math.max(0, loteHero.variantes.findIndex(vv => vv.det_id === vHero.det_id))}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  )
}

function TarjetaGrillaItem({
  producto,
  onNeedSession,
}: {
  producto: TarjetaGrilla
  onNeedSession: () => void
}) {
  if (isTarjetaFusionada(producto)) {
    return <TarjetaProductoFusion producto={producto} onNeedSession={onNeedSession} />
  }
  return <TarjetaProducto producto={producto} onNeedSession={onNeedSession} />
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
      <HeaderSesion />

      <p style={{ fontSize: 14, color: '#64748B', marginBottom: 20 }}>
        Mostrando <strong style={{ color: AZUL }}>{filtered.length}</strong> modelos
        {!activa && (
          <span style={{ marginLeft: 12, color: CELESTE, fontWeight: 600 }}>
            🔒 Precios visibles tras activar venta (cliente + lista)
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
        <CatalogGrillaDeposito totalModelos={filtered.length} totalPares={grillaPares} compactStats>
          {filtered.map(p => (
            <TarjetaGrillaItem key={p.cardKey} producto={p} onNeedSession={() => setMostrarDialogo(true)} />
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
