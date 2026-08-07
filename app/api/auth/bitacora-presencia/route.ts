import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { registrarPresenciaRimecWeb } from '@/lib/bitacoraPresencia'

export const dynamic = 'force-dynamic'

/** Ping presencia Bitácora holding (sesión RIMEC Web). */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false }, { status: 401 })
  await registrarPresenciaRimecWeb({
    id_usuario: session.id_usuario,
    descp_usuario: session.name,
  })
  return NextResponse.json({ ok: true })
}
