/**
 * Gate de overlay «RIMEC sincronizando».
 * Una vez en la pestaña del navegador: carrito↔catálogo (SPA o hard nav) NO reabre el overlay.
 * Se reinicia al cerrar la pestaña (sessionStorage).
 */
const SESSION_KEY = 'rimec.catalogSyncOverlayDone.v1'

let overlayDoneThisDocument = false

function readSessionFlag(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeSessionFlag(): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* modo privado / bloqueado */
  }
}

export function wasCatalogSyncOverlayDoneThisDocument(): boolean {
  if (overlayDoneThisDocument) return true
  if (readSessionFlag()) {
    overlayDoneThisDocument = true
    return true
  }
  return false
}

export function markCatalogSyncOverlayDoneThisDocument(): void {
  overlayDoneThisDocument = true
  writeSessionFlag()
}
