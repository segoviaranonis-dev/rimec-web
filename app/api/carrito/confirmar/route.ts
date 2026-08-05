import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/auth/session'
import { sanitizeConfirmarPayload } from '@/lib/sanitizeConfirmarPayload'
import { repairConfirmarPayloadPrecios } from '@/lib/repairConfirmarPayloadPrecios'
import { asegurarSegregacionFiPayload } from '@/lib/asegurarSegregacionFiPayload'
import { asegurarSegregacionPePpPayload } from '@/lib/asegurarSegregacionPePpPayload'
import {
  extraerLogisticaPePayload,
  persistirLogisticaPePostConfirmar,
} from '@/lib/logisticaPeConfirmar'
import { appendObsLogisticaPeAFacturas } from '@/lib/logisticaObservacionPe'
import { notificarAprobadoresPedidoWeb } from '@/lib/notificarAprobadoresPedidoWeb'
import { validarCarritoPeApp } from '@/lib/carritoValidarPe'

/**
 * POST /api/carrito/confirmar
 * Confirma pedido ejecutando RPC desde servidor (no desde cliente)
 * Requiere sesión activa (vendedor/admin)
 *
 * PE (MIG-173): confirmar_pedido_web resuelve pp_id real vía PPD / v_stock_pe_rimec.
 * No emitir FI PE sin PP — ancla Fecha de entrega Real en pedido_proveedor.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const {
      p_cliente_id,
      p_vendedor_id,
      p_plazo_id,
      p_lista_precio_id,
      p_descuento_1,
      p_descuento_2,
      p_descuento_3,
      p_descuento_4,
      p_total_pares,
      p_total_monto,
      p_payload,
      p_validacion_token,
    } = body

    if (!p_cliente_id || !p_plazo_id || !p_lista_precio_id || !p_payload || !p_validacion_token) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    const sb = getSupabaseAdmin()
    const sanitized = sanitizeConfirmarPayload(p_payload)
    const repaired = await repairConfirmarPayloadPrecios(sb, session.id_usuario, sanitized)
    let payload: unknown
    try {
      const seg = await asegurarSegregacionFiPayload(sb, repaired)
      const pePp = await asegurarSegregacionPePpPayload(sb, seg.payload)
      payload = pePp.payload
      if (seg.facturas_spliteadas > 0) {
        console.info(
          `[confirmar] R-FI-2: se separaron ${seg.facturas_spliteadas} FI por cadena comercial`,
        )
      }
      if (pePp.facturas_spliteadas > 0) {
        console.info(
          `[confirmar] MIG-173: se separaron ${pePp.facturas_spliteadas} FI PE por pedido proveedor`,
        )
      }
    } catch (segErr) {
      return NextResponse.json(
        {
          error:
            segErr instanceof Error
              ? segErr.message
              : 'R-FI-2: PROMO y LIQUIDACIÓN no pueden ir en la misma factura',
        },
        { status: 400 },
      )
    }
    const totalMonto =
      payload && typeof payload === 'object' && 'total_neto' in payload
        ? Number((payload as { total_neto?: number }).total_neto) || Number(p_total_monto) || 0
        : Number(p_total_monto) || 0

    // Ley PE/Web: fi.vendedor_id = usuario_v2.id_usuario (NO vendedor_v2). Error 4.02.04.004.
    const vendedorSesion = session.id_usuario
    if (p_vendedor_id != null && Number(p_vendedor_id) !== Number(vendedorSesion)) {
      console.warn('[confirmar] p_vendedor_id≠sesión · usando id_usuario', {
        body: p_vendedor_id,
        sesion: vendedorSesion,
      })
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const p = payload as Record<string, unknown>
      p.vendedor_id = vendedorSesion
      if (session.name) p.vendedor_nombre = session.name
    }

    // Si el token del cliente venció (logística larga), revalidar stock/precios y emitir uno fresco.
    let tokenConfirmar = String(p_validacion_token)
    const { data: sesTok } = await sb
      .from('carrito_sesion')
      .select('validacion_token, validacion_estado, validada_en')
      .eq('id_usuario', vendedorSesion)
      .maybeSingle()
    const validadaMs = sesTok?.validada_en ? new Date(sesTok.validada_en).getTime() : 0
    const tokenVigente =
      sesTok?.validacion_estado === 'OK' &&
      sesTok?.validacion_token &&
      String(sesTok.validacion_token) === tokenConfirmar &&
      validadaMs > 0 &&
      Date.now() - validadaMs < 30 * 60_000

    if (!tokenVigente) {
      console.warn('[confirmar] token no vigente · revalidando en servidor')
      const reval = await validarCarritoPeApp(sb, vendedorSesion)
      if (reval.estado !== 'OK' || !reval.token) {
        return NextResponse.json({
          success: false,
          error:
            'Token de validación vencido o el stock/precio cambió. Presioná VALIDAR de nuevo.',
          detail: 'VALIDACION_VENCIDA',
          items: reval.items ?? [],
        })
      }
      tokenConfirmar = reval.token
    }

    const { data, error: rpcErr } = await sb.rpc('confirmar_pedido_web', {
      p_cliente_id,
      p_vendedor_id: vendedorSesion,
      p_plazo_id,
      p_lista_precio_id,
      p_descuento_1: Number(p_descuento_1) || 0,
      p_descuento_2: Number(p_descuento_2) || 0,
      p_descuento_3: Number(p_descuento_3) || 0,
      p_descuento_4: Number(p_descuento_4) || 0,
      p_total_pares,
      p_total_monto: totalMonto,
      p_payload: payload,
      p_validacion_token: tokenConfirmar,
    })

    if (rpcErr) {
      console.error('[confirmar] RPC error:', rpcErr)
      return NextResponse.json(
        { error: rpcErr.message, details: rpcErr.details },
        { status: 500 },
      )
    }

    const logisticaPe = extraerLogisticaPePayload(payload)
    const pedidoId =
      data && typeof data === 'object' && 'pedido_id' in data
        ? Number((data as { pedido_id?: number }).pedido_id)
        : NaN
    if (Number.isFinite(pedidoId) && pedidoId > 0) {
      await persistirLogisticaPePostConfirmar(sb, pedidoId, logisticaPe)
      if (logisticaPe.observacion) {
        await appendObsLogisticaPeAFacturas(sb, pedidoId, {
            texto: logisticaPe.observacion,
            usuarioId: session.id_usuario,
            usuarioNombre: session.name,
        })
      }
      try {
        let clienteNombre: string | null = null
        const { data: clienteRow } = await sb
          .from('cliente_v2')
          .select('descp_cliente')
          .eq('id_cliente', p_cliente_id)
          .maybeSingle()
        clienteNombre = clienteRow?.descp_cliente ?? null
        await notificarAprobadoresPedidoWeb(sb, {
          pedidoId,
          vendedorNombre: session.name,
          clienteNombre,
        })
      } catch (notifErr) {
        console.error('[confirmar] alerta aprobadores:', notifErr)
      }
      // Logística OK solo tras FI CONFIRMADA en Aprobaciones — no pre-sync Web (RESERVADA)
      // Puente PE → Logística: syncLogisticaTrasConfirmarFi en Report al confirmar FI
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[confirmar] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
