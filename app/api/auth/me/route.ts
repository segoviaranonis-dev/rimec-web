/**
 * OT-514: GET /api/auth/me
 * Devuelve sesión actual
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { resolveCatalogoRamoScope } from '@/lib/auth/catalogoScopeUsuario'

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const catalogoScope = resolveCatalogoRamoScope(session.name)

  // Bitácora: presencia (LOGIN día / HEARTBEAT) — await para no perder el evento
  try {
    const { registrarPresenciaRimecWeb } = await import('@/lib/bitacoraPresencia')
    await registrarPresenciaRimecWeb({
      id_usuario: session.id_usuario,
      descp_usuario: session.name,
    })
  } catch {
    /* no bloquea me */
  }

  return NextResponse.json({
    user: {
      ...session,
      catalogo_scope: catalogoScope,
      solo_calzado: catalogoScope === 'calzado',
      solo_confecciones: catalogoScope === 'confecciones',
    },
  })
}
