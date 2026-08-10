import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { clasificarCarritoPeCp, validarCarritoPeApp } from '@/lib/carritoValidarPe'

export const dynamic = 'force-dynamic'

/**
 * Validación 100% app — no RPC carrito_validar.
 * El RPC usaba lpc03 crudo de la vista; la ley Web es LPN×1.12 (LPC03) → loop 95900↔96000.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  try {
    const sb = getSupabaseAdmin()
    const mix = await clasificarCarritoPeCp(sb, session.id_usuario)

    if (mix.count === 0) {
      return NextResponse.json({ success: false, estado: 'ERROR', detail: 'Carrito vacío' }, { status: 409 })
    }

    const result = await validarCarritoPeApp(sb, session.id_usuario)
    return NextResponse.json(result)
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const timeout = /statement timeout|57014|canceling statement/i.test(raw)
    console.error('[carrito/validar]', err)
    return NextResponse.json(
      {
        success: false,
        estado: 'ERROR',
        detail: timeout
          ? 'Validación demoró demasiado (timeout BD). Reintentá en 10s; si persiste avisá a Héctor.'
          : raw,
      },
      { status: timeout ? 503 : 500 },
    )
  }
}
