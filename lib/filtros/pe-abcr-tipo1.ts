/**
 * AB-CR Tipo1 PE — paridad Report `pe-abcr-tipo1.ts`.
 * Solo opciones presentes en el stock / filas (filosofía Nexus · sin hardcode fantasma).
 */
import { canonPeTipo1Valorizado } from '@/lib/filtros/pe-valorizado-tipo1'
import {
  ABCR_MEDIAS_ITEM,
  esFilaMedias,
  esLabelMedias,
  PE_TIPO1_MEDIAS_ID,
} from '@/lib/filtros/pe-modulo-medias'
import {
  ABCR_ESCOLAR_ITEM,
  esFilaEscolar,
  PE_TIPO1_ESCOLAR_ID,
} from '@/lib/filtros/pe-modulo-escolar'
import {
  ACCESORIOS_SUBTIPO_SYNTHETIC_ID,
  accesoriosSubtipoOpcionesSidebar,
  esLabelModuloAccesorios,
  subtipoAccesoriosKey,
  type AccesoriosSubtipoKey,
} from '@/lib/filtros/modulo-accesorios'

const TEMPORADA_ORDER = [
  'ABIERTO',
  'ACT ROPAS',
  'CERRADO',
  'ESCOLAR',
  'INVIERNO',
  'VERANO',
] as const

/** Señales detectadas en filas de stock — habilitan chips solo si hay mercadería. */
export type PeAbcrStockSignals = {
  hasMedias?: boolean
  hasEscolar?: boolean
  hasCarteras?: boolean
  hasLentes?: boolean
}

export function peAbcrSignalsFromRows(
  rows: ReadonlyArray<{
    tipo_1?: string | null
    descp_tipo_1?: string | null
    sdrm_tipo1?: string | null
    marca?: string | null
    sdrm_marca?: string | null
    cod_grupo?: string | null
    linea_codigo?: string | null
    linea_codigo_proveedor?: string | null
    estilo?: string | null
    descp_grupo_estilo?: string | null
    descp_estilo?: string | null
    codigo_barras?: string | null
    proveedor_id?: number | null
    referencia_codigo_proveedor?: string | null
    cantidad?: number | null
  }>,
): PeAbcrStockSignals {
  let hasMedias = false
  let hasEscolar = false
  let hasCarteras = false
  let hasLentes = false
  for (const r of rows) {
    if ((r.cantidad ?? 1) <= 0) continue
    if (!hasMedias && esFilaMedias(r)) hasMedias = true
    if (!hasEscolar && esFilaEscolar(r)) hasEscolar = true
    const sub = subtipoAccesoriosKey(r)
    if (sub === 'CARTERAS') hasCarteras = true
    if (sub === 'LENTES') hasLentes = true
    if (hasMedias && hasEscolar && hasCarteras && hasLentes) break
  }
  return { hasMedias, hasEscolar, hasCarteras, hasLentes }
}

export function mergePeAbcrTipo1Items(
  tipos: { id: number; label: string }[],
  signals?: PeAbcrStockSignals | null,
): { id: number; label: string }[] {
  const sig = signals ?? {}
  const accKeysWanted = new Set<AccesoriosSubtipoKey>()
  if (sig.hasCarteras) accKeysWanted.add('CARTERAS')
  if (sig.hasLentes) accKeysWanted.add('LENTES')

  const acc = accesoriosSubtipoOpcionesSidebar(tipos).filter((a) => {
    const u = String(a.label).trim().toUpperCase()
    const key: AccesoriosSubtipoKey | null =
      u === 'CARTERAS' || u === 'CARTERA'
        ? 'CARTERAS'
        : u === 'ANTEOJOS' || u === 'LENTES' || u.includes('ANTEOJ')
          ? 'LENTES'
          : null
    if (!key) return false
    if (accKeysWanted.has(key)) return true
    return tipos.some((t) => {
      const tu = canonPeTipo1Valorizado(t.label)
      return key === 'CARTERAS'
        ? tu === 'CARTERAS' || tu === 'CARTERA'
        : tu === 'LENTES' || tu.includes('ANTEOJ') || tu.includes('LENT')
    })
  })

  for (const key of accKeysWanted) {
    if (
      acc.some(
        (a) =>
          a.id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID[key] ||
          a.label.toUpperCase().includes(key === 'LENTES' ? 'ANTEOJ' : 'CARTER'),
      )
    ) {
      continue
    }
    const label = key === 'LENTES' ? 'ANTEOJOS' : 'CARTERAS'
    acc.push({ id: ACCESORIOS_SUBTIPO_SYNTHETIC_ID[key]!, label })
  }

  const accKeys = new Set(acc.map((a) => a.label.toUpperCase()))

  const byLabel = new Map<string, { id: number; label: string }>()
  for (const t of tipos) {
    const id = Number(t.id)
    if (id <= 0) continue
    const u = canonPeTipo1Valorizado(t.label)
    if (!u || accKeys.has(u) || esLabelModuloAccesorios(u)) continue
    if (!byLabel.has(u)) byLabel.set(u, { id, label: u })
  }

  if (sig.hasMedias || byLabel.has('MEDIAS')) {
    byLabel.set('MEDIAS', { ...ABCR_MEDIAS_ITEM })
  }
  if (sig.hasEscolar || byLabel.has('ESCOLAR')) {
    byLabel.set('ESCOLAR', { ...ABCR_ESCOLAR_ITEM })
  }

  const upper = (label: string) =>
    canonPeTipo1Valorizado(label) || String(label).trim().toUpperCase()

  const temporada = TEMPORADA_ORDER.filter((k) => byLabel.has(k)).map((k) => ({
    ...byLabel.get(k)!,
    label: upper(byLabel.get(k)!.label),
  }))

  const rest = [...byLabel.entries()]
    .filter(
      ([k]) =>
        !TEMPORADA_ORDER.includes(k as (typeof TEMPORADA_ORDER)[number]) && k !== 'MEDIAS',
    )
    .map(([, v]) => ({ ...v, label: upper(v.label) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const mediasChip =
    sig.hasMedias || byLabel.has('MEDIAS')
      ? [{ id: PE_TIPO1_MEDIAS_ID, label: 'MEDIAS' as const }]
      : []

  return [...acc.map((t) => ({ ...t, label: upper(t.label) })), ...mediasChip, ...temporada, ...rest]
}

export function rowMatchesPeAbcrTipo1(
  row: {
    tipo_1_id?: number | null
    tipo_1?: string | null
    descp_tipo_1?: string | null
    sdrm_tipo1?: string | null
    marca?: string | null
    sdrm_marca?: string | null
    cod_grupo?: string | null
    linea_codigo?: string | null
    linea_codigo_proveedor?: string | null
  },
  tipo1Ids: readonly number[],
): boolean {
  if (!tipo1Ids.length) return true
  for (const id of tipo1Ids) {
    if (id === PE_TIPO1_ESCOLAR_ID && esFilaEscolar(row)) return true
    if (id === PE_TIPO1_MEDIAS_ID && esFilaMedias(row)) return true
    if (id > 0 && Number(row.tipo_1_id) === id) {
      if (esFilaEscolar(row)) continue
      return true
    }
    if (id > 0 && esLabelMedias(row.tipo_1 ?? row.descp_tipo_1) && id === PE_TIPO1_MEDIAS_ID) {
      return true
    }
  }
  return false
}
