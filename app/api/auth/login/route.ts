/**
 * OT-514: POST /api/auth/login
 * Valida credenciales y crea sesión
 */

import { NextResponse } from 'next/server'
import { validateUsuario } from '@/lib/auth/validateUsuario'
import { normalizarCategoria, puedeAccederRimecWeb } from '@/lib/auth/roles'
import { createSession } from '@/lib/auth/session'
import type { RolePermitido } from '@/lib/auth/roles'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { usuario, password } = body

    if (!usuario || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña requeridos' },
        { status: 400 }
      )
    }

    // Validar credenciales
    const user = await validateUsuario(usuario, password)

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // Verificar categoría permitida
    const categoriaNorm = normalizarCategoria(user.categoria)

    if (!puedeAccederRimecWeb(user.rol_id, user.categoria)) {
      return NextResponse.json(
        {
          error: 'Acceso denegado',
          message: `Tu categoría (${user.categoria}) no tiene acceso al catálogo mayorista.`,
        },
        { status: 403 }
      )
    }

    // Crear sesión
    await createSession({
      id_usuario: user.id_usuario,
      name: user.descp_usuario,
      role: categoriaNorm as RolePermitido,
    })

    return NextResponse.json({
      success: true,
      user: {
        name: user.descp_usuario,
        role: categoriaNorm,
      },
    })
  } catch (error) {
    console.error('[login]', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
