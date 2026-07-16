/**
 * POST /api/carrito/factura/recalcular
 * @deprecated Preferir POST /api/carrito/factura/guardar-descuentos
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { guardarDescuentosFacturaInterna } from '@/lib/carritoDescuentosFi'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { pp_id, marca, caso } = await req.json()
    if (!pp_id || !marca || !caso) {
      return NextResponse.json({ error: 'pp_id, marca y caso obligatorios' }, { status: 400 })
    }

    const sb = getSupabaseAdmin()
    const { data: sesion } = await sb
      .from('carrito_sesion')
      .select('descuentos_lote')
      .eq('id_usuario', session.id_usuario)
      .single()

    const factura = sesion?.descuentos_lote?.facturas?.find(
      (f: { pp_id: number; marca: string; caso: string }) =>
        f.pp_id === pp_id && f.marca === marca && f.caso === caso,
    )
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const result = await guardarDescuentosFacturaInterna(sb, session.id_usuario, {
      pp_id: Number(pp_id),
      marca: String(marca),
      caso: String(caso),
      lista_precio_id: Number(factura.lista_precio_id) || 1,
      descuentos: factura.descuentos ?? [0, 0, 0, 0],
    })

    return NextResponse.json({
      ok: true,
      items_actualizados: result.items_actualizados,
      lista_aplicada: result.lista_aplicada,
      descuentos_aplicados: result.descuentos_aplicados,
    })
  } catch (err) {
    console.error('Error POST /api/carrito/factura/recalcular:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
