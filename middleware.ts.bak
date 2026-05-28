import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware de seguridad para rimec-web
 *
 * Características:
 * - Rate limiting básico (10 req/10s por IP)
 * - Security headers (CSP, HSTS, etc.)
 * - Protección XSS/Clickjacking
 * - Bloqueo de bots maliciosos
 */

// Rate limiting simple (en producción usar @upstash/ratelimit con Redis)
const requestCounts = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT = {
  windowMs: 10_000, // 10 segundos
  maxRequests: 10,  // 10 requests
}

function getRateLimitKey(req: NextRequest): string {
  // Usar IP o fallback a user-agent
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown'
  return ip
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const record = requestCounts.get(key)

  if (!record || now > record.resetAt) {
    // Nueva ventana
    requestCounts.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs })
    return true
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    // Excedió límite
    return false
  }

  // Incrementar contador
  record.count++
  return true
}

// Limpiar cache cada minuto
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key)
    }
  }
}, 60_000)

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Rate Limiting (solo para API routes)
  if (pathname.startsWith('/api/')) {
    const rateLimitKey = getRateLimitKey(req)
    const allowed = checkRateLimit(rateLimitKey)

    if (!allowed) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': '10',
          'Content-Type': 'text/plain',
        },
      })
    }
  }

  // 2. Security Headers
  const response = NextResponse.next()

  // Content Security Policy (CSP)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requiere unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind requiere unsafe-inline
    "img-src 'self' data: https:", // Permitir imágenes de cualquier HTTPS
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co", // API calls a Supabase
    "frame-ancestors 'none'", // Prevenir clickjacking
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)

  // Strict Transport Security (HTTPS obligatorio)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  // Prevenir MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Clickjacking protection
  response.headers.set('X-Frame-Options', 'DENY')

  // XSS Protection (legacy pero útil)
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions Policy (antes Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  // 3. Bloquear User-Agents sospechosos
  const userAgent = req.headers.get('user-agent') || ''
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zap/i,
    /burp/i,
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      console.warn(`[SECURITY] Blocked suspicious user-agent: ${userAgent}`)
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // 4. Bloquear paths sospechosos
  const suspiciousPaths = [
    '/wp-admin',
    '/wp-login',
    '/phpmyadmin',
    '/.env',
    '/.git',
    '/admin.php',
    '/config.php',
  ]

  if (suspiciousPaths.some(p => pathname.includes(p))) {
    console.warn(`[SECURITY] Blocked suspicious path: ${pathname}`)
    return new NextResponse('Not Found', { status: 404 })
  }

  return response
}

// Configurar qué rutas ejecutan el middleware
export const config = {
  matcher: [
    /*
     * Match todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
