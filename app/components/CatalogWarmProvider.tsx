'use client'

import { useEffect } from 'react'
import { ensureDualCatalogWarm, ensurePeCatalogWarm } from '@/lib/catalogoPeWarmCache'
import { subscribeSharedCatalogFilters } from '@/lib/catalogoFiltrosCompartidos'

/** Canon 30 tarjetas PE — refresh silencioso cada 10 min (sin overlay). */
const PE_REFRESH_MS = 10 * 60 * 1000

/**
 * Warm en memoria una sola vez al montar la app + refresh periódico.
 * No re-warm en cada cambio de ruta (carrito ↔ catálogo / pestañas).
 */
export function CatalogWarmProvider() {
  useEffect(() => {
    ensurePeCatalogWarm()
    ensureDualCatalogWarm()

    const onShared = () => {
      ensurePeCatalogWarm()
      ensureDualCatalogWarm()
    }
    const unsub = subscribeSharedCatalogFilters(onShared)

    const interval = window.setInterval(() => {
      ensurePeCatalogWarm()
      ensureDualCatalogWarm()
    }, PE_REFRESH_MS)

    return () => {
      unsub()
      window.clearInterval(interval)
    }
  }, [])

  return null
}
