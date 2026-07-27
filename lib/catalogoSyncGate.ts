/**
 * Gate de overlay «RIMEC sincronizando».
 * Memoria de documento: sobrevive carrito↔catálogo (SPA); se reinicia con F5.
 */
let overlayDoneThisDocument = false

export function wasCatalogSyncOverlayDoneThisDocument(): boolean {
  return overlayDoneThisDocument
}

export function markCatalogSyncOverlayDoneThisDocument(): void {
  overlayDoneThisDocument = true
}
