/**
 * API: /api/notificaciones
 * GET: Lista de notificaciones del usuario logueado
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

export async function GET(request: Request) {
  try {
    // Obtener usuario de la sesión
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const soloNoLeidas = searchParams.get('no_leidas') === 'true'

    // Construir query
    let query = supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', session.id_usuario)
      .order('created_at', { ascending: false })
      .limit(50)

    if (soloNoLeidas) {
      query = query.eq('leida', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('[notificaciones] Error:', error)
      return NextResponse.json(
        { error: 'Error al obtener notificaciones' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      notificaciones: data || [],
      total: data?.length || 0,
    })
  } catch (error) {
    console.error('[notificaciones] Exception:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
