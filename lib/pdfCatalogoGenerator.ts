/**
 * Generador de PDF para Catálogo de Productos
 * Organizado por Fecha de Llegada > Marca > Línea+Referencia
 */

import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib'
import { safeFetchImage } from './imageUrlValidator'

// Colores Nexus
const AZUL_NEXUS = rgb(0.106, 0.227, 0.42) // #1B3A6B
const DORADO_NEXUS = rgb(0.831, 0.686, 0.216) // #D4AF37
const GRIS_CLARO = rgb(0.973, 0.980, 0.988) // #F8FAFC
const GRIS_TEXTO = rgb(0.118, 0.161, 0.235) // #1E293B

export interface CatalogoVariante {
  det_id: number
  descp_color: string
  imagen_url: string
  gradas_fmt: string
  cajas_disponibles: number
  precio_base?: number
  lista_precio_id?: string
}

export interface CatalogoProducto {
  linea_codigo: string
  referencia_codigo: string
  descp_material: string
  descp_marca: string
  quincena_desc: string | null
  variantes: CatalogoVariante[]
}

export interface CatalogoData {
  cliente_nombre: string
  vendedor_nombre: string
  lista_precio: string
  fecha_generacion: string
}

export async function generarPDFCatalogo(
  catalogoData: CatalogoData,
  productos: CatalogoProducto[]
): Promise<Buffer> {
  try {
    console.log('[PDF Catálogo] Iniciando generación...')
    console.log('[PDF Catálogo] Productos:', productos.length)
    console.log('[PDF Catálogo] CatalogoData:', catalogoData)

    // Organizar productos: Quincena > Marca > Línea+Ref (descendente)
    const productosOrdenados = [...productos].sort((a, b) => {
      // 1. Por quincena (nulls al final)
      if (a.quincena_desc && !b.quincena_desc) return -1
      if (!a.quincena_desc && b.quincena_desc) return 1
      if (a.quincena_desc !== b.quincena_desc) {
        return (a.quincena_desc || '').localeCompare(b.quincena_desc || '')
      }

      // 2. Por marca
      if (a.descp_marca !== b.descp_marca) {
        return a.descp_marca.localeCompare(b.descp_marca)
      }

      // 3. Por línea + referencia (descendente = mayor primero)
      const aCode = `${a.linea_codigo}-${a.referencia_codigo}`
      const bCode = `${b.linea_codigo}-${b.referencia_codigo}`
      return bCode.localeCompare(aCode) // Invertido para orden descendente
    })

    // Crear documento
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()

    // Cargar fuentes
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    let y = height - 40

    // ========================================
    // PORTADA / HEADER
    // ========================================
    page.drawText('CATÁLOGO NEXUS', {
      x: width / 2 - 90,
      y,
      size: 24,
      font: fontBold,
      color: AZUL_NEXUS,
    })
    y -= 22

    page.drawText('RIMEC Business Intelligence', {
      x: width / 2 - 85,
      y,
      size: 11,
      font: fontRegular,
      color: DORADO_NEXUS,
    })
    y -= 20

    // Línea dorada
    page.drawLine({
      start: { x: 40, y },
      end: { x: width - 40, y },
      thickness: 2,
      color: DORADO_NEXUS,
    })
    y -= 25

    // Info de venta
    page.drawText(`Cliente: ${catalogoData.cliente_nombre}`, {
      x: 40,
      y,
      size: 12,
      font: fontBold,
      color: AZUL_NEXUS,
    })
    y -= 15

    page.drawText(`Vendedor: ${catalogoData.vendedor_nombre}`, {
      x: 40,
      y,
      size: 10,
      font: fontRegular,
      color: GRIS_TEXTO,
    })
    page.drawText(`Lista: ${catalogoData.lista_precio}`, {
      x: 300,
      y,
      size: 10,
      font: fontRegular,
      color: GRIS_TEXTO,
    })
    y -= 12

    page.drawText(`Fecha: ${catalogoData.fecha_generacion}`, {
      x: 40,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.392, 0.455, 0.545),
    })
    y -= 30

    // ========================================
    // PRODUCTOS
    // ========================================
    let quincenaActual = ''
    let marcaActual = ''

    for (const producto of productosOrdenados) {
      // Nueva quincena: título grande
      if (producto.quincena_desc !== quincenaActual) {
        // Verificar espacio para nueva sección
        if (y < 120) {
          page = pdfDoc.addPage([595, 842])
          y = height - 40
        }

        quincenaActual = producto.quincena_desc || 'SIN QUINCENA'

        // Fondo de sección
        page.drawRectangle({
          x: 40,
          y: y - 22,
          width: width - 80,
          height: 28,
          color: AZUL_NEXUS,
        })

        page.drawText(`📦 ${quincenaActual}`, {
          x: 50,
          y: y - 14,
          size: 16,
          font: fontBold,
          color: rgb(1, 1, 1),
        })

        y -= 38
        marcaActual = '' // Reset marca
      }

      // Nueva marca dentro de la quincena: subtítulo
      if (producto.descp_marca !== marcaActual) {
        if (y < 100) {
          page = pdfDoc.addPage([595, 842])
          y = height - 40
        }

        marcaActual = producto.descp_marca

        page.drawText(`${marcaActual}`, {
          x: 40,
          y,
          size: 13,
          font: fontBold,
          color: DORADO_NEXUS,
        })
        y -= 20
      }

      // Renderizar cada variante del producto
      for (const variante of producto.variantes) {
        // Verificar espacio para nueva fila
        if (y < 100) {
          page = pdfDoc.addPage([595, 842])
          y = height - 40
        }

        const rowHeight = 65
        const rowY = y - rowHeight

        // Fondo alternado
        if (productosOrdenados.indexOf(producto) % 2 === 0) {
          page.drawRectangle({
            x: 40,
            y: rowY,
            width: width - 80,
            height: rowHeight,
            color: GRIS_CLARO,
          })
        }

        // Imagen (70x70 pts)
        if (variante.imagen_url) {
          try {
            const imgResponse = await safeFetchImage(variante.imagen_url, 5000)

            if (imgResponse) {
              const imgBytes = await imgResponse.arrayBuffer()
              const imgType = variante.imagen_url.toLowerCase()
              let image

              if (imgType.endsWith('.png')) {
                image = await pdfDoc.embedPng(imgBytes)
              } else if (imgType.endsWith('.jpg') || imgType.endsWith('.jpeg')) {
                image = await pdfDoc.embedJpg(imgBytes)
              }

              if (image) {
                const imgSize = 55
                page.drawImage(image, {
                  x: 45,
                  y: y - 60,
                  width: imgSize,
                  height: imgSize,
                })
              }
            }
          } catch (error) {
            console.warn('[PDF Catálogo] Error cargando imagen:', variante.imagen_url, error)
          }
        }

        // Código (Línea-Ref)
        page.drawText(`${producto.linea_codigo}-${producto.referencia_codigo}`, {
          x: 110,
          y: y - 15,
          size: 11,
          font: fontBold,
          color: AZUL_NEXUS,
        })

        // Material
        const materialTrunc = producto.descp_material.substring(0, 35)
        page.drawText(materialTrunc, {
          x: 110,
          y: y - 28,
          size: 8,
          font: fontRegular,
          color: GRIS_TEXTO,
        })

        // Color
        const colorTrunc = variante.descp_color.substring(0, 30)
        page.drawText(`Color: ${colorTrunc}`, {
          x: 110,
          y: y - 40,
          size: 8,
          font: fontRegular,
          color: rgb(0.392, 0.455, 0.545),
        })

        // Tallas disponibles
        const tallasTrunc = variante.gradas_fmt.length > 35
          ? variante.gradas_fmt.substring(0, 32) + '...'
          : variante.gradas_fmt
        page.drawText(`Tallas: ${tallasTrunc}`, {
          x: 110,
          y: y - 52,
          size: 7,
          font: fontRegular,
          color: rgb(0.392, 0.455, 0.545),
        })

        // Precio (si existe)
        if (variante.precio_base && variante.precio_base > 0) {
          page.drawText(`Gs. ${variante.precio_base.toLocaleString('es-PY')}`, {
            x: width - 140,
            y: y - 20,
            size: 11,
            font: fontBold,
            color: DORADO_NEXUS,
          })
        }

        // Disponibilidad
        page.drawText(`Disp: ${variante.cajas_disponibles} cjs`, {
          x: width - 140,
          y: y - 40,
          size: 9,
          font: fontRegular,
          color: GRIS_TEXTO,
        })

        y -= rowHeight + 5
      }
    }

    // Footer en todas las páginas
    const pages = pdfDoc.getPages()
    pages.forEach((p, idx) => {
      p.drawText(`Catálogo Nexus — Página ${idx + 1} de ${pages.length}`, {
        x: width / 2 - 100,
        y: 20,
        size: 8,
        font: fontRegular,
        color: rgb(0.580, 0.639, 0.722),
      })
    })

    console.log('[PDF Catálogo] Finalizando documento...')
    const pdfBytes = await pdfDoc.save()
    console.log('[PDF Catálogo] PDF generado exitosamente, size:', pdfBytes.length)

    return Buffer.from(pdfBytes)
  } catch (error) {
    console.error('[PDF Catálogo] Exception en generación:', error)
    console.error('[PDF Catálogo] Error stack:', error instanceof Error ? error.stack : 'No stack available')
    console.error('[PDF Catálogo] Error message:', error instanceof Error ? error.message : String(error))
    throw error
  }
}
