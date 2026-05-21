import { createClient } from '@supabase/supabase-js'
import {
  isAnonKeyCorrupted,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from './supabaseEnv'

const url = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const anon = resolveSupabaseAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
  if (!url || !anon) {
    console.warn('[rimec-web] Supabase: faltan NEXT_PUBLIC_SUPABASE_URL o ANON_KEY en .env.local')
  } else if (isAnonKeyCorrupted(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    console.warn(
      '[rimec-web] Supabase: ANON_KEY en entorno venía corrupta (duplicada); se usó el JWT extraído. ' +
        'Revisá Variables de entorno de Windows o reiniciá `npm run dev` tras corregir .env.local.',
    )
  }
}

export const supabase = createClient(url, anon)
