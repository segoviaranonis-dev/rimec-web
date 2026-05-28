/**
 * Generador de PDF para Facturas Internas
 * Compatible con Vercel (Node.js serverless)
 */

import PDFDocument from 'pdfkit'

interface FIData {
  nro_factura: string
  cliente_nombre: string
  vendedor_nombre: string
  quincena_llegada: string
  pp_nro: string
  proforma?: string
  created_at: string
  lista_precio: string
  plazo: string
  descuento_1?: number
  descuento_2?: number
  descuento_3?: number
  descuento_4?: number
  marca?: string
  caso?: string
  total_pares: number
  total_monto: number
}

interface FIItem {
  linea_codigo: string
  ref_codigo: string
  color_nombre: string
  gradas_fmt: string
  cajas: number
  pares: number
  precio_unit: number
  precio_neto: number
  subtotal: number
}

export async function generarPDFFactura(
  fiData: FIData,
  items: FIItem[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      // Capturar chunks del PDF
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // ========================================
      // HEADER
      // ========================================
      doc
        .fontSize(20)
        .fillColor('#1B3A6B')
        .text('NEXUS CORE', { align: 'center' })
        .moveDown(0.3)

      doc
        .fontSize(11)
        .fillColor('#D4AF37')
        .text('RIMEC Business Intelligence', { align: 'center' })
        .moveDown(1)

      // Línea dorada
      doc
        .strokeColor('#D4AF37')
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1)

      // Cliente (destacado)
      doc
        .fontSize(15)
        .fillColor('white')
        .rect(50, doc.y, 495, 30)
        .fill('#1B3A6B')
        .fillColor('white')
        .text(fiData.cliente_nombre, 50, doc.y + 8, {
          width: 495,
          align: 'center',
        })
        .moveDown(2)

      // Info principal
      doc.fontSize(12).fillColor('#D4AF37')
      doc.text(`Llegada: ${fiData.quincena_llegada}`, 50)
      doc.fontSize(10).fillColor('#64748B')
      doc.text(`Vendedora: ${fiData.vendedor_nombre}`, 50).moveDown(0.5)

      // Info complementaria
      const fecha = new Date(fiData.created_at).toLocaleDateString('es-PY')
      const ppDisplay = fiData.proforma
        ? `${fiData.pp_nro} (${fiData.proforma})`
        : fiData.pp_nro

      doc.fontSize(9).fillColor('#475569')
      doc.text(`Nro. FI: ${fiData.nro_factura}`, 50)
      doc.text(`PP: ${ppDisplay}`, 300, doc.y - 10)
      doc.text(`Marca: ${fiData.marca || 'N/A'}`, 50)
      doc.text(`Plazo: ${fiData.plazo}`, 300, doc.y - 10)
      doc.text(`Estado: RESERVADA`, 50)
      doc.text(`Fecha: ${fecha}`, 300, doc.y - 10)

      // Descuentos
      const descs = [
        fiData.descuento_1,
        fiData.descuento_2,
        fiData.descuento_3,
        fiData.descuento_4,
      ]
        .filter((d) => d && d > 0)
        .map((d) => `${d}%`)
        .join(' / ')

      doc.text(`Descuentos: ${descs || '0%'}`, 50).moveDown(1)

      // ========================================
      // TABLA DE ITEMS
      // ========================================
      const tableTop = doc.y + 10
      const colX = {
        producto: 50,
        gradas: 180,
        cajas: 280,
        pares: 330,
        precioSin: 380,
        precioCon: 460,
        subtotal: 520,
      }

      // Header de tabla
      doc
        .rect(50, tableTop, 530, 25)
        .fill('#1B3A6B')
        .fontSize(8)
        .fillColor('white')

      doc.text('Producto', colX.producto + 5, tableTop + 8)
      doc.text('Gradas', colX.gradas + 5, tableTop + 8)
      doc.text('Cajas', colX.cajas + 5, tableTop + 8)
      doc.text('Pares', colX.pares + 5, tableTop + 8)
      doc.text('Sin Desc', colX.precioSin + 5, tableTop + 8)
      doc.text('Con Desc', colX.precioCon + 5, tableTop + 8)
      doc.text('Subtotal', colX.subtotal + 5, tableTop + 8)

      // Items
      let currentY = tableTop + 30
      doc.fillColor('#1E293B').fontSize(8)

      items.forEach((item, idx) => {
        // Verificar si necesitamos nueva página
        if (currentY > 700) {
          doc.addPage()
          currentY = 50
        }

        // Alternar color de fondo
        if (idx % 2 === 0) {
          doc.rect(50, currentY - 3, 530, 20).fill('#F8FAFC')
        }

        doc.fillColor('#1E293B')

        // Producto
        const producto = `${item.linea_codigo}-${item.ref_codigo}`
        doc.text(producto, colX.producto + 5, currentY, { width: 120 })
        doc.fontSize(7).fillColor('#64748B')
        doc.text(item.color_nombre.substring(0, 25), colX.producto + 5, currentY + 10)
        doc.fontSize(8).fillColor('#1E293B')

        // Resto de columnas
        doc.text(item.gradas_fmt, colX.gradas + 5, currentY)
        doc.text(String(item.cajas), colX.cajas + 5, currentY)
        doc.text(String(item.pares), colX.pares + 5, currentY)
        doc.text(
          `Gs. ${item.precio_unit.toLocaleString('es-PY')}`,
          colX.precioSin + 5,
          currentY,
          { width: 70 }
        )
        doc.text(
          `Gs. ${item.precio_neto.toLocaleString('es-PY')}`,
          colX.precioCon + 5,
          currentY,
          { width: 70 }
        )
        doc.text(
          `Gs. ${item.subtotal.toLocaleString('es-PY')}`,
          colX.subtotal + 5,
          currentY,
          { width: 60 }
        )

        currentY += 25
      })

      // ========================================
      // TOTALES
      // ========================================
      currentY += 10

      doc
        .rect(50, currentY, 530, 40)
        .fill('#F1F5F9')
        .fontSize(10)
        .fillColor('#1E293B')

      doc.text(
        `Total Pares: ${fiData.total_pares.toLocaleString('es-PY')}`,
        colX.producto + 10,
        currentY + 12
      )

      doc
        .fontSize(14)
        .fillColor('#1B3A6B')
        .text(
          `TOTAL NETO: Gs. ${fiData.total_monto.toLocaleString('es-PY')}`,
          colX.precioCon,
          currentY + 10,
          { width: 150, align: 'right' }
        )

      // Footer
      doc
        .fontSize(8)
        .fillColor('#94A3B8')
        .text(
          'Documento de uso interno - Sin valor legal',
          50,
          750,
          { width: 495, align: 'center' }
        )

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
