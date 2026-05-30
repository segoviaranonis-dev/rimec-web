/**
 * OT-514: Manejo de sesión con cookie firmada (httpOnly)
 */

import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { RolePermitido } from './roles'

const SESSION_COOKIE = 'rimec_session'

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET no está configurada - requerida para firmar sesiones')
}

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET)

export interface SessionData {
  id_usuario: number
  name: string
  role: RolePermitido
}

/**
 * Crear cookie de sesión firmada
 */
export async function createSession(data: SessionData): Promise<void> {
  const token = await new SignJWT(data as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 días
    path: '/',
  })
}

/**
 * Leer sesión actual desde cookie
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value

    if (!token) return null

    const { payload } = await jwtVerify(token, SECRET)

    return {
      id_usuario: payload.id_usuario as number,
      name: payload.name as string,
      role: payload.role as RolePermitido,
    }
  } catch {
    return null
  }
}

/**
 * Borrar cookie de sesión
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
