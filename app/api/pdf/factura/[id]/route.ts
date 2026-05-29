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

    // Obtener ppd_ids únicos para cargar materiales
    const ppdIds = items
      .map(item => item.ppd_id)
      .filter((id): id is number => id != null)

    // Cargar materiales de todos los ppd_ids en una sola query
    const materialesMap = new Map<number, string>()
    if (ppdIds.length > 0) {
      const { data: ppdData } = await supabase
        .from('pedido_proveedor_det')
        .select('id, descp_material')
        .in('id', ppdIds)

      if (ppdData) {
        ppdData.forEach((ppd: any) => {
          materialesMap.set(ppd.id, ppd.descp_material || '')
        })
      }
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

      // Material: prioridad snapshot, fallback a descp_material de ppd
      const materialNombre = snapshot.material_nombre ||
                            (item.ppd_id ? materialesMap.get(item.ppd_id) : '') ||
                            ''

      return {
        linea_codigo: snapshot.linea_codigo || '?',
        ref_codigo: snapshot.ref_codigo || '?',
        color_nombre: snapshot.color_nombre || '',
        material_nombre: materialNombre,
        imagen_url: snapshot.imagen_url || '',
        gradas_fmt: snapshot.gradas_fmt || '',
        cajas: item.cajas || 0,
        pares: item.pares || 0,
        precio_unit: item.precio_unit || 0,
        precio_neto: item.precio_neto || 0,
        subtotal: item.subtotal || 0,
      }
    })

    // Validar datos críticos
    if (!fiCompleta.nro_factura) {
      console.error('[PDF] Falta nro_factura')
      return NextResponse.json(
        { error: 'Datos incompletos: falta número de factura' },
        { status: 500 }
      )
    }

    if (!fiCompleta.created_at) {
      console.error('[PDF] Falta created_at')
      return NextResponse.json(
        { error: 'Datos incompletos: falta fecha' },
        { status: 500 }
      )
    }

    if (typeof fiCompleta.total_pares !== 'number' || typeof fiCompleta.total_monto !== 'number') {
      console.error('[PDF] Totales inválidos:', fiCompleta.total_pares, fiCompleta.total_monto)
      return NextResponse.json(
        { error: 'Datos incompletos: totales inválidos' },
        { status: 500 }
      )
    }

    // Preparar datos de la FI
    const fiData = {
      nro_factura: fiCompleta.nro_factura,
      cliente_nombre: cliente?.descp_cliente || 'Sin cliente',
      vendedor_nombre: vendedor?.nombre || 'Sin vendedor',
      quincena_llegada: quincena?.descripcion || 'A confirmar',
      pp_nro: pp?.numero_registro || 'N/A',
      proforma: pp?.numero_proforma || undefined,
      created_at: fiCompleta.created_at,
      lista_precio: `Lista ${fiCompleta.lista_precio_id}`,
      plazo: plazo?.nombre || 'N/A',
      descuento_1: fiCompleta.descuento_1 || 0,
      descuento_2: fiCompleta.descuento_2 || 0,
      descuento_3: fiCompleta.descuento_3 || 0,
      descuento_4: fiCompleta.descuento_4 || 0,
      marca: fiCompleta.marca || 'N/A',
      caso: fiCompleta.caso || '',
      total_pares: fiCompleta.total_pares,
      total_monto: fiCompleta.total_monto,
    }

    // Generar PDF
    console.log('[PDF] Generando PDF para FI:', fiData.nro_factura)
    console.log('[PDF] Items count:', itemsParaPDF.length)
    console.log('[PDF] FI Data:', JSON.stringify(fiData, null, 2))

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generarPDFFactura(fiData, itemsParaPDF)
      console.log('[PDF] PDF generado exitosamente, size:', pdfBuffer.length)
    } catch (pdfError) {
      console.error('[PDF] Error en generación PDF:', pdfError)
      return NextResponse.json(
        {
          error: 'Error generando PDF',
          details: pdfError instanceof Error ? pdfError.message : String(pdfError)
        },
        { status: 500 }
      )
    }

    // Devolver PDF (convertir Buffer a Uint8Array para Next.js 16)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="FI_${fi.nro_factura}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (error) {
    console.error('[PDF] Exception general:', error)
    console.error('[PDF] Stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
