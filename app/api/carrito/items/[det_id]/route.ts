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
  if (!body?.cantidad_cajas || body.cantidad_cajas < 0) {
    return NextResponse.json({ error: 'cantidad_cajas inválido' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()

  if (body.cantidad_cajas === 0) {
    const { error } = await sb
      .from('carrito_item')
      .delete()
      .eq('id_usuario', session.id_usuario)
      .eq('det_id', detId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, removed: true })
  }

  const { data, error } = await sb
    .from('carrito_item')
    .update({ cantidad_cajas: body.cantidad_cajas, actualizado_en: new Date().toISOString() })
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
