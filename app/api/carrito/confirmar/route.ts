import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth/session'

/**
 * POST /api/carrito/confirmar
 * Confirma pedido ejecutando RPC desde servidor (no desde cliente)
 * Requiere sesión activa (vendedor/admin)
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar sesión
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener parámetros del cliente
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

    // Validar parámetros requeridos
    if (!p_cliente_id || !p_plazo_id || !p_lista_precio_id || !p_payload || !p_validacion_token) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    // Ejecutar RPC desde servidor
    const { data, error: rpcErr } = await supabase.rpc('confirmar_pedido_web', {
      p_cliente_id,
      p_vendedor_id: p_vendedor_id ?? null,
      p_plazo_id,
      p_lista_precio_id,
      p_descuento_1: Number(p_descuento_1) || 0,
      p_descuento_2: Number(p_descuento_2) || 0,
      p_descuento_3: Number(p_descuento_3) || 0,
      p_descuento_4: Number(p_descuento_4) || 0,
      p_total_pares,
      p_total_monto,
      p_payload,
      p_validacion_token,
    })

    if (rpcErr) {
      console.error('[confirmar] RPC error:', rpcErr)
      return NextResponse.json(
        { error: rpcErr.message, details: rpcErr.details },
        { status: 500 }
      )
    }

    // Retornar resultado del RPC
    return NextResponse.json(data)
  } catch (error) {
    console.error('[confirmar] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
