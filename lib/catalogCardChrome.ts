import type { CSSProperties } from 'react'
import type { TarjetaShellStyle } from '@/lib/catalogoOrigen'

/** @deprecated Usar CatalogTarjetaDeposito + CATALOG_CARD_WIDTH_CLASS */
export const CATALOG_CARD_CLASS =
  'flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white'

/** @deprecated pill integrada en CatalogTarjetaDeposito */
export const CATALOG_STOCK_PILL_CLASS =
  'shrink-0 rounded-full bg-orange-600 px-1.5 py-0.5 text-[9px] font-bold text-white sm:px-2 sm:text-[10px]'

/** @deprecated */
export const CATALOG_MARCA_HEADER_CLASS =
  'min-w-0 flex-1 truncate text-[9px] font-normal uppercase tracking-wide text-[#1E40AF] sm:text-[10px]'

/** Chip origen / ETA — color de origen solo acá, no en la tarjeta entera. */
export function origenChipStyle(shell: TarjetaShellStyle, active = true): CSSProperties {
  if (!active) {
    return {
      color: '#94A3B8',
      backgroundColor: '#F8FAFC',
      border: '1px solid #E2E8F0',
    }
  }
  return {
    color: shell.accentColor,
    backgroundColor: '#FFFFFF',
    border: `1px solid ${shell.badgeBackground}`,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  }
}

export function origenBadgePillStyle(shell: TarjetaShellStyle): CSSProperties {
  return {
    backgroundColor: shell.badgeBackground,
    color: shell.badgeColor,
  }
}
