import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface PatchBody {
  cantidad_cajas: number
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ det_id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const { det_id } = await ctx.params
  const detId = Number(det_id)
  if (!Number.isFinite(detId)) return NextResponse.json({ error: 'det_id inválido' }, { status: 400 })

  const body = (await req.json()) as PatchBody
  const qty = Math.floor(Number(body?.cantidad_cajas))
  if (!Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: 'cantidad_cajas inválido' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()

  if (qty === 0) {
    const { error } = await sb
      .from('carrito_item')
      .delete()
      .eq('id_usuario', session.id_usuario)
      .eq('det_id', detId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, removed: true })
  }

  const { data: currentItem } = await sb
    .from('carrito_item')
    .select('cantidad_cajas')
    .eq('id_usuario', session.id_usuario)
    .eq('det_id', detId)
    .maybeSingle()

  const currentQty = Number(currentItem?.cantidad_cajas ?? 0)

  // Solo validar stock al subir cantidad — bajar/quitar no consume stock nuevo
  if (qty > currentQty) {
    const { data: stockData } = await sb
      .from('v_stock_rimec')
      .select('det_id, cajas_disponibles')
      .eq('det_id', detId)
      .single()

    if (!stockData) {
      return NextResponse.json({ error: 'producto no encontrado' }, { status: 404 })
    }

    const cajasDisponibles = stockData.cajas_disponibles ?? 0
    if (qty > cajasDisponibles) {
      return NextResponse.json({
        error: `stock insuficiente (disponible: ${cajasDisponibles} cajas)`,
      }, { status: 400 })
    }
  }

  const { data, error } = await sb
    .from('carrito_item')
    .update({ cantidad_cajas: qty, actualizado_en: new Date().toISOString() })
    .eq('id_usuario', session.id_usuario)
    .eq('det_id', detId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ det_id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const { det_id } = await ctx.params
  const detId = Number(det_id)
  if (!Number.isFinite(detId)) return NextResponse.json({ error: 'det_id inválido' }, { status: 400 })

  const sb = getSupabaseAdmin()
  const { error } = await sb
    .from('carrito_item')
    .delete()
    .eq('id_usuario', session.id_usuario)
    .eq('det_id', detId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
