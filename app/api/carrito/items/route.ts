import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { asegurarFacturasDescuentosLote } from '@/lib/asegurarFacturasDescuentosLote'
import { resolveCarritoStockRow, stockCantidadLabel } from '@/lib/carritoStockResolve'
import { isProntaEntregaStockRow, syntheticPpIdForPe } from '@/lib/prontaEntregaVenta'

export const dynamic = 'force-dynamic'

interface ItemBody {
  det_id: number
  pp_id: number
  cantidad_cajas: number
  precio_snapshot: number
  caso_snapshot: string
  caso_id_snapshot?: number | null
  marca_snapshot: string
  marca_id_snapshot?: number | null
  origen_tipo?: string | null
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const body = (await req.json()) as ItemBody
  const detId = Number(body?.det_id)
  if (!Number.isFinite(detId) || detId <= 0 || !body?.cantidad_cajas || body.cantidad_cajas <= 0) {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 })
  }

  let isPe = isProntaEntregaStockRow({
    det_id: detId,
    origen_tipo: body.origen_tipo,
    pp_id: body.pp_id,
  })
  if (!isPe && !body?.pp_id) {
    return NextResponse.json({ error: 'payload inválido — falta pp_id' }, { status: 400 })
  }

  // PE: agrupar carrito por PP real (-pp_id) — evita PE_PP_MIXTO al confirmar (MIG-173).
  let ppId = body.pp_id
  if (isPe) {
    if (body.pp_id < 0) {
      ppId = body.pp_id
    } else if (body.pp_id > 0) {
      ppId = -Math.abs(body.pp_id)
    } else {
      ppId = syntheticPpIdForPe({ pp_nro: 'PE-import' })
    }
  }

  const sb = getSupabaseAdmin()

  const { data: sesion } = await sb
    .from('carrito_sesion')
    .select('id_usuario')
    .eq('id_usuario', session.id_usuario)
    .maybeSingle()
  if (!sesion) {
    return NextResponse.json({ error: 'sesión de venta no activa' }, { status: 409 })
  }

  const stockHit = await resolveCarritoStockRow(sb, detId, body.origen_tipo, body.pp_id)
  if (!stockHit) {
    console.warn('[carrito/items] producto no encontrado', {
      det_id: detId,
      origen_tipo: body.origen_tipo,
      pp_id: body.pp_id,
    })
    return NextResponse.json({ error: 'producto no encontrado' }, { status: 404 })
  }

  isPe = isProntaEntregaStockRow({
    det_id: detId,
    origen_tipo: stockHit.row.origen_tipo ?? body.origen_tipo,
    pp_id: body.pp_id,
  })

  const detIdStore = isPe ? stockHit.canonicalDetId : detId

  const cajasDisponibles = stockHit.row.cajas_disponibles ?? 0
  if (body.cantidad_cajas > cajasDisponibles) {
    return NextResponse.json({
      error: `stock insuficiente (disponible: ${stockCantidadLabel(detId, cajasDisponibles, stockHit.row.origen_tipo ?? body.origen_tipo)})`,
    }, { status: 400 })
  }

  const { data, error } = await sb
    .from('carrito_item')
    .upsert(
      {
        id_usuario: session.id_usuario,
        det_id: detIdStore,
        pp_id: ppId,
        cantidad_cajas: body.cantidad_cajas,
        precio_snapshot: body.precio_snapshot,
        caso_snapshot: body.caso_snapshot,
        caso_id_snapshot: body.caso_id_snapshot ?? null,
        marca_snapshot: body.marca_snapshot,
        marca_id_snapshot: body.marca_id_snapshot ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'id_usuario,det_id' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Descuentos FI — async; no bloquear cada tap en catálogo.
  void asegurarFacturasDescuentosLote(sb, session.id_usuario).catch((err) => {
    console.warn('[carrito/items] asegurarFacturasDescuentosLote:', err)
  })

  return NextResponse.json({ item: data })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('carrito_item').delete().eq('id_usuario', session.id_usuario)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
