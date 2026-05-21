/**
 * Ecosistema de tarjetas multi-origen — RIMEC Web catálogo.
 *
 * Una tarjeta = SKU (línea·ref·material) + origen_tipo + origen_referencia_id.
 * Mismo SKU con distinto origen → dos instancias DOM independientes (saldos desacoplados).
 */

export type OrigenTipo =
  | 'TRÁNSITO_PP'
  | 'STOCK_LOCAL'
  | 'DEPOSITO_X'

export type TarjetaShellStyle = {
  /** Fondo del contenedor de la tarjeta */
  shellBackground: string
  shellBorder: string
  /** Pill «tránsito» / «stock» */
  badgeBackground: string
  badgeColor: string
  /** Texto 🚢 ETA / depósito */
  accentColor: string
  /** Sombra sutil para separar tarjetas coexistiendo */
  boxShadow: string
}

export type OrigenMetadatos = {
  tipo: OrigenTipo
  /** Clave estable para agrupar y paleta (ETA ISO, pp_id, depósito id, …) */
  referenciaId: string
  /** Etiqueta UI (DD-MM, nombre depósito, PP nro) */
  label: string
  shell: TarjetaShellStyle
}

/** Paletas por quincena / lote de arribo (hash de fecha ETA). */
const PALETAS_QUINCENA: TarjetaShellStyle[] = [
  {
    shellBackground: '#EFF6FF',
    shellBorder: '1px solid #BAE6FD',
    badgeBackground: '#0EA5E9',
    badgeColor: '#FFFFFF',
    accentColor: '#1E40AF',
    boxShadow: '0 4px 20px rgba(14, 165, 233, 0.12)',
  },
  {
    shellBackground: '#FFF7ED',
    shellBorder: '1px solid #FED7AA',
    badgeBackground: '#F97316',
    badgeColor: '#FFFFFF',
    accentColor: '#C2410C',
    boxShadow: '0 4px 20px rgba(249, 115, 22, 0.12)',
  },
  {
    shellBackground: '#F5F3FF',
    shellBorder: '1px solid #DDD6FE',
    badgeBackground: '#7C3AED',
    badgeColor: '#FFFFFF',
    accentColor: '#5B21B6',
    boxShadow: '0 4px 20px rgba(124, 58, 237, 0.1)',
  },
  {
    shellBackground: '#ECFDF5',
    shellBorder: '1px solid #A7F3D0',
    badgeBackground: '#059669',
    badgeColor: '#FFFFFF',
    accentColor: '#047857',
    boxShadow: '0 4px 20px rgba(5, 150, 105, 0.1)',
  },
]

const SHELL_STOCK_LOCAL: TarjetaShellStyle = {
  shellBackground: '#F8FAFC',
  shellBorder: '2px solid #94A3B8',
  badgeBackground: '#334155',
  badgeColor: '#FFFFFF',
  accentColor: '#0F172A',
  boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
}

const SHELL_DEPOSITO_X: TarjetaShellStyle = {
  shellBackground: '#FFFBEB',
  shellBorder: '1px solid #FDE68A',
  badgeBackground: '#D97706',
  badgeColor: '#FFFFFF',
  accentColor: '#92400E',
  boxShadow: '0 4px 20px rgba(217, 119, 6, 0.1)',
}

function hashReferencia(ref: string): number {
  let h = 0
  for (let i = 0; i < ref.length; i++) {
    h = (h * 31 + ref.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function paletaQuincena(etaIso: string): TarjetaShellStyle {
  const idx = hashReferencia(etaIso) % PALETAS_QUINCENA.length
  return PALETAS_QUINCENA[idx]!
}

function etaLabelDdMm(iso: string): string {
  const [, mes, dia] = iso.split('-')
  if (!mes || !dia) return iso
  return `${dia.slice(0, 2)}-${mes}`
}

/** sku_id estable para el holding (sin color — el color es variante dentro de la tarjeta). */
export function buildSkuId(lineaId: number, referenciaId: number, materialCode: string): string {
  return `${lineaId}:${referenciaId}:${String(materialCode ?? '').trim()}`
}

export function buildCardKey(skuId: string, origen: Pick<OrigenMetadatos, 'tipo' | 'referenciaId'>): string {
  return `${skuId}|${origen.tipo}|${origen.referenciaId}`
}

type StockOrigenRow = {
  pp_id?: number | null
  pp_nro?: string | null
  eta?: string | null
  /** Futuro: id depósito / flag stock físico en vista */
  origen_tipo?: string | null
  deposito_id?: string | number | null
}

/**
 * Deriva metadatos de origen desde una fila de v_stock_rimec.
 * Hoy todo el catálogo web sale de PP en tránsito; STOCK_LOCAL cuando la vista lo exponga.
 */
export function deriveOrigenFromStockRow(row: StockOrigenRow): OrigenMetadatos {
  const tipoRaw = String(row.origen_tipo ?? '').trim().toUpperCase()

  if (tipoRaw === 'STOCK_LOCAL' || tipoRaw === 'STOCK') {
    const depId = String(row.deposito_id ?? 'RIMEC_PY').trim()
    return {
      tipo: 'STOCK_LOCAL',
      referenciaId: depId,
      label: `Stock · ${depId}`,
      shell: SHELL_STOCK_LOCAL,
    }
  }

  if (tipoRaw === 'DEPOSITO_X' || tipoRaw.startsWith('DEPOSITO')) {
    const depId = String(row.deposito_id ?? 'DEP').trim()
    return {
      tipo: 'DEPOSITO_X',
      referenciaId: depId,
      label: `Depósito ${depId}`,
      shell: SHELL_DEPOSITO_X,
    }
  }

  const etaIso = row.eta?.slice(0, 10) ?? ''
  const ppId = row.pp_id != null ? Number(row.pp_id) : 0
  const referenciaId = etaIso || (ppId > 0 ? `pp:${ppId}` : 'sin-eta')
  const label = etaIso
    ? `🚢 ${etaLabelDdMm(etaIso)}`
    : row.pp_nro
      ? `PP ${row.pp_nro}`
      : ppId > 0
        ? `PP #${ppId}`
        : 'Tránsito'

  return {
    tipo: 'TRÁNSITO_PP',
    referenciaId,
    label,
    shell: etaIso ? paletaQuincena(etaIso) : PALETAS_QUINCENA[0]!,
  }
}

export function origenBadgeText(tipo: OrigenTipo): string {
  switch (tipo) {
    case 'STOCK_LOCAL':
      return 'stock local'
    case 'DEPOSITO_X':
      return 'depósito'
    default:
      return 'tránsito'
  }
}
