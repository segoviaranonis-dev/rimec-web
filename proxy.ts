/**
 * Next.js 16: Proxy de autenticación (migrado de middleware.ts)
 * Protege rutas que requieren login
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET no está configurada - requerida para verificar sesiones')
}

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET)

const PUBLIC_PATHS = ['/login', '/acceso-denegado', '/api/auth/login', '/api/auth/logout']

function nextWithPath(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-url-path', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  if (host.endsWith('.vercel.app')) {
    return NextResponse.redirect(
      new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://www.rimec.com.py'),
      308,
    )
  }

  const { pathname } = request.nextUrl

  // Rutas públicas
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return nextWithPath(request)
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
    const { payload } = await jwtVerify(token, SECRET)
    const role = payload.role as string

    // Si no es VENDEDOR ni ADMIN, denegar acceso
    if (role !== 'VENDEDOR' && role !== 'ADMIN') {
      const deniedUrl = new URL('/acceso-denegado', request.url)
      return NextResponse.redirect(deniedUrl)
    }

    return nextWithPath(request)
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
    '/login',
    '/acceso-denegado',
    '/',
    '/carrito',
    '/pedidos',
    '/estadisticas',
    '/mis-facturas',
    '/api/estadisticas/:path*',
    '/api/consulta-pilar/:path*',
    '/api/mis-facturas/:path*',
    '/api/pdf/:path*',
    '/api/notificaciones/:path*',
    '/api/carrito/:path*',
    '/api/catalogo/:path*',
  ],
}
