import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import type { StockRow } from '@/app/catalogo-types'
import { CATALOGO_SOLO_COMPRA_PREVIA } from '@/lib/catalogoData'
import { inferPeRamoTipo, type PeDepositoCodigo } from '@/lib/rimecPeDeposito'
import { etiquetaTonoFromRaw } from '@/lib/pilares/color-canon'

export type CatalogoFilterStateExtended = CatalogoFilterState & {
  origen_tipo?: string
  ramo_tipo?: '' | 'CALZADO' | 'CONFECCIONES'
  deposito_codigo?: '' | PeDepositoCodigo
  genero_codigo?: string
  tonos?: string[]
  sin_tono?: boolean
  buscar?: string
}

export function normalizeOrigenCatalogo(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().toUpperCase()
  if (t === 'PRONTA_ENTREGA' || t === 'PRONTA ENTREGA') return 'PRONTA_ENTREGA'
  if (t === 'TRÁNSITO_PP' || t === 'TRANSITO_PP' || t === 'TRANSITO PP') return 'TRÁNSITO_PP'
  return t
}

/** Filtros PostgREST — compra previa por defecto; PE solo si filtro explícito. */
export function applyOrigenTipoQuery(query: any, filters: CatalogoFilterStateExtended): any {
  const want = normalizeOrigenCatalogo(filters.origen_tipo)
  if (want === 'PRONTA_ENTREGA') {
    return query.or('origen_tipo.eq.PRONTA_ENTREGA,origen_tipo.eq.PRONTA ENTREGA')
  }
  if (CATALOGO_SOLO_COMPRA_PREVIA) {
    return query.eq('origen_tipo', 'TRÁNSITO_PP')
  }
  return query
}

/** @deprecated usar applyOrigenTipoQuery */
export function applyFiltroCompraPreviaQuery(query: any): any {
  if (!CATALOGO_SOLO_COMPRA_PREVIA) return query
  return query.eq('origen_tipo', 'TRÁNSITO_PP')
}

export function applyPeDepositoQuery(query: any, filters: CatalogoFilterStateExtended): any {
  const dep = String(filters.deposito_codigo ?? '').trim()
  if (dep === 'D1' || dep === 'DEP2' || dep === 'D3') {
    return query.eq('deposito_nombre', dep)
  }
  return query
}

export function applyNonOrigenSqlFilters(query: any, filters: CatalogoFilterStateExtended): any {
  let q = query
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

export function applySqlFiltersToQuery(query: any, filters: CatalogoFilterStateExtended): any {
  let q = applyOrigenTipoQuery(query, filters)
  return applyNonOrigenSqlFilters(q, filters)
}

/** Vista Supabase — CP en v_stock_rimec · PE en v_stock_pe_rimec (PPD · local). */
export function catalogoStockView(
  filters: CatalogoFilterStateExtended,
): 'v_stock_rimec' | 'v_stock_pe_rimec' {
  return normalizeOrigenCatalogo(filters.origen_tipo) === 'PRONTA_ENTREGA'
    ? 'v_stock_pe_rimec'
    : 'v_stock_rimec'
}

/** Filtros que dependen de enriquecimiento pilar (estilo/tipo/tono/género/búsqueda). */
export function applyMemoryFilters(rows: StockRow[], filters: CatalogoFilterStateExtended): StockRow[] {
  let out = rows
  if (filters.genero_codigo) {
    const want = String(filters.genero_codigo).trim().toUpperCase()
    out = out.filter(r => String(r.genero_codigo ?? '').trim().toUpperCase() === want)
  }
  if (filters.grupo_estilo_id) {
    out = out.filter(r => r.grupo_estilo_id === Number(filters.grupo_estilo_id))
  }
  if (filters.tipo_ids.length) {
    const tipos = new Set(filters.tipo_ids)
    out = out.filter(r => r.tipo_1_id && tipos.has(r.tipo_1_id))
  }
  if (filters.sin_tono) {
    out = out.filter(r => !etiquetaTonoFromRaw(r.color_tono_canon))
  } else if (filters.tonos?.length) {
    const tonos = new Set(filters.tonos.map(t => t.trim().toLowerCase()))
    out = out.filter(r => {
      const et = etiquetaTonoFromRaw(r.color_tono_canon)?.toLowerCase()
      return et && tonos.has(et)
    })
  }
  if (filters.colores.length) {
    const cols = new Set(filters.colores.map(c => c.trim()))
    out = out.filter(r => cols.has(String(r.descp_color ?? '').trim()))
  }
  const q = String(filters.buscar ?? '').trim().toLowerCase()
  if (q) {
    out = out.filter(r => {
      const hay = [
        r.descp_marca, r.linea_codigo, r.referencia_codigo, r.nombre,
        r.descp_material, r.descp_color, r.material_code,
      ]
      return hay.some(f => String(f ?? '').toLowerCase().includes(q))
    })
  }
  if (filters.origen_tipo) {
    const want = normalizeOrigenCatalogo(filters.origen_tipo)
    out = out.filter(r => normalizeOrigenCatalogo(r.origen_tipo) === want)
  }
  if (filters.ramo_tipo === 'CALZADO' || filters.ramo_tipo === 'CONFECCIONES') {
    out = out.filter(r => inferPeRamoTipo(r) === filters.ramo_tipo)
  }
  if (filters.deposito_codigo) {
    const dep = String(filters.deposito_codigo).trim()
    out = out.filter(r => String(r.deposito_nombre ?? '').trim() === dep)
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
    const marLabel = String(r.descp_marca ?? '').trim()
    if (marLabel) {
      const marId = Number(r.marca_id ?? 0)
      marcas.set(marId, marLabel)
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
    todosGeneros: buildGenerosFromRows(rows),
  }
}

export function buildGenerosFromRows(rows: StockRow[]) {
  const m = new Map<string, string>()
  for (const r of rows) {
    const cod = String(r.genero_codigo ?? '').trim()
    if (!cod) continue
    m.set(cod, String(r.descp_genero ?? cod).trim() || cod)
  }
  const orden = ['DAMAS', 'CABALLEROS', 'NINAS', 'NINOS']
  return [...m.entries()]
    .sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0]))
    .map(([codigo, label]) => ({ codigo, label }))
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
