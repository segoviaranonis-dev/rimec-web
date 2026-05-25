'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSesion, getPrecioActivo, LISTAS, esSesionDeOtroDia, type ListaId } from '@/store/sesionVenta'
import { useRouter } from 'next/navigation'
import { DialogoActivacion } from '@/components/DialogoActivacion'
import { formatearQuincena } from '@/lib/fecha'
import { estiloBadgeMarca } from '@/lib/marcaBadge'
import { origenBadgeText } from '@/lib/catalogoOrigen'
import type { RimecVariante, TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'

export type { RimecVariante, TarjetaCatalogo }
/** @deprecated Usar TarjetaCatalogo — alias para compatibilidad interna */
export type RimecAgrupado = TarjetaCatalogo

const AZUL = '#0F172A'
const CELESTE = '#0EA5E9'

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

function Imagen({ src, alt, fallbackText, className, style }: {
  src: string; alt: string; fallbackText: string; className?: string; style?: React.CSSProperties
}) {
  const [err, setErr] = useState(false)
  if (err) return (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-1 ${className ?? ''}`}
         style={{ background: `linear-gradient(135deg, ${AZUL} 0%, #2d5a8e 100%)` }}>
      <span className="text-white/80 text-sm font-extrabold tracking-wide">{fallbackText}</span>
      <span className="text-white/30 text-[9px] font-bold uppercase tracking-widest">RIMEC</span>
    </div>
  )
  return <img src={src} alt={alt} onError={() => setErr(true)} className={className} style={style} />
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
      style={{
        color: shell.accentColor,
        backgroundColor: shell.shellBackground,
        border: shell.shellBorder,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
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
  const precioVal = getPrecioActivo(v, listaPrecioId)
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

        <div className="relative flex-1 min-h-0"
             style={{ background: 'linear-gradient(135deg,#f8fafc,#eff6ff)', minHeight: 320 }}>
          <Imagen src={v.imagen_url}
                  alt={`${p.linea_codigo}-${p.referencia_codigo}`}
                  fallbackText={`${p.linea_codigo}·${p.referencia_codigo}`}
                  className="w-full h-full object-contain"
                  style={{ maxHeight: 420 } as React.CSSProperties} />

          <button onClick={onClose}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow"
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

          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full uppercase shadow-sm"
                  style={{ backgroundColor: shell.badgeBackground, color: shell.badgeColor }}>
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
              <div className="flex items-center gap-1 text-[11px] font-extrabold truncate">
                <span style={{ color: AZUL }}>{p.linea_codigo}</span>
                <span className="text-slate-300">·</span>
                <span style={{ color: shell.accentColor }}>{p.referencia_codigo}</span>
              </div>
            </div>

            {/* ETA */}
            <ChipEta label={p.origen_label} shell={shell} />
          </div>

          <p className="text-xs font-bold uppercase truncate" style={{ color: '#1e293b' }}>{p.nombre}</p>
          <p className="text-[10px] text-slate-400 truncate mb-2">
            {p.descp_material} · {v.descp_color}
          </p>
          <p className="text-[10px] font-mono font-bold text-slate-500 mb-3 bg-slate-50 px-2 py-1 rounded">
            {v.gradas_fmt}
          </p>

          <div className="flex items-end justify-between gap-2 mb-4">
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
          
          {p.variantes.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-3 items-center">
              {p.variantes.map((vv, i) => {
                const hex = resolverHex(vv)
                const isActive = i === idx
                return (
                  <button
                    key={vv.det_id}
                    onClick={() => setIdx(i)}
                    title={vv.descp_color}
                    aria-label={`Color ${vv.descp_color}`}
                    aria-pressed={isActive}
                    type="button"
                    className="cursor-pointer focus:outline-none"
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      backgroundColor: hex,
                      border: '1.5px solid #CBD5E1',
                      boxShadow: isActive
                        ? `0 0 0 2px white, 0 0 0 4px ${CELESTE}`
                        : '0 1px 2px rgba(0,0,0,0.08)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      transform: isActive ? 'scale(1.10)' : 'scale(1)',
                    }}
                  />
                )
              })}
              <span className="text-xs text-slate-500 ml-1">{v.descp_color}</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function TarjetaProducto({ producto: p, onNeedSession }: { producto: TarjetaCatalogo; onNeedSession: () => void }) {
  // Filtrar solo variantes con stock disponible
  const variantesConStock = p.variantes.filter(v => v.cajas_disponibles > 0)

  const [varIdx, setVarIdx] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const activaStore   = useSesion(s => s.activa)
  const carrito       = useSesion(s => s.carrito)
  const listaPrecioId = useSesion(s => s.listaPrecioId)
  const agregarCaja   = useSesion(s => s.agregarCaja)
  const quitarCaja    = useSesion(s => s.quitarCaja)

  const activa = mounted ? activaStore : false

  // Usar solo variantes con stock
  const v = variantesConStock[varIdx] || p.variantes[0]

  const precioVal = getPrecioActivo(v, listaPrecioId)
  const tienePrecio = precioVal !== null && precioVal > 0
  const precio = tienePrecio ? new Intl.NumberFormat('es-PY').format(precioVal as number) : null
  const shell = p.shell
  const cartItem = carrito[`det_${v.det_id}`]
  const cajas = cartItem ? cartItem.cajas : 0
  const maxCajas = v.cajas_disponibles

  const puedeAgregar = !!activa && tienePrecio && cajas < maxCajas

  const botonPlusColor = !activa
    ? '#CBD5E1'
    : !tienePrecio
      ? '#F1F5F9'
      : cajas >= maxCajas
        ? '#E2E8F0'
        : AZUL

  const botonPlusTxt = !activa
    ? 'white'
    : !tienePrecio
      ? '#CBD5E1'
      : cajas >= maxCajas
        ? '#94A3B8'
        : 'white'

  const handleAgregar = () => {
    if (!activa) { onNeedSession(); return }
    if (!tienePrecio || cajas >= maxCajas) return
    void agregarCaja({
      det_id:            v.det_id,
      linea_codigo:      p.linea_codigo,
      referencia_codigo: p.referencia_codigo,
      material_code:     v.material_code,
      color_code:        v.color_code,
      color_nombre:      v.descp_color,
      pp_id:             v.pp_id,
      pp_nro:            v.pp_nro,
      eta:                v.eta,
      marca:             p.descp_marca ?? '',
      marca_id:          p.marca_id ?? null,
      caso:              p.descp_caso ?? '',
      caso_id:           p.caso_id ?? null,
      nombre:            p.nombre,
      gradas_fmt:         v.gradas_fmt,
      imagen_url:         v.imagen_url,
      lista_precio_id:   listaPrecioId,
      precio_base:        precioVal as number,
      precio_lpn:         v.lpn ?? 0,
      precio_lpc02:       v.lpc02 ?? 0,
      precio_lpc03:       v.lpc03 ?? 0,
      precio_lpc04:       v.lpc04 ?? 0,
      cant_caja:          v.pares_por_caja,
    })
  }

  return (
    <>
      <div className="group flex flex-col overflow-hidden h-full relative"
           style={{
             borderRadius: '16px',
             backgroundColor: shell.shellBackground,
             border: shell.shellBorder,
             boxShadow: shell.boxShadow,
             transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
           }}>

        <div className="relative aspect-square overflow-hidden cursor-zoom-in bg-[#F8FAFC]"
             onClick={() => setLightbox(true)}>
          <Imagen src={v.imagen_url}
                  alt={`${p.linea_codigo}-${p.referencia_codigo} ${v.descp_color}`}
                  fallbackText={`${p.linea_codigo}·${p.referencia_codigo}`}
                  className="w-full h-full object-contain p-3 transition-transform duration-700 ease-out group-hover:scale-105" />

          <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full uppercase shadow-sm"
                  style={{ backgroundColor: shell.badgeBackground, color: shell.badgeColor }}>
              {origenBadgeText(p.origen_tipo)}
            </span>
          </div>

          {variantesConStock.length > 1 && (
            <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#475569',
                           boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              {variantesConStock.length} col.
            </span>
          )}
        </div>

        <div className="flex flex-col flex-1 p-3">
          {/* Fila 3: Marca y Códigos */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0"
                    style={estiloBadgeMarca(p.descp_marca)}>
                {p.descp_marca}
              </span>
              <div className="flex items-center gap-1 text-[11px] font-extrabold truncate">
                <span style={{ color: AZUL }}>{p.linea_codigo}</span>
                <span className="text-slate-300">·</span>
                <span style={{ color: shell.accentColor }}>{p.referencia_codigo}</span>
              </div>
            </div>

            {/* ETA — nueva ubicación pedida por el Director */}
            <ChipEta label={p.origen_label} shell={shell} />
          </div>

          {/* Fila 4: Descripción */}
          <p className="text-[10px] font-bold uppercase truncate" style={{ color: '#1e293b' }}>
            {p.nombre}
          </p>

          {/* Fila 5: Material y Color */}
          <p className="text-[10px] text-slate-400 truncate mb-1">
            {p.descp_material} · {v.descp_color}
          </p>

          {/* Fila 6: Grada */}
          <p className="text-[10px] font-mono font-bold text-slate-500 mb-2 bg-slate-50 px-2 py-0.5 rounded">
            {v.gradas_fmt}
          </p>

          {/* Fila 7: Precio y Disponibilidad */}
          <div className="flex items-end justify-between gap-1 mb-3">
            {!activa ? (
              <span className="text-[10px] font-semibold text-slate-400">🔒 Activar venta</span>
            ) : tienePrecio ? (
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-0.5">Precio Gs.</p>
                <span className="text-sm font-extrabold" style={{ color: CELESTE }}>{precio}</span>
              </div>
            ) : (
              <span
                title={
                  cartItem
                    ? 'Este ítem perdió su precio porque el listado fue desvinculado en Nexus Core. ' +
                      'Quitalo del carrito; cuando Alfredo lo vincule de nuevo, podés volver a agregarlo.'
                    : 'Este SKU aún no tiene precio vinculado al PP. El Director debe vincular el listado en Nexus Core (Streamlit) antes de venderlo.'
                }
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md"
                style={{
                  backgroundColor: cartItem ? '#FEE2E2' : '#FEF3C7',
                  color: cartItem ? '#991B1B' : '#92400E',
                  border: cartItem ? '1px solid #FCA5A5' : '1px solid #FCD34D',
                  cursor: 'help',
                }}
              >
                {cartItem ? '⚠ Sin precio (en carrito)' : 'Precio pendiente de vinculación'}
              </span>
            )}
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: shell.shellBackground, color: shell.accentColor, border: shell.shellBorder }}>
              disp: {v.cajas_disponibles} cjs
            </span>
          </div>

          {/* Variantes de color: chips clickeables que cambian la variante visible */}
          {variantesConStock.length > 1 && (
            <div className="flex flex-wrap gap-2 pb-3 items-center">
              {variantesConStock.map((vv, i) => {
                const hex = resolverHex(vv)
                const isActive = i === varIdx
                return (
                  <button
                    key={vv.det_id}
                    onClick={(e) => { e.stopPropagation(); setVarIdx(i) }}
                    title={`${vv.descp_color} (${vv.cajas_disponibles} cjs)`}
                    aria-label={`Color ${vv.descp_color}`}
                    aria-pressed={isActive}
                    type="button"
                    className="group/chip relative cursor-pointer focus:outline-none"
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      backgroundColor: hex,
                      // Borde fijo gris para que el chip se vea siempre, aún sobre blanco
                      border: '1.5px solid #CBD5E1',
                      // Ring celeste prominente sólo cuando está activo
                      boxShadow: isActive
                        ? `0 0 0 2px white, 0 0 0 4px ${CELESTE}`
                        : '0 1px 2px rgba(0,0,0,0.08)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      transform: isActive ? 'scale(1.10)' : 'scale(1)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.15)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
                    }}
                  />
                )
              })}
              {/* Etiqueta del color activo */}
              <span className="text-[10px] text-slate-400 ml-1 truncate max-w-[120px]">
                {v.descp_color}
              </span>
            </div>
          )}

          {/* Controles de compra. Si el SKU no tiene precio, el bloque entero queda visualmente opaco
              y los handlers son no-ops. Teclado/Enter no fuerzan inserción. */}
          <div
            className="mt-auto space-y-2"
            style={{ opacity: activa && !tienePrecio ? 0.55 : 1 }}
            aria-disabled={activa && !tienePrecio ? true : undefined}
            onKeyDown={(e) => {
              if (activa && !tienePrecio && (e.key === 'Enter' || e.key === ' ' || e.key === '+')) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { if (!activa) { onNeedSession(); return }; if (!tienePrecio) return; void quitarCaja(v.det_id) }}
                disabled={!activa || !tienePrecio || cajas === 0}
                aria-disabled={!activa || !tienePrecio || cajas === 0}
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-colors"
                style={{
                  borderColor: activa && tienePrecio && cajas > 0 ? AZUL : '#E2E8F0',
                  color: activa && tienePrecio && cajas > 0 ? AZUL : '#CBD5E1',
                  cursor: activa && tienePrecio && cajas > 0 ? 'pointer' : 'not-allowed',
                }}>−</button>

              <div className="flex-1 text-center">
                <p className="text-lg font-black leading-none" style={{ color: activa && tienePrecio ? AZUL : '#CBD5E1' }}>{cajas}</p>
                <p className="text-[9px] text-slate-500 font-medium">
                  {cajas === 0 ? 'cajas' : `= ${cajas * v.pares_por_caja} p`}
                </p>
              </div>

              <button
                type="button"
                onClick={handleAgregar}
                disabled={!puedeAgregar}
                aria-disabled={!puedeAgregar}
                title={
                  !activa
                    ? 'Activá la venta primero'
                    : !tienePrecio
                      ? 'Precio pendiente de vinculación — no se puede agregar al carrito hasta que Alfredo vincule el listado en Nexus Core.'
                      : cajas >= maxCajas
                        ? `Llegaste al máximo (${maxCajas} cajas)`
                        : 'Agregar al carrito'
                }
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-colors"
                style={{
                  borderColor: botonPlusColor,
                  backgroundColor: botonPlusColor,
                  color: botonPlusTxt,
                  cursor: puedeAgregar ? 'pointer' : 'not-allowed',
                }}>+</button>
            </div>

            <p className="text-[9px] text-center text-slate-400 font-medium">
              {v.pares_por_caja} pares/caja · máx. {maxCajas} cjs
            </p>

            {activa && !tienePrecio && (
              <p className="text-[9px] text-center font-semibold" style={{ color: '#92400E' }}>
                Bloqueado hasta que el Director vincule el listado de precios.
              </p>
            )}

            {cajas > 0 && tienePrecio && (
              <a href="/carrito" className="block w-full py-1.5 rounded-lg bg-emerald-500 text-white text-center font-bold text-xs">
                En pedido ✅
              </a>
            )}
          </div>
        </div>
      </div>

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

export function CatalogoGrid({ productos, pps }: { productos: TarjetaCatalogo[], pps: any[] }) {
  const { activa, carrito } = useSesion()
  const [lineaFiltro, setLineaFiltro] = useState('')
  const [colorFiltro, setColorFiltro] = useState('')
  const [ofertasFiltro, setOfertasFiltro] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [mostrarDialogo, setMostrarDialogo] = useState(false)

  // Derived unique lists for filters
  const lineasDisponibles = Array.from(new Set(productos.map(p => p.linea_codigo))).sort()
  
  // Group colors logically using el hex del pilar (color_hex) con fallback al regex
  // Filtrar solo colores con stock disponible
  const baseColorsPresent = new Set<string>()
  productos.forEach(p => p.variantes.filter(v => v.cajas_disponibles > 0).forEach(v => {
    baseColorsPresent.add(resolverHex(v))
  }))
  const coloresDisponibles = Array.from(baseColorsPresent)

  const filtered = productos.filter(p => {
    if (lineaFiltro && p.linea_codigo !== lineaFiltro) return false
    if (colorFiltro && !p.variantes.some(v => resolverHex(v) === colorFiltro)) return false
    // Note: ofertasFiltro kept purely visual per aesthetic constraint, filtering not applied if no real data field exists.
    if (buscar) {
      const q = buscar.toLowerCase()
      if (![p.descp_marca, p.linea_codigo, p.referencia_codigo, p.nombre, p.descp_material]
            .some(f => f?.toLowerCase().includes(q)) &&
          !p.variantes.some(v => v.descp_color.toLowerCase().includes(q))) return false
    }
    return true
  })

  const cartItems = Object.values(carrito)
  const totalCajas = cartItems.reduce((s, i) => s + i.cajas, 0)
  const totalPares = cartItems.reduce((s, i) => s + i.pares, 0)
  const cartCount = cartItems.length

  return (
    <>
      <DialogoActivacion open={mostrarDialogo} onClose={() => setMostrarDialogo(false)} />
      <HeaderSesion />

      <div className="flex flex-col md:flex-row md:items-center gap-6 mb-10 bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        {/* Search */}
        <div className="flex-1">
          <input value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar modelos..."
            className="w-full bg-transparent border-b border-gray-200 px-0 py-2 text-sm placeholder-gray-400 focus:outline-none focus:border-[#0F172A] transition-colors" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-8">
          
          {/* Color Circles */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Color</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-[260px] no-scrollbar">
              {/* "Todos" — multicolor */}
              <button
                onClick={() => setColorFiltro('')}
                aria-label="Mostrar todos los colores"
                aria-pressed={!colorFiltro}
                title="Todos los colores"
                type="button"
                className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer transition-all
                            ${!colorFiltro
                              ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-900'
                              : 'border-gray-300 opacity-60 hover:opacity-100 hover:scale-110'}`}>
                <span className="w-4 h-4 rounded-full bg-[conic-gradient(red,yellow,green,blue,magenta,red)] block" />
              </button>
              {/* Chips por hex de color */}
              {coloresDisponibles.map(hex => {
                const isActive = colorFiltro === hex
                return (
                  <button
                    key={hex}
                    onClick={() => setColorFiltro(isActive ? '' : hex)}
                    aria-label={`Filtrar por color ${hex}`}
                    aria-pressed={isActive}
                    title={hex}
                    type="button"
                    className="shrink-0 cursor-pointer focus:outline-none"
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      backgroundColor: hex,
                      border: '1.5px solid #CBD5E1',
                      boxShadow: isActive
                        ? `0 0 0 2px white, 0 0 0 4px #0F172A`
                        : '0 1px 3px rgba(0,0,0,0.08)',
                      transform: isActive ? 'scale(0.92)' : 'scale(1)',
                      opacity: colorFiltro && !isActive ? 0.4 : 1,
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.12)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
                    }}
                  />
                )
              })}
            </div>
          </div>

          {/* Offers Toggle */}
          <div className="flex items-center gap-3 border-l border-gray-200 pl-8">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Ofertas</span>
            <button 
              onClick={() => setOfertasFiltro(!ofertasFiltro)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none ${ofertasFiltro ? 'bg-[#0EA5E9]' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-300 ease-in-out shadow-sm ${ofertasFiltro ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

        </div>
      </div>

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
            🛒 {cartCount} ref · {totalCajas} cajas · {totalPares.toLocaleString('es-PY')} pares
          </a>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>📦</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#94A3B8' }}>Sin resultados</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {filtered.map(p => (
            <TarjetaProducto key={p.cardKey} producto={p} onNeedSession={() => setMostrarDialogo(true)} />
          ))}
        </div>
      )}
    </>
  )
}
