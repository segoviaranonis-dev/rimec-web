import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  dedupeFilterItemsByLabel,
  normalizeFilterItems,
  type CatalogoFilterStateExtended,
  isCatalogoOrigenCp,
  isCatalogoOrigenPe,
  isCatalogoOrigenTodos,
} from '@/lib/catalogoFilters'

export type CatalogoMetaRpc = {
  marcas: { id: number; label: string }[]
  lineas: { id: number; label: string }[]
  estilos: { id: number; label: string }[]
  tipos: { id: number; label: string }[]
  generos: { codigo: string; label: string }[]
  colores: string[]
  quincenas: { id: number; label: string }[]
  tonos: string[]
}

function rpcParams(filters: CatalogoFilterStateExtended, esPe: boolean) {
  return {
    p_es_pe: esPe,
    p_marca_id: filters.marca_id ? Number(filters.marca_id) : null,
    p_linea_ids: filters.linea_ids?.length ? filters.linea_ids : null,
    p_grupo_estilo_id: filters.grupo_estilo_id ? Number(filters.grupo_estilo_id) : null,
    p_tipo_ids: filters.tipo_ids?.length ? filters.tipo_ids : null,
    p_genero_codigo: filters.genero_codigo?.trim() || null,
    p_ramo_tipo: filters.ramo_tipo || null,
    p_deposito: filters.deposito_codigo?.trim() || null,
    p_quincena_ids: filters.quincenas?.length ? filters.quincenas : null,
  }
}

async function fetchMetaRpc(
  filters: CatalogoFilterStateExtended,
  esPe: boolean,
): Promise<CatalogoMetaRpc | null> {
  const { data, error } = await getSupabaseAdmin().rpc('rimec_catalogo_meta', rpcParams(filters, esPe))
  if (error) {
    console.error('[catalogoMetaRpc]', esPe ? 'PE' : 'CP', error.message)
    return null
  }
  const raw = (data ?? {}) as CatalogoMetaRpc
  return {
    marcas: normalizeFilterItems(raw.marcas ?? []),
    lineas: normalizeFilterItems(raw.lineas ?? []),
    estilos: normalizeFilterItems(raw.estilos ?? []),
    tipos: normalizeFilterItems(raw.tipos ?? []),
    generos: raw.generos ?? [],
    colores: raw.colores ?? [],
    quincenas: raw.quincenas ?? [],
    tonos: raw.tonos ?? [],
  }
}

function mergeItems(a: { id: number; label: string }[], b: { id: number; label: string }[]) {
  const m = new Map<number, string>()
  for (const x of [...a, ...b]) {
    if (!x.id) continue
    const lbl = String(x.label ?? '').trim()
    if (lbl) m.set(x.id, lbl)
  }
  return normalizeFilterItems([...m.entries()].map(([id, label]) => ({ id, label })))
}

function mergeGeneros(a: CatalogoMetaRpc['generos'], b: CatalogoMetaRpc['generos']) {
  const m = new Map<string, string>()
  for (const g of [...a, ...b]) {
    const c = String(g.codigo ?? '').trim()
    if (c) m.set(c, String(g.label ?? c).trim() || c)
  }
  const orden = ['DAMAS', 'CABALLEROS', 'NINAS', 'NINOS']
  return [...m.entries()]
    .sort((x, y) => orden.indexOf(x[0]) - orden.indexOf(y[0]))
    .map(([codigo, label]) => ({ codigo, label }))
}

/** Meta sidebar vía RPC SQL (CAT-LAT-T2) — fallback null → scan legacy. */
export async function fetchCatalogoMetaViaRpc(
  filters: CatalogoFilterStateExtended,
): Promise<CatalogoMetaRpc | null> {
  if (isCatalogoOrigenPe(filters)) {
    return fetchMetaRpc(filters, true)
  }
  if (isCatalogoOrigenCp(filters)) {
    return fetchMetaRpc(filters, false)
  }
  if (isCatalogoOrigenTodos(filters)) {
    // Confecciones = solo PE (638). CP no aporta marcas ni meta (evita mezclar Actvitta/Vizzano con Kyly).
    if (filters.ramo_tipo === 'CONFECCIONES') {
      return fetchMetaRpc(
        { ...filters, origen_tipo: 'PRONTA_ENTREGA', quincenas: [] as number[] },
        true,
      )
    }

    const cpF = {
      ...filters,
      origen_tipo: 'TRÁNSITO_PP',
      ramo_tipo: (filters.ramo_tipo === 'CALZADO' ? 'CALZADO' : '') as '' | 'CALZADO' | 'CONFECCIONES',
      deposito_codigo: '' as const,
      quincenas: [] as number[],
    }
    const peF = {
      ...filters,
      origen_tipo: 'PRONTA_ENTREGA',
      quincenas: [] as number[],
      ramo_tipo: (filters.ramo_tipo === 'CALZADO' ? 'CALZADO' : filters.ramo_tipo) as '' | 'CALZADO' | 'CONFECCIONES',
    }
    const [cp, pe] = await Promise.all([fetchMetaRpc(cpF, false), fetchMetaRpc(peF, true)])
    if (!cp && !pe) return null
    const empty: CatalogoMetaRpc = { marcas: [], lineas: [], estilos: [], tipos: [], generos: [], colores: [], quincenas: [], tonos: [] }
    const a = cp ?? empty
    const b = pe ?? empty
    return {
      marcas: mergeItems(a.marcas, b.marcas),
      lineas: mergeItems(a.lineas, b.lineas),
      estilos: mergeItems(a.estilos, b.estilos),
      tipos: mergeItems(a.tipos, b.tipos),
      generos: mergeGeneros(a.generos, b.generos),
      colores: [...new Set([...a.colores, ...b.colores])].sort((x, y) => x.localeCompare(y, 'es')),
      quincenas: mergeItems(
        a.quincenas.map(q => ({ id: q.id, label: q.label })),
        b.quincenas.map(q => ({ id: q.id, label: q.label })),
      ).map(x => ({ id: x.id, label: x.label })),
      tonos: [...new Set([...a.tonos, ...b.tonos])].sort((x, y) => x.localeCompare(y, 'es')),
    }
  }
  return null
}

export function metaRpcToFiltrosResponse(meta: CatalogoMetaRpc) {
  return {
    filtros: {
      todasLineas: meta.lineas,
      todasMarcas: meta.marcas,
      todosEstilos: meta.estilos,
      todosTipos: meta.tipos,
      todosGeneros: meta.generos,
    },
    colores: meta.colores,
    quincenas: meta.quincenas,
    tonosDisponibles: meta.tonos,
  }
}
