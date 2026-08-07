/**
 * Presencia Bitácora (RIMEC Web) — LOGIN día + HEARTBEAT cada ~4 min.
 * Importante: el client Supabase NO lanza throw en error de insert — hay que mirar `error`.
 */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

async function insertEvento(opts: {
  id_usuario: number
  app: string
  evento: 'LOGIN' | 'HEARTBEAT' | 'LOGOUT' | 'VENTA_ACTIVA' | 'VENTA_CERRADA'
  detalle?: Record<string, unknown> | null
}): Promise<boolean> {
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('bitacora_acceso_web').insert({
    id_usuario: opts.id_usuario,
    app: opts.app,
    evento: opts.evento,
    detalle: opts.detalle ?? null,
  })
  if (error) {
    console.error('[bitacoraPresencia] INSERT falló:', error.message, error.code, error.details)
    return false
  }
  return true
}

export async function registrarPresenciaRimecWeb(opts: {
  id_usuario: number
  descp_usuario?: string
}): Promise<{ evento: string; ok: boolean }> {
  if (!opts.id_usuario) return { evento: 'SKIP', ok: false }
  const app = 'rimec-web'

  try {
    const sb = getSupabaseAdmin()
    const { data: recientes, error } = await sb
      .from('bitacora_acceso_web')
      .select('id, evento, created_at')
      .eq('id_usuario', opts.id_usuario)
      .eq('app', app)
      .in('evento', ['LOGIN', 'HEARTBEAT'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('[bitacoraPresencia] SELECT falló:', error.message)
      // Igual intentamos LOGIN — si la tabla no está en cache, falla y lo vemos
      const ok = await insertEvento({
        id_usuario: opts.id_usuario,
        app,
        evento: 'LOGIN',
        detalle: {
          descp_usuario: opts.descp_usuario ?? null,
          via: 'presencia-fallback',
          select_error: error.message,
        },
      })
      return { evento: ok ? 'LOGIN' : 'SKIP', ok }
    }

    const now = Date.now()
    const asuDay = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Asuncion' })
    const huboHoy = (recientes ?? []).some((r) => {
      const d = new Date(r.created_at as string).toLocaleDateString('en-CA', {
        timeZone: 'America/Asuncion',
      })
      return d === asuDay
    })

    if (!huboHoy) {
      const ok = await insertEvento({
        id_usuario: opts.id_usuario,
        app,
        evento: 'LOGIN',
        detalle: {
          descp_usuario: opts.descp_usuario ?? null,
          via: 'presencia',
        },
      })
      return { evento: ok ? 'LOGIN' : 'SKIP', ok }
    }

    const ultimo = recientes?.[0]
    if (ultimo) {
      const age = now - new Date(ultimo.created_at as string).getTime()
      if (age < 4 * 60 * 1000) return { evento: 'SKIP', ok: true }
    }

    const ok = await insertEvento({
      id_usuario: opts.id_usuario,
      app,
      evento: 'HEARTBEAT',
      detalle: { descp_usuario: opts.descp_usuario ?? null },
    })
    return { evento: ok ? 'HEARTBEAT' : 'SKIP', ok }
  } catch (e) {
    console.error('[bitacoraPresencia] omitido:', e)
    return { evento: 'SKIP', ok: false }
  }
}

/** Login duro — siempre escribe LOGIN (además de presencia). */
export async function registrarLoginRimecWeb(opts: {
  id_usuario: number
  descp_usuario?: string
}): Promise<boolean> {
  return insertEvento({
    id_usuario: opts.id_usuario,
    app: 'rimec-web',
    evento: 'LOGIN',
    detalle: {
      descp_usuario: opts.descp_usuario ?? null,
      via: 'login',
    },
  })
}
