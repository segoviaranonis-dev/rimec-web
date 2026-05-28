import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/carrito/limpiar
 *
 * Limpia el carrito ajustando las cantidades al stock disponible.
 * Útil cuando hay items que exceden el stock disponible.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const sb = getSupabaseAdmin()

  // 1. Obtener items del carrito
  const { data: items, error: itemsError } = await sb
    .from('carrito_item')
    .select('det_id, cantidad_cajas')
    .eq('id_usuario', session.id_usuario)

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, ajustados: 0, eliminados: 0 })
  }

  // 2. Obtener stock disponible para cada item
  const detIds = items.map(i => i.det_id)
  const { data: stockData } = await sb
    .from('v_stock_rimec')
    .select('det_id, cajas_disponibles')
    .in('det_id', detIds)

  if (!stockData) {
    return NextResponse.json({ error: 'no se pudo obtener stock' }, { status: 500 })
  }

  const stockMap = new Map(stockData.map(s => [s.det_id, s.cajas_disponibles ?? 0]))

  // 3. Ajustar o eliminar items según stock
  const ajustados: number[] = []
  const eliminados: number[] = []

  for (const item of items) {
    const stockDisponible = stockMap.get(item.det_id) ?? 0

    if (stockDisponible === 0) {
      // Sin stock: eliminar del carrito
      await sb
        .from('carrito_item')
        .delete()
        .eq('id_usuario', session.id_usuario)
        .eq('det_id', item.det_id)
      eliminados.push(item.det_id)
    } else if (item.cantidad_cajas > stockDisponible) {
      // Excede stock: ajustar a máximo disponible
      await sb
        .from('carrito_item')
        .update({
          cantidad_cajas: stockDisponible,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id_usuario', session.id_usuario)
        .eq('det_id', item.det_id)
      ajustados.push(item.det_id)
    }
  }

  return NextResponse.json({
    ok: true,
    ajustados: ajustados.length,
    eliminados: eliminados.length,
    detalle: {
      ajustados,
      eliminados,
    },
  })
}
