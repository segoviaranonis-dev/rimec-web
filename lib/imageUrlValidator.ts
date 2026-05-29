/**
 * Validación de URLs de imágenes para prevenir SSRF attacks
 * Solo permite dominios whitelisteados y protocolo HTTPS
 */

// Dominios permitidos para cargar imágenes
const ALLOWED_DOMAINS = [
  'supabase.co',      // Supabase Storage
  'supabase.in',      // Supabase Storage (alternativo)
  'cloudinary.com',   // Cloudinary CDN (si se usa en futuro)
  'res.cloudinary.com', // Cloudinary recursos
]

/**
 * Valida si una URL de imagen es segura para fetch
 *
 * @param url - URL de la imagen a validar
 * @returns true si la URL es segura, false en caso contrario
 *
 * @example
 * isValidImageUrl('https://abc.supabase.co/storage/v1/object/public/productos/img.png') // true
 * isValidImageUrl('http://localhost:5432/admin') // false (protocolo no seguro)
 * isValidImageUrl('https://evil.com/malware.jpg') // false (dominio no permitido)
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)

    // Solo HTTPS (no HTTP ni otros protocolos)
    if (parsed.protocol !== 'https:') {
      console.warn('[Security] Imagen rechazada - protocolo no seguro:', parsed.protocol)
      return false
    }

    // Verificar que el hostname termine en alguno de los dominios permitidos
    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    )

    if (!isAllowed) {
      console.warn('[Security] Imagen rechazada - dominio no permitido:', parsed.hostname)
      return false
    }

    return true
  } catch (error) {
    console.warn('[Security] Imagen rechazada - URL inválida:', url)
    return false
  }
}

/**
 * Fetch seguro de imagen con timeout y validación
 *
 * @param url - URL de la imagen
 * @param timeoutMs - Timeout en milisegundos (default: 5000)
 * @returns Response de fetch o null si falla
 */
export async function safeFetchImage(
  url: string,
  timeoutMs: number = 5000
): Promise<Response | null> {
  if (!isValidImageUrl(url)) {
    return null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Nexus-Core-PDF-Generator/1.0',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn('[PDF] Imagen no disponible (HTTP', response.status, '):', url)
      return null
    }

    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[PDF] Timeout cargando imagen:', url)
    } else {
      console.warn('[PDF] Error cargando imagen:', url, error)
    }
    return null
  }
}
