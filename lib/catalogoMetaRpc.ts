import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { formatQuincenaCorta } from '@/lib/datoDuroCabecera'
import {
  dedupeFilterItemsByLabel,
  generoCodigosActivos,
  mergeTiposCatalogoTodos,
  normalizeFilterItems,
  type CatalogoFilterStateExtended,
  isCatalogoOrigenCp,
  isCatalogoOrigenPe,
  isCatalogoOrigenTodos,
} from '@/lib/catalogoFilters'
import { quincenasIdsFromDatoDuroCp } from '@/lib/datoDuroCpFiltro'
import { calzadoExcluyeCarterasPorDefecto, esMarcaFantasmaFiltro } from '@/lib/filtros/filtro-tipo-canonico'
import {
  esLabelModuloAccesorios,
  esRamoAccesorios,
  mergePeAbcrTipo1Items,
  tiposMetaModuloAccesorios,
} from '@/lib/filtros/modulo-accesorios'

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

/** Universo facetas multi-select — CHUSAR cabecera: pills multi en Marca/Estilo/Tipo/Línea/Género. */
export function filtersForFacetUniverse(filters: CatalogoFilterStateExtended): CatalogoFilterStateExtended {
  return {
    ...filters,
    marca_id: '',
    marca_ids: [],
    grupo_estilo_id: '',
    grupo_estilo_ids: [],
    linea_ids: [],
    tipo_ids: [],
    material_familias: [],
    color_familias: [],
    tipo_grupos: [],
    colores: [],
    tonos: [],
    sin_tono: false,
    genero_codigo: '',
    genero_codigos: [],
    quincenas: [],
    dato_duro_cp: [],
    preventas: [],
    buscar: '',
    cadena_comercial: '',
  }
}

function rpcParams(filters: CatalogoFilterStateExtended, esPe: boolean) {
  const marcas = filters.marca_ids?.length
    ? filters.marca_ids
    : filters.marca_id ? [Number(filters.marca_id)] : []
  const estilos = filters.grupo_estilo_ids?.length
    ? filters.grupo_estilo_ids
    : filters.grupo_estilo_id ? [Number(filters.grupo_estilo_id)] : []
  const quincenaIds = quincenasIdsFromDatoDuroCp(filters.dato_duro_cp).length
    ? quincenasIdsFromDatoDuroCp(filters.dato_duro_cp)
    : filters.quincenas?.length
      ? filters.quincenas
      : null
  return {
    p_es_pe: esPe,
    // Cascada línea/color/tono — grilla usa .in() multi; meta legacy solo 1 FK.
    p_marca_id: marcas.length === 1 ? marcas[0] : null,
    p_linea_ids: filters.linea_ids?.length ? filters.linea_ids : null,
    p_grupo_estilo_id: estilos.length === 1 ? estilos[0] : null,
    p_tipo_ids: filters.tipo_ids?.filter((id) => id > 0).length
      ? filters.tipo_ids.filter((id) => id > 0)
      : null,
    p_genero_codigo: (() => {
      const gens = generoCodigosActivos(filters)
      return gens.length === 1 ? gens[0] : null
    })(),
    p_ramo_tipo: filters.ramo_tipo || null,
    p_deposito: filters.deposito_codigo?.trim() || null,
    p_quincena_ids: quincenaIds,
  }
}

const EMPTY_META: CatalogoMetaRpc = {
  marcas: [],
  lineas: [],
  estilos: [],
  tipos: [],
  generos: [],
  colores: [],
  quincenas: [],
  tonos: [],
}

async function fetchMetaRpcOnce(
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
    quincenas: (raw.quincenas ?? []).map((q) => ({
      id: q.id,
      label: formatQuincenaCorta(q.label) || String(q.label ?? ''),
    })),
    tonos: raw.tonos ?? [],
  }
}

/** Facetas multi-select: listas completas sin auto-estrechar; cascada solo Color/Tono. */
async function fetchMetaRpc(
  filters: CatalogoFilterStateExtended,
  esPe: boolean,
): Promise<CatalogoMetaRpc | null> {
  const [universe, cascade] = await Promise.all([
    fetchMetaRpcOnce(filtersForFacetUniverse(filters), esPe),
    fetchMetaRpcOnce(filters, esPe),
  ])
  if (!universe && !cascade) return null
  const u = universe ?? EMPTY_META
  const c = cascade ?? EMPTY_META
  return {
    marcas: u.marcas,
    estilos: u.estilos,
    tipos: u.tipos,
    generos: u.generos,
    lineas: u.lineas,
    quincenas: u.quincenas.length ? u.quincenas : c.quincenas,
    colores: c.colores,
    tonos: c.tonos,
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

function stripAccesoriosFromMetaIfCalzado(
  meta: CatalogoMetaRpc,
  filters: CatalogoFilterStateExtended,
): CatalogoMetaRpc {
  if (!calzadoExcluyeCarterasPorDefecto(filters)) return meta
  const isAcc = (label: string) => esLabelModuloAccesorios(label)
  const tiposFiltrados = meta.tipos.filter((t) => !isAcc(t.label))
  return {
    ...meta,
    estilos: meta.estilos.filter((e) => !isAcc(e.label)),
    tipos: mergePeAbcrTipo1Items(tiposFiltrados),
  }
}

function metaSoloModuloAccesorios(meta: CatalogoMetaRpc): CatalogoMetaRpc {
  const isAcc = (label: string) => esLabelModuloAccesorios(label)
  return {
    ...meta,
    estilos: meta.estilos.filter((e) => isAcc(e.label)),
    tipos: tiposMetaModuloAccesorios(meta.tipos),
  }
}

function finalizeMeta(
  meta: CatalogoMetaRpc | null,
  filters: CatalogoFilterStateExtended,
): CatalogoMetaRpc | null {
  if (!meta) return null
  if (esRamoAccesorios(filters.ramo_tipo)) return metaSoloModuloAccesorios(meta)
  return stripAccesoriosFromMetaIfCalzado(meta, filters)
}

/** Ley siamese 2026-07-29 — Estilo/Género = FK Administrador Pilares (no distinct stock). */
async function applyMaestrasTrianguloPilares(
  meta: CatalogoMetaRpc | null,
  filters: CatalogoFilterStateExtended,
): Promise<CatalogoMetaRpc | null> {
  if (!meta) return null
  if (esRamoAccesorios(filters.ramo_tipo)) return meta
  const { loadMaestrasTrianguloCatalogo } = await import('@/lib/pilares/loadMaestrasTriangulo')
  const maestras = await loadMaestrasTrianguloCatalogo(filters.ramo_tipo)
  if (!maestras) return meta
  let next: CatalogoMetaRpc = {
    ...meta,
    estilos: maestras.estilos,
    generos: maestras.generos,
  }
  return finalizeMeta(next, filters) ?? next
}

/** Meta sidebar vía RPC SQL (CAT-LAT-T2) — fallback null → scan legacy. */
export async function fetchCatalogoMetaViaRpc(
  filters: CatalogoFilterStateExtended,
): Promise<CatalogoMetaRpc | null> {
  const raw = await fetchCatalogoMetaViaRpcRaw(filters)
  return applyMaestrasTrianguloPilares(raw, filters)
}

async function fetchCatalogoMetaViaRpcRaw(
  filters: CatalogoFilterStateExtended,
): Promise<CatalogoMetaRpc | null> {
  if (isCatalogoOrigenPe(filters)) {
    return finalizeMeta(await fetchMetaRpc(filters, true), filters)
  }
  if (isCatalogoOrigenCp(filters)) {
    return finalizeMeta(await fetchMetaRpc(filters, false), filters)
  }
  if (isCatalogoOrigenTodos(filters)) {
    if (esRamoAccesorios(filters.ramo_tipo)) {
      const peAcc = {
        ...filters,
        origen_tipo: 'PRONTA_ENTREGA' as const,
        quincenas: [] as number[],
        ramo_tipo: 'CALZADO' as const,
      }
      return finalizeMeta(await fetchMetaRpc(peAcc, true), filters)
    }
    // Confecciones = CP 638 + PE confecciones (no PE-only).
    if (filters.ramo_tipo === 'CONFECCIONES') {
      const cpConf = {
        ...filters,
        origen_tipo: 'TRÁNSITO_PP' as const,
        ramo_tipo: 'CONFECCIONES' as const,
        deposito_codigo: '' as const,
        quincenas: [] as number[],
      }
      const peConf = {
        ...filters,
        origen_tipo: 'PRONTA_ENTREGA' as const,
        quincenas: [] as number[],
        ramo_tipo: 'CONFECCIONES' as const,
      }
      const [cp, pe] = await Promise.all([fetchMetaRpc(cpConf, false), fetchMetaRpc(peConf, true)])
      if (!cp && !pe) return null
      const empty: CatalogoMetaRpc = { marcas: [], lineas: [], estilos: [], tipos: [], generos: [], colores: [], quincenas: [], tonos: [] }
      const a = cp ?? empty
      const b = pe ?? empty
      return finalizeMeta({
        marcas: mergeItems(a.marcas, b.marcas),
        lineas: mergeItems(a.lineas, b.lineas),
        estilos: mergeItems(a.estilos, b.estilos),
        tipos: mergeTiposCatalogoTodos(a.tipos, b.tipos, filters.ramo_tipo),
        generos: mergeGeneros(a.generos, b.generos),
        colores: [...new Set([...a.colores, ...b.colores])].sort((x, y) => x.localeCompare(y, 'es')),
        quincenas: mergeItems(
          a.quincenas.map(q => ({ id: q.id, label: q.label })),
          b.quincenas.map(q => ({ id: q.id, label: q.label })),
        ).map(x => ({ id: x.id, label: x.label })),
        tonos: [...new Set([...a.tonos, ...b.tonos])].sort((x, y) => x.localeCompare(y, 'es')),
      }, filters)
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
    return finalizeMeta({
      marcas: mergeItems(a.marcas, b.marcas),
      lineas: mergeItems(a.lineas, b.lineas),
      estilos: mergeItems(a.estilos, b.estilos),
      tipos: mergeTiposCatalogoTodos(a.tipos, b.tipos, filters.ramo_tipo),
      generos: mergeGeneros(a.generos, b.generos),
      colores: [...new Set([...a.colores, ...b.colores])].sort((x, y) => x.localeCompare(y, 'es')),
      quincenas: mergeItems(
        a.quincenas.map(q => ({ id: q.id, label: q.label })),
        b.quincenas.map(q => ({ id: q.id, label: q.label })),
      ).map(x => ({ id: x.id, label: x.label })),
      tonos: [...new Set([...a.tonos, ...b.tonos])].sort((x, y) => x.localeCompare(y, 'es')),
    }, filters)
  }
  return null
}

export function metaRpcToFiltrosResponse(meta: CatalogoMetaRpc) {
  return {
    filtros: {
      todasLineas: meta.lineas,
      todasMarcas: (meta.marcas ?? []).filter((m) => !esMarcaFantasmaFiltro(String(m?.label ?? ''))),
      todosEstilos: meta.estilos,
      todosTipos: meta.tipos,
      todosGeneros: meta.generos,
    },
    colores: meta.colores,
    quincenas: meta.quincenas,
    tonosDisponibles: meta.tonos,
  }
}
