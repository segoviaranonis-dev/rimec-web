import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { asegurarFacturasDescuentosLote } from '@/lib/asegurarFacturasDescuentosLote'
import { fetchCarritoStockByDetIds } from '@/lib/carritoStockEnrich'

export const dynamic = 'force-dynamic'

interface SesionBody {
  cliente_id: number
  cliente_nombre: string
  plazo_id?: number | null
  plazo_nombre?: string | null
  cod_oper_carlos?: string | null
  lista_precio_id?: number
  descuentos?: number[]
  descuentos_lote?: Record<string, number[]>
  observacion?: string | null
  fecha_entrega_cliente?: string | null
}

interface LogisticaPePatchBody {
  observacion?: string | null
  fecha_entrega_cliente?: string | null
}

function normalizarFechaEntregaCliente(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const fecha = raw.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null
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
  let sesion = sesionRes.data

  // Hotfix PE: regenerar descuentos_lote.facturas si faltan / desalineadas (botón Editar descuentos).
  if (sesion && items.length > 0) {
    try {
      const { facturas } = await asegurarFacturasDescuentosLote(sb, session.id_usuario)
      const lote = (sesion.descuentos_lote as Record<string, unknown> | null) ?? {}
      sesion = { ...sesion, descuentos_lote: { ...lote, facturas } }
    } catch (err) {
      console.warn('[carrito/sesion] asegurarFacturasDescuentosLote falló:', err)
    }
  }

  // Si hay items, enriquecer con vista stock (MIG-083). Fallo no debe bloquear la sesión.
  if (items.length > 0) {
    try {
      const stockMap = await fetchCarritoStockByDetIds(sb, items.map(i => i.det_id))
      items.forEach(item => {
        const stock = stockMap.get(item.det_id)
        if (stock) {
          item.v_stock_rimec = [stock]
        }
      })
    } catch (err) {
      console.warn('[carrito/sesion] enrich stock falló — respuesta degradada:', err)
    }
  }

  return NextResponse.json({
    sesion,
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
        cod_oper_carlos: body.cod_oper_carlos ?? null,
        lista_precio_id: body.lista_precio_id ?? 1,
        descuentos: body.descuentos ?? [0, 0, 0, 0],
        descuentos_lote: body.descuentos_lote ?? {},
        observacion: body.observacion?.trim()?.slice(0, 2000) ?? null,
        fecha_entrega_cliente: normalizarFechaEntregaCliente(body.fecha_entrega_cliente),
        actualizada_en: new Date().toISOString(),
      },
      { onConflict: 'id_usuario' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: bitErr } = await sb.from('bitacora_acceso_web').insert({
    id_usuario: session.id_usuario,
    app: 'rimec-web',
    evento: 'VENTA_ACTIVA',
    detalle: {
      cliente_id: body.cliente_id,
      cliente_nombre: body.cliente_nombre,
    },
  })
  if (bitErr) console.error('[carrito/sesion] VENTA_ACTIVA:', bitErr.message)

  return NextResponse.json({ sesion: data })
}

/** PATCH — solo observación / fecha entrega cliente (PE ↔ Logística OK · MIG-175) */
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const body = (await req.json()) as LogisticaPePatchBody
  const patch: Record<string, string | null> = { actualizada_en: new Date().toISOString() }

  if (body.observacion !== undefined) {
    const obs = typeof body.observacion === 'string' ? body.observacion.trim().slice(0, 2000) : ''
    patch.observacion = obs.length > 0 ? obs : null
  }
  if (body.fecha_entrega_cliente !== undefined) {
    patch.fecha_entrega_cliente = normalizarFechaEntregaCliente(body.fecha_entrega_cliente)
  }

  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('carrito_sesion')
    .update(patch)
    .eq('id_usuario', session.id_usuario)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  return NextResponse.json({ sesion: data })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'no-session' }, { status: 401 })

  const sb = getSupabaseAdmin()
  const { error: errItems } = await sb
    .from('carrito_item')
    .delete()
    .eq('id_usuario', session.id_usuario)
  if (errItems) {
    console.error('[carrito/sesion DELETE] items:', errItems.message)
    return NextResponse.json(
      { error: `No se pudieron borrar ítems: ${errItems.message}` },
      { status: 500 },
    )
  }

  const { error } = await sb.from('carrito_sesion').delete().eq('id_usuario', session.id_usuario)
  if (error) {
    console.error('[carrito/sesion DELETE] sesion:', error.message)
    return NextResponse.json(
      { error: `Ítems borrados pero sesión falló: ${error.message}` },
      { status: 500 },
    )
  }

  const { error: bitErr } = await sb.from('bitacora_acceso_web').insert({
    id_usuario: session.id_usuario,
    app: 'rimec-web',
    evento: 'VENTA_CERRADA',
    detalle: { via: 'delete-sesion' },
  })
  if (bitErr) console.error('[carrito/sesion] VENTA_CERRADA:', bitErr.message)

  return NextResponse.json({ ok: true })
}
