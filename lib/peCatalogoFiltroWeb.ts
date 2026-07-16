import { getSupabaseAdmin } from './supabaseAdmin'

export type PeCatalogoFiltroWeb = {
  batch_label: string
  cadena_comercial: string | null
  pulse_liquidacion: boolean
}

/** Lee filtro comercial activo para catálogo PE — gobernado desde Report. */
export async function fetchPeCatalogoFiltroWeb(batchLabel?: string): Promise<PeCatalogoFiltroWeb | null> {
  const batch = String(batchLabel ?? 'sdrm0849').trim().toLowerCase()
  if (!batch) return null
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('pe_catalogo_filtro_web')
      .select('batch_label, cadena_comercial, pulse_liquidacion')
      .ilike('batch_label', batch)
      .maybeSingle()
    if (error || !data) return null
    return data as PeCatalogoFiltroWeb
  } catch {
    return null
  }
}
