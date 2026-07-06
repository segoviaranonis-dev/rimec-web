import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import type { StockRow } from '@/app/catalogo-types'
import { CATALOGO_SOLO_COMPRA_PREVIA } from '@/lib/catalogoData'

export type CatalogoFilterStateExtended = CatalogoFilterState & {
  origen_tipo?: string
  ramo_tipo?: '' | 'CALZADO' | 'CONFECCIONES'
}

export function normalizeOrigenCatalogo(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().toUpperCase()
  if (t === 'PRONTA_ENTREGA' || t === 'PRONTA ENTREGA') return 'PRONTA_ENTREGA'
  if (t === 'TRÁNSITO_PP' || t === 'TRANSITO_PP' || t === 'TRANSITO PP') return 'TRÁNSITO_PP'
  return t
}

/** Filtros PostgREST — solo rama TRÁNSITO_PP (evita escanear UNION PE). */
export function applyFiltroCompraPreviaQuery(query: any): any {
  if (!CATALOGO_SOLO_COMPRA_PREVIA) return query
  return query.eq('origen_tipo', 'TRÁNSITO_PP')
}

export function applySqlFiltersToQuery(query: any, filters: CatalogoFilterStateExtended): any {
  let q = applyFiltroCompraPreviaQuery(query)
  if (filters.marca_id) q = q.eq('marca_id', Number(filters.marca_id))
  if (filters.linea_ids.length) q = q.in('linea_id', filters.linea_ids)
  if (filters.quincenas.length) q = q.in('quincena_arribo_id', filters.quincenas)
  if (filters.grupo_estilo_id) q = q.eq('grupo_estilo_id', Number(filters.grupo_estilo_id))
  if (filters.tipo_ids.length) q = q.in('tipo_1_id', filters.tipo_ids)
  if (filters.colores.length) {
    const cols = filters.colores.map(c => c.trim()).filter(Boolean)
    if (cols.length) q = q.in('descp_color', cols)
  }
  return q
}

/** Filtros que dependen de enriquecimiento pilar (estilo/tipo exactos). */
export function applyMemoryFilters(rows: StockRow[], filters: CatalogoFilterStateExtended): StockRow[] {
  let out = rows
  if (filters.grupo_estilo_id) {
    out = out.filter(r => r.grupo_estilo_id === Number(filters.grupo_estilo_id))
  }
  if (filters.tipo_ids.length) {
    const tipos = new Set(filters.tipo_ids)
    out = out.filter(r => r.tipo_1_id && tipos.has(r.tipo_1_id))
  }
  if (filters.colores.length) {
    const cols = new Set(filters.colores.map(c => c.trim()))
    out = out.filter(r => cols.has(String(r.descp_color ?? '').trim()))
  }
  if (filters.origen_tipo) {
    const want = normalizeOrigenCatalogo(filters.origen_tipo)
    out = out.filter(r => normalizeOrigenCatalogo(r.origen_tipo) === want)
  }
  return out
}

export function buildFiltrosFromRows(rows: StockRow[]) {
  const lineas = new Map<number, string>()
  const marcas = new Map<number, string>()
  const estilos = new Map<number, string>()
  const tipos = new Map<number, string>()
  for (const r of rows) {
    if (r.linea_id) {
      lineas.set(r.linea_id, String(r.linea_codigo || '').trim() || `Línea ${r.linea_id}`)
    }
    if (r.marca_id) {
      marcas.set(r.marca_id, String(r.descp_marca || '').trim() || `Marca ${r.marca_id}`)
    }
    if (r.grupo_estilo_id) {
      const id = Number(r.grupo_estilo_id)
      estilos.set(id, String(r.descp_grupo_estilo || '').trim() || `Estilo ${id}`)
    }
    if (r.tipo_1_id) {
      const id = Number(r.tipo_1_id)
      tipos.set(id, String(r.descp_tipo_1 || '').trim() || `Tipo ${id}`)
    }
  }
  const toItems = (m: Map<number, string>) =>
    [...m.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }))
      .map(([id, label]) => ({ id, label }))
  return {
    todasLineas: toItems(lineas),
    todasMarcas: toItems(marcas),
    todosEstilos: toItems(estilos),
    todosTipos: toItems(tipos),
  }
}

export function buildColoresFromRows(rows: StockRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .map(r => (typeof r.descp_color === 'string' ? r.descp_color.trim() : ''))
        .filter((c): c is string => c.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

export function buildQuincenasFromRows(rows: StockRow[]) {
  return Array.from(
    new Map(
      rows
        .filter(r => r.quincena_arribo_id && r.quincena_desc)
        .map(r => [r.quincena_arribo_id, { id: r.quincena_arribo_id!, label: r.quincena_desc! }]),
    ).values(),
  ).sort((a, b) => a.id - b.id)
}
