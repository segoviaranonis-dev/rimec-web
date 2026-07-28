import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveCarritoStockRow, stockCantidadLabel } from '@/lib/carritoStockResolve'

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
    .select('cantidad_cajas, pp_id')
    .eq('id_usuario', session.id_usuario)
    .eq('det_id', detId)
    .maybeSingle()

  const currentQty = Number(currentItem?.cantidad_cajas ?? 0)

  // Solo validar stock al subir cantidad — bajar/quitar no consume stock nuevo
  if (qty > currentQty) {
    const stockHit = await resolveCarritoStockRow(
      sb,
      detId,
      null,
      currentItem?.pp_id ?? null,
    )
    if (!stockHit) {
      return NextResponse.json({ error: 'producto no encontrado' }, { status: 404 })
    }

    const cajasDisponibles = stockHit.row.cajas_disponibles ?? 0
    if (qty > cajasDisponibles) {
      return NextResponse.json({
        error: `stock insuficiente (disponible: ${stockCantidadLabel(detId, cajasDisponibles, stockHit.row.origen_tipo)})`,
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
