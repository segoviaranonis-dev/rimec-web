/**
 * MIG-083: PATCH descuentos de Factura Interna específica (Marca × Caso)
 * Invalida pre_autorizado → requiere "Ver Totales" para habilitar "Confirmar"
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

interface FacturaConfig {
  pp_id: number
  marca: string
  caso: string
  lista_precio_id?: number
  descuentos?: number[]
  pre_autorizado?: boolean
}

export async function PATCH(req: NextRequest) {
  try {
    // Autenticación
    const cookieStore = await cookies()
    const token = cookieStore.get('rimec_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { payload } = await jwtVerify(token, SECRET)
    const id_usuario = payload.id_usuario as number

    // Body
    const body: FacturaConfig = await req.json()
    const { pp_id, marca, caso, lista_precio_id, descuentos, pre_autorizado } = body

    if (!pp_id || !marca || !caso) {
      return NextResponse.json(
        { error: 'pp_id, marca y caso son obligatorios' },
        { status: 400 }
      )
    }

    // Leer descuentos_lote actual
    const { data: sesion, error: sesionErr } = await supabase
      .from('carrito_sesion')
      .select('descuentos_lote')
      .eq('id_usuario', id_usuario)
      .single()

    if (sesionErr || !sesion) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }

    const descuentosLote = sesion.descuentos_lote as { facturas: FacturaConfig[] }
    if (!descuentosLote?.facturas) {
      return NextResponse.json({ error: 'Sin facturas en sesión' }, { status: 400 })
    }

    // Buscar factura específica
    const facturaIndex = descuentosLote.facturas.findIndex(
      (f) => f.pp_id === pp_id && f.marca === marca && f.caso === caso
    )

    if (facturaIndex === -1) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Actualizar factura
    const facturaActualizada = {
      ...descuentosLote.facturas[facturaIndex],
      ...(lista_precio_id !== undefined && { lista_precio_id }),
      ...(descuentos !== undefined && { descuentos }),
      ...(pre_autorizado !== undefined && { pre_autorizado }),
    }

    descuentosLote.facturas[facturaIndex] = facturaActualizada

    // Guardar en BD
    const { error: updateErr } = await supabase
      .from('carrito_sesion')
      .update({
        descuentos_lote: descuentosLote,
        actualizada_en: new Date().toISOString(),
        validada_en: null,
        validacion_token: null,
        validacion_estado: null,
      })
      .eq('id_usuario', id_usuario)

    if (updateErr) {
      console.error('Error actualizando factura:', updateErr)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, factura: facturaActualizada })
  } catch (err) {
    console.error('Error PATCH /api/carrito/factura:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
