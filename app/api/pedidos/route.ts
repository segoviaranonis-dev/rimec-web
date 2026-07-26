/**
 * API: /api/pedidos
 * GET: Lista pedidos del vendedor autenticado
 *
 * SEGURIDAD HOTFIX 2026-06-07:
 * - Movido desde cliente a servidor
 * - Filtra por vendedor_id de sesión
 * - Usa SERVICE_ROLE_KEY (no expone ANON_KEY)
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseUrl, resolveSupabaseAnonKey } from '@/lib/supabaseEnv'

const supabaseUrl = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const serviceKey = resolveSupabaseAnonKey(process.env.SUPABASE_SERVICE_ROLE_KEY)

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function GET() {
  try {
    // Autenticación requerida
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    console.log('[API Pedidos] Cargando pedidos para vendedor:', session.id_usuario)

    // Query pedidos DEL VENDEDOR (no de todos)
    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedido_venta_rimec')
      .select('*')
      .eq('vendedor_id', session.id_usuario)  // ← FILTRO DE SEGURIDAD
      .order('id', { ascending: false })
      .limit(30)

    if (pedidosError) {
      console.error('[API Pedidos] Error:', pedidosError)
      return NextResponse.json(
        { error: 'Error cargando pedidos', details: pedidosError.message },
        { status: 500 }
      )
    }

    if (!pedidos || pedidos.length === 0) {
      return NextResponse.json({ pedidos: [], facturas: {} })
    }

    // Cargar facturas de esos pedidos
    const pedidoIds = pedidos.map((p) => p.id)
    const minCreated = pedidos[pedidos.length - 1].created_at

    const { data: facturas, error: facturasError } = await supabase
      .from('v_factura_interna_preventa')
      .select(
        'id, numero_preventa_global, pv_global, nro_factura, pp_id, pedido_id, marca, marca_id, caso, caso_id, total_pares, total_monto, estado, created_at, lista_precio_id, descuento_1, descuento_2, descuento_3, descuento_4'
      )
      .or(`pedido_id.in.(${pedidoIds.join(',')}),and(pedido_id.is.null,created_at.gte.${minCreated})`)
      .order('id', { ascending: true })

    if (facturasError) {
      console.error('[API Pedidos] Error facturas:', facturasError)
      // No falla si facturas fallan, solo no las incluye
    }

    // Agrupar facturas por pedido_id
    const facturasMap: Record<number, any[]> = {}
    if (facturas) {
      for (const fi of facturas) {
        if (fi.pedido_id) {
          if (!facturasMap[fi.pedido_id]) facturasMap[fi.pedido_id] = []
          facturasMap[fi.pedido_id].push(fi)
        } else {
          // FI sin pedido_id: buscar por ventana temporal
          for (const ped of pedidos) {
            const diff = Math.abs(
              new Date(fi.created_at).getTime() - new Date(ped.created_at).getTime()
            )
            if (diff <= 10000) {
              // ±10s
              if (!facturasMap[ped.id]) facturasMap[ped.id] = []
              facturasMap[ped.id].push(fi)
            }
          }
        }
      }
    }

    console.log(`[API Pedidos] ✓ Cargados ${pedidos.length} pedidos, ${facturas?.length || 0} facturas`)

    return NextResponse.json({
      pedidos,
      facturas: facturasMap,
    })
  } catch (error) {
    console.error('[API Pedidos] Exception:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}