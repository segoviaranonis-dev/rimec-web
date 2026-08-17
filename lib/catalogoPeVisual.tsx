import type { ReactNode } from 'react'
import { PeProBadge } from '@/components/catalog/PeProBadge'
import { PeLiqBadge } from '@/components/catalog/PeLiqBadge'
import { PeChiBadge } from '@/components/catalog/PeChiBadge'
import {
  esChineloCaso,
  esLiquidacionPe,
  esPromoTarjeta,
  esComunPe,
  type CatalogShellVariant,
} from '@/lib/catalogoComercial'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'

export type PeVisualBadges = {
  headerBadge: ReactNode | null
  imageTopRightBadge: ReactNode | null
  shellVariant: CatalogShellVariant
  showCpPromoBadge: boolean
}

function withChi(node: ReactNode | null, showChi: boolean): ReactNode | null {
  if (!showChi) return node
  if (!node) return <PeChiBadge />
  return (
    <span className="inline-flex items-center gap-1">
      <PeChiBadge />
      {node}
    </span>
  )
}

/** Grupo uno PE — badges cortos LIQ · PRO · CHI (filtro largo = CHINELO). */
export function resolvePeVisualBadges(lote: TarjetaCatalogo): PeVisualBadges | null {
  if (lote.origen_tipo !== 'PRONTA_ENTREGA') return null

  const esLiquidacion = esLiquidacionPe(lote)
  const esComun = esComunPe(lote)
  const esPromo = esPromoTarjeta(lote) && !esLiquidacion && !esComun
  const esChi = esChineloCaso(lote)

  if (esLiquidacion) {
    return {
      headerBadge: withChi(null, esChi),
      imageTopRightBadge: <PeLiqBadge />,
      shellVariant: 'liquidacion',
      showCpPromoBadge: false,
    }
  }

  if (esPromo) {
    return {
      headerBadge: withChi(<PeProBadge />, esChi),
      imageTopRightBadge: null,
      shellVariant: 'promo',
      showCpPromoBadge: false,
    }
  }

  if (esComun) {
    return {
      headerBadge: withChi(null, esChi),
      imageTopRightBadge: null,
      shellVariant: 'comun',
      showCpPromoBadge: false,
    }
  }

  return {
    headerBadge: withChi(null, esChi),
    imageTopRightBadge: null,
    shellVariant: 'pe',
    showCpPromoBadge: false,
  }
}
