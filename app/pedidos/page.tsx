'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const AZUL = '#1E40AF'

interface FacturaPayload {
  marca?: string
  marca_id?: number | null
  caso?: string
  caso_id?: number | null
  total_pares?: number
  total_monto?: number
  items?: Array<{ det_id?: number; linea_codigo?: string; ref_codigo?: string; pares?: number }>
}

interface LotePayload {
  pp_id?: number
  pp_nro?: string
  proforma?: string
  quincena?: string
  eta?: string | null
  total_pares?: number
  total_monto?: number
  facturas?: FacturaPayload[]
}

interface PayloadJson {
  cliente_id?: number
  cliente_nombre?: string
  vendedor_nombre?: string
  plazo_nombre?: string
  lista_nombre?: string
  descuento_1?: number
  descuento_2?: number
  descuento_3?: number
  descuento_4?: number
  lotes?: LotePayload[]
}

interface PedidoRow {
  id:               number
  nro_pedido:       string
  cliente_id:       number | null
  vendedor_id:      number | null
  plazo_id:         number | null
  lista_precio_id:  number | null
  descuento_1:      number | null
  descuento_2:      number | null
  descuento_3:      number | null
  descuento_4:      number | null
  total_pares:      number
  total_monto:      number
  estado:           string
  created_at:       string
  payload_json:     PayloadJson | null
}

interface FacturaInternaRow {
  id:           number
  nro_factura:  string
  numero_preventa_global?: string | null
  pv_global:    number | null
  pp_id:        number
  pedido_id:    number | null
  marca:        string | null
  marca_id:     number | null
  caso:         string | null
  caso_id:      number | null
  total_pares:  number
  total_monto:  number
  estado:       string
  created_at:   string
}

function fmtMoney(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('es-PY')
}
function fmtPares(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('es-PY')
}
function fmtFecha(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-PY', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function fmtPV(fi: FacturaInternaRow): string {
  // Prioridad: numero_preventa_global (desde vista) > pv_global (directo) > nro_factura legacy
  if (fi.numero_preventa_global) {
    return fi.numero_preventa_global
  }
  if (fi.pv_global) {
    return `PV${fi.pv_global.toString().padStart(6, '0')}`
  }
  return fi.nro_factura
}

function estadoBadge(estado: string): { bg: string; fg: string; label: string } {
  switch (estado) {
    case 'PENDIENTE':  return { bg: '#FEF3C7', fg: '#92400E', label: 'PENDIENTE' }
    case 'RESERVADA':  return { bg: '#DBEAFE', fg: '#1E40AF', label: 'RESERVADA' }
    case 'FACTURADA':  return { bg: '#D1FAE5', fg: '#065F46', label: 'FACTURADA' }
    case 'CANCELADA':  return { bg: '#FEE2E2', fg: '#991B1B', label: 'CANCELADA' }
    default:           return { bg: '#F1F5F9', fg: '#475569', label: estado }
  }
}

function PedidosContent() {
  const sp = useSearchParams()
  const destacar = sp.get('destacar') // ej: ?destacar=PVR-2026-123456

  const [pedidos,  setPedidos]  = useState<PedidoRow[]>([])
  const [facturas, setFacturas] = useState<Record<number, FacturaInternaRow[]>>({})
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)

      const { data: peds, error: e1 } = await supabase
        .from('pedido_venta_rimec')
        .select('*')
        .order('id', { ascending: false })
        .limit(30)

      if (e1) {
        if (!cancelado) {
          setError(`Error cargando pedidos: ${e1.message}`)
          setCargando(false)
        }
        return
      }

      const pedRows = (peds ?? []) as PedidoRow[]
      if (cancelado) return

      // Cargamos las FIs de estos pedidos. Estrategia híbrida:
      //   · Preferimos `pedido_id` (FK formal, migración 029).
      //   · Fallback a ventana de ±10s en `created_at` para FIs viejas.
      const fxMap: Record<number, FacturaInternaRow[]> = {}
      if (pedRows.length > 0) {
        const pedIds = pedRows.map(p => p.id)
        const minCreated = pedRows[pedRows.length - 1].created_at

        const { data: fis } = await supabase
          .from('v_factura_interna_preventa')
          .select('id, numero_preventa_global, nro_factura, pp_id, pedido_id, marca, marca_id, caso, caso_id, total_pares, total_monto, estado, created_at')
          .or(`pedido_id.in.(${pedIds.join(',')}),and(pedido_id.is.null,created_at.gte.${minCreated})`)
          .order('id', { ascending: true })

        const fiRows = (fis ?? []) as FacturaInternaRow[]
        for (const fi of fiRows) {
          // 1) Caso ideal: pedido_id presente y conocido
          if (fi.pedido_id && pedIds.includes(fi.pedido_id)) {
            if (!fxMap[fi.pedido_id]) fxMap[fi.pedido_id] = []
            fxMap[fi.pedido_id].push(fi)
            continue
          }
          // 2) Fallback: matchear por timestamp (FIs viejas anteriores a la 029)
          const fiTime = new Date(fi.created_at).getTime()
          let best: PedidoRow | null = null
          let bestDelta = Infinity
          for (const p of pedRows) {
            const delta = Math.abs(fiTime - new Date(p.created_at).getTime())
            if (delta < bestDelta && delta < 10_000) {
              best = p
              bestDelta = delta
            }
          }
          if (best) {
            if (!fxMap[best.id]) fxMap[best.id] = []
            fxMap[best.id].push(fi)
          }
        }
      }

      if (!cancelado) {
        setPedidos(pedRows)
        setFacturas(fxMap)
        setCargando(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [])

  if (cargando) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
        Cargando pedidos…
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', padding: 24,
                    background: '#FEE2E2', border: '1px solid #FCA5A5',
                    borderRadius: 12, color: '#7F1D1D' }}>
        {error}
      </div>
    )
  }
  if (pedidos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>📋</p>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: AZUL, marginBottom: 8 }}>
          Sin pedidos aún
        </h1>
        <p style={{ color: '#64748B', marginBottom: 24 }}>
          Confirmá un pedido desde el carrito y volvé a esta pantalla.
        </p>
        <Link href="/" style={{
          display: 'inline-block', padding: '14px 28px', borderRadius: 12,
          backgroundColor: AZUL, color: 'white', fontWeight: 700,
          textDecoration: 'none', fontSize: 16,
        }}>← Ir al Catálogo</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: AZUL }}>
          Pedidos · Rimec
        </h1>
        <Link href="/" style={{
          padding: '10px 18px', borderRadius: 10, backgroundColor: AZUL,
          color: 'white', fontWeight: 700, textDecoration: 'none', fontSize: 14,
        }}>← Catálogo</Link>
      </div>

      <p style={{ color: '#64748B', marginBottom: 24, fontSize: 14 }}>
        Últimos {pedidos.length} pedidos confirmados desde la web.
        Cada pedido genera <strong>una factura interna por (PP × Marca × Caso)</strong>
        respetando la Regla 1.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {pedidos.map(p => {
          const es = estadoBadge(p.estado)
          const fis = facturas[p.id] ?? []
          const destacado = destacar && p.nro_pedido === destacar
          const descs = [p.descuento_1, p.descuento_2, p.descuento_3, p.descuento_4]
            .filter(d => (d ?? 0) > 0)
            .map(d => `${d}%`)
            .join(' + ') || 'Sin descuento'
          const lotes = p.payload_json?.lotes ?? []

          return (
            <div
              key={p.id}
              style={{
                border: destacado ? `3px solid #10B981` : '1px solid #E2E8F0',
                borderRadius: 14,
                padding: 20,
                background: destacado ? '#ECFDF5' : 'white',
                boxShadow: destacado
                  ? '0 4px 14px rgba(16, 185, 129, 0.18)'
                  : '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              {destacado && (
                <div style={{ background: '#10B981', color: 'white',
                              display: 'inline-block', padding: '4px 12px',
                              borderRadius: 20, fontSize: 12, fontWeight: 700,
                              marginBottom: 10, letterSpacing: 0.5 }}>
                  ✓ RECIÉN CONFIRMADO
                </div>
              )}

              {/* Cabecera */}
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: AZUL,
                               marginBottom: 4, letterSpacing: 0.5 }}>
                    {p.nro_pedido}
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748B' }}>
                    {fmtFecha(p.created_at)}
                  </p>
                </div>
                <span style={{
                  background: es.bg, color: es.fg, padding: '4px 12px',
                  borderRadius: 20, fontSize: 11, fontWeight: 800,
                  letterSpacing: 0.5,
                }}>
                  {es.label}
                </span>
              </div>

              {/* Datos del pedido */}
              <div style={{ display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: 12, marginBottom: 14, fontSize: 13 }}>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 2,
                                textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Cliente
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>
                    {p.payload_json?.cliente_nombre || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 2,
                                textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Vendedor
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>
                    {p.payload_json?.vendedor_nombre || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 2,
                                textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Lista / Plazo
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>
                    {p.payload_json?.lista_nombre || '—'} · {p.payload_json?.plazo_nombre || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 2,
                                textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Descuentos
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>{descs}</div>
                </div>
              </div>

              {/* Totales */}
              <div style={{ display: 'flex', gap: 18, padding: '10px 14px',
                            background: '#F8FAFC', borderRadius: 10,
                            marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#64748B', fontSize: 11,
                                textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Total Pares
                  </div>
                  <div style={{ color: AZUL, fontSize: 22, fontWeight: 900 }}>
                    {fmtPares(p.total_pares)}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ color: '#64748B', fontSize: 11,
                                textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Total Neto
                  </div>
                  <div style={{ color: AZUL, fontSize: 22, fontWeight: 900 }}>
                    Gs. {fmtMoney(p.total_monto)}
                  </div>
                </div>
              </div>

              {/* Facturas internas generadas (Regla 1) */}
              {fis.length > 0 ? (
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: '#475569',
                               marginBottom: 8, textTransform: 'uppercase',
                               letterSpacing: 0.8 }}>
                    Facturas Internas ({fis.length}) — 1 por PP × Marca × Caso
                  </h3>
                  <div style={{ display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: 10 }}>
                    {fis.map(fi => {
                      const fiEs = estadoBadge(fi.estado)
                      return (
                        <div key={fi.id} style={{
                          padding: '10px 12px', border: '1px solid #E2E8F0',
                          borderRadius: 8, background: '#FAFBFC', fontSize: 13,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', marginBottom: 4 }}>
                            <strong style={{ color: AZUL, fontSize: 14 }}>
<<<<<<< HEAD
                              {fi.numero_preventa_global || fi.nro_factura}
=======
                              {fmtPV(fi)}
>>>>>>> 3242b5e (feat(rimec-web): PV Global en Mis Facturas y Pedidos)
                            </strong>
                            <span style={{
                              background: fiEs.bg, color: fiEs.fg,
                              padding: '2px 8px', borderRadius: 12,
                              fontSize: 10, fontWeight: 700,
                            }}>
                              {fiEs.label}
                            </span>
                          </div>
                          <div style={{ color: '#64748B', fontSize: 12, marginBottom: 4 }}>
                            PP {fi.pp_id} · {fi.marca || 'Sin marca'}
                            {fi.caso ? ` · ${fi.caso}` : ''}
                          </div>
                          {fi.nro_factura_legacy && fi.nro_factura_legacy !== (fi.numero_preventa_global || fi.nro_factura) && (
                            <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4 }}>
                              Legacy: {fi.nro_factura_legacy}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                            <span><strong>{fmtPares(fi.total_pares)}</strong> pares</span>
                            <span>·</span>
                            <span><strong>Gs. {fmtMoney(fi.total_monto)}</strong></span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: '#64748B',
                                    marginBottom: 6 }}>
                    Ver carrito original ({lotes.length} lote{lotes.length === 1 ? '' : 's'})
                  </summary>
                  <div style={{ marginTop: 8, padding: 10, background: '#F8FAFC',
                                borderRadius: 8, fontSize: 12, color: '#475569' }}>
                    {lotes.map((lt, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        {lt.pp_nro}{lt.proforma ? ` (${lt.proforma})` : ''} ·{' '}
                        {(lt.facturas?.length ?? 0)} factura(s) prevista(s) ·{' '}
                        {fmtPares(lt.total_pares)} pares
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PedidosPage() {
  return (
    <Suspense fallback={
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
        Cargando…
      </div>
    }>
      <PedidosContent />
    </Suspense>
  )
}
