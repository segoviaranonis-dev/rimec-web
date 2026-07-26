import { NextResponse } from 'next/server'
import { plazosCarlosParaUi, PLAZO_CARLOS_FUENTE } from '@/lib/carlos/plazoCarlosResolver'
import { etiquetaAmigablePlazo } from '@/lib/carlos/plazoOrdenUi'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

/** GET /api/plazos-carlos — catálogo Cod. Oper. Carlos · orden cronológico UI. */
export async function GET() {
  const base = plazosCarlosParaUi()
  const sb = getSupabaseAdmin()
  const { data: plazoRows } = await sb.from('plazo_v2').select('id_plazo, descp_plazo')
  const descpPorId = new Map(
    (plazoRows ?? []).map((r) => [Number(r.id_plazo), String(r.descp_plazo ?? '').trim()]),
  )

  const plazos = base.map((p) => {
    const descp =
      p.id_plazo != null ? descpPorId.get(Number(p.id_plazo)) || null : null
    return {
      ...p,
      descp_plazo: descp,
      label_display: etiquetaAmigablePlazo(p, descp),
    }
  })

  return NextResponse.json({
    ok: true,
    fuente: PLAZO_CARLOS_FUENTE,
    plazos,
  })
}
