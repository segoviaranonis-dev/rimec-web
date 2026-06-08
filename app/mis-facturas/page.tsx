'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const AZUL = '#1E40AF'
const VERDE = '#10B981'

interface Preventa {
  id: number
  pv_global: number
  pp_id: number
  pedido_id: number | null
  marca: string | null
  marca_id: number | null
  caso: string | null
  caso_id: number | null
  total_pares: number
  total_monto: number
  estado: string
  created_at: string
  lista_precio_id: number | null
  plazo_id: number | null
  descuento_1: number | null
  descuento_2: number | null
  descuento_3: number | null
  descuento_4: number | null
  cliente_id: number | null
  vendedor_id: number | null
  cliente_nombre: string
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function fmtPV(pv: Preventa): string {
  return `PV${pv.pv_global.toString().padStart(6, '0')}`
}

export default function MisPreventasPage() {
  const [facturas, setFacturas] = useState<Preventa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true)
        setError(null)

        const res = await fetch('/api/mis-facturas')

        if (res.status === 401) {
          setError('No estás autorizado. Por favor inicia sesión.')
          setCargando(false)
          return
        }

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al cargar preventas')
        }

        const data = await res.json()
        setFacturas(data.facturas || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [])

  if (cargando) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
        Cargando facturas...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', padding: 24 }}>
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: 12,
            padding: 20,
            color: '#7F1D1D',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>⚠️ Error</p>
          <p>{error}</p>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              marginTop: 16,
              padding: '10px 20px',
              backgroundColor: AZUL,
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Ir al Login
          </Link>
        </div>
      </div>
    )
  }

  if (facturas.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>📋</p>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: AZUL,
            marginBottom: 8,
          }}
        >
          Sin facturas confirmadas
        </h1>
        <p style={{ color: '#64748B', marginBottom: 24 }}>
          Cuando el administrador confirme tus facturas, aparecerán aquí.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '14px 28px',
            borderRadius: 12,
            backgroundColor: AZUL,
            color: 'white',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: 16,
          }}
        >
          ← Ir al Catálogo
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: AZUL, marginBottom: 4 }}>
            Mis Preventas Confirmadas
          </h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>
            {facturas.length} {facturas.length === 1 ? 'preventa' : 'preventas'} lista
            {facturas.length === 1 ? '' : 's'} para compartir
          </p>
        </div>
        <Link
          href="/"
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            backgroundColor: AZUL,
            color: 'white',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          ← Catálogo
        </Link>
      </div>

      {/* Lista de facturas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {facturas.map((fi) => {
          const descs = [fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4]
            .filter((d) => (d ?? 0) > 0)
            .map((d) => `${d}%`)
            .join(' + ') || 'Sin descuento'

          return (
            <div
              key={fi.id}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 14,
                padding: 20,
                background: 'white',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Cabecera de factura */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'inline-block',
                      background: '#ECFDF5',
                      color: VERDE,
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                  >
                    ✓ CONFIRMADA
                  </div>
                  <h2
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: AZUL,
                      marginBottom: 4,
                      letterSpacing: 0.5,
                    }}
                  >
                    {fmtPV(fi)}
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748B' }}>
                    {fmtFecha(fi.created_at)}
                  </p>
                </div>

                {/* Botón Ver PDF */}
                <a
                  href={`/api/pdf/factura/${fi.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 18px',
                    backgroundColor: VERDE,
                    color: 'white',
                    borderRadius: 10,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <span>📄</span>
                  <span>Ver PDF</span>
                </a>
              </div>

              {/* Datos de la factura */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                  marginBottom: 14,
                  fontSize: 13,
                }}
              >
                <div>
                  <div
                    style={{
                      color: '#94A3B8',
                      fontSize: 11,
                      marginBottom: 2,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    Cliente
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>
                    {fi.cliente_nombre}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color: '#94A3B8',
                      fontSize: 11,
                      marginBottom: 2,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    Marca / Caso
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>
                    {fi.marca || 'Sin marca'}
                    {fi.caso ? ` · ${fi.caso}` : ''}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color: '#94A3B8',
                      fontSize: 11,
                      marginBottom: 2,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    Descuentos
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>{descs}</div>
                </div>

                <div>
                  <div
                    style={{
                      color: '#94A3B8',
                      fontSize: 11,
                      marginBottom: 2,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    PP
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>#{fi.pp_id}</div>
                </div>
              </div>

              {/* Totales */}
              <div
                style={{
                  display: 'flex',
                  gap: 18,
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  borderRadius: 10,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: '#64748B',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    Total Pares
                  </div>
                  <div style={{ color: AZUL, fontSize: 22, fontWeight: 900 }}>
                    {fmtPares(fi.total_pares)}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div
                    style={{
                      color: '#64748B',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    Total Neto
                  </div>
                  <div style={{ color: AZUL, fontSize: 22, fontWeight: 900 }}>
                    Gs. {fmtMoney(fi.total_monto)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer con instrucciones */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: '#F1F5F9',
          borderRadius: 10,
          fontSize: 13,
          color: '#475569',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 4 }}>💡 Cómo compartir:</p>
        <p>
          1. Hacé clic en <strong>"Ver PDF"</strong> para abrir la factura
          <br />
          2. Usá los botones de tu dispositivo para compartir por WhatsApp, email o descargar
        </p>
      </div>
    </div>
  )
}
