import type { PlazoCarlosCanon } from './plazoCarlosResolver'

/** Inverso de import_plazo_carlos_excel.py DESC_TO_COD — etiqueta operativa vendedor. */
const COD_A_ETIQUETA: Record<string, string> = {
  'CR-EFECTIV': 'EFECTIVO',
  'CR-1DIA': '1 DÍA',
  'CR-8': '8 DÍAS',
  'CR-10': '10 DÍAS',
  'CR-15': '15 DÍAS',
  'CR-20': '20 DÍAS',
  'CR-30': '30 DÍAS',
  'CR-MEN 30': '30 DÍAS (mensual)',
  'CR-40': '40 DÍAS',
  'CR-45DIAS': '45 DÍAS',
  'CR-50': '50 DÍAS',
  'CR-60': '60 DÍAS',
  'CR-MEN 60': '60 DÍAS (mensual)',
  'CR-75': '75 DÍAS',
  'CR-90': '90 DÍAS',
  'CR-120': '120 DÍAS',
  'CR-150': '150 DÍAS',
  'CR-180': '180 DÍAS',
  'CR30-60-90': '30-60-90 DÍAS',
  'CR-30A120D': '30-60-90-120 DÍAS',
  'CR-30A150D': '30-60-90-120-150 DÍAS',
  'CR-456090': '45-60-90 DÍAS',
  'CR60-90': '60-90 DÍAS',
  'CR-6090120': '60-90-120 DÍAS',
  'CR-60A120D': '60-90-120 DÍAS',
  'CR-60-150': '60-90-120-150 DÍAS',
  'CR-90-120': '90-120 DÍAS',
  'CR-90-150': '90-120-150 DÍAS',
  'CR-90A150': '90-120-150 DÍAS',
  'CR-90A180': '90-120-150-180 DÍAS',
  'CR-120A180': '120-150-180 DÍAS',
  'CR-15-30': '15-30 DÍAS',
  'CR-CONTADO': 'CR-CONTADO',
  'CR-EF-TRAN': 'CR-EF-TRAN',
}

export type PlazoGrupoUi = 'contado' | 'corridos' | 'escalonados'

export type PlazoSortKey = {
  grupo: PlazoGrupoUi
  primary: number
  max: number
  sub: number
}

/** Clave de orden cronológico desde dias_vto (MIG-172 · Condiciones Hector). */
export function claveOrdenPlazo(dias_vto: string): PlazoSortKey {
  const d = String(dias_vto ?? '').trim()
  if (!d || d === '0') {
    return { grupo: 'contado', primary: 0, max: 0, sub: 0 }
  }
  if (/^\d+$/.test(d)) {
    const n = parseInt(d, 10)
    return { grupo: 'corridos', primary: n, max: n, sub: 0 }
  }
  const nums = d.split(/[-\s]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n))
  const primary = nums[0] ?? 9999
  const max = nums[nums.length - 1] ?? primary
  return { grupo: 'escalonados', primary, max, sub: nums.length }
}

const PRIORIDAD_CONTADO: Record<string, number> = {
  'CR-EFECTIV': 0,
  'CR-CONTADO': 1,
  'CR-EF-TRAN': 2,
}

export function compararPlazosCronologico(a: PlazoCarlosCanon, b: PlazoCarlosCanon): number {
  const ka = claveOrdenPlazo(a.dias_vto)
  const kb = claveOrdenPlazo(b.dias_vto)

  const ga = ka.grupo === 'contado' ? 0 : ka.grupo === 'corridos' ? 1 : 2
  const gb = kb.grupo === 'contado' ? 0 : kb.grupo === 'corridos' ? 1 : 2
  if (ga !== gb) return ga - gb

  if (ga === 0) {
    const pa = PRIORIDAD_CONTADO[a.cod_oper_carlos.toUpperCase()] ?? 50
    const pb = PRIORIDAD_CONTADO[b.cod_oper_carlos.toUpperCase()] ?? 50
    if (pa !== pb) return pa - pb
  }

  if (ka.primary !== kb.primary) return ka.primary - kb.primary
  if (ka.max !== kb.max) return ka.max - kb.max
  if (ka.sub !== kb.sub) return ka.sub - kb.sub
  return a.cod_oper_carlos.localeCompare(b.cod_oper_carlos, 'es')
}

export function etiquetaAmigablePlazo(p: PlazoCarlosCanon, descpPlazo?: string | null): string {
  const descp = descpPlazo?.trim()
  if (descp) return descp
  const hit = COD_A_ETIQUETA[p.cod_oper_carlos.toUpperCase()]
  if (hit) return hit
  const base = p.label_ui.split(' · ')[0]?.trim()
  return base || p.cod_oper_carlos
}

export function tituloGrupoPlazo(grupo: PlazoGrupoUi): string {
  switch (grupo) {
    case 'contado':
      return 'Contado / inmediato'
    case 'corridos':
      return 'Plazos corridos'
    case 'escalonados':
      return 'Plazos escalonados'
  }
}

export function agruparPlazosOrdenados<T extends PlazoCarlosCanon>(
  filas: T[],
): Array<{ grupo: PlazoGrupoUi; titulo: string; plazos: T[] }> {
  const sorted = [...filas].sort(compararPlazosCronologico)
  const grupos: PlazoGrupoUi[] = ['contado', 'corridos', 'escalonados']
  return grupos
    .map((grupo) => ({
      grupo,
      titulo: tituloGrupoPlazo(grupo),
      plazos: sorted.filter((p) => claveOrdenPlazo(p.dias_vto).grupo === grupo),
    }))
    .filter((g) => g.plazos.length > 0)
}
