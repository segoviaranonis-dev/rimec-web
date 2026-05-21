/**
 * OT-514: Validar credenciales contra usuario_v2
 * Server-side only - usa DATABASE_URL o SERVICE_ROLE
 */

import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from '@/lib/supabaseEnv'

const supabaseUrl = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const serviceKey =
  resolveSupabaseAnonKey(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
  resolveSupabaseAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Cliente con permisos server-side
const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
})

export interface UsuarioValidado {
  id_usuario: number
  descp_usuario: string
  categoria: string
}

/**
 * Valida usuario y contraseña contra usuario_v2
 * @returns Usuario si credenciales válidas, null si no
 */
export async function validateUsuario(
  usuario: string,
  password: string
): Promise<UsuarioValidado | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('usuario_v2')
      .select('id_usuario, descp_usuario, categoria')
      .eq('descp_usuario', usuario)
      .eq('password', password)
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id_usuario: data.id_usuario,
      descp_usuario: data.descp_usuario,
      categoria: data.categoria,
    }
  } catch {
    return null
  }
}
