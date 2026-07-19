import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  buildLineaCasoMap,
  type CasoBibliotecaLite,
} from '@/lib/depositos/caso-biblioteca'

const TTL_MS = 5 * 60 * 1000
let cachedMap: Map<string, string> | null = null
let cachedAt = 0
let inflight: Promise<Map<string, string>> | null = null

async function loadLineaCasoMap(): Promise<Map<string, string>> {
  const { data, error } = await getSupabaseAdmin()
    .from('caso_precio_biblioteca')
    .select('id, nombre_caso, lineas')
    .eq('activo', true)

  if (error) {
    console.error('[casoBibliotecaLoader]', error.message)
    return new Map()
  }

  const rows = (data ?? []) as CasoBibliotecaLite[]
  return buildLineaCasoMap(rows)
}

/** Mapa linea_codigo → nombre_caso — cache servidor 5 min. */
export async function getLineaCasoMapCached(): Promise<Map<string, string>> {
  if (cachedMap && Date.now() - cachedAt < TTL_MS) return cachedMap
  if (inflight) return inflight

  inflight = loadLineaCasoMap()
    .then((map) => {
      cachedMap = map
      cachedAt = Date.now()
      return map
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}
