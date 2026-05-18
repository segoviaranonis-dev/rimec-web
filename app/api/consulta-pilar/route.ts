import { NextRequest, NextResponse } from 'next/server'
import { consultarPilarPorCodigos } from '@/lib/atributosLinea'

/** GET /api/consulta-pilar?pares=1214:1073,1214:1075,1388:500 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('pares') ?? ''
  const pares = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const [linea_codigo, referencia_codigo] = pair.split(':')
      return { linea_codigo: linea_codigo?.trim() ?? '', referencia_codigo: referencia_codigo?.trim() ?? '' }
    })
    .filter(p => p.linea_codigo && p.referencia_codigo)

  if (!pares.length) {
    return NextResponse.json(
      { error: 'Usar ?pares=1214:1073,1214:1075,1388:500' },
      { status: 400 },
    )
  }

  const filas = await consultarPilarPorCodigos(pares)
  return NextResponse.json({ pares: filas })
}
