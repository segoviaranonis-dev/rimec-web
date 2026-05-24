'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSesion, fragmentarCarrito, LISTAS } from '@/store/sesionVenta'
import { supabase } from '@/lib/supabase'
import { carritoValidar, type ValidarItemResult } from '@/lib/carritoApi'

const AZUL = '#1E40AF'
const VERDE = '#10B981'
const AMARILLO = '#F59E0B'
const ROJO = '#DC2626'

const VENTANA_VALIDACION_S = 60

export default function CarritoPage() {
  const cliente             = useSesion(s => s.cliente)
  const vendedor            = useSesion(s => s.vendedor)
  const plazo               = useSesion(s => s.plazo)
  const listaPrecioId       = useSesion(s => s.listaPrecioId)
  const descuentos          = useSesion(s => s.descuentos)
  const descuentosPorLote   = useSesion(s => s.descuentosPorLote)
  const setDescuentoLote    = useSesion(s => s.setDescuentoLote)
  const facturas            = useSesion(s => s.facturas)
  const todasPreAutorizadas = useSesion(s => s.todasPreAutorizadas)
  const actualizarDescuentosFactura = useSesion(s => s.actualizarDescuentosFactura)
  const recalcularFactura   = useSesion(s => s.recalcularFactura)
  const carrito             = useSesion(s => s.carrito)
  const desactivar          = useSesion(s => s.desactivar)
  const activa              = useSesion(s => s.activa)
  const setCajas            = useSesion(s => s.setCajas)
  const eliminarItem        = useSesion(s => s.eliminarItem)
  const eliminarItems       = useSesion(s => s.eliminarItems)
  const validacion          = useSesion(s => s.validacion)
  const setValidacion       = useSesion(s => s.setValidacion)
  const limpiarValidacion   = useSesion(s => s.limpiarValidacion)

  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [validando, setValidando] = useState(false)
  const [exito, setExito] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recalculando, setRecalculando] = useState<string | null>(null) // "ppId:marca:caso"
  const [recalculoExito, setRecalculoExito] = useState<string | null>(null)

  // Countdown del token (60 s desde validacion.expiraEn).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (validacion.estado !== 'OK' || !validacion.expiraEn) return
    const intervalo = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(intervalo)
  }, [validacion.estado, validacion.expiraEn])

  const segundosRestantes = useMemo(() => {
    if (validacion.estado !== 'OK' || !validacion.expiraEn) return 0
    const restante = Math.max(0, new Date(validacion.expiraEn).getTime() - now)
    return Math.ceil(restante / 1000)
  }, [validacion.estado, validacion.expiraEn, now])

  useEffect(() => {
    if (validacion.estado === 'OK' && segundosRestantes <= 0) {
      limpiarValidacion()
    }
  }, [segundosRestantes, validacion.estado, limpiarValidacion])

  // Cualquier mutación del carrito limpia el token (lo hace el store).
  // Si el usuario cierra venta sin confirmar, volver al catálogo.
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
  const listaActiva   = LISTAS.find(l => l.id === listaPrecioId) ?? LISTAS[0]
  const totalGenPares = lotes.reduce((s, l) => s + l.total_pares, 0)
  const totalGenMonto = lotes.reduce((s, l) => s + l.total_monto, 0)
  const descLabel     = descuentos.length > 0 ? descuentos.map(d => `${d}%`).join(' + ') : 'Sin descuento'
  const totalFacturas = lotes.reduce((s, l) => s + l.cantidad_facturas, 0)

  const itemsConProblema: ValidarItemResult[] =
    validacion.estado === 'DIFERENCIAS'
      ? (validacion.items
          .filter((i) => !i.ok)
          .map((i) => ({
            det_id: i.det_id,
            cajas_solicitadas: carrito[`det_${i.det_id}`]?.cajas ?? 0,
            cajas_actuales: i.cajas_actuales,
            precio_carrito: carrito[`det_${i.det_id}`]?.precio_base ?? 0,
            precio_actual: i.precio_actual,
            ok: false,
            motivo: (i.motivo as ValidarItemResult['motivo']) ?? null,
          })))
      : []

  const detIdsSinPrecio = itemsConProblema
    .filter((i) => i.motivo === 'SIN_PRECIO')
    .map((i) => i.det_id)

  async function validar() {
    setValidando(true)
    setError(null)
    try {
      const data = await carritoValidar()
      if (!data.success) {
        setValidacion({
          estado: 'ERROR',
          token: null,
          expiraEn: null,
          items: [],
        })
        setError(data.detail ?? 'No se pudo validar el carrito.')
        return
      }
      setValidacion({
        estado: data.estado === 'OK' ? 'OK' : 'DIFERENCIAS',
        token: data.token ?? null,
        expiraEn: data.expira_en ?? null,
        items: (data.items ?? []).map((i) => ({
          det_id: i.det_id,
          ok: i.ok,
          motivo: i.motivo,
          cajas_actuales: i.cajas_actuales,
          precio_actual: i.precio_actual,
        })),
      })
    } catch (e) {
      setValidacion({ estado: 'ERROR', token: null, expiraEn: null, items: [] })
      setError(e instanceof Error ? e.message : 'Error al validar')
    } finally {
      setValidando(false)
    }
  }

  async function confirmarPedido() {
    setEnviando(true)
    setError(null)
    try {
      const [d1, d2, d3, d4] = [...descuentos, 0, 0, 0, 0]
      const payload = {
        cliente_id:      cliente!.id_cliente,
        cliente_nombre:  String(cliente!.descp_cliente || ''),
        vendedor_id:     vendedor?.id_vendedor ?? null,
        vendedor_nombre: String(vendedor?.descp_vendedor || '—'),
        plazo_id:        plazo!.id_plazo,
        plazo_nombre:    String(plazo!.descp_plazo || ''),
        lista_precio_id: listaPrecioId,
        lista_nombre:    String(listaActiva.nombre || ''),
        descuento_1: Number(d1) || 0,
        descuento_2: Number(d2) || 0,
        descuento_3: Number(d3) || 0,
        descuento_4: Number(d4) || 0,
        total_pares: Number(totalGenPares) || 0,
        total_neto:  Number(totalGenMonto) || 0,
        fecha:       new Date().toISOString(),
        lotes: lotes.map((lote) => ({
          pp_id:  Number(lote.pp_id),
          pp_nro: String(lote.pp_nro || ''),
          quincena: String(lote.quincena || ''),
          eta: lote.eta ? String(lote.eta) : null,
          total_pares: Number(lote.total_pares) || 0,
          total_monto: Number(lote.total_monto) || 0,
          facturas: lote.marcas.flatMap((m) =>
            m.facturas.map((f) => ({
              marca: String(m.marca || ''),
              marca_id: m.marca_id,
              caso: String(f.caso || ''),
              caso_id: f.caso_id,
              total_pares: Number(f.total_pares) || 0,
              total_monto: Number(f.total_monto) || 0,
              items: f.items.map((item) => ({
                det_id: Number(item.det_id),
                linea_codigo: String(item.linea_codigo || ''),
                ref_codigo:   String(item.ref_codigo || ''),
                color_nombre: String(item.color_nombre || ''),
                gradas_fmt:   String(item.gradas_fmt || ''),
                imagen_url:   String(item.imagen_url || ''),
                cajas: Number(item.cajas) || 0,
                pares: Number(item.pares) || 0,
                precio_base: Number(item.precio_base) || 0,
                precio_neto: Number(item.precio_neto) || 0,
                subtotal:    Number(item.subtotal) || 0,
              })),
            })),
          ),
        })),
      }

      const { data, error: rpcErr } = await supabase.rpc('confirmar_pedido_web', {
        p_cliente_id:      cliente!.id_cliente,
        p_vendedor_id:     vendedor?.id_vendedor ?? null,
        p_plazo_id:        plazo!.id_plazo,
        p_lista_precio_id: listaPrecioId,
        p_descuento_1:     Number(d1) || 0,
        p_descuento_2:     Number(d2) || 0,
        p_descuento_3:     Number(d3) || 0,
        p_descuento_4:     Number(d4) || 0,
        p_total_pares:     totalGenPares,
        p_total_monto:     totalGenMonto,
        p_payload:         payload,
        p_validacion_token: validacion.token,
      })

      if (rpcErr) throw new Error(rpcErr.message)

      const result = data as {
        success: boolean
        error?: string
        detail?: string
        nro_pedido?: string
        facturas?: Array<{ nro_factura: string; pp_id: number; total_pares: number }>
      }

      if (!result.success) {
        throw new Error(result.error || result.detail || 'Error al procesar el pedido')
      }

      const facturasGeneradas = result.facturas?.map((f) => f.nro_factura).join(', ') || ''
      const nroPedido = result.nro_pedido || ''
      await desactivar()
      setExito(`Pedido ${nroPedido} confirmado. Facturas: ${facturasGeneradas}`)
      setTimeout(() => {
        router.push(nroPedido ? `/pedidos?destacar=${encodeURIComponent(nroPedido)}` : '/pedidos')
      }, 2500)
    } catch (e) {
      console.error('Error al confirmar pedido:', e)
      setError(e instanceof Error ? e.message : 'Error al confirmar')
    } finally {
      setEnviando(false)
    }
  }

  const sinVendedor = !vendedor?.id_vendedor
  const tokenVigente = validacion.estado === 'OK' && segundosRestantes > 0
  const motivoBloqueoConfirmar =
    enviando ? 'procesando' :
    sinVendedor ? 'sin_vendedor' :
    !todasPreAutorizadas ? 'facturas_sin_preautorizar' :
    validacion.estado === 'ERROR' ? 'error_validacion' :
    validacion.estado === 'DIFERENCIAS' ? 'diferencias' :
    validacion.estado === 'IDLE' ? 'falta_validar' :
    !tokenVigente ? 'token_vencido' :
    null

  const labelConfirmar = (() => {
    switch (motivoBloqueoConfirmar) {
      case 'procesando':         return 'Procesando...'
      case 'sin_vendedor':       return 'Sesión sin vendedor — reactivá la venta'
      case 'facturas_sin_preautorizar': return '⚠️ Verificar descuentos (Ver Totales en cada factura)'
      case 'error_validacion':   return 'Reintentá VALIDAR'
      case 'diferencias':        return `Resolvé ${itemsConProblema.length} ítem(s) y volvé a VALIDAR`
      case 'falta_validar':      return 'Presioná VALIDAR primero'
      case 'token_vencido':      return 'Validación vencida — VALIDÁ de nuevo'
      default:                   return `CONFIRMAR PEDIDO →   (${segundosRestantes}s)`
    }
  })()

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
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
          &nbsp;·&nbsp;<strong>FIs previstas:</strong> {totalFacturas}
        </p>
      </div>

      {sinVendedor && !exito && (
        <div role="alert" style={{
          backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          color: '#7F1D1D',
        }}>
          <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
            ⛔ Sesión de venta sin vendedor asignado
          </p>
          <p style={{ fontSize: 12, marginBottom: 10 }}>
            La sesión no tiene un vendedor identificado. Cerrá la venta y volvé a activarla.
          </p>
          <button type="button" onClick={() => { void desactivar(); router.push('/') }}
            style={{
              padding: '10px 16px', borderRadius: 10, backgroundColor: '#7F1D1D',
              color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            }}>
            Cerrar venta y volver al catálogo
          </button>
        </div>
      )}

      {validacion.estado === 'DIFERENCIAS' && !exito && (
        <div role="alert" style={{
          backgroundColor: '#FEF3C7', border: '1px solid #FCD34D',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20, color: '#78350F',
        }}>
          <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
            ⚠ {itemsConProblema.length} ítem(s) con diferencias en BD
          </p>
          <ul style={{ fontSize: 12, paddingLeft: 18, marginBottom: 10 }}>
            {itemsConProblema.map((i) => {
              const meta = carrito[`det_${i.det_id}`]
              const desc = meta
                ? `L${meta.linea_codigo}·R${meta.referencia_codigo}${meta.color_nombre ? ` · ${meta.color_nombre}` : ''}`
                : `det ${i.det_id}`
              const motivo = i.motivo === 'STOCK_INSUFICIENTE'
                ? `Stock disponible: ${i.cajas_actuales} (pediste ${i.cajas_solicitadas})`
                : i.motivo === 'PRECIO_CAMBIO'
                  ? `Precio cambió: ${i.precio_carrito.toLocaleString('es-PY')} → ${i.precio_actual?.toLocaleString('es-PY') ?? '—'}`
                  : i.motivo === 'SIN_PRECIO'
                    ? 'El SKU perdió el precio en Nexus Core'
                    : 'Diferencia'
              return <li key={i.det_id}><strong>{desc}</strong> — {motivo}</li>
            })}
          </ul>
          {!todasPreAutorizadas && itemsConProblema.some(i => i.motivo === 'PRECIO_CAMBIO') && (
            <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, backgroundColor: '#FEF3C7', padding: '8px 12px', borderRadius: 6, border: '1px solid #F59E0B' }}>
              💡 Para continuar: presioná "⚠️ Ver Totales" en cada factura afectada para actualizar los precios. Luego podrás confirmar el pedido.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={validar} disabled={validando}
              style={{
                padding: '10px 14px', borderRadius: 10, backgroundColor: 'transparent',
                color: '#78350F', border: '1px solid #B45309', cursor: 'pointer',
                fontWeight: 700, fontSize: 12,
              }}>
              Revalidar
            </button>
            {detIdsSinPrecio.length > 0 && (
              <button type="button" onClick={() => void eliminarItems(detIdsSinPrecio)}
                style={{
                  padding: '10px 16px', borderRadius: 10, backgroundColor: '#78350F',
                  color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                }}>
                Quitar {detIdsSinPrecio.length} ítem(s) sin precio
              </button>
            )}
          </div>
        </div>
      )}

      {validacion.estado === 'ERROR' && !exito && (
        <div role="alert" style={{
          backgroundColor: '#FFEDD5', border: '1px solid #FB923C',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20, color: '#7C2D12',
        }}>
          <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
            🔌 No se pudo verificar el carrito
          </p>
          <p style={{ fontSize: 12 }}>
            Reintentá VALIDAR. Si persiste, refrescá la página y volvé a iniciar la venta.
          </p>
        </div>
      )}

      {exito && (
        <div style={{
          backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12,
          padding: '16px 20px', marginBottom: 20,
        }}>
          <p style={{ color: '#166534', fontWeight: 700, fontSize: 16 }}>✅ {exito}</p>
          <p style={{ color: '#166534', fontSize: 14, marginTop: 8 }}>
            Stock descontado. Las facturas están en estado RESERVADA esperando aprobación en el ERP.
          </p>
          <a href="/pedidos" style={{ color: AZUL, fontSize: 14, marginTop: 8, display: 'inline-block' }}>
            → Ver mis pedidos
          </a>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: '16px 20px', marginBottom: 20,
        }}>
          <p style={{ color: '#991B1B', fontWeight: 700 }}>❌ {error}</p>
        </div>
      )}

      {/* Lotes */}
      {lotes.map((lote) => {
        const descLote = descuentosPorLote[lote.pp_id] ?? []
        return (
          <div key={lote.pp_id} style={{ border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{
              backgroundColor: '#F8FAFC', padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <div>
                <p style={{ fontWeight: 900, fontSize: 17, color: '#1E293B' }}>📦 {lote.quincena}</p>
                <p style={{ fontSize: 13, color: '#64748B' }}>
                  {lote.pp_nro} · {lote.total_pares.toLocaleString('es-PY')} pares
                  &nbsp;·&nbsp;Gs. {lote.total_monto.toLocaleString('es-PY')}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>Desc. lote:</span>
                {descLote.map((d, i) => (
                  <span key={i} style={{ fontSize: 13, fontWeight: 700, color: AZUL, padding: '3px 10px', backgroundColor: '#DBEAFE', borderRadius: 99 }}>{d}%</span>
                ))}
                {descLote.length < 2 && (
                  <input
                    placeholder="%" type="number" min={0} max={99}
                    style={{ width: 56, padding: '4px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, textAlign: 'center' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseFloat((e.target as HTMLInputElement).value)
                        if (!isNaN(val) && val > 0) void setDescuentoLote(lote.pp_id, [...descLote, val])
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {lote.cantidad_facturas > 1 && (
              <div style={{ padding: '10px 20px', backgroundColor: '#FEFCE8', borderBottom: '1px solid #FDE68A', fontSize: 12, color: '#854D0E' }}>
                ⚖ <strong>Regla 1 — Factura Interna:</strong> este lote se dividirá en <strong>{lote.cantidad_facturas} facturas internas</strong>.
              </div>
            )}

            {lote.marcas.map((marca) => (
              <div key={`${lote.pp_id}__${marca.marca}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '14px 20px 8px 20px' }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: AZUL, margin: 0 }}>🏷️ {marca.marca}</p>
                  {marca.cantidad_facturas > 1 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, backgroundColor: '#FEF3C7', color: '#92400E' }}>
                      {marca.cantidad_facturas} casos · {marca.cantidad_facturas} facturas
                    </span>
                  )}
                  <p style={{ fontSize: 13, color: '#64748B', margin: 0, marginLeft: 'auto' }}>
                    {marca.total_pares.toLocaleString('es-PY')} pares · Gs. {marca.total_monto.toLocaleString('es-PY')}
                  </p>
                </div>

                {marca.facturas.map((fact, idx) => {
                  const facturaConfig = facturas.find(f =>
                    f.pp_id === lote.pp_id && f.marca === marca.marca && f.caso === fact.caso
                  )
                  return (
                  <div key={fact.grupo_key} style={{
                    padding: marca.cantidad_facturas > 1 ? '8px 20px 14px 20px' : '0 20px 12px 20px',
                    borderLeft: marca.cantidad_facturas > 1 ? `3px solid ${AZUL}` : 'none',
                    backgroundColor: marca.cantidad_facturas > 1 ? '#FAFAFA' : 'transparent',
                    marginLeft: marca.cantidad_facturas > 1 ? 12 : 0,
                  }}>
                    <div style={{ marginBottom: 12 }}>
                      {marca.cantidad_facturas > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99, backgroundColor: AZUL, color: 'white', letterSpacing: 0.5 }}>
                            FI {idx + 1}/{marca.cantidad_facturas}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 99, backgroundColor: '#E0E7FF', color: '#3730A3' }}>
                            Caso: {fact.caso}
                          </span>
                          <span style={{ fontSize: 12, color: '#64748B', marginLeft: 'auto' }}>
                            {fact.total_pares.toLocaleString('es-PY')} pares · Gs. {fact.total_monto.toLocaleString('es-PY')}
                          </span>
                        </div>
                      )}
                      {facturaConfig && (
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px', backgroundColor: facturaConfig.pre_autorizado ? '#F0FDF4' : '#FEF3C7', borderRadius: 8, border: facturaConfig.pre_autorizado ? '1px solid #10B981' : '1px solid #F59E0B' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Lista de precios:</span>
                            <select
                              value={facturaConfig.lista_precio_id}
                              onChange={async (e) => {
                                const newLista = parseInt(e.target.value, 10)
                                await actualizarDescuentosFactura(lote.pp_id, marca.marca, fact.caso, {
                                  lista_precio_id: newLista,
                                  pre_autorizado: false
                                })
                              }}
                              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontWeight: 600, cursor: 'pointer', backgroundColor: 'white' }}
                              title="Seleccionar lista de precios base para esta factura"
                            >
                              {LISTAS.map((lista) => (
                                <option key={lista.id} value={lista.id}>
                                  {lista.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Descuentos (%):</span>
                            {[0, 1, 2, 3].map(i => (
                              <input
                                key={i}
                                type="number"
                                min={0}
                                max={95}
                                step={5}
                                defaultValue={facturaConfig.descuentos[i] || 0}
                                onBlur={async (e) => {
                                  const val = parseInt(e.target.value, 10) || 0
                                  const rounded = Math.round(val / 5) * 5
                                  const final = Math.max(0, Math.min(95, rounded))
                                  e.target.value = String(final)
                                  const newDesc = [...facturaConfig.descuentos]
                                  newDesc[i] = final
                                  await actualizarDescuentosFactura(lote.pp_id, marca.marca, fact.caso, {
                                    descuentos: newDesc,
                                    pre_autorizado: false
                                  })
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur()
                                  }
                                }}
                                style={{ width: 52, padding: '5px 6px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, textAlign: 'center', backgroundColor: 'white' }}
                                title={`Descuento ${i + 1} - Múltiplos de 5 (cascada). Presioná Enter para aplicar.`}
                              />
                            ))}
                          </div>
                          {!facturaConfig.pre_autorizado ? (
                            <button
                              onClick={async () => {
                                const key = `${lote.pp_id}:${marca.marca}:${fact.caso}`
                                setRecalculando(key)
                                setRecalculoExito(null)
                                setError(null)
                                try {
                                  const result = await recalcularFactura(lote.pp_id, marca.marca, fact.caso)
                                  setRecalculoExito(`✓ ${result.items_actualizados} ítems actualizados con ${LISTAS.find(l => l.id === result.lista_aplicada)?.nombre}`)
                                  setTimeout(() => setRecalculoExito(null), 5000)
                                } catch (err) {
                                  setError('Error recalculando precios. Intentá de nuevo.')
                                } finally {
                                  setRecalculando(null)
                                }
                              }}
                              disabled={recalculando === `${lote.pp_id}:${marca.marca}:${fact.caso}`}
                              title="Recalcular precios consultando BD con la lista y descuentos configurados. Requerido antes de confirmar el pedido."
                              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', backgroundColor: recalculando === `${lote.pp_id}:${marca.marca}:${fact.caso}` ? '#9CA3AF' : '#F59E0B', color: 'white', fontSize: 11, fontWeight: 700, cursor: recalculando === `${lote.pp_id}:${marca.marca}:${fact.caso}` ? 'not-allowed' : 'pointer', marginLeft: 'auto', whiteSpace: 'nowrap' }}
                            >
                              {recalculando === `${lote.pp_id}:${marca.marca}:${fact.caso}` ? '⏳ Recalculando...' : '⚠️ Ver Totales'}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: VERDE, marginLeft: 'auto', whiteSpace: 'nowrap' }}>✅ Pre-autorizado</span>
                          )}
                          {recalculoExito && recalculando === null && (
                            <span style={{ fontSize: 10, color: VERDE, fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>{recalculoExito}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {fact.items.map((item) => (
                      <div key={item.det_id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 0', borderTop: '1px solid #F8FAFC', fontSize: 14,
                      }}>
                        {item.imagen_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imagen_url}
                            alt={`${item.linea_codigo}-${item.ref_codigo}`}
                            style={{
                              width: 42, height: 42, borderRadius: 8, objectFit: 'contain',
                              backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', flexShrink: 0,
                            }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <div style={{
                            width: 42, height: 42, borderRadius: 8, backgroundColor: '#F1F5F9',
                            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#CBD5E1', fontSize: 18,
                          }}>👟</div>
                        )}

                        <span style={{ color: '#374151', flex: 2 }}>
                          L{item.linea_codigo}·R{item.ref_codigo}
                          <span style={{ color: '#94A3B8', marginLeft: 6 }}>{item.gradas_fmt}</span>
                          {item.color_nombre && (
                            <span style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 2 }}>{item.color_nombre}</span>
                          )}
                        </span>

                        <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, color: '#64748B' }}>
                          <button type="button" aria-label="Restar caja"
                            onClick={() => void setCajas(item.det_id, item.cajas - 1)}
                            style={{
                              width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1',
                              background: '#F8FAFC', cursor: 'pointer', fontWeight: 700,
                              color: '#475569', fontSize: 16, lineHeight: 1, padding: 0,
                            }}>−</button>
                          <input
                            type="number" min={0} value={item.cajas}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10)
                              void setCajas(item.det_id, Number.isFinite(v) ? v : 0)
                            }}
                            aria-label="Cantidad de cajas"
                            style={{
                              width: 48, height: 26, textAlign: 'center', borderRadius: 6,
                              border: '1px solid #CBD5E1', fontSize: 14, color: '#1E293B',
                              fontWeight: 600, padding: 0,
                            }}
                          />
                          <button type="button" aria-label="Sumar caja"
                            onClick={() => void setCajas(item.det_id, item.cajas + 1)}
                            style={{
                              width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1',
                              background: '#F8FAFC', cursor: 'pointer', fontWeight: 700,
                              color: '#475569', fontSize: 16, lineHeight: 1, padding: 0,
                            }}>+</button>
                          <span style={{ marginLeft: 4, fontSize: 12 }}>caj · {item.pares} p</span>
                        </span>

                        <span style={{ color: '#64748B', flex: 1 }}>Base: {item.precio_base.toLocaleString('es-PY')}</span>
                        <span style={{ color: AZUL, fontWeight: 700, flex: 1 }}>Neto: {item.precio_neto.toLocaleString('es-PY')}</span>
                        <span style={{ color: '#1E293B', fontWeight: 700, flex: 1, textAlign: 'right' }}>
                          Gs. {item.subtotal.toLocaleString('es-PY')}
                        </span>

                        <button type="button" aria-label="Eliminar item del carrito"
                          title={`Eliminar L${item.linea_codigo}·R${item.ref_codigo}`}
                          onClick={(e) => {
                            e.preventDefault(); e.stopPropagation()
                            if (item.det_id == null || Number.isNaN(Number(item.det_id))) return
                            void eliminarItem(Number(item.det_id))
                          }}
                          style={{
                            background: 'transparent', border: '1px solid #FCA5A5',
                            cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '6px 10px',
                            borderRadius: 8, color: '#DC2626', marginLeft: 8,
                          }}>🗑️ Quitar</button>
                      </div>
                    ))}
                  </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}

      {/* Total + Validar + Confirmar */}
      <div style={{ border: `2px solid ${AZUL}`, borderRadius: 16, padding: 24, backgroundColor: '#EFF6FF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, marginBottom: 8 }}>
          <span style={{ color: '#64748B' }}>Total pares</span>
          <span style={{ fontWeight: 900, color: '#1E293B' }}>{totalGenPares.toLocaleString('es-PY')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, marginBottom: 24 }}>
          <span style={{ color: '#64748B' }}>Monto total</span>
          <span style={{ fontWeight: 900, color: AZUL }}>Gs. {totalGenMonto.toLocaleString('es-PY')}</span>
        </div>

        {/* Banner del estado de validación */}
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 14,
          backgroundColor:
            validacion.estado === 'OK' && tokenVigente ? '#ECFDF5' :
            validacion.estado === 'DIFERENCIAS' ? '#FEF3C7' :
            validacion.estado === 'ERROR' ? '#FFEDD5' :
            '#F1F5F9',
          border:
            validacion.estado === 'OK' && tokenVigente ? `1px solid ${VERDE}` :
            validacion.estado === 'DIFERENCIAS' ? `1px solid ${AMARILLO}` :
            validacion.estado === 'ERROR' ? `1px solid #FB923C` :
            '1px solid #CBD5E1',
          color:
            validacion.estado === 'OK' && tokenVigente ? '#065F46' :
            validacion.estado === 'DIFERENCIAS' ? '#78350F' :
            validacion.estado === 'ERROR' ? '#7C2D12' :
            '#475569',
          fontSize: 13,
        }}>
          {validacion.estado === 'OK' && tokenVigente && (
            <>✅ <strong>Carrito validado.</strong> Tenés {segundosRestantes}s para confirmar antes de re-validar.</>
          )}
          {validacion.estado === 'DIFERENCIAS' && (
            <>⚠ <strong>Hay diferencias en stock o precio.</strong> Ajustá los ítems marcados arriba y volvé a validar.</>
          )}
          {validacion.estado === 'ERROR' && (
            <>🔌 <strong>No se pudo validar.</strong> Reintentá; si persiste, refrescá la página.</>
          )}
          {validacion.estado === 'IDLE' && (
            <>🛡 <strong>Validar obligatorio</strong> — el sistema chequea stock y precios contra el PP en BD antes de confirmar.</>
          )}
          {validacion.estado === 'OK' && !tokenVigente && (
            <>⌛ <strong>La validación venció.</strong> Volvé a presionar VALIDAR.</>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <button type="button" onClick={validar} disabled={validando || sinVendedor}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 12,
              backgroundColor: validando || sinVendedor ? '#94A3B8' : VERDE,
              color: 'white', fontWeight: 900, fontSize: 16, border: 'none',
              cursor: validando || sinVendedor ? 'not-allowed' : 'pointer',
            }}>
            {validando ? 'Validando...' : '🛡 VALIDAR'}
          </button>
          <button type="button" onClick={confirmarPedido}
            disabled={motivoBloqueoConfirmar !== null}
            title={motivoBloqueoConfirmar ? labelConfirmar : 'Confirmar pedido'}
            style={{
              flex: 2, padding: '14px 0', borderRadius: 12,
              backgroundColor: motivoBloqueoConfirmar !== null ? '#94A3B8' : AZUL,
              color: 'white', fontWeight: 900, fontSize: 16, border: 'none',
              cursor: motivoBloqueoConfirmar !== null ? 'not-allowed' : 'pointer',
            }}>
            {labelConfirmar}
          </button>
        </div>

        <a href="/" style={{ display: 'block', textAlign: 'center', color: '#64748B', fontSize: 14 }}>
          ← Seguir agregando
        </a>
      </div>
    </div>
  )
}
