import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from './supabaseEnv'

let cached: SupabaseClient | null = null

/**
 * Cliente Supabase server-side con SERVICE_ROLE_KEY.
 * Bypassea RLS — usar SOLO desde route handlers con sesión validada.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const url = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = resolveSupabaseAnonKey(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!url || !serviceKey) {
    throw new Error(
      '[supabaseAdmin] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
