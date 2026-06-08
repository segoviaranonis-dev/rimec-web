/**
 * Generador de PDF para Facturas Internas
 * Compatible con Vercel (serverless) usando pdf-lib
 *
 * HOTFIX 2026-06-07: Corregido problema de imágenes faltantes
 * - Cambio a fetchPdfImage con retry automático
 * - Timeout aumentado: 5s → 20s
 * - Pre-carga paralela de imágenes (no secuencial)
 * - Usa thumbnails para velocidad
 */

import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
import { fetchPdfImage, getThumbnailUrl } from './pdfImageUtils'

interface FIData {
  nro_factura: string
  cliente_codigo: number
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
  material_nombre?: string
  imagen_url?: string
  gradas_fmt: string
  cajas: number
  pares: number
  precio_unit: number
  precio_neto: number
  subtotal: number
}

// Colores Nexus
const AZUL_NEXUS = rgb(0.106, 0.227, 0.42) // #1B3A6B
const DORADO_NEXUS = rgb(0.831, 0.686, 0.216) // #D4AF37
const GRIS_CLARO = rgb(0.973, 0.980, 0.988) // #F8FAFC
const GRIS_TEXTO = rgb(0.118, 0.161, 0.235) // #1E293B

/**
 * Pre-carga todas las imágenes en paralelo (no secuencial)
 * Evita timeout de función Vercel cargando múltiples imágenes a la vez
 *
 * @param pdfDoc - Documento PDF donde embedir imágenes
 * @param items - Items con URLs de imágenes
 * @param maxConcurrency - Máximo de imágenes a cargar en paralelo (default: 5)
 * @returns Map de URL → PDFImage embebida
 */
async function preloadImages(
  pdfDoc: PDFDocument,
  items: FIItem[],
  maxConcurrency: number = 5
): Promise<Map<string, PDFImage>> {
  const imageMap = new Map<string, PDFImage>()
  const urlsUnicas = Array.from(new Set(items.map(i => i.imagen_url).filter(Boolean))) as string[]

  if (urlsUnicas.length === 0) {
    console.log('[PDF] No hay imágenes para cargar')
    return imageMap
  }

  console.log(`[PDF] Pre-cargando ${urlsUnicas.length} imágenes únicas en paralelo (max ${maxConcurrency})`)
  const startTime = Date.now()
  let cargadas = 0
  let fallidas = 0

  // Cargar en batches paralelos con límite de concurrencia
  for (let i = 0; i < urlsUnicas.length; i += maxConcurrency) {
    const batch = urlsUnicas.slice(i, i + maxConcurrency)
    const batchNum = Math.floor(i / maxConcurrency) + 1
    const totalBatches = Math.ceil(urlsUnicas.length / maxConcurrency)

    console.log(`[PDF] Batch ${batchNum}/${totalBatches}: cargando ${batch.length} imágenes...`)

    await Promise.all(
      batch.map(async (url) => {
        try {
          // Usar fetchPdfImage con retry automático y thumbnail
          const imgBytes = await fetchPdfImage(url, {
            timeout: 20000,  // 20s por imagen (antes 5s)
            retries: 3,      // 3 reintentos
            useThumbnail: true,  // Intentar thumbnail primero
          })

          if (!imgBytes) {
            console.warn(`[PDF] ✗ Imagen no disponible: ${url.substring(0, 60)}...`)
            fallidas++
            return
          }

          // Embedir en PDF
          const imgType = url.toLowerCase()
          let image: PDFImage | null = null

          if (imgType.endsWith('.png')) {
            image = await pdfDoc.embedPng(imgBytes)
          } else if (imgType.endsWith('.jpg') || imgType.endsWith('.jpeg')) {
            image = await pdfDoc.embedJpg(imgBytes)
          }

          if (image) {
            imageMap.set(url, image)
            cargadas++
          } else {
            console.warn(`[PDF] ✗ Formato no soportado: ${url.substring(0, 60)}...`)
            fallidas++
          }
        } catch (error) {
          console.error(`[PDF] ✗ Error embebiendo imagen:`, error instanceof Error ? error.message : error)
          fallidas++
        }
      })
    )
  }

  const duracionMs = Date.now() - startTime
  console.log(`[PDF] Pre-carga completada en ${duracionMs}ms`)
  console.log(`[PDF]   ✓ Cargadas: ${cargadas}/${urlsUnicas.length}`)
  console.log(`[PDF]   ✗ Fallidas: ${fallidas}/${urlsUnicas.length}`)

  if (fallidas > 0) {
    console.warn(`[PDF] ⚠️  ${fallidas} imágenes no se pudieron cargar - aparecerán sin foto en PDF`)
  }

  return imageMap
}

export async function generarPDFFactura(
  fiData: FIData,
  items: FIItem[]
): Promise<Buffer> {
  try {
    // Validar datos de entrada
    if (!fiData || !items || items.length === 0) {
      throw new Error('Datos de entrada inválidos')
    }

    console.log('[PDF Gen] Iniciando generación con pdf-lib...')
    console.log('[PDF Gen] FI:', fiData.nro_factura, 'Items:', items.length)

    // Crear documento
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4: 595x842 pts
    const { width, height } = page.getSize()

    // Cargar fuentes
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // PRE-CARGAR TODAS LAS IMÁGENES EN PARALELO (HOTFIX 2026-06-07)
    // Esto evita timeout de función Vercel y carga imágenes más rápido
    console.log('[PDF Gen] HOTFIX: Pre-cargando imágenes en paralelo...')
    const imageMap = await preloadImages(pdfDoc, items, 5)
    console.log('[PDF Gen] HOTFIX: Pre-carga completada, continuando con PDF...')

    let y = height - 50 // Posición vertical inicial

    // ========================================
    // HEADER
    // ========================================
    page.drawText('NEXUS CORE', {
      x: width / 2 - 70,
      y,
      size: 20,
      font: fontBold,
      color: AZUL_NEXUS,
    })
    y -= 20

    page.drawText('RIMEC Business Intelligence', {
      x: width / 2 - 85,
      y,
      size: 11,
      font: fontRegular,
      color: DORADO_NEXUS,
    })
    y -= 25

    // Línea dorada
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 2,
      color: DORADO_NEXUS,
    })
    y -= 25

    // Cliente (destacado)
    page.drawRectangle({
      x: 50,
      y: y - 25,
      width: width - 100,
      height: 30,
      color: AZUL_NEXUS,
    })
    page.drawText(`${fiData.cliente_nombre} (${fiData.cliente_codigo})`, {
      x: 60,
      y: y - 17,
      size: 15,
      font: fontBold,
      color: rgb(1, 1, 1),
    })
    y -= 45

    // Info principal
    page.drawText(`Llegada: ${fiData.quincena_llegada}`, {
      x: 50,
      y,
      size: 12,
      font: fontBold,
      color: DORADO_NEXUS,
    })
    y -= 15

    page.drawText(`Vendedora: ${fiData.vendedor_nombre}`, {
      x: 50,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.392, 0.455, 0.545),
    })
    y -= 25

    // Disclaimer amarillo (como en Streamlit)
    const disclaimerBg = rgb(0.996, 0.953, 0.780) // #FEF3C7
    const disclaimerText = rgb(0.573, 0.251, 0.055) // #92400E

    page.drawRectangle({
      x: 50,
      y: y - 28,
      width: width - 100,
      height: 32,
      color: disclaimerBg,
    })

    page.drawText('FACTURA PROVISORIA INTERNA (SIN VALOR LEGAL)', {
      x: 60,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: disclaimerText,
    })

    page.drawText('Este documento es para uso interno y no genera obligaciones fiscales ni comerciales.', {
      x: 60,
      y: y - 22,
      size: 7,
      font: fontRegular,
      color: disclaimerText,
    })

    y -= 48

    // Info complementaria
    const fecha = new Date(fiData.created_at).toLocaleDateString('es-PY')
    const ppDisplay = fiData.proforma
      ? `${fiData.pp_nro} (${fiData.proforma})`
      : fiData.pp_nro

    page.drawText(`Nro. FI: ${fiData.nro_factura}`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.278, 0.333, 0.412),
    })
    page.drawText(`PP: ${ppDisplay}`, {
      x: 300,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.278, 0.333, 0.412),
    })
    y -= 12

    page.drawText(`Marca: ${fiData.marca || 'N/A'}`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.278, 0.333, 0.412),
    })
    page.drawText(`Plazo: ${fiData.plazo}`, {
      x: 300,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.278, 0.333, 0.412),
    })
    y -= 12

    page.drawText(`Estado: RESERVADA`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.278, 0.333, 0.412),
    })
    page.drawText(`Fecha: ${fecha}`, {
      x: 300,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.278, 0.333, 0.412),
    })
    y -= 12

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

    page.drawText(`Descuentos: ${descs || '0%'}`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.278, 0.333, 0.412),
    })
    y -= 25

    // ========================================
    // TABLA DE ITEMS (con imagen y material)
    // ========================================
    const colX = {
      imagen: 55,
      producto: 75,   // Desplazado a la izquierda (90 → 75)
      gradas: 200,    // Desplazado a la izquierda (215 → 200)
      cajas: 325,     // Desplazado (340 → 325)
      pares: 365,     // Desplazado (380 → 365)
      precioSin: 405, // Desplazado (420 → 405)
      precioCon: 460, // Desplazado (475 → 460)
      subtotal: 515,  // Más espacio del margen (525 → 515)
    }

    // Header de tabla
    page.drawRectangle({
      x: 50,
      y: y - 20,
      width: width - 100,
      height: 25,
      color: AZUL_NEXUS,
    })

    const headers = [
      { text: '', x: colX.imagen }, // Imagen (sin texto)
      { text: 'Producto', x: colX.producto },
      { text: 'Gradas', x: colX.gradas },
      { text: 'Cj', x: colX.cajas },
      { text: 'Ps', x: colX.pares },
      { text: 'Sin Desc', x: colX.precioSin },
      { text: 'Con Desc', x: colX.precioCon },
      { text: 'Total', x: colX.subtotal },
    ]

    headers.forEach((h) => {
      page.drawText(h.text, {
        x: h.x,
        y: y - 13,
        size: 8,
        font: fontBold,
        color: rgb(1, 1, 1),
      })
    })

    // Línea inferior del header
    const borderColor = rgb(0.886, 0.910, 0.941) // #E2E8F0
    page.drawLine({
      start: { x: 50, y: y - 20 },
      end: { x: width - 50, y: y - 20 },
      thickness: 1,
      color: borderColor,
    })

    y -= 30

    // Items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // Verificar si necesitamos nueva página
      if (y < 100) {
        const newPage = pdfDoc.addPage([595, 842])
        y = height - 50
        // Re-dibujar header de tabla en nueva página
        newPage.drawRectangle({
          x: 50,
          y: y - 20,
          width: width - 100,
          height: 25,
          color: AZUL_NEXUS,
        })
        headers.forEach((h) => {
          newPage.drawText(h.text, {
            x: h.x,
            y: y - 13,
            size: 8,
            font: fontBold,
            color: rgb(1, 1, 1),
          })
        })
        y -= 30
      }

      // Alternar color de fondo
      const rowHeight = 35
      const rowY = y - 27

      if (i % 2 === 0) {
        page.drawRectangle({
          x: 50,
          y: rowY,
          width: width - 100,
          height: rowHeight,
          color: GRIS_CLARO,
        })
      }

      // Bordes de la fila (líneas horizontales)
      const borderColor = rgb(0.886, 0.910, 0.941) // #E2E8F0

      // Línea inferior de la fila
      page.drawLine({
        start: { x: 50, y: rowY },
        end: { x: width - 50, y: rowY },
        thickness: 0.5,
        color: borderColor,
      })

      // Imagen del producto (usar pre-cargada del Map)
      // HOTFIX 2026-06-07: Ya no cargamos aquí, usamos imageMap pre-cargado
      if (item.imagen_url) {
        const image = imageMap.get(item.imagen_url)
        if (image) {
          const imgSize = 20 // 20 pts = ~7mm
          // Centrar imagen verticalmente en la fila (fila = 35pts)
          page.drawImage(image, {
            x: colX.imagen,
            y: y - 19, // Centrada verticalmente en fila de 35pts
            width: imgSize,
            height: imgSize,
          })
        }
        // Si no está en el map, simplemente no se dibuja (ya loggeamos el error en preloadImages)
      }

      // Producto (código): línea 1
      page.drawText(`${item.linea_codigo}-${item.ref_codigo}`, {
        x: colX.producto,
        y: y,
        size: 7,
        font: fontBold,
        color: GRIS_TEXTO,
      })

      // Material: línea 2 (si existe)
      let currentY = y - 8
      if (item.material_nombre) {
        const materialTrunc = item.material_nombre.substring(0, 30)
        page.drawText(materialTrunc, {
          x: colX.producto,
          y: currentY,
          size: 6.5,
          font: fontRegular,
          color: rgb(0.278, 0.333, 0.412),
        })
        currentY -= 8
      }

      // Color: línea 3
      const colorNombre = item.color_nombre.substring(0, 25)
      page.drawText(colorNombre, {
        x: colX.producto,
        y: currentY,
        size: 6.5,
        font: fontRegular,
        color: rgb(0.392, 0.455, 0.545),
      })

      // Resto de columnas
      // Gradas: reducir font para que quepa mejor
      const gradasText = item.gradas_fmt.length > 45
        ? item.gradas_fmt.substring(0, 42) + '...'
        : item.gradas_fmt
      page.drawText(gradasText, {
        x: colX.gradas,
        y: y,
        size: 6.5,
        font: fontRegular,
        color: GRIS_TEXTO,
      })
      page.drawText(String(item.cajas), {
        x: colX.cajas,
        y: y,
        size: 8,
        font: fontRegular,
        color: GRIS_TEXTO,
      })
      page.drawText(String(item.pares), {
        x: colX.pares,
        y: y,
        size: 8,
        font: fontRegular,
        color: GRIS_TEXTO,
      })
      page.drawText(`${item.precio_unit.toLocaleString('es-PY')}`, {
        x: colX.precioSin,
        y: y,
        size: 7,
        font: fontRegular,
        color: GRIS_TEXTO,
      })
      page.drawText(`${item.precio_neto.toLocaleString('es-PY')}`, {
        x: colX.precioCon,
        y: y,
        size: 7,
        font: fontRegular,
        color: GRIS_TEXTO,
      })
      page.drawText(`${item.subtotal.toLocaleString('es-PY')}`, {
        x: colX.subtotal,
        y: y,
        size: 7,
        font: fontRegular,
        color: GRIS_TEXTO,
      })

      y -= 35
    }

    // ========================================
    // TOTALES
    // ========================================
    y -= 10

    page.drawRectangle({
      x: 50,
      y: y - 35,
      width: width - 100,
      height: 40,
      color: rgb(0.945, 0.961, 0.976),
    })

    page.drawText(
      `Total Pares: ${fiData.total_pares.toLocaleString('es-PY')}`,
      {
        x: 60,
        y: y - 20,
        size: 11,
        font: fontBold,
        color: GRIS_TEXTO,
      }
    )

    page.drawText(
      `TOTAL NETO: Gs. ${fiData.total_monto.toLocaleString('es-PY')}`,
      {
        x: 320,
        y: y - 20,
        size: 16,
        font: fontBold,
        color: AZUL_NEXUS,
      }
    )

    // Footer
    page.drawText('Documento de uso interno - Sin valor legal', {
      x: 150,
      y: 30,
      size: 8,
      font: fontRegular,
      color: rgb(0.580, 0.639, 0.722),
    })

    console.log('[PDF Gen] Finalizando documento...')
    const pdfBytes = await pdfDoc.save()
    console.log('[PDF Gen] PDF generado exitosamente, size:', pdfBytes.length)

    return Buffer.from(pdfBytes)
  } catch (error) {
    console.error('[PDF Gen] Exception en generación:', error)
    throw error
  }
}
