/** Caché global: precarga + decode antes de mostrar (paridad Tablet Bazzar). */

const decoded = new Set<string>()
const inflight = new Map<string, Promise<boolean>>()

export function isImageDecoded(url: string | null | undefined): boolean {
  return Boolean(url && decoded.has(url))
}

export function preloadImageDecoded(url: string | null | undefined): Promise<boolean> {
  if (!url) return Promise.resolve(false)
  if (decoded.has(url)) return Promise.resolve(true)

  const pending = inflight.get(url)
  if (pending) return pending

  const promise = new Promise<boolean>(resolve => {
    const img = new Image()
    img.decoding = 'async'

    const finish = (ok: boolean) => {
      if (ok) decoded.add(url)
      inflight.delete(url)
      resolve(ok)
    }

    img.onload = () => {
      void (img.decode?.() ?? Promise.resolve())
        .then(() => finish(true))
        .catch(() => finish(true))
    }
    img.onerror = () => finish(false)
    img.src = url

    if (img.complete && img.naturalWidth > 0) {
      void (img.decode?.() ?? Promise.resolve())
        .then(() => finish(true))
        .catch(() => finish(true))
    }
  })

  inflight.set(url, promise)
  return promise
}

export function markImageDecoded(url: string | null | undefined): void {
  if (url) decoded.add(url)
}
