import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface ItemBody {
  det_id: number
  pp_id: number
  cantidad_cajas: number
  precio_snapshot: number
  caso_snapshot: string
  caso_id_snapshot?: number | null
  marca_snapshot: string
  marca_id_snapshot?: number | null
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const body = (await req.json()) as ItemBody
  if (!body?.det_id || !body?.pp_id || !body?.cantidad_cajas || body.cantidad_cajas <= 0) {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()

  const { data: sesion } = await sb
    .from('carrito_sesion')
    .select('id_usuario')
    .eq('id_usuario', session.id_usuario)
    .maybeSingle()
  if (!sesion) {
    return NextResponse.json({ error: 'sesión de venta no activa' }, { status: 409 })
  }

  const { data, error } = await sb
    .from('carrito_item')
    .upsert(
      {
        id_usuario: session.id_usuario,
        det_id: body.det_id,
        pp_id: body.pp_id,
        cantidad_cajas: body.cantidad_cajas,
        precio_snapshot: body.precio_snapshot,
        caso_snapshot: body.caso_snapshot,
        caso_id_snapshot: body.caso_id_snapshot ?? null,
        marca_snapshot: body.marca_snapshot,
        marca_id_snapshot: body.marca_id_snapshot ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'id_usuario,det_id' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('carrito_item').delete().eq('id_usuario', session.id_usuario)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
