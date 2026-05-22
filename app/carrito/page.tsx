'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSesion, fragmentarCarrito, LISTAS, getPrecioActivo } from '@/store/sesionVenta'
import { supabase } from '@/lib/supabase'

const AZUL = '#1E40AF'

interface PrecioActualRow {
  det_id: number
  lpn:    number | null
  lpc02:  number | null
  lpc03:  number | null
  lpc04:  number | null
  precio_web: number | null
}

export default function CarritoPage() {
  const { cliente, vendedor, plazo, listaPrecioId, descuentos, descuentosPorLote,
          setDescuentoLote, carrito, desactivar, activa,
          setCajas, eliminarItem, eliminarItems } = useSesion()
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [exito,    setExito]    = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  /** det_ids en el carrito que actualmente NO tienen precio en la lista activa. */
  const [huerfanos, setHuerfanos] = useState<number[]>([])
  const [validandoPrecios, setValidandoPrecios] = useState(false)

  // Al abrir el carrito, revalidar precios contra v_stock_rimec con la lista activa.
  // Esto detecta carritos persistidos de días anteriores cuyos SKUs perdieron precio.
  useEffect(() => {
    const detIds = Object.values(carrito).map(it => it.det_id).filter(n => Number.isFinite(n))
    if (!activa || detIds.length === 0) {
      setHuerfanos([])
      return
    }
    let cancelado = false
    setValidandoPrecios(true)
    ;(async () => {
      const { data, error: errPrecio } = await supabase
        .from('v_stock_rimec')
        .select('det_id, lpn, lpc02, lpc03, lpc04, precio_web')
        .in('det_id', detIds)
      if (cancelado) return
      if (errPrecio) {
        console.error('[carrito] error validando precios:', errPrecio.message)
        setHuerfanos([])
        setValidandoPrecios(false)
        return
      }
      const map = new Map<number, PrecioActualRow>()
      for (const r of (data ?? []) as PrecioActualRow[]) map.set(Number(r.det_id), r)
      const sinPrecio: number[] = []
      for (const id of detIds) {
        const row = map.get(id)
        if (!row) { sinPrecio.push(id); continue }
        const p = getPrecioActivo(row, listaPrecioId)
        if (p == null || p <= 0) sinPrecio.push(id)
      }
      setHuerfanos(sinPrecio)
      setValidandoPrecios(false)
    })()
    return () => { cancelado = true }
  }, [activa, listaPrecioId, carrito])

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

  // Cantidad total de facturas internas que se van a generar.
  // Regla 1: una factura por cada combinación (PP × Marca × Caso).
  const totalFacturas = lotes.reduce((s, l) => s + l.cantidad_facturas, 0)

  async function confirmarPedido() {
    setEnviando(true)
    setError(null)
    try {
      const [d1, d2, d3, d4] = [...descuentos, 0, 0, 0, 0]

      // Construir payload con tipos primitivos garantizados (JSON válido).
      // Cada elemento de `facturas` se traduce en UNA factura_interna del backend.
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
        total_pares:  Number(totalGenPares) || 0,
        total_neto:   Number(totalGenMonto) || 0,
        fecha:        new Date().toISOString(),
        lotes:        lotes.map(lote => ({
          pp_id:       Number(lote.pp_id),
          pp_nro:      String(lote.pp_nro || ''),
          quincena:    String(lote.quincena || ''),
          eta:         lote.eta ? String(lote.eta) : null,
          total_pares: Number(lote.total_pares) || 0,
          total_monto: Number(lote.total_monto) || 0,
          // Aplanamos lote.marcas[].facturas[] -> lote.facturas[] enriqueciendo
          // cada factura con su marca de pertenencia (Regla 1: 1 FI por PP×Marca×Caso).
          facturas:    lote.marcas.flatMap(m =>
            m.facturas.map(f => ({
              marca:       String(m.marca || ''),
              marca_id:    m.marca_id,
              caso:        String(f.caso || ''),
              caso_id:     f.caso_id,
              total_pares: Number(f.total_pares) || 0,
              total_monto: Number(f.total_monto) || 0,
              items:       f.items.map(item => ({
                det_id:       Number(item.det_id),
                linea_codigo: String(item.linea_codigo || ''),
                ref_codigo:   String(item.ref_codigo || ''),
                color_nombre: String(item.color_nombre || ''),
                gradas_fmt:   String(item.gradas_fmt || ''),
                imagen_url:   String(item.imagen_url || ''),
                cajas:        Number(item.cajas) || 0,
                pares:        Number(item.pares) || 0,
                precio_base:  Number(item.precio_base) || 0,
                precio_neto:  Number(item.precio_neto) || 0,
                subtotal:     Number(item.subtotal) || 0,
              }))
            }))
          ),
        }))
      }

      // Llamar RPC que ejecuta todo en una transacción atómica:
      // 1. Inserta pedido_venta_rimec
      // 2. Crea factura_interna por cada PP en estado RESERVADA
      // 3. Descuenta stock de mercadería en tránsito
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
      })

      if (rpcErr) {
        throw new Error(rpcErr.message)
      }

      // Verificar respuesta de la función
      const result = data as { 
        success: boolean
        error?: string
        nro_pedido?: string
        facturas?: Array<{ nro_factura: string; pp_id: number; total_pares: number }> 
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Error al procesar el pedido')
      }

      // Éxito: limpiar sesión y mostrar resultado
      const facturasGeneradas = result.facturas?.map(f => f.nro_factura).join(', ') || ''
      const nroPedido = result.nro_pedido || ''
      desactivar()
      setExito(`Pedido ${nroPedido} confirmado. Facturas: ${facturasGeneradas}`)

      // Redirigir destacando el pedido recién creado
      setTimeout(() => {
        router.push(nroPedido ? `/pedidos?destacar=${encodeURIComponent(nroPedido)}` : '/pedidos')
      }, 2500)

    } catch (e: unknown) {
      console.error('Error al confirmar pedido:', e)
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

      {/* Aviso de items huérfanos: SKUs en el carrito que ya no tienen precio en la lista activa. */}
      {huerfanos.length > 0 && !exito && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF3C7', border: '1px solid #FCD34D',
            borderRadius: 12, padding: '14px 18px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap', color: '#78350F',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
              ⚠ {huerfanos.length} {huerfanos.length === 1 ? 'ítem perdió' : 'ítems perdieron'} su precio
            </p>
            <p style={{ fontSize: 12 }}>
              Estos SKUs estaban en tu carrito pero ya no tienen precio en la lista{' '}
              <strong>{listaActiva.nombre}</strong>. Probablemente el listado fue cambiado en Nexus Core.
              No se pueden facturar — quitalos para continuar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => eliminarItems(huerfanos)}
            style={{
              padding: '10px 16px', borderRadius: 10,
              backgroundColor: '#78350F', color: 'white',
              border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
            }}
          >
            Quitar {huerfanos.length} ítem{huerfanos.length === 1 ? '' : 's'} sin precio
          </button>
        </div>
      )}

      {/* Éxito */}
      {exito && (
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12,
                      padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ color: '#166534', fontWeight: 700, fontSize: 16 }}>✅ {exito}</p>
          <p style={{ color: '#166534', fontSize: 14, marginTop: 8 }}>
            Stock descontado. Las facturas están en estado RESERVADA esperando aprobación en el ERP.
          </p>
          <a href="/pedidos" style={{ color: AZUL, fontSize: 14, marginTop: 8, display: 'inline-block' }}>
            → Ver mis pedidos
          </a>
        </div>
      )}

      {/* Error */}
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

            {/* Aviso de Regla 1 si este PP va a generar más de 1 factura */}
            {lote.cantidad_facturas > 1 && (
              <div style={{
                padding: '10px 20px', backgroundColor: '#FEFCE8',
                borderBottom: '1px solid #FDE68A',
                fontSize: 12, color: '#854D0E',
              }}>
                ⚖ <strong>Regla 1 — Factura Interna:</strong> este lote se dividirá en{' '}
                <strong>{lote.cantidad_facturas} facturas internas</strong>{' '}
                (una por cada Marca · una adicional por cada Caso extra dentro de una marca).
              </div>
            )}

            {/* Nivel 2: MARCA */}
            {lote.marcas.map(marca => (
              <div key={`${lote.pp_id}__${marca.marca}`}
                   style={{ borderBottom: '1px solid #F1F5F9' }}>

                {/* Cabecera de la marca */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                              flexWrap: 'wrap', padding: '14px 20px 8px 20px' }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: AZUL, margin: 0 }}>
                    🏷️ {marca.marca}
                  </p>
                  {marca.cantidad_facturas > 1 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 99, backgroundColor: '#FEF3C7', color: '#92400E',
                    }}>
                      {marca.cantidad_facturas} casos · {marca.cantidad_facturas} facturas
                    </span>
                  )}
                  <p style={{ fontSize: 13, color: '#64748B', margin: 0, marginLeft: 'auto' }}>
                    {marca.total_pares.toLocaleString('es-PY')} pares · Gs.{' '}
                    {marca.total_monto.toLocaleString('es-PY')}
                  </p>
                </div>

                {/* Nivel 2.5: facturas dentro de la marca (1 por caso). Sólo se muestra
                    el sub-header de caso si la marca tiene MÁS DE UNO. */}
                {marca.facturas.map((fact, idx) => (
                  <div key={fact.grupo_key}
                       style={{
                         padding: marca.cantidad_facturas > 1 ? '8px 20px 14px 20px'
                                                              : '0 20px 12px 20px',
                         borderLeft: marca.cantidad_facturas > 1 ? `3px solid ${AZUL}` : 'none',
                         backgroundColor: marca.cantidad_facturas > 1 ? '#FAFAFA' : 'transparent',
                         marginLeft: marca.cantidad_facturas > 1 ? 12 : 0,
                       }}>
                    {marca.cantidad_facturas > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                                    marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 7px',
                          borderRadius: 99, backgroundColor: AZUL, color: 'white',
                          letterSpacing: 0.5,
                        }}>
                          FI {idx + 1}/{marca.cantidad_facturas}
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: '2px 10px',
                          borderRadius: 99, backgroundColor: '#E0E7FF', color: '#3730A3',
                        }}>
                          Caso: {fact.caso}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748B', marginLeft: 'auto' }}>
                          {fact.total_pares.toLocaleString('es-PY')} pares · Gs.{' '}
                          {fact.total_monto.toLocaleString('es-PY')}
                        </span>
                      </div>
                    )}
                    {/* Nivel 3: items con foto miniatura */}
                    {fact.items.map(item => (
                  <div key={item.det_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 0', borderTop: '1px solid #F8FAFC', fontSize: 14,
                  }}>
                    {/* Foto miniatura */}
                    {item.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imagen_url}
                        alt={`${item.linea_codigo}-${item.ref_codigo}`}
                        style={{
                          width: 42, height: 42, borderRadius: 8, objectFit: 'contain',
                          backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0',
                          flexShrink: 0,
                        }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div style={{
                        width: 42, height: 42, borderRadius: 8, backgroundColor: '#F1F5F9',
                        flexShrink: 0, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#CBD5E1', fontSize: 18,
                      }}>👟</div>
                    )}

                    <span style={{ color: '#374151', flex: 2 }}>
                      L{item.linea_codigo}·R{item.ref_codigo}
                      <span style={{ color: '#94A3B8', marginLeft: 6 }}>{item.gradas_fmt}</span>
                      {item.color_nombre && (
                        <span style={{
                          display: 'block', fontSize: 11, color: '#64748B',
                          marginTop: 2,
                        }}>{item.color_nombre}</span>
                      )}
                    </span>

                    {/* Editor de cajas con +/-  */}
                    <span style={{ flex: 1, display: 'flex', alignItems: 'center',
                                   gap: 4, color: '#64748B' }}>
                      <button
                        type="button"
                        aria-label="Restar caja"
                        onClick={() => setCajas(item.det_id, item.cajas - 1)}
                        style={{
                          width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1',
                          background: '#F8FAFC', cursor: 'pointer', fontWeight: 700,
                          color: '#475569', fontSize: 16, lineHeight: 1, padding: 0,
                        }}
                      >−</button>
                      <input
                        type="number"
                        min={0}
                        value={item.cajas}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10)
                          setCajas(item.det_id, Number.isFinite(v) ? v : 0)
                        }}
                        aria-label="Cantidad de cajas"
                        style={{
                          width: 48, height: 26, textAlign: 'center', borderRadius: 6,
                          border: '1px solid #CBD5E1', fontSize: 14, color: '#1E293B',
                          fontWeight: 600, padding: 0,
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Sumar caja"
                        onClick={() => setCajas(item.det_id, item.cajas + 1)}
                        style={{
                          width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1',
                          background: '#F8FAFC', cursor: 'pointer', fontWeight: 700,
                          color: '#475569', fontSize: 16, lineHeight: 1, padding: 0,
                        }}
                      >+</button>
                      <span style={{ marginLeft: 4, fontSize: 12 }}>caj · {item.pares} p</span>
                    </span>

                    <span style={{ color: '#64748B', flex: 1 }}>
                      Base: {item.precio_base.toLocaleString('es-PY')}
                    </span>
                    <span style={{ color: AZUL, fontWeight: 700, flex: 1 }}>
                      Neto: {item.precio_neto.toLocaleString('es-PY')}
                    </span>
                    <span style={{ color: '#1E293B', fontWeight: 700, flex: 1, textAlign: 'right' }}>
                      Gs. {item.subtotal.toLocaleString('es-PY')}
                    </span>

                    {/* Basurero — eliminar item del carrito */}
                    <button
                      type="button"
                      aria-label="Eliminar item del carrito"
                      title={`Eliminar L${item.linea_codigo}·R${item.ref_codigo}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('[carrito] eliminarItem click', { det_id: item.det_id, linea: item.linea_codigo, ref: item.ref_codigo })
                        if (item.det_id == null || Number.isNaN(Number(item.det_id))) {
                          console.error('[carrito] det_id inválido, no se elimina:', item)
                          window.alert('det_id inválido — abrí la consola y avisame.')
                          return
                        }
                        eliminarItem(Number(item.det_id))
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid #FCA5A5',
                        cursor: 'pointer',
                        fontSize: 16, lineHeight: 1, padding: '6px 10px',
                        borderRadius: 8, color: '#DC2626',
                        marginLeft: 8,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#FEE2E2'
                        e.currentTarget.style.borderColor = '#DC2626'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = '#FCA5A5'
                      }}
                    >🗑️ Quitar</button>
                  </div>
                ))}
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
        <button
          onClick={confirmarPedido}
          disabled={enviando || huerfanos.length > 0 || validandoPrecios}
          title={
            huerfanos.length > 0
              ? `Tenés ${huerfanos.length} ítem(s) sin precio. Quitalos antes de confirmar.`
              : validandoPrecios
                ? 'Validando precios contra el catálogo...'
                : 'Confirmar pedido'
          }
          style={{
            width: '100%', padding: '18px 0', borderRadius: 14,
            backgroundColor: enviando || huerfanos.length > 0 || validandoPrecios ? '#94A3B8' : AZUL,
            color: 'white',
            fontWeight: 900, fontSize: 19, border: 'none',
            cursor: enviando || huerfanos.length > 0 || validandoPrecios ? 'not-allowed' : 'pointer',
          }}>
          {enviando
            ? 'Procesando...'
            : validandoPrecios
              ? 'Validando precios...'
              : huerfanos.length > 0
                ? `Resolvé ${huerfanos.length} ítem(s) sin precio`
                : 'CONFIRMAR PEDIDO →'}
        </button>
        <a href="/" style={{ display: 'block', textAlign: 'center', marginTop: 14,
                              color: '#64748B', fontSize: 14 }}>← Seguir agregando</a>
      </div>
    </div>
  )
}