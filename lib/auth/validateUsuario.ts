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

console.log('[validateUsuario] Initialization:', {
  hasUrl: !!supabaseUrl,
  urlLength: supabaseUrl ? supabaseUrl.length : 0,
  urlValue: supabaseUrl,
  hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  keyLength: serviceKey ? serviceKey.length : 0,
})

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
    console.log('[validateUsuario] Attempting validation for user:', usuario)
    const { data, error } = await supabaseAdmin
      .from('usuario_v2')
      .select('id_usuario, descp_usuario, categoria')
      .ilike('descp_usuario', usuario.trim())
      .eq('password', password)
      .limit(1)
      .single()

    if (error) {
      console.error('[validateUsuario] Query error:', error.message, error.details, error.hint)
      return null
    }

    if (!data) {
      console.log('[validateUsuario] User not found or password mismatch.')
      return null
    }

    console.log('[validateUsuario] Successfully validated user:', data.descp_usuario)
    return {
      id_usuario: data.id_usuario,
      descp_usuario: data.descp_usuario,
      categoria: data.categoria,
    }
  } catch (err) {
    console.error('[validateUsuario] Exception:', err)
    return null
  }
}
