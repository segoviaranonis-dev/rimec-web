/**
 * Valida credenciales contra usuario_v2 (server-side).
 * Réplica de control_central/core/auth.py:AuthManager.login (Nexus).
 * Requiere SUPABASE_SERVICE_ROLE_KEY: con RLS activa la anon no puede leer usuario_v2.
 * SECURITY: Usa bcrypt para verificar contraseñas hasheadas.
 */

import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from '@/lib/supabaseEnv'
import { verificarPasswordUsuario } from '@/lib/auth/verifyPassword'
import bcrypt from 'bcryptjs'

const supabaseUrl = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const rawServiceKey = resolveSupabaseAnonKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
const rawAnonKey = resolveSupabaseAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const serviceKey = rawServiceKey || rawAnonKey

function decodeJwtRole(jwt: string): string | null {
  try {
    const parts = jwt.split('.')
    if (parts.length < 2) return null
    const json = Buffer.from(parts[1], 'base64').toString('utf8')
    return (JSON.parse(json).role as string) ?? null
  } catch {
    return null
  }
}

const effectiveRole = decodeJwtRole(serviceKey)
const usingServiceRole = effectiveRole === 'service_role'

if (!supabaseUrl || !serviceKey) {
  console.error('[validateUsuario] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}
if (!usingServiceRole) {
  console.warn(
    '[validateUsuario] Usando rol=%s en lugar de service_role. ' +
      'Con RLS activa la query a usuario_v2 devolverá vacío y el login fallará. ' +
      'Definí SUPABASE_SERVICE_ROLE_KEY en .env.local',
    effectiveRole ?? 'desconocido',
  )
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export interface UsuarioValidado {
  id_usuario: number
  descp_usuario: string
  categoria: string
  rol_id: number
}

const ROLE_MAP: Record<string, string> = {
  DIRECTOR: 'ADMIN',
  ROOT: 'ADMIN',
  ADMINISTRADOR: 'ADMIN',
  GERENTE: 'ADMIN',
  DIOS: 'ADMIN',
}

function normalizarRol(rawRole: string): string {
  const r = rawRole.toUpperCase().trim()
  return ROLE_MAP[r] ?? r
}

export async function validateUsuario(
  usuario: string,
  password: string,
): Promise<UsuarioValidado | null> {
  const userClean = (usuario ?? '').trim()
  const passClean = password ?? ''

  if (!userClean || !passClean) return null

  if (!usingServiceRole) {
    console.error(
      '[validateUsuario] Login imposible sin service_role mientras RLS bloquee anon sobre usuario_v2',
    )
  }

  try {
    // SECURITY: Query actualizada para incluir password_hash
    const { data, error } = await supabaseAdmin
      .from('usuario_v2')
      .select('id_usuario, descp_usuario, categoria, password, password_hash, rol_id')
      .ilike('descp_usuario', userClean)
      .order('id_usuario', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[validateUsuario] supabase error:', error.message)
      return null
    }
    if (!data) {
      console.warn(`[validateUsuario] Usuario '${userClean}' no encontrado`)
      return null
    }

    const passwordHash = data.password_hash as string | null
    const passwordPlain = data.password as string | null

    const { ok, needsRehash } = await verificarPasswordUsuario(
      passClean,
      passwordPlain,
      passwordHash,
    )

    if (!ok) {
      console.warn(`[validateUsuario] Contraseña incorrecta para '${userClean}'`)
      return null
    }

    if (needsRehash || (!passwordHash && ok)) {
      const hashNew = await bcrypt.hash(passClean, 10)
      await supabaseAdmin
        .from('usuario_v2')
        .update({ password_hash: hashNew })
        .eq('id_usuario', data.id_usuario)
    }

    return {
      id_usuario: data.id_usuario,
      descp_usuario: String(data.descp_usuario ?? userClean),
      categoria: normalizarRol(String(data.categoria ?? '')),
      rol_id: Number(data.rol_id ?? 0),
    }
  } catch (e) {
    console.error('[validateUsuario] excepción:', e)
    return null
  }
}
