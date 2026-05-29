/**
 * Rate Limiting usando Upstash Redis
 * Previene abuso de API y controla costos de Vercel
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Configuración de Redis (fail-safe: si no está configurado, permite todo)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// Rate limiter: 10 requests por minuto por identificador
export const ratelimit = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'nexus:ratelimit:pdf',
    })
  : null

/**
 * Verifica rate limit para un identificador (usuario ID o IP)
 *
 * @param identifier - ID de usuario o IP
 * @returns { success: boolean, limit: number, remaining: number, reset: number }
 *
 * @example
 * const result = await checkRateLimit('user:123')
 * if (!result.success) {
 *   // Usuario excedió límite
 *   return error429(result.reset)
 * }
 */
export async function checkRateLimit(identifier: string) {
  // Si no hay Redis configurado, permitir siempre (graceful degradation)
  if (!ratelimit) {
    console.warn('[RateLimit] Redis no configurado - rate limiting deshabilitado')
    return { success: true, limit: 10, remaining: 10, reset: Date.now() + 60000 }
  }

  try {
    const result = await ratelimit.limit(identifier)
    return result
  } catch (error) {
    console.error('[RateLimit] Error verificando límite:', error)
    // En caso de error, permitir (fail-open, no fail-closed)
    return { success: true, limit: 10, remaining: 10, reset: Date.now() + 60000 }
  }
}
