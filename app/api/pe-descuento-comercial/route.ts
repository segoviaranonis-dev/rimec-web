import { NextRequest, NextResponse } from 'next/server'
import { fetchPeDescuentoComercialMap } from '@/lib/peDescuentoComercial'

/** Mapa público (lectura) · descuento comercial PE dictado. */
export async function GET(req: NextRequest) {
  try {
    const batchLabel = req.nextUrl.searchParams.get('batch_label')
    const map = await fetchPeDescuentoComercialMap({ batchLabel })
    const descuentos: Record<string, number> = {}
    for (const [k, v] of map) descuentos[k] = v
    return NextResponse.json({ ok: true, descuentos, count: map.size })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
