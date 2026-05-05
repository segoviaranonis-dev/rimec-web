'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSesion, fragmentarCarrito, LISTAS, type ListaId } from '@/store/sesionVenta'
import { supabase } from '@/lib/supabase'

const AZUL = '#1E40AF'

export default function CarritoPage() {
  const { cliente, vendedor, plazo, listaPrecioId, descuentos, descuentosPorLote,
          setDescuentoLote, carrito, vaciarCarrito, desactivar, activa } = useSesion()
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [exito,    setExito]    = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  if (!activa || Object.keys(carrito).length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>🛒</p>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: AZUL, marginBottom: 8 }}>Carrito vacío</h1>
        <p style={{ color: '#64748B', marginBottom: 24 }}>
          {!activa ? 'Iniciá sesión para agregar productos.' : 'Agregá productos desde el catálogo.'}
        </p>
        <a href="/" style={{
          display: 'inline-block', padding: '14px 28px', borderRadius: 12,
          backgroundColor: AZUL, color: 'white', fontWeight: 700, textDecoration: 'none', fontSize: 16,
        }}>← Ir al Catálogo</a>
      </div>
    )
  }

  const lotes         = fragmentarCarrito(carrito, descuentos, descuentosPorLote)
  const listaActiva = LISTAS.find(l => l.id === listaPrecioId) ?? LISTAS[0]
  const totalGenPares = lotes.reduce((s, l) => s + l.total_pares, 0)
  const totalGenMonto = lotes.reduce((s, l) => s + l.total_monto, 0)
  const subtotalBruto = Object.values(carrito).reduce((s, i) => s + i.precio_base * i.pares, 0)
  const descLabel     = descuentos.length > 0 ? descuentos.map(d => `${d}%`).join(' + ') : 'Sin descuento'

  async function confirmarPedido() {
    setEnviando(true)
    setError(null)
    try {
      const [d1, d2, d3, d4] = [...descuentos, 0, 0, 0, 0]
      const anio = new Date().getFullYear()
      const nroPedido = `PVR-${anio}-${String(Date.now()).slice(-6)}`

      const payload = {
        cliente_id:      cliente!.id_cliente,
        cliente_nombre:  cliente!.descp_cliente,
        vendedor_id:     vendedor?.id_vendedor    ?? null,
        vendedor_nombre: vendedor?.descp_vendedor ?? '—',
        plazo_id:        plazo!.id_plazo,
        plazo_nombre:    plazo!.descp_plazo,
        lista_precio_id: listaPrecioId,
        lista_nombre:    listaActiva.nombre,
        descuento_1: d1, descuento_2: d2, descuento_3: d3, descuento_4: d4,
        total_pares:  totalGenPares,
        total_neto:   totalGenMonto,
        fecha:        new Date().toISOString(),
        lotes,
      }

      const { error: sbErr } = await supabase
        .from('pedido_venta_rimec')
        .insert({
          nro_pedido:      nroPedido,
          cliente_id:      cliente!.id_cliente,
          vendedor_id:     vendedor?.id_vendedor    ?? null,
          plazo_id:        plazo!.id_plazo,
          lista_precio_id: listaPrecioId,
          descuento_1: d1, descuento_2: d2, descuento_3: d3, descuento_4: d4,
          total_pares:     totalGenPares,
          total_monto:     totalGenMonto,
          estado:          'PENDIENTE',
          payload_json:    payload,
        })
      if (sbErr) throw new Error(sbErr.message)

      // Limpiar sesión y redirigir para nuevo cliente
      desactivar()
      setExito(`Pedido ${nroPedido} enviado. Preparando para nuevo cliente...`)
      setTimeout(() => router.push('/'), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar')
    }
    setEnviando(false)
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* Cabecera del pedido */}
      <div style={{
        backgroundColor: '#EFF6FF', border: `2px solid ${AZUL}`,
        borderRadius: 16, padding: '20px 24px', marginBottom: 28,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: AZUL, marginBottom: 6 }}>
          Revisión del Pedido
        </h1>
        <p style={{ fontSize: 16, color: '#1E293B', marginBottom: 4 }}>
          <strong>Cliente:</strong> {cliente?.descp_cliente}
          &nbsp;·&nbsp;<strong>Lista:</strong> {listaActiva.nombre}
          &nbsp;·&nbsp;<strong>Descuentos:</strong> {descLabel}
        </p>
        <p style={{ fontSize: 14, color: '#64748B' }}>
          <strong>Vendedor:</strong> {vendedor?.descp_vendedor ?? '—'}
          &nbsp;·&nbsp;<strong>Plazo:</strong> {plazo?.descp_plazo ?? '—'}
        </p>
      </div>

      {/* Éxito / Error */}
      {exito && (
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12,
                      padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ color: '#166534', fontWeight: 700, fontSize: 16 }}>✅ {exito}</p>
          <a href="/" style={{ color: AZUL, fontSize: 14 }}>← Volver al catálogo</a>
        </div>
      )}
      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
                      padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ color: '#991B1B', fontWeight: 700 }}>❌ {error}</p>
        </div>
      )}

      {/* Lotes */}
      {lotes.map(lote => {
        const descLote = descuentosPorLote[lote.pp_id] ?? []
        return (
          <div key={lote.pp_id} style={{
            border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 20, overflow: 'hidden',
          }}>
            {/* Header lote */}
            <div style={{ backgroundColor: '#F8FAFC', padding: '16px 20px',
                          borderBottom: '1px solid #E2E8F0', display: 'flex',
                          alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontWeight: 900, fontSize: 17, color: '#1E293B' }}>
                  📦 {lote.quincena}
                </p>
                <p style={{ fontSize: 13, color: '#64748B' }}>
                  {lote.pp_nro} · {lote.total_pares.toLocaleString('es-PY')} pares
                  &nbsp;·&nbsp;Gs. {lote.total_monto.toLocaleString('es-PY')}
                </p>
              </div>
              {/* Descuento especial del lote */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>Desc. lote:</span>
                {descLote.map((d, i) => (
                  <span key={i} style={{ fontSize: 13, fontWeight: 700, color: AZUL,
                    padding: '3px 10px', backgroundColor: '#DBEAFE', borderRadius: 99 }}>{d}%</span>
                ))}
                {descLote.length < 2 && (
                  <input
                    placeholder="%" type="number" min={0} max={99}
                    style={{ width: 56, padding: '4px 8px', borderRadius: 8,
                      border: '1px solid #E2E8F0', fontSize: 13, textAlign: 'center' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = parseFloat((e.target as HTMLInputElement).value)
                        if (!isNaN(val) && val > 0)
                          setDescuentoLote(lote.pp_id, [...descLote, val]);
                        (e.target as HTMLInputElement).value = ''
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Marcas */}
            {lote.marcas.map(marca => (
              <div key={marca.marca} style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: AZUL, marginBottom: 10 }}>
                  {marca.marca} — {marca.total_pares.toLocaleString('es-PY')} pares
                  &nbsp;·&nbsp;Gs. {marca.total_monto.toLocaleString('es-PY')}
                </p>
                {marca.items.map(item => (
                  <div key={item.det_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 0', borderTop: '1px solid #F8FAFC', fontSize: 14,
                  }}>
                    <span style={{ color: '#374151', flex: 2 }}>
                      L{item.linea_codigo}·R{item.ref_codigo}
                      <span style={{ color: '#94A3B8', marginLeft: 6 }}>{item.gradas_fmt}</span>
                    </span>
                    <span style={{ color: '#64748B', flex: 1 }}>{item.cajas} caj · {item.pares} p</span>
                    <span style={{ color: '#64748B', flex: 1 }}>
                      Base: {item.precio_base.toLocaleString('es-PY')}
                    </span>
                    <span style={{ color: AZUL, fontWeight: 700, flex: 1 }}>
                      Neto: {item.precio_neto.toLocaleString('es-PY')}
                    </span>
                    <span style={{ color: '#1E293B', fontWeight: 700, flex: 1, textAlign: 'right' }}>
                      Gs. {item.subtotal.toLocaleString('es-PY')}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      })}

      {/* Total general + confirmación */}
      <div style={{
        border: `2px solid ${AZUL}`, borderRadius: 16, padding: '24px',
        backgroundColor: '#EFF6FF',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, marginBottom: 8 }}>
          <span style={{ color: '#64748B' }}>Total pares</span>
          <span style={{ fontWeight: 900, color: '#1E293B' }}>{totalGenPares.toLocaleString('es-PY')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, marginBottom: 24 }}>
          <span style={{ color: '#64748B' }}>Monto total</span>
          <span style={{ fontWeight: 900, color: AZUL }}>Gs. {totalGenMonto.toLocaleString('es-PY')}</span>
        </div>
        <button onClick={confirmarPedido} disabled={enviando}
          style={{
            width: '100%', padding: '18px 0', borderRadius: 14,
            backgroundColor: enviando ? '#94A3B8' : AZUL, color: 'white',
            fontWeight: 900, fontSize: 19, border: 'none',
            cursor: enviando ? 'not-allowed' : 'pointer',
          }}>
          {enviando ? 'Enviando...' : 'CONFIRMAR PEDIDO →'}
        </button>
        <a href="/" style={{ display: 'block', textAlign: 'center', marginTop: 14,
                              color: '#64748B', fontSize: 14 }}>← Seguir agregando</a>
      </div>
    </div>
  )
}
