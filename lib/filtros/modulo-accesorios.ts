/**
 * Módulo Carteras + Anteojos — paridad Report `modulo-accesorios.ts`.
 */
import type { RowTipoSignals } from '@/lib/filtros/filtro-tipo-canonico'
import { canonPeTipo1Valorizado } from '@/lib/filtros/pe-valorizado-tipo1'
import { esFilaMedias, type FilaMediasSignals } from '@/lib/filtros/pe-modulo-medias'
import {
  lookupPeTraductorByBarras,
  lookupPeTraductorByLineaRef,
  subtipoAbcrDesdeTraductor,
} from '@/lib/filtros/pe-traductor-tipo1'
import { PE_TIPO1_ESCOLAR_ID } from '@/lib/filtros/pe-modulo-escolar'

export const MODULO_ACCESORIOS_LABELS = [
  'CARTERAS',
  'CARTERA',
  'LENTES',
  'ANTEOJOS',
  'OCULOS',
  'ÓCULOS',
] as const

export type ModuloAccesoriosLabel = (typeof MODULO_ACCESORIOS_LABELS)[number]

export const CATEGORIA_ACCESORIOS_UI = 'Carteras y accesorios'

export const ABCR_ACCESORIOS_SUBFILTROS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'CARTERAS', label: 'CARTERAS' },
  { key: 'LENTES', label: 'ANTEOJOS' },
]

export const ACCESORIOS_SUBTIPO_SYNTHETIC_ID: Record<string, number> = {
  CARTERAS: -1,
  LENTES: -2,
}

/** IDs sintéticos AB-CR sidebar — no son FK BD pero son filtros válidos. */
export function isAbcrSyntheticTipoId(id: number): boolean {
  return (
    id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID.CARTERAS ||
    id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID.LENTES ||
    id === PE_TIPO1_ESCOLAR_ID
  )
}

const SYNTHETIC_ID_TO_SUBTIPO = new Map<number, string>(
  Object.entries(ACCESORIOS_SUBTIPO_SYNTHETIC_ID).map(([k, id]) => [id, k]),
)

export function accesoriosSubtipoFromSyntheticId(id: number): string | null {
  return SYNTHETIC_ID_TO_SUBTIPO.get(id) ?? null
}

const SET_LABELS = new Set<string>(MODULO_ACCESORIOS_LABELS)

function normTipo1Token(raw: string | null | undefined): string {
  return canonPeTipo1Valorizado(raw)
}

export function esLabelModuloAccesorios(raw: string | null | undefined): boolean {
  const t = normTipo1Token(raw)
  if (!t) return false
  if (t === 'ACT ROPAS' || t === 'ACCESORIOS') return false
  if (t === 'MEDIAS' || t === 'MEDIA') return false
  if (SET_LABELS.has(t)) return true
  if (t.includes('ANTEOJ') || t.includes('OCUL') || t.includes('LENT')) return true
  return false
}

export type FilaAccesoriosSignals = RowTipoSignals & {
  estilo?: string | null
  tipo_1?: string | null
  descp_grupo_estilo?: string | null
  descp_tipo_1?: string | null
  descp_estilo?: string | null
  codigo_barras?: string | null
  proveedor_id?: number | null
  proveedor_importacion_id?: number | null
  linea_codigo_proveedor?: string | number | null
  referencia_codigo_proveedor?: string | number | null
  linea_codigo?: string | number | null
  referencia_codigo?: string | number | null
}

export function esFilaModuloAccesorios(
  row: FilaAccesoriosSignals,
  _lineaCasoMap?: Map<string, string> | null,
): boolean {
  if (esFilaMedias(row as FilaMediasSignals)) return false
  if (esLabelModuloAccesorios(row.tipo_1)) return true
  if (esLabelModuloAccesorios(row.descp_tipo_1)) return true
  if (esLabelModuloAccesorios(row.estilo)) return true
  if (esLabelModuloAccesorios(row.descp_grupo_estilo)) return true
  if (esLabelModuloAccesorios(row.descp_estilo)) return true
  return false
}

export function esRamoAccesorios(ramo_tipo?: string | null): boolean {
  return String(ramo_tipo ?? '').trim().toUpperCase() === 'ACCESORIOS'
}

export function applyModuloAccesoriosIncludeSql(query: unknown): unknown {
  const q = query as { or: (clause: string) => unknown }
  return q.or(
    [
      'descp_grupo_estilo.eq.CARTERAS',
      'descp_tipo_1.in.(CARTERAS,CARTERA,LENTES,ANTEOJOS,OCULOS)',
      'descp_caso.eq.CARTERAS',
    ].join(','),
  )
}

export function applyModuloAccesoriosExcludeSql(query: unknown): unknown {
  let q = query as { neq: (col: string, val: string) => typeof q }
  q = q.neq('descp_grupo_estilo', 'CARTERAS') as typeof q
  q = q.neq('descp_tipo_1', 'CARTERAS') as typeof q
  q = q.neq('descp_tipo_1', 'CARTERA') as typeof q
  q = q.neq('descp_tipo_1', 'LENTES') as typeof q
  q = q.neq('descp_caso', 'CARTERAS') as typeof q
  return q
}

export function tituloAbcrSidebar(ramo_tipo?: string | null): string {
  return esRamoAccesorios(ramo_tipo) ? CATEGORIA_ACCESORIOS_UI : 'AB - CR'
}

export function accesoriosSubtipoOpcionesSidebar(
  tipos: { id: number; label: string }[],
): { id: number; label: string }[] {
  const byKey = new Map<string, { id: number; label: string }>()
  for (const t of tipos) {
    const u = normTipo1Token(t.label)
    let key: 'CARTERAS' | 'LENTES' | null = null
    if (u === 'CARTERAS' || u === 'CARTERA') key = 'CARTERAS'
    else if (u === 'LENTES' || u.includes('ANTEOJ') || u.includes('OCUL') || u.includes('LENT')) {
      key = 'LENTES'
    }
    if (!key || byKey.has(key)) continue
    byKey.set(key, {
      id: t.id,
      label: ABCR_ACCESORIOS_SUBFILTROS.find((s) => s.key === key)!.label,
    })
  }
  for (const s of ABCR_ACCESORIOS_SUBFILTROS) {
    if (byKey.has(s.key)) continue
    byKey.set(s.key, { id: ACCESORIOS_SUBTIPO_SYNTHETIC_ID[s.key]!, label: s.label })
  }
  return ABCR_ACCESORIOS_SUBFILTROS.map((s) => byKey.get(s.key)!)
}

export function tiposMetaModuloAccesorios(
  tipos: { id: number; label: string }[],
): { id: number; label: string }[] {
  const fromMeta = accesoriosSubtipoOpcionesSidebar(tipos.filter((t) => esLabelModuloAccesorios(t.label)))
  if (fromMeta.some((t) => t.id > 0)) return fromMeta
  return accesoriosSubtipoOpcionesSidebar([])
}

export type AccesoriosSubtipoKey = 'CARTERAS' | 'LENTES'

export function subtipoAccesoriosKey(row: FilaAccesoriosSignals): AccesoriosSubtipoKey | null {
  const proveedorId =
    row.proveedor_id ?? row.proveedor_importacion_id ?? 654
  const tr =
    lookupPeTraductorByBarras(row.codigo_barras) ??
    lookupPeTraductorByLineaRef(
      proveedorId,
      row.linea_codigo_proveedor != null
        ? String(row.linea_codigo_proveedor)
        : row.linea_codigo != null
          ? String(row.linea_codigo)
          : null,
      row.referencia_codigo_proveedor != null
        ? String(row.referencia_codigo_proveedor)
        : row.referencia_codigo != null
          ? String(row.referencia_codigo)
          : null,
    )
  if (tr) {
    const fromTr = subtipoAbcrDesdeTraductor(tr)
    if (fromTr) return fromTr
  }

  const scan = [row.tipo_1, row.descp_tipo_1, row.estilo, row.descp_grupo_estilo, row.descp_estilo]
  for (const raw of scan) {
    const t = normTipo1Token(raw)
    if (!t) continue
    if (t === 'LENTES' || t.includes('ANTEOJ') || t.includes('OCUL') || t.includes('LENT')) return 'LENTES'
    if (t === 'CARTERAS' || t === 'CARTERA') return 'CARTERAS'
    if (t === 'ACT ROPAS' || t === 'ACCESORIOS') return null
  }
  if (esFilaModuloAccesorios(row)) return 'CARTERAS'
  return null
}

export function rowMatchesAccesoriosSubtipo(row: FilaAccesoriosSignals, keys: readonly string[]): boolean {
  if (!keys.length) return true
  const sub = subtipoAccesoriosKey(row)
  if (!sub) return false
  const want = new Set(keys.map((k) => String(k).trim().toUpperCase()))
  return want.has(sub)
}

export function peTieneSubfamiliaAccesorios(tipo1Ids: readonly number[]): boolean {
  // Solo Carteras/Anteojos (-1/-2). ESCOLAR (-8) es sintético AB-CR pero no módulo accesorios.
  return tipo1Ids.some(
    (id) =>
      id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID.CARTERAS ||
      id === ACCESORIOS_SUBTIPO_SYNTHETIC_ID.LENTES,
  )
}

export { mergePeAbcrTipo1Items } from '@/lib/filtros/pe-abcr-tipo1'
