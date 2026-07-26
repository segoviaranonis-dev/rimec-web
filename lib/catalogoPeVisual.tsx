import type { ReactNode } from 'react'
import { PeProBadge } from '@/components/catalog/PeProBadge'
import { PeLiqBadge } from '@/components/catalog/PeLiqBadge'
import { esLiquidacionPe, esPromoTarjeta, esComunPe, type CatalogShellVariant } from '@/lib/catalogoComercial'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'

export type PeVisualBadges = {
  headerBadge: ReactNode | null
  imageTopRightBadge: ReactNode | null
  shellVariant: CatalogShellVariant
  showCpPromoBadge: boolean
}

/** Grupo uno PE — NORMAL sin latido · PRO fucsia · LIQ oro (convive con CP azul). */
export function resolvePeVisualBadges(lote: TarjetaCatalogo): PeVisualBadges | null {
  if (lote.origen_tipo !== 'PRONTA_ENTREGA') return null

  const esLiquidacion = esLiquidacionPe(lote)
  const esComun = esComunPe(lote)
  const esPromo = esPromoTarjeta(lote) && !esLiquidacion && !esComun

  if (esLiquidacion) {
    return {
      headerBadge: null,
      imageTopRightBadge: <PeLiqBadge />,
      shellVariant: 'liquidacion',
      showCpPromoBadge: false,
    }
  }

  if (esPromo) {
    return {
      headerBadge: <PeProBadge />,
      imageTopRightBadge: null,
      shellVariant: 'promo',
      showCpPromoBadge: false,
    }
  }

  if (esComun) {
    return {
      headerBadge: null,
      imageTopRightBadge: null,
      shellVariant: 'comun',
      showCpPromoBadge: false,
    }
  }

  return {
    headerBadge: null,
    imageTopRightBadge: null,
    shellVariant: 'pe',
    showCpPromoBadge: false,
  }
}
