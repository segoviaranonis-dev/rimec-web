'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ensureDualCatalogWarm, ensurePeCatalogWarm } from '@/lib/catalogoPeWarmCache'
import { subscribeSharedCatalogFilters } from '@/lib/catalogoFiltrosCompartidos'

/** Canon 30 tarjetas PE — refresh cada 10 min para no expirar TTL 15 min. */
const PE_REFRESH_MS = 10 * 60 * 1000

/** Mantiene ≥30 tarjetas CP+PE en memoria en toda la sesión (catálogo, estadísticas, carrito…). */
export function CatalogWarmProvider() {
  const pathname = usePathname()

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

  useEffect(() => {
    ensurePeCatalogWarm()
    ensureDualCatalogWarm()
  }, [pathname])

  return null
}
