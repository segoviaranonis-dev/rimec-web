'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ensureDualCatalogWarm } from '@/lib/catalogoPeWarmCache'
import { subscribeSharedCatalogFilters } from '@/lib/catalogoFiltrosCompartidos'

/** Mantiene ≥30 tarjetas CP+PE en memoria en toda la sesión (catálogo, estadísticas, carrito…). */
export function CatalogWarmProvider() {
  const pathname = usePathname()

  useEffect(() => {
    ensureDualCatalogWarm()
    return subscribeSharedCatalogFilters(() => {
      ensureDualCatalogWarm()
    })
  }, [])

  useEffect(() => {
    ensureDualCatalogWarm()
  }, [pathname])

  return null
}
