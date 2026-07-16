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
  /** Filtro comercial SDRM — gobernado desde Report (pe_catalogo_filtro_web). */
  cadena_comercial?: string
}

export const CATALOGO_ORIGEN_TODOS = 'TODOS'

export function normalizeOrigenCatalogo(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().toUpperCase()
  if (t === 'TODOS') return 'TODOS'
  if (t === 'PRONTA_ENTREGA' || t === 'PRONTA ENTREGA') return 'PRONTA_ENTREGA'
  if (t === 'TRÁNSITO_PP' || t === 'TRANSITO_PP' || t === 'TRANSITO PP') return 'TRÁNSITO_PP'
  if (t === 'CP' || t === 'COMPRA_PREVIA') return 'TRÁNSITO_PP'
  return t
}

export function isCatalogoOrigenTodos(filters: CatalogoFilterStateExtended): boolean {
  return normalizeOrigenCatalogo(filters.origen_tipo) === 'TODOS'
}

export function isCatalogoOrigenPe(filters: CatalogoFilterStateExtended): boolean {
  return normalizeOrigenCatalogo(filters.origen_tipo) === 'PRONTA_ENTREGA'
}

export function isCatalogoOrigenCp(filters: CatalogoFilterStateExtended): boolean {
  const o = normalizeOrigenCatalogo(filters.origen_tipo)
  return o === 'TRÁNSITO_PP' || o === ''
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

/** Escapa comodines para ilike PostgREST. */
function escapeIlike(q: string): string {
  return q.replace(/[%_,().\\]/g, ' ').trim()
}

export function applyGeneroRamoBuscarSql(query: any, filters: CatalogoFilterStateExtended): any {
  let q = query
  const gen = String(filters.genero_codigo ?? '').trim()
  if (gen) q = q.eq('genero_codigo', gen)

  if (filters.ramo_tipo === 'CALZADO' || filters.ramo_tipo === 'CONFECCIONES') {
    q = q.eq('ramo_tipo', filters.ramo_tipo)
  }

  const buscar = escapeIlike(String(filters.buscar ?? ''))
  if (buscar.length >= 2) {
    const pat = `%${buscar}%`
    q = q.or(
      [
        `linea_codigo.ilike.${pat}`,
        `referencia_codigo.ilike.${pat}`,
        `nombre.ilike.${pat}`,
        `descp_material.ilike.${pat}`,
        `descp_color.ilike.${pat}`,
        `material_code.ilike.${pat}`,
        `descp_marca.ilike.${pat}`,
      ].join(','),
    )
  }
  return q
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
  return applyGeneroRamoBuscarSql(q, filters)
}

/** Filtro comercial SDRM — solo v_stock_pe_rimec (MIG-162). CP no tiene es_liquidacion. */
export function applyPeCommercialSqlFilters(
  query: any,
  filters: CatalogoFilterStateExtended,
): any {
  const cadena = String(filters.cadena_comercial ?? '').trim().toUpperCase()
  if (cadena === 'LIQUIDACION') {
    return query.eq('es_liquidacion', true)
  }
  if (cadena && cadena !== 'REGULAR') {
    return query.eq('cadena_comercial', cadena)
  }
  return query
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

/** Filtros solo memoria — tono JSON · origen Todos · quincenas/depósito cruzados. */
export function applyMemoryFilters(rows: StockRow[], filters: CatalogoFilterStateExtended): StockRow[] {
  let out = rows
  if (filters.sin_tono) {
    out = out.filter(r => !etiquetaTonoFromRaw(r.color_tono_canon))
  } else if (filters.tonos?.length) {
    const tonos = new Set(filters.tonos.map(t => t.trim().toLowerCase()))
    out = out.filter(r => {
      const et = etiquetaTonoFromRaw(r.color_tono_canon)?.toLowerCase()
      return et && tonos.has(et)
    })
  }
  if (filters.origen_tipo) {
    const want = normalizeOrigenCatalogo(filters.origen_tipo)
    if (want !== 'TODOS') {
      out = out.filter(r => normalizeOrigenCatalogo(r.origen_tipo) === want)
    }
  }
  if (filters.deposito_codigo && isCatalogoOrigenTodos(filters)) {
    const dep = String(filters.deposito_codigo).trim()
    out = out.filter(r => {
      if (normalizeOrigenCatalogo(r.origen_tipo) !== 'PRONTA_ENTREGA') return true
      return String(r.deposito_nombre ?? '').trim() === dep
    })
  }
  if (filters.quincenas.length && isCatalogoOrigenTodos(filters)) {
    const qSet = new Set(filters.quincenas)
    out = out.filter(r => {
      if (normalizeOrigenCatalogo(r.origen_tipo) !== 'TRÁNSITO_PP') return true
      return r.quincena_arribo_id != null && qSet.has(r.quincena_arribo_id)
    })
  }
  const cadena = String(filters.cadena_comercial ?? '').trim().toUpperCase()
  if (cadena === 'LIQUIDACION') {
    // Solo PE tiene es_liquidacion — no borrar CP en modo Todos.
    out = out.filter(r => {
      const origen = normalizeOrigenCatalogo(r.origen_tipo)
      if (origen !== 'PRONTA_ENTREGA') return true
      return r.es_liquidacion === true
    })
  } else if (cadena && cadena !== 'REGULAR') {
    out = out.filter(r => {
      const origen = normalizeOrigenCatalogo(r.origen_tipo)
      if (origen !== 'PRONTA_ENTREGA') return true
      return String(r.cadena_comercial ?? '').toUpperCase() === cadena
    })
  }
  if (filters.ramo_tipo && isCatalogoOrigenTodos(filters)) {
    out = out.filter(r => {
      const origen = normalizeOrigenCatalogo(r.origen_tipo)
      const ramoRow = String((r as StockRow & { ramo_tipo?: string }).ramo_tipo ?? '').trim()
      const ramoEfectivo =
        ramoRow || (origen === 'PRONTA_ENTREGA' ? inferPeRamoTipo(r) : 'CALZADO')

      if (filters.ramo_tipo === 'CONFECCIONES') {
        // CP (TRÁNSITO_PP) no tiene confecciones — solo lotes PE Kyly (CHUSAR 2.2.1.0.4 §4).
        return origen === 'PRONTA_ENTREGA' && ramoEfectivo === 'CONFECCIONES'
      }
      if (filters.ramo_tipo === 'CALZADO') {
        if (origen === 'PRONTA_ENTREGA') return ramoEfectivo === 'CALZADO'
        return ramoEfectivo === 'CALZADO'
      }
      return ramoEfectivo === filters.ramo_tipo
    })
  }
  return out
}

/** Unifica pills duplicadas (ej. dos «OTROS», dos «CARTERAS») por etiqueta normalizada. */
export function dedupeFilterItemsByLabel(items: { id: number; label: string }[]): { id: number; label: string }[] {
  const byKey = new Map<string, { id: number; label: string }>()
  for (const item of items) {
    const label = String(item.label ?? '').trim()
    if (!label) continue
    const key = label.toUpperCase()
    const prev = byKey.get(key)
    if (!prev || item.id < prev.id) {
      byKey.set(key, { id: item.id, label })
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }),
  )
}

/** Evita keys React duplicadas — mismo id con labels distintos (PE+CP merge, RPC). */
export function dedupeFilterItemsById(items: { id: number; label: string }[]): { id: number; label: string }[] {
  const byId = new Map<number, { id: number; label: string }>()
  for (const item of items) {
    const id = Number(item.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const label = String(item.label ?? '').trim()
    if (!label) continue
    const prev = byId.get(id)
    if (!prev) {
      byId.set(id, { id, label })
      continue
    }
    if (prev.label === label) continue
    const pick =
      /^\d+$/.test(label) && !/^\d+$/.test(prev.label)
        ? label
        : label.length > prev.label.length
          ? label
          : prev.label
    byId.set(id, { id, label: pick })
  }
  return [...byId.values()]
}

/** Canónico sidebar catálogo — id único + label único. */
export function normalizeFilterItems(items: { id: number; label: string }[]): { id: number; label: string }[] {
  return dedupeFilterItemsByLabel(dedupeFilterItemsById(items)).sort((a, b) =>
    a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }),
  )
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
    normalizeFilterItems([...m.entries()].map(([id, label]) => ({ id, label })))
  return {
    todasLineas: toItems(lineas),
    todasMarcas: toItems(marcas),
    todosEstilos: toItems(estilos),
    todosTipos: toItems(tipos),
    todosGeneros: buildGenerosFromRows(rows),
  }
}

export function buildTonosDisponiblesFromRows(rows: StockRow[]): string[] {
  const tonos = new Set<string>()
  for (const r of rows) {
    const et = etiquetaTonoFromRaw(r.color_tono_canon)
    if (et) tonos.add(et)
  }
  return [...tonos].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

export function parseCatalogoFiltersFromSearchParams(sp: URLSearchParams): CatalogoFilterStateExtended {
  const ramoRaw = String(sp.get('ramo_tipo') ?? '').trim().toUpperCase()
  const depRaw = String(sp.get('deposito_codigo') ?? '').trim().toUpperCase()
  const sinTono = sp.get('sin_tono') === '1'
  const tonosRaw = (sp.get('tonos') ?? '').split(',').filter(Boolean)

  return {
    grupo_estilo_id: sp.get('grupo_estilo_id') ?? '',
    marca_id: sp.get('marca_id') ?? '',
    linea_ids: (sp.get('linea_ids') ?? '').split(',').filter(Boolean).map(Number),
    tipo_ids: (sp.get('tipo_ids') ?? '').split(',').filter(Boolean).map(Number),
    colores: (sp.get('colores') ?? '').split(',').filter(Boolean),
    quincenas: (sp.get('quincenas') ?? '').split(',').filter(Boolean).map(Number),
    origen_tipo: normalizeOrigenCatalogo(sp.get('origen_tipo')),
    ramo_tipo:
      ramoRaw === 'CONFECCIONES' ? 'CONFECCIONES' : ramoRaw === 'CALZADO' ? 'CALZADO' : '',
    deposito_codigo:
      depRaw === 'D1' || depRaw === 'DEP2' || depRaw === 'D3' ? depRaw : '',
    genero_codigo: sp.get('genero_codigo') ?? '',
    tonos: sinTono ? [] : tonosRaw,
    sin_tono: sinTono,
    buscar: sp.get('buscar') ?? '',
    cadena_comercial: sp.get('cadena_comercial') ?? '',
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
