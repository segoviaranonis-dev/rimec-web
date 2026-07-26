'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LISTAS, useSesion, esSesionDeOtroDia } from '@/store/sesionVenta'

const AZUL = '#0F172A'

type Props = {
  /** Compacto: ocupa la franja de cabecera (cero espacio muerto). */
  compact?: boolean
  /** Acciones a la derecha (Limpiar · Extender · conteos). */
  trailing?: ReactNode
}

/**
 * Barra «Venta a cliente» — vive en la cabecera del catálogo (no debajo, no hueco vacío).
 */
export function HeaderSesionVenta({ compact = false, trailing }: Props) {
  const activa = useSesion((s) => s.activa)
  const cliente = useSesion((s) => s.cliente)
  const vendedorDesc = useSesion((s) => s.vendedor?.descp_vendedor)
  const plazoDesc = useSesion((s) => s.plazo?.descp_plazo)
  const listaPrecioId = useSesion((s) => s.listaPrecioId)
  const activatedAt = useSesion((s) => s.activatedAt)
  const desactivar = useSesion((s) => s.desactivar)
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!activa) return null

  const clienteNombre = cliente?.descp_cliente || 'Cliente no asignado'
  const listaNombre = LISTAS.find((l) => l.id === listaPrecioId)?.nombre ?? '—'
  const sesionVieja = mounted && esSesionDeOtroDia(activatedAt)
  const fechaActiv = activatedAt ? new Date(activatedAt) : null
  const fechaActivStr = fechaActiv
    ? fechaActiv.toLocaleString('es-PY', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const pad = compact ? '8px 12px' : '14px 20px'
  const avatar = compact ? 32 : 42
  const gap = compact ? 10 : 14

  return (
    <div className={compact ? 'mb-0' : 'mb-4'}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: pad,
          backgroundColor: AZUL,
          color: 'white',
          borderRadius: sesionVieja ? '12px 12px 0 0' : 12,
          boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
          gap: 10,
          flexWrap: 'wrap',
          minHeight: compact ? 44 : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: avatar,
              height: avatar,
              borderRadius: '50%',
              backgroundColor: 'white',
              color: AZUL,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: compact ? 13 : 16,
              flexShrink: 0,
            }}
          >
            {clienteNombre.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 9,
                color: '#93C5FD',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontWeight: 700,
                marginBottom: 0,
                lineHeight: 1.2,
              }}
            >
              Venta a cliente
            </p>
            <p
              style={{
                fontSize: compact ? 13 : 15,
                fontWeight: 800,
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {clienteNombre}
              <span style={{ fontWeight: 600, fontSize: compact ? 11 : 12, color: '#93C5FD', marginLeft: 8 }}>
                · {listaNombre}
                {plazoDesc ? ` · ${plazoDesc}` : ''}
                {vendedorDesc ? ` · ${vendedorDesc}` : ''}
              </span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {trailing}
          <button
            type="button"
            onClick={() => router.refresh()}
            title="Volver a consultar precios y stock al servidor"
            style={{
              padding: compact ? '5px 10px' : '8px 14px',
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.16)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.22)',
              cursor: 'pointer',
              fontSize: compact ? 11 : 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            🔄 Revalidar
          </button>
          <button
            type="button"
            onClick={() => {
              void desactivar()
            }}
            title="Cerrar la sesión de venta (sigue logueado como vendedor)"
            style={{
              padding: compact ? '5px 10px' : '8px 16px',
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.12)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.18)',
              cursor: 'pointer',
              fontSize: compact ? 11 : 13,
              fontWeight: 600,
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: compact ? '8px 12px' : '12px 20px',
            backgroundColor: '#FEF3C7',
            color: '#78350F',
            border: '1px solid #FCD34D',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            fontSize: 12,
          }}
        >
          <p style={{ fontWeight: 700, margin: 0 }}>
            Sesión del {fechaActivStr} — precios pueden haber cambiado. Refrescá o iniciá venta nueva.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => router.refresh()}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                backgroundColor: '#78350F',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Refrescar
            </button>
            <button
              type="button"
              onClick={() => {
                void desactivar()
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                backgroundColor: 'transparent',
                color: '#78350F',
                border: '1px solid #B45309',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Venta nueva
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
