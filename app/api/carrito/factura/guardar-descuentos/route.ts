import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { guardarDescuentosFacturaInterna } from '@/lib/carritoDescuentosFi'

/**
 * POST /api/carrito/factura/guardar-descuentos
 * Commit único por FI: descuentos_lote + precio_snapshot ítems (CP / PE).
 * Invalida validación — obliga Revalidar antes de Confirmar.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { pp_id, marca, caso, lista_precio_id, descuentos } = body

    if (pp_id == null || !marca || !caso) {
      return NextResponse.json({ error: 'pp_id, marca y caso obligatorios' }, { status: 400 })
    }

    const sb = getSupabaseAdmin()
    const result = await guardarDescuentosFacturaInterna(sb, session.id_usuario, {
      pp_id: Number(pp_id),
      marca: String(marca),
      caso: String(caso),
      lista_precio_id: lista_precio_id != null ? Number(lista_precio_id) : undefined,
      descuentos,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[guardar-descuentos]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al guardar descuentos' },
      { status: 500 },
    )
  }
}
