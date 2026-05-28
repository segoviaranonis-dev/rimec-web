/**
 * API: /api/pdf/factura/[id]
 * GET: Genera y devuelve PDF de Factura Interna
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseUrl, resolveSupabaseAnonKey } from '@/lib/supabaseEnv'
import { spawn } from 'child_process'
import path from 'path'

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

    // Generar PDF llamando al script Python
    const controlCentralPath = path.resolve(process.cwd(), '..', 'control_central')
    const scriptPath = path.join(controlCentralPath, 'generar_pdf_cli.py')
    const pythonPath = path.join(controlCentralPath, 'venv', 'Scripts', 'python.exe')

    // Verificar si existe el script
    const fs = require('fs')
    if (!fs.existsSync(scriptPath)) {
      console.error('[PDF] Script no encontrado:', scriptPath)
      return NextResponse.json(
        { error: 'Generador de PDF no disponible' },
        { status: 500 }
      )
    }

    return new Promise<NextResponse>((resolve) => {
      const chunks: Buffer[] = []
      const errorChunks: Buffer[] = []

      const pythonProcess = spawn(pythonPath, [scriptPath, String(fiId)], {
        cwd: controlCentralPath,
      })

      pythonProcess.stdout.on('data', (data: Buffer) => {
        chunks.push(data)
      })

      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorChunks.push(data)
      })

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          const errorMsg = Buffer.concat(errorChunks).toString('utf-8')
          console.error('[PDF] Error generando PDF:', errorMsg)
          resolve(
            NextResponse.json(
              { error: 'Error al generar PDF', details: errorMsg },
              { status: 500 }
            )
          )
          return
        }

        const pdfBuffer = Buffer.concat(chunks)

        if (pdfBuffer.length === 0) {
          resolve(
            NextResponse.json(
              { error: 'PDF generado está vacío' },
              { status: 500 }
            )
          )
          return
        }

        // Devolver PDF con headers apropiados
        resolve(
          new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="FI_${fi.nro_factura}.pdf"`,
              'Content-Length': String(pdfBuffer.length),
            },
          })
        )
      })

      pythonProcess.on('error', (err) => {
        console.error('[PDF] Error ejecutando Python:', err)
        resolve(
          NextResponse.json(
            { error: 'Error ejecutando generador de PDF' },
            { status: 500 }
          )
        )
      })
    })
  } catch (error) {
    console.error('[PDF] Exception:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
