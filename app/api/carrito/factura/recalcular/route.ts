/**
 * POST /api/carrito/factura/recalcular
 * Recalcula precios de items de una factura según lista_precio_id + descuentos
 * Lee v_stock_rimec columna correcta (lpn/lpc02/lpc03/lpc04)
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'rimec-web-default-secret-change-in-production'
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('rimec_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { payload } = await jwtVerify(token, SECRET)
    const id_usuario = payload.id_usuario as number

    const { pp_id, marca, caso } = await req.json()

    if (!pp_id || !marca || !caso) {
      return NextResponse.json({ error: 'pp_id, marca y caso obligatorios' }, { status: 400 })
    }

    // Leer configuración de factura
    const { data: sesion } = await supabase
      .from('carrito_sesion')
      .select('descuentos_lote')
      .eq('id_usuario', id_usuario)
      .single()

    if (!sesion?.descuentos_lote?.facturas) {
      return NextResponse.json({ error: 'Sin facturas en sesión' }, { status: 404 })
    }

    const factura = sesion.descuentos_lote.facturas.find(
      (f: any) => f.pp_id === pp_id && f.marca === marca && f.caso === caso
    )

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const { lista_precio_id, descuentos } = factura

    // Obtener items de esta factura
    const { data: items } = await supabase
      .from('carrito_item')
      .select('det_id, pp_id, marca_snapshot, caso_snapshot')
      .eq('id_usuario', id_usuario)
      .eq('pp_id', pp_id)
      .eq('marca_snapshot', marca)
      .eq('caso_snapshot', caso)

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Sin items en factura' }, { status: 404 })
    }

    const det_ids = items.map((i) => i.det_id)

    // Consultar v_stock_rimec para precios
    const columna_precio = lista_precio_id === 1 ? 'lpn' : `lpc0${lista_precio_id}`

    const { data: precios } = await supabase
      .from('v_stock_rimec')
      .select(`det_id, ${columna_precio}`)
      .in('det_id', det_ids)

    if (!precios) {
      return NextResponse.json({ error: 'Error consultando precios' }, { status: 500 })
    }

    // Mapa det_id -> precio_base
    const preciosMap = new Map(precios.map((p: any) => [p.det_id, p[columna_precio]]))

    // Aplicar descuentos
    const aplicarDescuentos = (base: number, desc: number[]) => {
      let precio = base
      for (const d of desc) {
        if (d > 0) precio = precio * (1 - d / 100)
      }
      return Math.round(precio)
    }

    // Actualizar precio_snapshot de cada item
    for (const item of items) {
      const precio_base = preciosMap.get(item.det_id)
      if (!precio_base) continue

      const precio_neto = aplicarDescuentos(precio_base, descuentos)

      await supabase
        .from('carrito_item')
        .update({ precio_snapshot: precio_neto })
        .eq('id_usuario', id_usuario)
        .eq('det_id', item.det_id)
    }

    // Marcar pre_autorizado = true
    const descuentosLote = sesion.descuentos_lote
    const facturaIndex = descuentosLote.facturas.findIndex(
      (f: any) => f.pp_id === pp_id && f.marca === marca && f.caso === caso
    )
    if (facturaIndex !== -1) {
      descuentosLote.facturas[facturaIndex].pre_autorizado = true
    }

    await supabase
      .from('carrito_sesion')
      .update({
        descuentos_lote: descuentosLote,
        actualizada_en: new Date().toISOString(),
      })
      .eq('id_usuario', id_usuario)

    return NextResponse.json({
      ok: true,
      items_actualizados: items.length,
      lista_aplicada: lista_precio_id,
      descuentos_aplicados: descuentos,
    })
  } catch (err) {
    console.error('Error POST /api/carrito/factura/recalcular:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
