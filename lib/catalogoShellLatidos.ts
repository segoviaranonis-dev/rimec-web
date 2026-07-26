/**
 * Matriz latidos / colores — LIQ oro (liquidación) · PROMO fucsia (oferta activa).
 * Psicología: oro = cierre/stock final · fucsia = urgencia promocional (≠ oro).
 */
import type { CatalogShellVariant } from '@/lib/catalogoComercial'

export type CatalogShellLatidoSpec = {
  variant: CatalogShellVariant
  origen: 'CP' | 'PE' | 'ambos'
  deteccion: string
  pulseClass: string | null
  shellBorder: string
  shellBg: string
  footerBorder: string
  footerBg: string
  badge: string
}

/** Canónico visual — una sola fuente para auditoría siamese. */
export const CATALOG_SHELL_LATIDOS: readonly CatalogShellLatidoSpec[] = [
  {
    variant: 'cp',
    origen: 'CP',
    deteccion: 'TRÁNSITO_PP · caso biblioteca normal',
    pulseClass: null,
    shellBorder: 'border-blue-200/90',
    shellBg: 'bg-gradient-to-b from-blue-50/95 via-white to-white',
    footerBorder: 'border-blue-100/80',
    footerBg: 'bg-blue-50/30',
    badge: '—',
  },
  {
    variant: 'pe',
    origen: 'PE',
    deteccion: 'PRONTA_ENTREGA · diccionario REGULAR / NORMAL',
    pulseClass: null,
    shellBorder: 'border-slate-200/85',
    shellBg: 'bg-gradient-to-b from-slate-100/80 via-white to-white',
    footerBorder: 'border-slate-200/80',
    footerBg: 'bg-slate-50/40',
    badge: '—',
  },
  {
    variant: 'cp-promo',
    origen: 'CP',
    deteccion: 'descp_caso / BCL = PROMOCIONAL',
    pulseClass: 'catalog-card-casino-fucsia',
    shellBorder: 'border-fuchsia-300/90',
    shellBg: 'bg-gradient-to-b from-fuchsia-50/95 via-fuchsia-50/25 to-white',
    footerBorder: 'border-fuchsia-200/90',
    footerBg: 'bg-fuchsia-50/40',
    badge: 'PromoCasoBadge · PROMO biblioteca CP',
  },
  {
    variant: 'promo',
    origen: 'PE',
    deteccion: 'es_promo / cadena PROMOCIONAL / COD.GRUPO d45=02',
    pulseClass: 'catalog-card-casino-fucsia',
    shellBorder: 'border-fuchsia-300/90',
    shellBg: 'bg-gradient-to-b from-fuchsia-50/95 via-fuchsia-50/25 to-white',
    footerBorder: 'border-fuchsia-200/90',
    footerBg: 'bg-fuchsia-50/40',
    badge: 'PeProBadge · PRO diccionario PE',
  },
  {
    variant: 'liquidacion',
    origen: 'PE',
    deteccion: 'es_liquidacion / cadena LIQUIDACION / COD.GRUPO d45=04',
    pulseClass: 'catalog-card-casino-oro',
    shellBorder: 'border-amber-300/85',
    shellBg: 'bg-gradient-to-b from-amber-50/90 via-yellow-50/40 to-white',
    footerBorder: 'border-amber-200/90',
    footerBg: 'bg-amber-50/45',
    badge: 'PeLiqBadge · LIQ oro',
  },
  {
    variant: 'comun',
    origen: 'PE',
    deteccion: 'cadena COMUN / COD.GRUPO d45=06',
    pulseClass: 'catalog-card-casino-comun',
    shellBorder: 'border-emerald-300/85',
    shellBg: 'bg-gradient-to-b from-emerald-50/90 via-teal-50/35 to-white',
    footerBorder: 'border-emerald-200/90',
    footerBg: 'bg-emerald-50/45',
    badge: '—',
  },
  {
    variant: 'fusion',
    origen: 'ambos',
    deteccion: 'mismo SKU CP+PE agrupado',
    pulseClass: null,
    shellBorder: 'border-violet-200/80',
    shellBg: 'bg-gradient-to-b from-violet-50/40 via-white to-white',
    footerBorder: 'border-violet-100/80',
    footerBg: 'bg-white/80',
    badge: '—',
  },
] as const

const SPEC_BY_VARIANT = new Map<CatalogShellVariant, CatalogShellLatidoSpec>(
  CATALOG_SHELL_LATIDOS.map((s) => [s.variant, s]),
)

export function shellLatidoSpec(variant: CatalogShellVariant | undefined): CatalogShellLatidoSpec | null {
  if (!variant) return null
  return SPEC_BY_VARIANT.get(variant) ?? null
}

/** Clases shell tarjeta (borde + fondo + latido). */
export function shellLatidoClass(variant: CatalogShellVariant | undefined): string {
  const spec = shellLatidoSpec(variant)
  if (!spec) return 'border-slate-300 bg-white'
  const pulse = spec.pulseClass ? `${spec.pulseClass} ` : ''
  return `${pulse}${spec.shellBorder} ${spec.shellBg}`.trim()
}

export function shellFooterLatidoClass(variant: CatalogShellVariant | undefined): string {
  const spec = shellLatidoSpec(variant)
  if (!spec) return 'border-slate-200 bg-white'
  return `${spec.footerBorder} ${spec.footerBg}`
}
