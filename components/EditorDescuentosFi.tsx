'use client'

import { useEffect, useState } from 'react'
import { LISTAS } from '@/store/sesionVenta'
import type { FacturaConfig } from '@/lib/carritoApi'
import { descuentoInputDisplay, parseDescuentoInput, sanitizeDescuentoTyping } from '@/lib/descuentoInput'
import { etiquetaDescuentos, normalizarDescuentos4 } from '@/lib/carritoDescuentosFi'

const AZUL = '#1E40AF'

export interface EditorDescuentosFiProps {
  abierto: boolean
  factura: FacturaConfig
  ppId: number
  esPeLote: boolean
  guardando: boolean
  onGuardar: (payload: { lista_precio_id: number; descuentos: number[] }) => Promise<void>
  onCancelar: () => void
}

export function EditorDescuentosFi({
  abierto,
  factura,
  ppId,
  esPeLote,
  guardando,
  onGuardar,
  onCancelar,
}: EditorDescuentosFiProps) {
  const [listaId, setListaId] = useState(factura.lista_precio_id)
  const [slots, setSlots] = useState(['', '', '', ''])

  useEffect(() => {
    if (!abierto) return
    setListaId(factura.lista_precio_id)
    setSlots(normalizarDescuentos4(factura.descuentos).map((d) => descuentoInputDisplay(d)))
  }, [abierto, factura])

  useEffect(() => {
    if (!abierto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [abierto])

  if (!abierto) return null

  async function guardar() {
    const descuentos = slots.map((s) => parseDescuentoInput(s))
    await onGuardar({ lista_precio_id: listaId, descuentos })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-desc-fi-titulo"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !guardando) onCancelar()
      }}
    >
      <div style={{
        backgroundColor: 'white', borderRadius: 16, padding: '24px 28px',
        width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        <p id="editor-desc-fi-titulo" style={{ fontSize: 11, fontWeight: 800, color: '#64748B', letterSpacing: 1, marginBottom: 4 }}>
          FACTURA INTERNA · {esPeLote ? 'PRONTA ENTREGA' : 'TRÁNSITO PP'}
        </p>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: AZUL, marginBottom: 4 }}>
          {factura.marca} · {factura.caso}
        </h3>
        <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
          PP {ppId} · {factura.items_count} ítems · Editá y presioná <strong>Guardar descuento</strong> para fijar en BD.
        </p>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
          Lista de precios
          <select
            value={listaId}
            disabled={guardando}
            onChange={(e) => setListaId(Number(e.target.value))}
            style={{
              display: 'block', width: '100%', marginTop: 4, padding: '10px 12px',
              borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 600,
            }}
          >
            {LISTAS.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </label>

        <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '16px 0 8px' }}>
          Descuentos cascada (%)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <label key={i} style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>
              D{i + 1}
              <input
                type="text"
                inputMode="decimal"
                placeholder=""
                disabled={guardando}
                value={slots[i]}
                onChange={(e) => {
                  const next = [...slots]
                  next[i] = sanitizeDescuentoTyping(e.target.value)
                  setSlots(next)
                }}
                style={{
                  display: 'block', width: '100%', marginTop: 4, padding: '10px 6px',
                  borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 15, fontWeight: 700,
                  textAlign: 'center',
                }}
              />
            </label>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#334155', marginTop: 12, padding: '8px 10px', backgroundColor: '#F1F5F9', borderRadius: 8 }}>
          Vista previa: {etiquetaDescuentos(slots.map(parseDescuentoInput))}
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            disabled={guardando}
            onClick={onCancelar}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, border: '2px solid #E2E8F0',
              background: 'white', color: '#64748B', fontWeight: 700, fontSize: 14,
              cursor: guardando ? 'wait' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            style={{
              flex: 2, padding: '12px 0', borderRadius: 10, border: 'none',
              background: guardando ? '#94A3B8' : AZUL, color: 'white',
              fontWeight: 800, fontSize: 15, cursor: guardando ? 'wait' : 'pointer',
            }}
          >
            {guardando ? 'Guardando…' : 'Guardar descuento'}
          </button>
        </div>
      </div>
    </div>
  )
}
