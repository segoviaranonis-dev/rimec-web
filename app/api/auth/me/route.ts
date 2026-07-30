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

  return NextResponse.json({
    user: {
      ...session,
      catalogo_scope: catalogoScope,
      solo_calzado: catalogoScope === 'calzado',
      solo_confecciones: catalogoScope === 'confecciones',
    },
  })
}
