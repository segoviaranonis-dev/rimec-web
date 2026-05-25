import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface SesionBody {
  cliente_id: number
  cliente_nombre: string
  plazo_id?: number | null
  plazo_nombre?: string | null
  lista_precio_id?: number
  descuentos?: number[]
  descuentos_lote?: Record<string, number[]>
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const sb = getSupabaseAdmin()

  // Traer sesión e items del carrito
  const [sesionRes, itemsRes] = await Promise.all([
    sb.from('carrito_sesion').select('*').eq('id_usuario', session.id_usuario).maybeSingle(),
    sb.from('carrito_item').select('*').eq('id_usuario', session.id_usuario),
  ])

  if (sesionRes.error) return NextResponse.json({ error: sesionRes.error.message }, { status: 500 })
  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 })

  const items = itemsRes.data ?? []

  // Si hay items, traer precios de v_stock_rimec
  if (items.length > 0) {
    const detIds = items.map(i => i.det_id)
    const { data: stockData } = await sb
      .from('v_stock_rimec')
      .select('det_id, lpn, lpc02, lpc03, lpc04')
      .in('det_id', detIds)

    // Enriquecer items con precios
    if (stockData) {
      const stockMap = new Map(stockData.map(s => [s.det_id, s]))
      items.forEach(item => {
        const stock = stockMap.get(item.det_id)
        if (stock) {
          item.v_stock_rimec = [stock]
        }
      })
    }
  }

  return NextResponse.json({
    sesion: sesionRes.data,
    items,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const body = (await req.json()) as SesionBody
  if (!body?.cliente_id || !body?.cliente_nombre) {
    return NextResponse.json({ error: 'cliente_id y cliente_nombre obligatorios' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('carrito_sesion')
    .upsert(
      {
        id_usuario: session.id_usuario,
        cliente_id: body.cliente_id,
        cliente_nombre: body.cliente_nombre,
        plazo_id: body.plazo_id ?? null,
        plazo_nombre: body.plazo_nombre ?? null,
        lista_precio_id: body.lista_precio_id ?? 1,
        descuentos: body.descuentos ?? [0, 0, 0, 0],
        descuentos_lote: body.descuentos_lote ?? {},
        actualizada_en: new Date().toISOString(),
      },
      { onConflict: 'id_usuario' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sesion: data })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const sb = getSupabaseAdmin()
  await sb.from('carrito_item').delete().eq('id_usuario', session.id_usuario)
  const { error } = await sb.from('carrito_sesion').delete().eq('id_usuario', session.id_usuario)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
