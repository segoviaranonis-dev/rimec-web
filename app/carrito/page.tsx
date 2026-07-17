'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSesion, fragmentarCarrito, LISTAS } from '@/store/sesionVenta'
import { supabase } from '@/lib/supabase'
import { carritoValidar, type FacturaConfig, type ValidarItemResult } from '@/lib/carritoApi'
import { ProductImage } from '@/components/ProductImage'
import { EditorDescuentosFi } from '@/components/EditorDescuentosFi'
import { getImageCandidatesForUi } from '@/lib/imagen'
import { isProntaEntregaStockRow } from '@/lib/prontaEntregaVenta'
import { etiquetaDescuentos, normalizarDescuentos4 } from '@/lib/carritoDescuentosFi'

const AZUL = '#1E40AF'
const VERDE = '#10B981'
const AMARILLO = '#F59E0B'
const ROJO = '#DC2626'

const VENTANA_VALIDACION_S = 60

const RE_STOCK_INSUFICIENTE_RPC = /^Stock insuficiente L(\S+) R(\S+) \(PP: ([^)]+)\)\. Solicitado: (\d+), Disponible: (\d+)\.?$/

function mensajeAmigableError(raw: string): string {
  const m = raw.match(RE_STOCK_INSUFICIENTE_RPC)
  if (!m) return raw
  const [, linea, referencia, , solicitado, disponible] = m
  return `El stock cambió mientras confirmabas: L${linea}·R${referencia} — pediste ${solicitado}, quedan ${disponible} disponibles. Presioná "Revalidar" para actualizar el carrito.`
}

export default function CarritoPage() {
  const cliente             = useSesion(s => s.cliente)
  const vendedor            = useSesion(s => s.vendedor)
  const plazo               = useSesion(s => s.plazo)
  const listaPrecioId       = useSesion(s => s.listaPrecioId)
  const descuentos          = useSesion(s => s.descuentos)
  const facturas            = useSesion(s => s.facturas)
  const guardarDescuentosFactura = useSesion(s => s.guardarDescuentosFactura)
  const carrito             = useSesion(s => s.carrito)
  const desactivar          = useSesion(s => s.desactivar)
  const activa              = useSesion(s => s.activa)
  const setCajas            = useSesion(s => s.setCajas)
  const eliminarItem        = useSesion(s => s.eliminarItem)
  const eliminarItems       = useSesion(s => s.eliminarItems)
  const validacion          = useSesion(s => s.validacion)
  const setValidacion       = useSesion(s => s.setValidacion)
  const limpiarValidacion   = useSesion(s => s.limpiarValidacion)
  const cargarDesdeBD       = useSesion(s => s.cargarDesdeBD)
  const hydrating           = useSesion(s => s.hydrating)
  const hydrated            = useSesion(s => s.hydrated)

  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const confirmLock = useRef(false)
  const [validando, setValidando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editorFi, setEditorFi] = useState<FacturaConfig | null>(null)
  const [guardandoDesc, setGuardandoDesc] = useState(false)

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

  const descLabel = useMemo(() => {
    const nFi = facturas.filter((f) => normalizarDescuentos4(f.descuentos).some((d) => d > 0)).length
    if (nFi > 0) return `${nFi} FI con descuento`
    if (descuentos.length > 0) return descuentos.map((d) => `${d}%`).join(' + ')
    return 'Sin descuento global · editar por FI'
  }, [facturas, descuentos])

  useEffect(() => {
    if (!hydrated && !hydrating) void cargarDesdeBD()
  }, [hydrated, hydrating, cargarDesdeBD])

  if (hydrating || (!hydrated && vendedor?.id_vendedor)) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748B' }}>
        <p style={{ fontSize: 18, fontWeight: 600 }}>Cargando carrito…</p>
      </div>
    )
  }

  // Cualquier mutación del carrito limpia el token (lo hace el store).
  // Si el usuario cierra venta sin confirmar, volver al catálogo.
  if (!activa || Object.keys(carrito).length === 0) {
    const logueado = Boolean(vendedor?.id_vendedor)
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>🛒</p>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: AZUL, marginBottom: 8 }}>Carrito vacío</h1>
        <p style={{ color: '#64748B', marginBottom: 24 }}>
          {!activa && !logueado
            ? 'Iniciá sesión para agregar productos.'
            : !activa
              ? 'Iniciá una venta con cliente desde el catálogo.'
              : 'Agregá productos desde el catálogo.'}
        </p>
        <a href="/" style={{
          display: 'inline-block', padding: '14px 28px', borderRadius: 12,
          backgroundColor: AZUL, color: 'white', fontWeight: 700, textDecoration: 'none', fontSize: 16,
        }}>← Ir al Catálogo</a>
      </div>
    )
  }

  const lotes         = fragmentarCarrito(carrito, descuentos, {}, facturas)
  const listaActiva   = LISTAS.find(l => l.id === listaPrecioId) ?? LISTAS[0]
  const totalGenPares = lotes.reduce((s, l) => s + l.total_pares, 0)
  const totalGenMonto = lotes.reduce((s, l) => s + l.total_monto, 0)
  const totalFacturas = lotes.reduce((s, l) => s + l.cantidad_facturas, 0)
  const carritoItems  = Object.values(carrito)
  const totalRefs     = carritoItems.length
  const totalCajas    = carritoItems.reduce((s, i) => s + i.cajas, 0)
  const totalParesCarrito = carritoItems.reduce((s, i) => s + i.pares, 0)

  const itemsConProblema: ValidarItemResult[] =
    validacion.estado === 'DIFERENCIAS'
      ? (validacion.items
          .filter((i) => !i.ok)
          .map((i) => ({
            det_id: i.det_id,
            cajas_solicitadas: i.cajas_solicitadas ?? carrito[`det_${i.det_id}`]?.cajas ?? 0,
            cajas_actuales: i.cajas_actuales ?? 0,
            pares_solicitados: i.pares_solicitados,
            pares_actuales: i.pares_actuales,
            precio_carrito: carrito[`det_${i.det_id}`]?.precio_base ?? 0,
            precio_actual: i.precio_actual,
            ok: false,
            motivo: (i.motivo as ValidarItemResult['motivo']) ?? null,
          })))
      : []

  const detIdsSinPrecio = itemsConProblema
    .filter((i) => i.motivo === 'SIN_PRECIO')
    .map((i) => i.det_id)

  const detIdsSinStock = itemsConProblema
    .filter((i) =>
      i.motivo === 'ITEM_OBSOLETO' ||
      (i.motivo === 'STOCK_INSUFICIENTE' && (i.cajas_actuales ?? 0) <= 0),
    )
    .map((i) => i.det_id)

  const hayCambioPrecio = itemsConProblema.some(
    (i) =>
      i.motivo === 'PRECIO_CAMBIO' ||
      (i.precio_actual != null &&
        i.precio_carrito > 0 &&
        i.precio_carrito !== i.precio_actual),
  )

  function textoMotivoValidacion(item: ValidarItemResult): string {
    if (item.motivo === 'ITEM_OBSOLETO') {
      return 'Debés eliminar este artículo por falta de stock — ya no está disponible en depósito.'
    }
    if (item.motivo === 'STOCK_INSUFICIENTE' && (item.cajas_actuales ?? 0) <= 0) {
      return 'Debés eliminar este artículo por falta de stock — saldo agotado tras la última carga.'
    }
    if (item.motivo === 'STOCK_INSUFICIENTE') {
      const cs = item.cajas_solicitadas ?? 0
      const ca = item.cajas_actuales ?? 0
      const ps = item.pares_solicitados
      const pa = item.pares_actuales
      if (cs <= ca && ps != null && pa != null && ps > pa) {
        return `Stock insuficiente en pares: hay ${pa} pares (${ca} cj) y pediste ${ps} pares (${cs} cj). Reducí o quitá el ítem.`
      }
      return `Stock insuficiente: hay ${ca} caja(s) y pediste ${cs}. Reducí cantidad o eliminá el ítem.`
    }
    if (item.motivo === 'PRECIO_CAMBIO') {
      return (
        `Precio cambió: ${item.precio_carrito.toLocaleString('es-PY')} → ${item.precio_actual?.toLocaleString('es-PY') ?? '—'}. ` +
        'Presioná Revalidar (se sincroniza solo). Si persiste: (1) Editar descuentos de la FI → Guardar → VALIDAR, o (2) Quitar el ítem y volver a agregarlo desde el catálogo.'
      )
    }
    if (item.motivo === 'SIN_PRECIO') {
      return 'El SKU perdió el precio en Nexus Core — eliminá el ítem para continuar.'
    }
    return 'Diferencia detectada — revalidá o ajustá el carrito.'
  }

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
          cajas_solicitadas: i.cajas_solicitadas,
          pares_actuales: i.pares_actuales,
          pares_solicitados: i.pares_solicitados,
          precio_actual: i.precio_actual,
        })),
      })
      if (data.estado === 'OK') {
        await cargarDesdeBD()
        const recalc = (data as { items_recalculados?: number }).items_recalculados ?? 0
        if (recalc > 0) {
          setError(null)
          setAviso(`Precios actualizados (${recalc} ítem(s)). Podés confirmar el pedido.`)
        }
      } else if ((data as { items_recalculados?: number }).items_recalculados) {
        await cargarDesdeBD()
      }
    } catch (e) {
      setValidacion({ estado: 'ERROR', token: null, expiraEn: null, items: [] })
      setError(e instanceof Error ? e.message : 'Error al validar')
    } finally {
      setValidando(false)
    }
  }

  async function confirmarPedido() {
    if (confirmLock.current || enviando) return
    if (totalGenPares > 0 && totalGenMonto <= 0) {
      setError(
        'Montos en 0 con pares en carrito — revalidá o recargá la página. No se puede confirmar a Gs. 0.',
      )
      return
    }
    confirmLock.current = true
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
          proforma: String(lote.proforma || ''),
          quincena: String(lote.quincena || ''),
          origen_pe: lote.pp_id < 0,
          total_pares: Number(lote.total_pares) || 0,
          total_monto: Number(lote.total_monto) || 0,
          facturas: lote.marcas.flatMap((m) =>
            m.facturas.map((f) => {
              // Buscar configuración de descuentos específicos para esta factura
              const facturaConfig = facturas.find(
                fc => fc.pp_id === lote.pp_id && fc.marca === m.marca && fc.caso === f.caso
              )
              const descFactura = normalizarDescuentos4(facturaConfig?.descuentos ?? descuentos)
              const listaFactura = facturaConfig?.lista_precio_id ?? listaPrecioId

              return {
                marca: String(m.marca || ''),
                marca_id: m.marca_id,
                caso: String(f.caso || ''),
                caso_id: f.caso_id,
                lista_precio_id: listaFactura,
                descuento_1: descFactura[0],
                descuento_2: descFactura[1],
                descuento_3: descFactura[2],
                descuento_4: descFactura[3],
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
              }
            }),
          ),
        })),
      }

      // SECURITY: Ejecutar confirmación desde servidor, no desde cliente
      const response = await fetch('/api/carrito/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Error al confirmar pedido')
      }

      const data = await response.json()

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
      const rawMsg = e instanceof Error ? e.message : 'Error al confirmar'
      const esStockCambiado = RE_STOCK_INSUFICIENTE_RPC.test(rawMsg)
      setExito(null)
      setAviso(null)
      // Stock insuficiente al confirmar es un resultado de negocio esperado (el RPC
      // revalida atómicamente y puede rechazar si el stock bajó desde la validación),
      // no un bug — usar warn para no disparar el overlay rojo de Next dev en cada venta.
      if (esStockCambiado) {
        console.warn('Confirmar pedido: stock cambió desde la validación:', rawMsg)
      } else {
        console.error('Error al confirmar pedido:', e)
      }
      setError(mensajeAmigableError(rawMsg))
      if (esStockCambiado) {
        limpiarValidacion()
        void validar()
      }
    } finally {
      confirmLock.current = false
      setEnviando(false)
    }
  }

  const sinVendedor = !vendedor?.id_vendedor
  const tokenVigente = validacion.estado === 'OK' && segundosRestantes > 0
  const motivoBloqueoConfirmar =
    editorFi ? 'editando_descuentos' :
    enviando ? 'procesando' :
    sinVendedor ? 'sin_vendedor' :
    validacion.estado === 'ERROR' ? 'error_validacion' :
    validacion.estado === 'DIFERENCIAS' ? 'diferencias' :
    validacion.estado === 'IDLE' ? 'falta_validar' :
    !tokenVigente ? 'token_vencido' :
    null

  const labelConfirmar = (() => {
    switch (motivoBloqueoConfirmar) {
      case 'editando_descuentos':  return 'Guardá o cancelá descuentos primero'
      case 'procesando':         return 'Procesando...'
      case 'sin_vendedor':       return 'Sesión sin vendedor — reactivá la venta'
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
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginBottom: 12, padding: '8px 14px', borderRadius: 10,
          backgroundColor: '#1E293B', color: 'white', fontSize: 14, fontWeight: 800,
        }}>
          <span aria-hidden>🛒</span>
          <span>
            {totalRefs.toLocaleString('es-PY')} ref · {totalCajas.toLocaleString('es-PY')} cajas ·{' '}
            {totalParesCarrito.toLocaleString('es-PY')} pares
          </span>
        </div>
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
            ⚠ {itemsConProblema.length} ítem(s) requieren acción antes de confirmar
          </p>
          <p style={{ fontSize: 12, marginBottom: 8 }}>
            Tras importar stock real, usá <strong>VALIDAR</strong> para re-coordinar el carrito con la BD.
          </p>
          <ul style={{ fontSize: 12, paddingLeft: 18, marginBottom: 10 }}>
            {itemsConProblema.map((i) => {
              const meta = carrito[`det_${i.det_id}`]
              const desc = meta
                ? `L${meta.linea_codigo}·R${meta.referencia_codigo}${meta.color_nombre ? ` · ${meta.color_nombre}` : ''}`
                : `det ${i.det_id}`
              return (
                <li key={i.det_id}>
                  <strong>{desc}</strong> — {textoMotivoValidacion(i)}
                </li>
              )
            })}
          </ul>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, backgroundColor: '#E0F2FE', padding: '8px 12px', borderRadius: 6, border: '1px solid #0EA5E9' }}>
            💡 {hayCambioPrecio
              ? <>Los precios se recalcularán al presionar <strong>VALIDAR</strong> o <strong>Revalidar</strong>. Si no desbloquea: (1) <strong>Editar descuentos</strong> de la factura interna → Guardar → VALIDAR, o (2) <strong>Quitar</strong> el ítem y volver a agregarlo desde el catálogo.</>
              : <>Tras importar stock real, usá <strong>VALIDAR</strong> para re-coordinar precios y saldos con la BD.</>}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={validar} disabled={validando}
              style={{
                padding: '10px 14px', borderRadius: 10, backgroundColor: 'transparent',
                color: '#78350F', border: '1px solid #B45309', cursor: 'pointer',
                fontWeight: 700, fontSize: 12,
              }}>
              Revalidar
            </button>
            {detIdsSinStock.length > 0 && (
              <button type="button" onClick={() => void eliminarItems(detIdsSinStock)}
                style={{
                  padding: '10px 16px', borderRadius: 10, backgroundColor: ROJO,
                  color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                }}>
                Quitar {detIdsSinStock.length} ítem(s) sin stock
              </button>
            )}
            {detIdsSinPrecio.length > 0 && (
              <button type="button" onClick={() => void eliminarItems(detIdsSinPrecio)}
                style={{
                  padding: '10px 16px', borderRadius: 10, backgroundColor: '#78350F',
                  color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                }}>
                Quitar {detIdsSinPrecio.length} ítem(s) sin precio
              </button>
            )}
            <button type="button" onClick={() => { void desactivar(); router.push('/') }}
              style={{
                padding: '10px 14px', borderRadius: 10, backgroundColor: 'transparent',
                color: '#64748B', border: '1px solid #94A3B8', cursor: 'pointer',
                fontWeight: 700, fontSize: 12,
              }}>
              Cerrar venta
            </button>
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

      {aviso && !exito && (
        <div style={{
          backgroundColor: '#ECFDF5', border: '1px solid #86EFAC', borderRadius: 12,
          padding: '14px 18px', marginBottom: 20,
        }}>
          <p style={{ color: '#166534', fontWeight: 700, fontSize: 14 }}>✅ {aviso}</p>
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
      {lotes.map((lote) => (
          <div key={`${lote.pp_id}-${lote.pp_nro}`} style={{ border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 20, overflow: 'hidden', ...(lote.pp_id < 0 ? { borderColor: '#10B981', borderWidth: 2 } : {}) }}>
            <div style={{
              backgroundColor: '#F8FAFC', padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <div>
                <p style={{ fontWeight: 900, fontSize: 17, color: '#1E293B' }}>
                  {lote.pp_id < 0 ? '🟢 Pronta entrega · ' : '📦 '}{lote.quincena}
                </p>
                <p style={{ fontSize: 13, color: '#64748B' }}>
                  {lote.pp_nro} ({lote.proforma}) · {lote.total_pares.toLocaleString('es-PY')} pares
                  &nbsp;·&nbsp;Gs. {lote.total_monto.toLocaleString('es-PY')}
                </p>
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
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 12, color: '#64748B' }}>
                            <strong>Lista:</strong> {LISTAS.find(l => l.id === facturaConfig.lista_precio_id)?.nombre ?? 'LPN'}
                            &nbsp;·&nbsp;<strong>Desc.:</strong> {etiquetaDescuentos(facturaConfig.descuentos)}
                          </span>
                          <button
                            type="button"
                            disabled={guardandoDesc || !!editorFi}
                            onClick={() => setEditorFi(facturaConfig)}
                            style={{
                              marginLeft: 'auto', padding: '7px 14px', borderRadius: 8,
                              border: `2px solid ${AZUL}`, backgroundColor: 'white', color: AZUL,
                              fontWeight: 800, fontSize: 12, cursor: 'pointer',
                            }}
                          >
                            Editar descuentos
                          </button>
                        </div>
                      )}
                    </div>

                    {fact.items.map((item) => {
                      const esPeItem = isProntaEntregaStockRow({
                        det_id: item.det_id,
                        pp_id: lote.pp_id,
                      })
                      const unidadCorta = esPeItem ? 'ud' : 'caj'
                      const unidadAria = esPeItem ? 'unidades' : 'cajas'
                      return (
                      <div key={item.det_id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 0', borderTop: '1px solid #F8FAFC', fontSize: 14,
                      }}>
                        <div
                          style={{ width: 42, height: 42, flexShrink: 0, position: 'relative' }}
                          className="overflow-hidden rounded-lg border border-[#E2E8F0]"
                        >
                          <ProductImage
                            linea={item.linea_codigo}
                            referencia={item.ref_codigo}
                            material={item.material_code ?? ''}
                            color={item.color_code ?? ''}
                            imagenNombre={item.imagen_url}
                            candidates={getImageCandidatesForUi(
                              item.linea_codigo,
                              item.ref_codigo,
                              item.material_code ?? '',
                              item.color_code ?? '',
                              item.imagen_url,
                              'thumb',
                            )}
                            alt={`${item.linea_codigo}-${item.ref_codigo}`}
                          />
                        </div>

                        <span style={{ color: '#374151', flex: 2 }}>
                          L{item.linea_codigo}·R{item.ref_codigo}
                          <span style={{ color: '#94A3B8', marginLeft: 6 }}>{item.gradas_fmt}</span>
                          {item.color_nombre && (
                            <span style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 2 }}>{item.color_nombre}</span>
                          )}
                        </span>

                        <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, color: '#64748B' }}>
                          <button type="button" aria-label={`Restar ${unidadAria}`}
                            onClick={() => void setCajas(item.det_id, item.cajas - 1)}
                            style={{
                              width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1',
                              background: '#F8FAFC', cursor: 'pointer', fontWeight: 700,
                              color: '#475569', fontSize: 16, lineHeight: 1, padding: 0,
                            }}>−</button>
                          <input
                            type="number" min={0} max={item.cajas_disponibles} value={item.cajas}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10)
                              void setCajas(item.det_id, Number.isFinite(v) ? v : 0)
                            }}
                            aria-label={`Cantidad de ${unidadAria}`}
                            style={{
                              width: 48, height: 26, textAlign: 'center', borderRadius: 6,
                              border: '1px solid #CBD5E1', fontSize: 14, color: '#1E293B',
                              fontWeight: 600, padding: 0,
                            }}
                          />
                          <button type="button" aria-label={`Sumar ${unidadAria}`}
                            disabled={item.cajas >= item.cajas_disponibles}
                            onClick={() => void setCajas(item.det_id, item.cajas + 1)}
                            style={{
                              width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1',
                              background: item.cajas >= item.cajas_disponibles ? '#E2E8F0' : '#F8FAFC',
                              cursor: item.cajas >= item.cajas_disponibles ? 'not-allowed' : 'pointer',
                              fontWeight: 700,
                              color: item.cajas >= item.cajas_disponibles ? '#94A3B8' : '#475569',
                              fontSize: 16, lineHeight: 1, padding: 0,
                              opacity: item.cajas >= item.cajas_disponibles ? 0.5 : 1,
                            }}>+</button>
                          <span style={{ marginLeft: 4, fontSize: 12 }}>
                            {unidadCorta}{esPeItem ? '' : ` · ${item.pares} p`}
                          </span>
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
                          }}>🗑️ Quitar                        </button>
                      </div>
                      )
                    })}
                  </div>
                  )
                })}
              </div>
            ))}
          </div>
      ))}

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
          <button type="button" onClick={validar} disabled={validando || sinVendedor || !!editorFi}
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

        <a href="/" style={{
          display: 'block', textAlign: 'center', color: editorFi ? '#CBD5E1' : '#64748B',
          fontSize: 14, pointerEvents: editorFi ? 'none' : 'auto',
        }}>
          ← Seguir agregando
        </a>
      </div>

      {editorFi && (
        <EditorDescuentosFi
          abierto
          factura={editorFi}
          ppId={editorFi.pp_id}
          esPeLote={editorFi.pp_id < 0}
          guardando={guardandoDesc}
          onCancelar={() => { if (!guardandoDesc) setEditorFi(null) }}
          onGuardar={async (payload) => {
            setGuardandoDesc(true)
            setError(null)
            try {
              const res = await guardarDescuentosFactura(
                editorFi.pp_id,
                editorFi.marca,
                editorFi.caso,
                payload,
              )
              setEditorFi(null)
              setError(null)
              setAviso(`Descuentos guardados (${res.origen}) · ${res.items_actualizados} ítems · Revalidá antes de confirmar.`)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudieron guardar los descuentos')
            } finally {
              setGuardandoDesc(false)
            }
          }}
        />
      )}
    </div>
  )
}
