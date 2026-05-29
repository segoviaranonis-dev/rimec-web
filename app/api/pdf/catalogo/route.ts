import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rateLimit'
import { generarPDFCatalogo, type CatalogoProducto } from '@/lib/pdfCatalogoGenerator'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticación
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // 2. Rate Limiting
    const identifier = `pdf-catalogo:${session.id_usuario}`
    const rateLimit = await checkRateLimit(identifier)

    if (!rateLimit.success) {
      console.warn('[PDF Catálogo] Rate limit excedido para usuario:', session.id_usuario)
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Demasiadas solicitudes. Por favor espera un momento antes de generar otro PDF.',
          retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.reset),
          },
        }
      )
    }

    // 3. Parsear body
    let body, productos, catalogoData
    try {
      body = await req.json()
      productos = body.productos
      catalogoData = body.catalogoData
    } catch (parseError) {
      console.error('[API Catálogo] Error parseando JSON:', parseError)
      return NextResponse.json(
        {
          error: 'Error parseando el request',
          message: parseError instanceof Error ? parseError.message : 'JSON inválido'
        },
        { status: 400 }
      )
    }

    // Log de debugging
    console.log('[API Catálogo] Request recibido')
    console.log('[API Catálogo] Productos recibidos:', productos?.length || 0)
    console.log('[API Catálogo] CatalogoData:', catalogoData)

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      console.error('[API Catálogo] Error: No hay productos')
      return NextResponse.json(
        { error: 'No se recibieron productos para el catálogo' },
        { status: 400 }
      )
    }

    if (!catalogoData || !catalogoData.cliente_nombre) {
      console.error('[API Catálogo] Error: Faltan datos del catálogo')
      return NextResponse.json(
        { error: 'Faltan datos del catálogo (cliente, vendedor, lista)' },
        { status: 400 }
      )
    }

    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Catálogo] Generando PDF para:', catalogoData.cliente_nombre)
      console.log('[API Catálogo] Productos:', productos.length)
    }

    // 4. Generar PDF
    console.log('[API Catálogo] Iniciando generación de PDF...')
    let pdfBuffer
    try {
      pdfBuffer = await generarPDFCatalogo(catalogoData, productos as CatalogoProducto[])
      console.log('[API Catálogo] PDF generado exitosamente')
    } catch (pdfError) {
      console.error('[API Catálogo] Error en generarPDFCatalogo:', pdfError)
      return NextResponse.json(
        {
          error: 'Error al generar el PDF',
          message: pdfError instanceof Error ? pdfError.message : String(pdfError),
          stack: pdfError instanceof Error ? pdfError.stack : undefined
        },
        { status: 500 }
      )
    }

    // 5. Responder con PDF
    const nombreArchivo = `catalogo-${catalogoData.cliente_nombre.replace(/\s+/g, '_')}-${Date.now()}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[API Catálogo] Error generando PDF:', error)
    console.error('[API Catálogo] Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('[API Catálogo] Error message:', error instanceof Error ? error.message : String(error))

    return NextResponse.json(
      {
        error: 'Error interno al generar el PDF',
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
