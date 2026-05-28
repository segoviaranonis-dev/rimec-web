/**
 * API: /api/mis-facturas
 * GET: Lista de Facturas Internas CONFIRMADAS del vendedor logueado
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

export async function GET(request: Request) {
  try {
    // Autenticación requerida
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener FIs confirmadas del vendedor
    const { data, error } = await supabase
      .from('factura_interna')
      .select(`
        id,
        nro_factura,
        pp_id,
        pedido_id,
        marca,
        marca_id,
        caso,
        caso_id,
        total_pares,
        total_monto,
        estado,
        created_at,
        lista_precio_id,
        plazo_id,
        descuento_1,
        descuento_2,
        descuento_3,
        descuento_4,
        cliente_id,
        vendedor_id
      `)
      .eq('vendedor_id', session.id_usuario)
      .eq('estado', 'CONFIRMADA')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[mis-facturas] Error:', error)
      return NextResponse.json(
        { error: 'Error al obtener facturas' },
        { status: 500 }
      )
    }

    // Obtener nombres de cliente para cada FI
    const clienteIds = [...new Set(data?.map(fi => fi.cliente_id).filter(Boolean))]
    let clientesMap: Record<number, string> = {}

    if (clienteIds.length > 0) {
      const { data: clientes } = await supabase
        .from('cliente_v2')
        .select('id_cliente, descp_cliente')
        .in('id_cliente', clienteIds)

      if (clientes) {
        clientesMap = Object.fromEntries(
          clientes.map(c => [c.id_cliente, c.descp_cliente])
        )
      }
    }

    // Enriquecer datos con nombre de cliente
    const facturasConCliente = (data || []).map(fi => ({
      ...fi,
      cliente_nombre: fi.cliente_id ? clientesMap[fi.cliente_id] || 'Sin nombre' : 'Sin cliente',
    }))

    return NextResponse.json({
      facturas: facturasConCliente,
      total: facturasConCliente.length,
    })
  } catch (error) {
    console.error('[mis-facturas] Exception:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
