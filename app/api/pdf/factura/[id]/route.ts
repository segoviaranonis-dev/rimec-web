/**
 * API: /api/pdf/factura/[id]
 * GET: Genera y devuelve PDF de Factura Interna
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseUrl, resolveSupabaseAnonKey } from '@/lib/supabaseEnv'
import { generarPDFFactura } from '@/lib/pdfGenerator'

const supabaseUrl = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const serviceKey = resolveSupabaseAnonKey(process.env.SUPABASE_SERVICE_ROLE_KEY)

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Autenticación requerida
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const fiId = parseInt(id)

    if (isNaN(fiId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    // Verificar que la FI pertenece al usuario y está confirmada
    const { data: fi, error } = await supabase
      .from('factura_interna')
      .select('id, vendedor_id, estado, nro_factura')
      .eq('id', fiId)
      .single()

    if (error || !fi) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Verificar permisos: solo el vendedor dueño puede ver su FI
    if (fi.vendedor_id !== session.id_usuario) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver esta factura' },
        { status: 403 }
      )
    }

    // Solo PDFs de facturas confirmadas
    if (fi.estado !== 'CONFIRMADA') {
      return NextResponse.json(
        { error: 'Solo se puede generar PDF de facturas confirmadas' },
        { status: 400 }
      )
    }

    // Obtener datos de la FI (sin JOINs complejos)
    const { data: fiCompleta, error: fiError } = await supabase
      .from('factura_interna')
      .select('*')
      .eq('id', fiId)
      .single()

    if (fiError || !fiCompleta) {
      console.error('[PDF] Error obteniendo FI:', fiError)
      return NextResponse.json(
        { error: 'Error obteniendo datos de factura' },
        { status: 500 }
      )
    }

    // Obtener datos relacionados (de forma segura)
    const { data: cliente } = await supabase
      .from('cliente_v2')
      .select('descp_cliente')
      .eq('id_cliente', fiCompleta.cliente_id)
      .single()

    const { data: vendedor } = await supabase
      .from('usuario_v2')
      .select('nombre')
      .eq('id_usuario', fiCompleta.vendedor_id)
      .single()

    const { data: plazo } = await supabase
      .from('plazo_venta')
      .select('nombre')
      .eq('id_plazo', fiCompleta.plazo_id)
      .single()

    const { data: pp } = await supabase
      .from('pedido_proveedor')
      .select('numero_registro, numero_proforma')
      .eq('id', fiCompleta.pp_id)
      .single()

    const { data: quincena } = await supabase
      .from('quincena_arribo')
      .select('descripcion')
      .eq('id', fiCompleta.quincena_arribo_id)
      .single()

    // Obtener items de la FI
    const { data: items } = await supabase
      .from('factura_interna_detalle')
      .select('*')
      .eq('factura_id', fiId)
      .order('id')

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Factura sin items' },
        { status: 400 }
      )
    }

    // Parsear snapshots y preparar items para PDF
    const itemsParaPDF = items.map((item: any) => {
      let snapshot: any = {}
      try {
        if (typeof item.linea_snapshot === 'string') {
          snapshot = JSON.parse(item.linea_snapshot)
        } else if (typeof item.linea_snapshot === 'object') {
          snapshot = item.linea_snapshot
        }
      } catch (e) {
        console.error('[PDF] Error parseando snapshot:', e)
      }

      return {
        linea_codigo: snapshot.linea_codigo || '?',
        ref_codigo: snapshot.ref_codigo || '?',
        color_nombre: snapshot.color_nombre || '',
        gradas_fmt: snapshot.gradas_fmt || '',
        cajas: item.cajas || 0,
        pares: item.pares || 0,
        precio_unit: item.precio_unit || 0,
        precio_neto: item.precio_neto || 0,
        subtotal: item.subtotal || 0,
      }
    })

    // Preparar datos de la FI
    const fiData = {
      nro_factura: fiCompleta.nro_factura,
      cliente_nombre: cliente?.descp_cliente || 'Sin cliente',
      vendedor_nombre: vendedor?.nombre || 'Sin vendedor',
      quincena_llegada: quincena?.descripcion || 'A confirmar',
      pp_nro: pp?.numero_registro || 'N/A',
      proforma: pp?.numero_proforma,
      created_at: fiCompleta.created_at,
      lista_precio: `Lista ${fiCompleta.lista_precio_id}`,
      plazo: plazo?.nombre || 'N/A',
      descuento_1: fiCompleta.descuento_1,
      descuento_2: fiCompleta.descuento_2,
      descuento_3: fiCompleta.descuento_3,
      descuento_4: fiCompleta.descuento_4,
      marca: fiCompleta.marca,
      caso: fiCompleta.caso,
      total_pares: fiCompleta.total_pares,
      total_monto: fiCompleta.total_monto,
    }

    // Generar PDF
    const pdfBuffer = await generarPDFFactura(fiData, itemsParaPDF)

    // Devolver PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="FI_${fi.nro_factura}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (error) {
    console.error('[PDF] Exception:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
