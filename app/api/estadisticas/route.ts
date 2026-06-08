import { NextRequest, NextResponse } from 'next/server'
import { fetchControlStock } from '@/lib/controlStock/fetchControl'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  // SECURITY: Requiere autenticación
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const sp = req.nextUrl.searchParams
    const ppIds = sp.get('pp_ids')
      ? sp.get('pp_ids')!.split(',').map(Number).filter(n => n > 0)
      : undefined
    const generos = sp.get('generos')?.split('|').filter(Boolean)
    const marcas = sp.get('marcas')?.split('|').filter(Boolean)
    const estilos = sp.get('estilos')?.split('|').filter(Boolean)
    const soloSaldo = sp.get('solo_saldo') === '1'

    const data = await fetchControlStock({
      ppIds,
      generos,
      marcas,
      estilos,
      soloSaldo,
    })

    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
