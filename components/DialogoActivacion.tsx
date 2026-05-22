'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion, LISTAS, type Cliente, type Plazo, type ListaId } from '@/store/sesionVenta'

const AZUL = '#1E40AF'

interface DialogoProps {
  open: boolean
  onClose: () => void
}

export function DialogoActivacion({ open, onClose }: DialogoProps) {
  const { activa, activar } = useSesion()
  const [paso, setPaso] = useState<'A' | 'B'>('A')

  // Paso A — Cliente
  const [buscar,    setBuscar]    = useState('')
  const [cargando,  setCargando]  = useState(false)
  const [clientes,  setClientes]  = useState<Cliente[]>([])
  const [selCliente, setSelCliente] = useState<Cliente | null>(null)

  // Paso B — Plazo + Lista + Descuentos
  const [plazos,    setPlazos]    = useState<Plazo[]>([])
  const [cargPlazos, setCargPlazos] = useState(false)
  const [selPlazo,  setSelPlazo]  = useState<Plazo | null>(null)
  const [listaId,   setListaId]   = useState<ListaId>(1)
  const [descs, setDescs] = useState<[string, string, string, string]>(['', '', '', ''])

  if (!open || activa) return null

  async function buscarClientes() {
    if (!buscar.trim()) return
    setCargando(true)
    const termino = buscar.trim()
    const esNum   = /^\d+$/.test(termino)
    const q = supabase.from('cliente_v2').select('id_cliente, descp_cliente, email').eq('tipo', 'MAYORISTA')
    const { data } = await (esNum
      ? q.eq('id_cliente', parseInt(termino))
      : q.ilike('descp_cliente', `%${termino}%`).limit(10))
    setClientes((data ?? []) as Cliente[])
    setCargando(false)
  }

  async function irPasoB() {
    if (!selCliente) return
    setPaso('B')
    if (plazos.length > 0) return
    setCargPlazos(true)
    const { data } = await supabase
      .from('plazo_v2').select('id_plazo, descp_plazo').order('id_plazo')
    setPlazos((data ?? []) as Plazo[])
    setCargPlazos(false)
  }

  async function confirmar() {
    if (!selCliente || !selPlazo) return
    const descuentos = descs.map(d => parseFloat(d)).filter(d => !isNaN(d) && d > 0)

    // Resolver vendedor desde sesión Auth actual
    let vendedor = null
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const { user } = await res.json()
        if (user && user.id_usuario) {
          vendedor = {
            id_vendedor: user.id_usuario,
            descp_vendedor: user.name
          }
        }
      }
    } catch (err) {
      console.error('Error al resolver vendedor:', err)
    }


    activar(selCliente, vendedor as never, selPlazo, listaId, descuentos)
    onClose()
  }

  const descNums = descs.map(d => parseFloat(d)).filter(d => !isNaN(d) && d > 0)
  let preview = 100000
  for (const d of descNums) preview = preview * (1 - d / 100)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: 20, padding: 36,
        width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 32, marginBottom: 6 }}>🛒</p>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: AZUL, marginBottom: 4 }}>
            Iniciar sesión de venta
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            {[1, 2].map(n => (
              <div key={n} style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                backgroundColor: (paso === 'A' ? n === 1 : n === 2) ? AZUL : '#DBEAFE',
                color: (paso === 'A' ? n === 1 : n === 2) ? 'white' : AZUL,
              }}>{n}</div>
            ))}
          </div>
        </div>

        {/* ── PASO A — Cliente ── */}
        {paso === 'A' && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 8 }}>Cliente</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input
                value={buscar} onChange={e => setBuscar(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarClientes()}
                placeholder="Nombre o código del cliente..."
                style={{ flex: 1, padding: '12px 14px', borderRadius: 10,
                  border: '2px solid #E2E8F0', fontSize: 16, outline: 'none', color: '#1E293B' }}
              />
              <button onClick={buscarClientes}
                style={{ padding: '12px 18px', borderRadius: 10, backgroundColor: AZUL,
                  color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}>
                {cargando ? '...' : 'Buscar'}
              </button>
            </div>

            {clientes.length > 0 && (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden',
                            maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
                {clientes.map(c => (
                  <button key={c.id_cliente} onClick={() => setSelCliente(c)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '11px 16px', border: 'none', cursor: 'pointer',
                      backgroundColor: selCliente?.id_cliente === c.id_cliente ? '#EFF6FF' : 'white',
                      borderBottom: '1px solid #F1F5F9',
                      color: selCliente?.id_cliente === c.id_cliente ? AZUL : '#1E293B',
                      fontWeight: selCliente?.id_cliente === c.id_cliente ? 700 : 400, fontSize: 14,
                    }}>
                    {c.descp_cliente}
                    <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 8 }}>#{c.id_cliente}</span>
                  </button>
                ))}
              </div>
            )}

            {selCliente && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#F0FDF4',
                            border: '1px solid #86EFAC', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>✓ {selCliente.descp_cliente}</p>
              </div>
            )}

            <button onClick={irPasoB} disabled={!selCliente}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 12,
                backgroundColor: selCliente ? AZUL : '#E2E8F0',
                color: selCliente ? 'white' : '#94A3B8',
                fontWeight: 700, fontSize: 17, border: 'none',
                cursor: selCliente ? 'pointer' : 'not-allowed',
              }}>
              Siguiente →
            </button>
          </div>
        )}

        {/* ── PASO B — Plazo + Lista + Descuentos ── */}
        {paso === 'B' && (
          <div>
            <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: 10,
                          border: '1px solid #E2E8F0', marginBottom: 20, fontSize: 14 }}>
              <span style={{ color: '#64748B' }}>Cliente: </span>
              <strong style={{ color: AZUL }}>{selCliente?.descp_cliente}</strong>
            </div>

            <p style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 8 }}>Plazo de pago</p>
            {cargPlazos ? (
              <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 16 }}>Cargando...</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {plazos.map(p => (
                  <button key={p.id_plazo} onClick={() => setSelPlazo(p)}
                    style={{
                      padding: '8px 16px', borderRadius: 99, fontSize: 14, fontWeight: 600,
                      border: `2px solid ${selPlazo?.id_plazo === p.id_plazo ? AZUL : '#E2E8F0'}`,
                      backgroundColor: selPlazo?.id_plazo === p.id_plazo ? '#EFF6FF' : 'white',
                      color: selPlazo?.id_plazo === p.id_plazo ? AZUL : '#374151',
                      cursor: 'pointer',
                    }}>{p.descp_plazo}</button>
                ))}
              </div>
            )}

            <p style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 8 }}>Lista de precios</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {LISTAS.map(l => (
                <button key={l.id} onClick={() => setListaId(l.id as ListaId)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    border: `2px solid ${listaId === l.id ? AZUL : '#E2E8F0'}`,
                    backgroundColor: listaId === l.id ? AZUL : 'white',
                    color: listaId === l.id ? 'white' : '#374151',
                    cursor: 'pointer',
                  }}>{l.nombre}</button>
              ))}
            </div>

            <p style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 8 }}>
              Descuentos <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 13 }}>(opcional)</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              {descs.map((d, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>D{i + 1}</p>
                  <input
                    value={d}
                    onChange={e => {
                      const next = [...descs] as typeof descs
                      next[i] = e.target.value
                      setDescs(next)
                    }}
                    placeholder="0%" type="number" min={0} max={100}
                    style={{
                      width: '100%', padding: '10px 6px', borderRadius: 8, textAlign: 'center',
                      border: `2px solid ${d ? AZUL : '#E2E8F0'}`,
                      fontSize: 15, fontWeight: d ? 700 : 400, color: d ? AZUL : '#94A3B8',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>

            {descNums.length > 0 && (
              <div style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: '9px 14px',
                            marginBottom: 18, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>Neto (ej. 100.000 →)</span>
                <span style={{ fontWeight: 900, fontSize: 15, color: AZUL }}>
                  {Math.round(preview).toLocaleString('es-PY')}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPaso('A')}
                style={{ flex: 1, padding: '14px 0', borderRadius: 12,
                  border: '2px solid #E2E8F0', backgroundColor: 'white',
                  color: '#64748B', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                ← Volver
              </button>
              <button onClick={confirmar} disabled={!selPlazo}
                style={{
                  flex: 2, padding: '14px 0', borderRadius: 12,
                  backgroundColor: selPlazo ? AZUL : '#E2E8F0',
                  color: selPlazo ? 'white' : '#94A3B8',
                  fontWeight: 700, fontSize: 17, border: 'none',
                  cursor: selPlazo ? 'pointer' : 'not-allowed',
                }}>
                Ver catálogo →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
