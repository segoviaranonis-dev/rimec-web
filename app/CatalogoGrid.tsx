'use client'

import { useState } from 'react'
import type { StockRow } from './page'
import { useSesion, getPrecioActivo, LISTAS, type ListaId } from '@/store/sesionVenta'
import { DialogoActivacion } from '@/components/DialogoActivacion'
import { getImageUrl } from '@/lib/imagen'
import { formatearQuincena } from '@/lib/fecha'

interface Props {
  rows:   StockRow[]
  marcas: string[]
  pps:    { nro: string; eta: string | null }[]
}

const AZUL = '#1E40AF'

function formatGrades(grades: Record<string, number> | null): string {
  if (!grades) return '—'
  const sorted = Object.entries(grades)
    .map(([k, v]) => ({ t: k, q: v }))
    .filter(e => e.q > 0)
    .sort((a, b) => (parseFloat(a.t) || 0) - (parseFloat(b.t) || 0))
  if (!sorted.length) return '—'
  return `${sorted[0].t}(${sorted.map(e => e.q).join('-')})${sorted[sorted.length - 1].t}`
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
      style={active
        ? { backgroundColor: AZUL, color: 'white' }
        : { backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
    >{children}</button>
  )
}

/* ── Header de sesión activa ── */
function HeaderSesion() {
  const { cliente, vendedor, plazo, listaPrecioId, descuentos, setLista, desactivar, activa } = useSesion()

  if (!activa) return null

  const listaActiva = LISTAS.find(l => l.id === listaPrecioId)
  const descLabel = descuentos.length > 0 ? descuentos.map(d => `${d}%`).join(' + ') : null

  return (
    <div style={{
      backgroundColor: '#EFF6FF', border: `2px solid ${AZUL}`,
      borderRadius: 14, padding: '14px 20px', marginBottom: 24,
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16,
    }}>
      {/* Cliente + Vendedor */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 2 }}>Cliente</p>
        <p style={{ fontWeight: 900, fontSize: 17, color: AZUL }}>{cliente?.descp_cliente}</p>
        {vendedor && (
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            Vendedor: <strong style={{ color: '#1E293B' }}>{vendedor.descp_vendedor}</strong>
            {plazo && <> · Plazo: <strong style={{ color: '#1E293B' }}>{plazo.descp_plazo}</strong></>}
          </p>
        )}
      </div>

      {/* Selector de lista — nombres comerciales */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#64748B', marginRight: 4 }}>Lista:</span>
        {LISTAS.map(l => (
          <button key={l.id} onClick={() => setLista(l.id as ListaId)}
            style={{
              padding: '6px 12px', borderRadius: 8,
              backgroundColor: listaPrecioId === l.id ? AZUL : 'white',
              color: listaPrecioId === l.id ? 'white' : '#64748B',
              border: `1px solid ${listaPrecioId === l.id ? AZUL : '#E2E8F0'}`,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{l.nombre}</button>
        ))}
      </div>

      {/* Descuentos (solo lectura — se fijaron en el diálogo) */}
      {descLabel && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748B' }}>Desc:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: AZUL,
            padding: '4px 12px', backgroundColor: '#DBEAFE', borderRadius: 99 }}>
            {descLabel}
          </span>
        </div>
      )}

      <button onClick={desactivar}
        style={{ fontSize: 13, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
        Cerrar sesión
      </button>
    </div>
  )
}

/* ── Tarjeta de producto ── */
function TarjetaProducto({ row, onNeedSession }: { row: StockRow; onNeedSession: () => void }) {
  const { activa, listaPrecioId, agregarCaja, quitarCaja, carrito } = useSesion()
  const key    = `det_${row.det_id}`
  const cajas  = carrito[key]?.cajas ?? 0
  const precio = activa ? getPrecioActivo(row, listaPrecioId) : null

  const esTransito  = !!row.eta
  const colorMarco  = esTransito ? '#F59E0B' : '#10B981'
  const labelOrigen = esTransito ? 'En camino' : 'En depósito'
  const bgBadge     = esTransito ? '#FFFBEB' : '#F0FDF4'
  const textBadge   = esTransito ? '#92400E' : '#166534'
  const gradas      = formatGrades(row.grades_json)
  const imgUrl      = getImageUrl(row.linea_codigo, row.referencia_codigo, row.material_code, row.color_code)
  const maxCajas    = row.cajas_disponibles

  function handleAgregar() {
    if (!activa) { onNeedSession(); return }
    if (precio === null || precio <= 0) return
    if (cajas >= maxCajas) return
    agregarCaja({
      det_id:             row.det_id,
      linea_codigo:       row.linea_codigo,
      referencia_codigo:  row.referencia_codigo,
      material_code:      row.material_code,
      color_code:         row.color_code,
      color_nombre:       row.color_nombre,
      pp_id:              row.pp_id,
      pp_nro:             row.pp_nro,
      eta:                row.eta,
      marca:              row.marca,
      nombre:             row.nombre,
      gradas_fmt:         gradas,
      imagen_url:         imgUrl,
      lista_precio_id:    listaPrecioId,
      precio_base:        precio,
      cant_caja:          row.pares_por_caja,
    })
  }

  const tienePrecio    = precio !== null && precio > 0
  const puedeAgregar   = activa && tienePrecio && cajas < maxCajas
  const botonPlusColor = puedeAgregar ? AZUL : '#E2E8F0'
  const botonPlusTxt   = puedeAgregar ? 'white' : '#CBD5E1'

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: 16, border: `3px solid ${colorMarco}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
      width: '100%', maxWidth: 280,
    }}>
      {/* Imagen */}
      <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 10,
                    overflow: 'hidden', backgroundColor: '#F8FAFC' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgUrl} alt={`${row.marca} ${row.referencia_codigo}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.currentTarget.src = '/placeholder-zapato.svg' }} />
        <span style={{
          position: 'absolute', top: 8, right: 8, backgroundColor: bgBadge,
          color: textBadge, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
        }}>{labelOrigen}</span>
      </div>

      {/* Info */}
      <div>
        <p style={{ fontWeight: 900, fontSize: 18, color: AZUL, marginBottom: 2 }}>{row.marca}</p>
        <p style={{ fontSize: 15, color: '#374151', marginBottom: 2 }}>
          Línea {row.linea_codigo} · Ref. {row.referencia_codigo}
        </p>
        <p style={{ fontSize: 13, color: '#64748B' }}>
          {row.material_descripcion} · {row.color_nombre}
        </p>
      </div>

      {/* ETA */}
      <div style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Llegada estimada
        </p>
        <p style={{ fontWeight: 700, color: AZUL, fontSize: 15, marginTop: 2 }}>
          {formatearQuincena(row.eta)}
        </p>
      </div>

      {/* Gradas */}
      <p style={{ fontSize: 13, color: '#475569', backgroundColor: '#F8FAFC',
                  padding: '6px 10px', borderRadius: 8, fontFamily: 'monospace' }}>
        📦 {gradas}
      </p>

      {/* Precio — solo si sesión activa */}
      {!activa ? (
        <div style={{ padding: '10px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>
            🔒 Iniciá sesión para ver el precio
          </p>
        </div>
      ) : tienePrecio ? (
        <p style={{ fontSize: 18, fontWeight: 900, color: AZUL }}>
          Gs. {precio!.toLocaleString('es-PY')}
          <span style={{ fontSize: 13, fontWeight: 400, color: '#64748B' }}> / par</span>
        </p>
      ) : (
        <p style={{ fontSize: 13, color: '#F59E0B', fontWeight: 600 }}>
          ⚠ Sin precio en lista {LISTAS.find(l => l.id === listaPrecioId)?.nombre}
        </p>
      )}

      {/* Control de cajas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* − */}
          <button
            onClick={() => { if (!activa) { onNeedSession(); return }; quitarCaja(row.det_id) }}
            disabled={!activa || cajas === 0}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              border: `2px solid ${activa && cajas > 0 ? AZUL : '#E2E8F0'}`,
              backgroundColor: 'white', color: activa && cajas > 0 ? AZUL : '#CBD5E1',
              fontSize: 28, fontWeight: 700, cursor: activa && cajas > 0 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>−</button>

          {/* Display */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: activa && tienePrecio ? AZUL : '#CBD5E1', lineHeight: 1 }}>{cajas}</p>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
              {cajas === 0 ? 'cajas' : `= ${cajas * row.pares_por_caja} pares`}
            </p>
          </div>

          {/* + */}
          <button
            onClick={handleAgregar}
            disabled={!puedeAgregar}
            title={!activa ? 'Iniciá sesión' : !tienePrecio ? 'Sin precio en esta lista' : cajas >= maxCajas ? 'Máximo alcanzado' : ''}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              border: `2px solid ${botonPlusColor}`,
              backgroundColor: botonPlusColor,
              color: botonPlusTxt,
              fontSize: 28, fontWeight: 700, cursor: puedeAgregar ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
        </div>

        <p style={{ fontSize: 12, textAlign: 'center', color: '#94A3B8' }}>
          {row.pares_por_caja} pares por caja · máx. {maxCajas} cajas
        </p>

        {cajas > 0 && (
          <a href="/carrito" style={{
            display: 'block', width: '100%', padding: '14px 0', borderRadius: 12,
            backgroundColor: '#10B981', color: 'white', textAlign: 'center',
            fontWeight: 700, fontSize: 16, cursor: 'pointer', border: 'none',
            textDecoration: 'none',
          }}>
            En pedido ✓ — Ver carrito
          </a>
        )}
      </div>
    </div>
  )
}

/* ── Grid principal ── */
export function CatalogoGrid({ rows, marcas, pps }: Props) {
  const { activa, carrito } = useSesion()
  const [marcaFiltro,    setMarcaFiltro]    = useState('')
  const [ppFiltro,       setPpFiltro]       = useState('')
  const [buscar,         setBuscar]         = useState('')
  const [mostrarDialogo, setMostrarDialogo] = useState(false)

  const filtered = rows.filter(r => {
    if (marcaFiltro && r.marca !== marcaFiltro) return false
    if (ppFiltro    && r.pp_nro !== ppFiltro)   return false
    if (buscar) {
      const q = buscar.toLowerCase()
      if (![r.marca, r.linea_codigo, r.referencia_codigo, r.nombre, r.material_descripcion, r.color_nombre]
            .some(f => f?.toLowerCase().includes(q))) return false
    }
    return true
  })

  const cartItems  = Object.values(carrito)
  const totalCajas = cartItems.reduce((s, i) => s + i.cajas, 0)
  const totalPares = cartItems.reduce((s, i) => s + i.pares, 0)
  const cartCount  = cartItems.length

  return (
    <>
      <DialogoActivacion open={mostrarDialogo} onClose={() => setMostrarDialogo(false)} />

      <HeaderSesion />

      {/* Filtros */}
      <div style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, marginBottom: 28,
                    border: '1px solid #E2E8F0' }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por marca, línea, referencia, color..."
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            border: '2px solid #E2E8F0', fontSize: 16, color: '#1E293B',
            backgroundColor: 'white', marginBottom: 14, boxSizing: 'border-box', outline: 'none',
          }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <Pill active={!marcaFiltro} onClick={() => setMarcaFiltro('')}>Todas las marcas</Pill>
          {marcas.map(m => (
            <Pill key={m} active={marcaFiltro === m} onClick={() => setMarcaFiltro(marcaFiltro === m ? '' : m)}>
              {m}
            </Pill>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Pill active={!ppFiltro} onClick={() => setPpFiltro('')}>Todos los lotes</Pill>
          {pps.map(p => (
            <Pill key={p.nro} active={ppFiltro === p.nro} onClick={() => setPpFiltro(ppFiltro === p.nro ? '' : p.nro)}>
              {p.nro}{p.eta ? ` · ${formatearQuincena(p.eta)}` : ''}
            </Pill>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 14, color: '#64748B', marginBottom: 20 }}>
        Mostrando <strong style={{ color: AZUL }}>{filtered.length}</strong> referencias
        {!activa && (
          <span style={{ marginLeft: 12, color: '#F59E0B', fontWeight: 600 }}>
            🔒 Los precios se muestran al iniciar sesión
          </span>
        )}
      </p>

      {/* Carrito flotante */}
      {!activa && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}>
          <button onClick={() => setMostrarDialogo(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '16px 28px', borderRadius: 16,
            backgroundColor: AZUL, color: 'white',
            fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 28px rgba(30,64,175,0.45)',
          }}>
            🛒 Iniciar sesión
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

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>📦</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#94A3B8' }}>Sin resultados</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 280px))', gap: 20 }}>
          {filtered.map(row => (
            <TarjetaProducto key={row.det_id} row={row} onNeedSession={() => setMostrarDialogo(true)} />
          ))}
        </div>
      )}
    </>
  )
}
