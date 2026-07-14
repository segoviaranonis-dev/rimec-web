'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isTarjetaFusionada, type TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'

type CatalogAcordeonContextValue = {
  isOpen: (key: string) => boolean
  toggle: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  allOpen: boolean
  totalLotes: number
}

const CatalogAcordeonContext = createContext<CatalogAcordeonContextValue | null>(null)

export function CatalogAcordeonProvider({
  allKeys,
  children,
}: {
  allKeys: string[]
  children: ReactNode
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set())

  const isOpen = useCallback((key: string) => openKeys.has(key), [openKeys])

  const toggle = useCallback((key: string) => {
    setOpenKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setOpenKeys(new Set(allKeys))
  }, [allKeys])

  const collapseAll = useCallback(() => {
    setOpenKeys(new Set())
  }, [])

  const allOpen = allKeys.length > 0 && allKeys.every(k => openKeys.has(k))

  const value = useMemo(
    () => ({
      isOpen,
      toggle,
      expandAll,
      collapseAll,
      allOpen,
      totalLotes: allKeys.length,
    }),
    [isOpen, toggle, expandAll, collapseAll, allOpen, allKeys.length],
  )

  return (
    <CatalogAcordeonContext.Provider value={value}>
      {children}
    </CatalogAcordeonContext.Provider>
  )
}

export function useCatalogAcordeon() {
  const ctx = useContext(CatalogAcordeonContext)
  if (!ctx) {
    throw new Error('useCatalogAcordeon debe usarse dentro de CatalogAcordeonProvider')
  }
  return ctx
}

/**
 * Toggle canónico — paridad Report `GrillaPeImportadora` («Extender todos los datos»).
 * Vive en la cabecera de filtros (pie del panel blanco), no dentro de cada tarjeta.
 */
export function CatalogExtenderDatosToggle() {
  const { allOpen, expandAll, collapseAll, totalLotes } = useCatalogAcordeon()

  if (totalLotes === 0) return null

  return (
    <button
      type="button"
      onClick={() => (allOpen ? collapseAll() : expandAll())}
      aria-pressed={allOpen}
      className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition ${
        allOpen
          ? 'border-bazzar-naranja bg-bazzar-naranja text-white'
          : 'border-bazzar-naranja/40 bg-white text-bazzar-naranja-dark hover:bg-orange-50'
      }`}
    >
      {allOpen ? 'Compactar lotes' : 'Extender todos los datos'}
    </button>
  )
}

export function collectLoteKeysFromGrilla(productos: TarjetaGrilla[]): string[] {
  const keys: string[] = []
  for (const p of productos) {
    if (isTarjetaFusionada(p)) {
      for (const l of p.lotes) keys.push(l.cardKey)
    } else {
      keys.push(p.cardKey)
    }
  }
  return keys
}
