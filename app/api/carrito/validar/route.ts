import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  clasificarCarritoPeCp,
  parcheValidarProntaEntrega,
  validarCarritoPeApp,
} from '@/lib/carritoValidarPe'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const sb = getSupabaseAdmin()
  const mix = await clasificarCarritoPeCp(sb, session.id_usuario)

  if (mix.count === 0) {
    return NextResponse.json({ success: false, estado: 'ERROR', detail: 'Carrito vacío' }, { status: 409 })
  }

  // PE puro: RPC pisa precio_snapshot → validar en app + token propio
  if (mix.hasPe && !mix.hasCp) {
    const peOnly = await validarCarritoPeApp(sb, session.id_usuario)
    return NextResponse.json(peOnly)
  }

  const { data, error } = await sb.rpc('carrito_validar', { p_id_usuario: session.id_usuario })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const patched = await parcheValidarProntaEntrega(sb, session.id_usuario, data ?? {})
  return NextResponse.json(patched)
}
