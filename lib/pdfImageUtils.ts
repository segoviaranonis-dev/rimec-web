/**
 * PROTOCOLO ÚNICO: Utilidades robustas para cargar imágenes en PDFs
 *
 * CARACTERÍSTICAS:
 * - Timeout configurable (default 15s)
 * - Retry automático (3 intentos con backoff exponencial)
 * - Logging detallado de errores
 * - Validación de seguridad (HTTPS, dominios whitelisteados)
 * - Compatible con pdf-lib (Vercel/Next.js)
 *
 * USO:
 * ```ts
 * import { fetchPdfImage } from './pdfImageUtils'
 *
 * const imgBytes = await fetchPdfImage(
 *   'https://abc.supabase.co/storage/v1/object/public/productos/img.png',
 *   { timeout: 15000, retries: 3 }
 * )
 * ```
 */

// Dominios permitidos para cargar imágenes
const ALLOWED_DOMAINS = [
  'supabase.co',
  'supabase.in',
  'cloudinary.com',
  'res.cloudinary.com',
]

export interface FetchImageOptions {
  /** Timeout por intento en milisegundos (default: 15000) */
  timeout?: number
  /** Número de reintentos (default: 3) */
  retries?: number
  /** Factor de backoff exponencial (default: 0.5) */
  backoffFactor?: number
  /** Si True, intenta thumbnail primero (default: true) */
  useThumbnail?: boolean
}

/**
 * Convierte URL original de Supabase a URL de thumbnail
 */
export function getThumbnailUrl(originalUrl: string): string {
  if (!originalUrl || !originalUrl.includes('/productos/')) {
    return originalUrl
  }
  return originalUrl.replace('/productos/', '/productos/thumbs/')
}

/**
 * Valida si una URL de imagen es segura para fetch
 */
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)

    // Solo HTTPS (no HTTP ni otros protocolos)
    if (parsed.protocol !== 'https:') {
      console.warn('[PDF Image Utils] Imagen rechazada - protocolo no seguro:', parsed.protocol)
      return false
    }

    // Verificar que el hostname termine en alguno de los dominios permitidos
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    )

    if (!isAllowed) {
      console.warn('[PDF Image Utils] Imagen rechazada - dominio no permitido:', parsed.hostname)
      return false
    }

    return true
  } catch (error) {
    console.warn('[PDF Image Utils] Imagen rechazada - URL inválida:', url)
    return false
  }
}

/**
 * Espera con backoff exponencial
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * PROTOCOLO ÚNICO: Fetch robusto de imagen con retry y timeout
 *
 * @param url - URL de la imagen (debe ser HTTPS de dominio confiable)
 * @param options - Configuración de timeout y retry
 * @returns ArrayBuffer de la imagen o null si falla
 *
 * @example
 * ```ts
 * const imgBytes = await fetchPdfImage(imageUrl, { timeout: 15000, retries: 3 })
 * if (imgBytes) {
 *   const image = await pdfDoc.embedPng(imgBytes)
 * }
 * ```
 */
export async function fetchPdfImage(
  url: string,
  options: FetchImageOptions = {}
): Promise<ArrayBuffer | null> {
  const { timeout = 15000, retries = 3, backoffFactor = 0.5, useThumbnail = true } = options

  // Intentar thumbnail primero si está habilitado
  if (useThumbnail && url.includes('/productos/')) {
    const thumbUrl = getThumbnailUrl(url)
    console.log(`[PDF Image Utils] Intentando thumbnail: ${thumbUrl.substring(0, 80)}...`)

    const thumbResult = await _fetchImage(thumbUrl, { timeout, retries, backoffFactor })

    if (thumbResult) {
      console.log('[PDF Image Utils] ✓ Thumbnail cargado exitosamente')
      return thumbResult
    }

    console.log('[PDF Image Utils] Thumbnail no disponible, intentando original...')
  }

  // Fallback a URL original
  return _fetchImage(url, { timeout, retries, backoffFactor })
}

/**
 * Función interna: descarga imagen con retry
 */
async function _fetchImage(
  url: string,
  options: { timeout: number; retries: number; backoffFactor: number }
): Promise<ArrayBuffer | null> {
  const { timeout, retries, backoffFactor } = options

  // Validación de seguridad
  if (!isValidImageUrl(url)) {
    return null
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    // Calcular timeout con backoff exponencial (fuera del try para usarlo en catch)
    const currentTimeout = timeout * (1 + backoffFactor * attempt)

    try {
      console.log(
        `[PDF Image Utils] Intento ${attempt + 1}/${retries} - Descargando: ${url.substring(0, 80)}...`
      )

      // Fetch con timeout usando AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), currentTimeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Nexus-Core-PDF-Generator/2.0',
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.warn(
          `[PDF Image Utils] HTTP ${response.status} en intento ${attempt + 1}/${retries}: ${url.substring(0, 80)}`
        )

        if (attempt < retries - 1) {
          await sleep(backoffFactor * 1000 * Math.pow(2, attempt)) // Backoff exponencial
          continue
        }
        return null
      }

      // Obtener ArrayBuffer
      const arrayBuffer = await response.arrayBuffer()

      console.log(
        `[PDF Image Utils] ✓ Imagen cargada exitosamente (${(arrayBuffer.byteLength / 1024).toFixed(1)}KB)`
      )

      return arrayBuffer

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(
          `[PDF Image Utils] ⏱ Timeout (${currentTimeout}ms) en intento ${attempt + 1}/${retries}: ${url.substring(0, 80)}`
        )
      } else {
        console.warn(
          `[PDF Image Utils] ⚠ Error de red en intento ${attempt + 1}/${retries}:`,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }

      if (attempt < retries - 1) {
        await sleep(backoffFactor * 1000 * Math.pow(2, attempt))
        continue
      }

      console.error(
        `[PDF Image Utils] ✗ Imagen falló después de ${retries} intentos: ${url.substring(0, 80)}`
      )
      return null
    }
  }

  return null
}

/**
 * DEPRECATED: Usar fetchPdfImage() directamente.
 * Wrapper para compatibilidad con código legacy.
 */
export async function safeFetchImage(
  url: string,
  timeoutMs: number = 15000
): Promise<Response | null> {
  console.warn('[PDF Image Utils] safeFetchImage() está deprecated, usar fetchPdfImage()')

  const arrayBuffer = await fetchPdfImage(url, { timeout: timeoutMs })

  if (!arrayBuffer) return null

  // Crear Response falso para compatibilidad
  return new Response(arrayBuffer, {
    status: 200,
    headers: { 'Content-Type': 'image/jpeg' },
  })
}