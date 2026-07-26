/**
 * AB-CR Tipo1 PE — paridad Report `pe-abcr-tipo1.ts`.
 */
import { canonPeTipo1Valorizado } from '@/lib/filtros/pe-valorizado-tipo1'
import {
  ABCR_MEDIAS_ITEM,
  esFilaMedias,
  esLabelMedias,
  PE_TIPO1_MEDIAS_ID,
} from '@/lib/filtros/pe-modulo-medias'
import {
  accesoriosSubtipoOpcionesSidebar,
  esLabelModuloAccesorios,
} from '@/lib/filtros/modulo-accesorios'

const TEMPORADA_ORDER = ['ABIERTO', 'ACT ROPAS', 'CERRADO', 'INVIERNO', 'VERANO'] as const

export function mergePeAbcrTipo1Items(
  tipos: { id: number; label: string }[],
): { id: number; label: string }[] {
  const acc = accesoriosSubtipoOpcionesSidebar([])
  const accKeys = new Set(acc.map((a) => a.label.toUpperCase()))

  const byLabel = new Map<string, { id: number; label: string }>()
  for (const t of tipos) {
    const id = Number(t.id)
    if (id <= 0) continue
    const u = canonPeTipo1Valorizado(t.label)
    if (!u || accKeys.has(u) || esLabelModuloAccesorios(u)) continue
    if (!byLabel.has(u)) byLabel.set(u, { id, label: u })
  }

  if (!byLabel.has('MEDIAS')) byLabel.set('MEDIAS', { ...ABCR_MEDIAS_ITEM })
  else byLabel.set('MEDIAS', { id: PE_TIPO1_MEDIAS_ID, label: 'MEDIAS' })

  const upper = (label: string) => canonPeTipo1Valorizado(label) || String(label).trim().toUpperCase()

  const temporada = TEMPORADA_ORDER.filter((k) => byLabel.has(k)).map((k) => ({
    ...byLabel.get(k)!,
    label: upper(byLabel.get(k)!.label),
  }))

  const rest = [...byLabel.entries()]
    .filter(([k]) => !TEMPORADA_ORDER.includes(k as (typeof TEMPORADA_ORDER)[number]) && k !== 'MEDIAS')
    .map(([, v]) => ({ ...v, label: upper(v.label) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  return [
    ...acc,
    { id: PE_TIPO1_MEDIAS_ID, label: 'MEDIAS' },
    ...temporada,
    ...rest,
  ]
}

export function rowMatchesPeAbcrTipo1(
  row: {
    tipo_1_id?: number | null
    tipo_1?: string | null
    descp_tipo_1?: string | null
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
    if (id === PE_TIPO1_MEDIAS_ID && esFilaMedias(row)) return true
    if (id > 0 && Number(row.tipo_1_id) === id) return true
    if (id > 0 && esLabelMedias(row.tipo_1 ?? row.descp_tipo_1) && id === PE_TIPO1_MEDIAS_ID) return true
  }
  return false
}
