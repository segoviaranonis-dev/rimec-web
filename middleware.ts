/**
 * OT-514: Middleware de autenticación
 * Protege rutas que requieren login
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'rimec-web-default-secret-change-in-production'
)

const PUBLIC_PATHS = ['/login', '/acceso-denegado', '/api/auth/login', '/api/auth/logout']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Verificar sesión
  const token = request.cookies.get('rimec_session')?.value

  if (!token) {
    // Sin sesión → redirect login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  try {
    // Verificar token válido
    await jwtVerify(token, SECRET)
    return NextResponse.next()
  } catch {
    // Token inválido → redirect login
    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('rimec_session')
    return response
  }
}

export const config = {
  matcher: [
    '/',
    '/carrito',
    '/pedidos',
    '/estadisticas',
    '/api/estadisticas/:path*',
    '/api/consulta-pilar/:path*',
  ],
}
