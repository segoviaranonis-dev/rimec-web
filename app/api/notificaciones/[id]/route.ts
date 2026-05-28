/**
 * API: /api/notificaciones/[id]
 * PATCH: Marcar notificación como leída
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseUrl, resolveSupabaseAnonKey } from '@/lib/supabaseEnv'

const supabaseUrl = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const serviceKey = resolveSupabaseAnonKey(process.env.SUPABASE_SERVICE_ROLE_KEY)

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const notifId = parseInt(id)

    if (isNaN(notifId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    // Verificar que la notificación pertenece al usuario
    const { data: notif } = await supabase
      .from('notificaciones')
      .select('usuario_id')
      .eq('id', notifId)
      .single()

    if (!notif || notif.usuario_id !== session.id_usuario) {
      return NextResponse.json(
        { error: 'Notificación no encontrada' },
        { status: 404 }
      )
    }

    // Marcar como leída
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', notifId)

    if (error) {
      console.error('[notificaciones] Error al marcar leída:', error)
      return NextResponse.json(
        { error: 'Error al actualizar notificación' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notificaciones] Exception:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
