import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

/** GET — impacto diccionario PE en catálogo (v_pe_diccionario_impacto) */
export async function GET() {
  const sb = getSupabaseAdmin()
  const [{ data: cadenas }, { data: impacto, error }] = await Promise.all([
    sb.from('pe_diccionario_cadena').select('*').order('cadena_pe'),
    sb.from('v_pe_diccionario_impacto').select('*'),
  ])

  if (error) {
    return NextResponse.json(
      { cadenas: cadenas ?? [], impacto: [], warning: error.message },
      { status: 200 },
    )
  }

  return NextResponse.json({
    cadenas: cadenas ?? [],
    impacto: impacto ?? [],
    fetchedAt: Date.now(),
  })
}
