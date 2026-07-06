import { NextResponse } from 'next/server'
import { getFiltros } from '@/lib/filtros'

export const dynamic = 'force-dynamic'

/** Header mega-menú — carga async post-paint (no bloquea HTML). */
export async function GET() {
  try {
    const filtros = await getFiltros()
    return NextResponse.json(filtros)
  } catch (err) {
    console.error('[catalogo/header-filtros]', err)
    return NextResponse.json({ error: 'Error cargando filtros' }, { status: 500 })
  }
}
