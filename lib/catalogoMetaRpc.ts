import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { formatQuincenaCorta } from '@/lib/datoDuroCabecera'
import {
  buildColoresFromRows,
  buildFiltrosFromRows,
  buildTonosDisponiblesFromRows,
  dedupeFilterItemsByLabel,
  generoCodigosActivos,
  mergeTiposCatalogoTodos,
  normalizeFilterItems,
  type CatalogoFilterStateExtended,
  isCatalogoOrigenCp,
  isCatalogoOrigenPe,
  isCatalogoOrigenTodos,
} from '@/lib/catalogoFilters'
import type { StockRow } from '@/app/catalogo-types'
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

function rpcParamsV199(filters: CatalogoFilterStateExtended, esPe: boolean) {
  const marcas = filters.marca_ids?.length
    ? filters.marca_ids
    : filters.marca_id ? [Number(filters.marca_id)] : []
  const estilos = filters.grupo_estilo_ids?.length
    ? filters.grupo_estilo_ids
    : filters.grupo_estilo_id ? [Number(filters.grupo_estilo_id)] : []
  const generos = generoCodigosActivos(filters)
  const quincenaIds = quincenasIdsFromDatoDuroCp(filters.dato_duro_cp).length
    ? quincenasIdsFromDatoDuroCp(filters.dato_duro_cp)
    : filters.quincenas?.length
      ? filters.quincenas
      : null
  return {
    p_es_pe: esPe,
    p_marca_ids: marcas.length ? marcas : null,
    p_linea_ids: filters.linea_ids?.length ? filters.linea_ids : null,
    p_grupo_estilo_ids: estilos.length ? estilos : null,
    p_tipo_ids: filters.tipo_ids?.filter((id) => id > 0).length
      ? filters.tipo_ids.filter((id) => id > 0)
      : null,
    p_genero_codigos: generos.length ? generos : null,
    p_ramo_tipo: filters.ramo_tipo || null,
    p_deposito: filters.deposito_codigo?.trim() || null,
    p_quincena_ids: quincenaIds,
  }
}

/** MIG-181 — fallback si MIG-199 aún no aplicada en Supabase. */
function rpcParamsLegacy181(filters: CatalogoFilterStateExtended, esPe: boolean) {
  const v = rpcParamsV199(filters, esPe)
  return {
    p_es_pe: v.p_es_pe,
    p_marca_id: v.p_marca_ids?.length === 1 ? v.p_marca_ids[0] : null,
    p_linea_ids: v.p_linea_ids,
    p_grupo_estilo_id: v.p_grupo_estilo_ids?.length === 1 ? v.p_grupo_estilo_ids[0] : null,
    p_tipo_ids: v.p_tipo_ids,
    p_genero_codigo: v.p_genero_codigos?.length === 1 ? v.p_genero_codigos[0] : null,
    p_ramo_tipo: v.p_ramo_tipo,
    p_deposito: v.p_deposito,
    p_quincena_ids: v.p_quincena_ids,
  }
}


function normalizeMetaRpcRaw(data: CatalogoMetaRpc | null): CatalogoMetaRpc {
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

function mergeMetaRpcParts(parts: CatalogoMetaRpc[]): CatalogoMetaRpc {
  const empty: CatalogoMetaRpc = {
    marcas: [],
    lineas: [],
    estilos: [],
    tipos: [],
    generos: [],
    colores: [],
    quincenas: [],
    tonos: [],
  }
  return parts.reduce((acc, part) => {
    return {
      marcas: mergeItems(acc.marcas, part.marcas),
      lineas: mergeItems(acc.lineas, part.lineas),
      estilos: mergeItems(acc.estilos, part.estilos),
      tipos: mergeItems(acc.tipos, part.tipos),
      generos: mergeGeneros(acc.generos, part.generos),
      colores: [...new Set([...acc.colores, ...part.colores])].sort((x, y) =>
        x.localeCompare(y, 'es'),
      ),
      quincenas: mergeItems(
        acc.quincenas.map((q) => ({ id: q.id, label: q.label })),
        part.quincenas.map((q) => ({ id: q.id, label: q.label })),
      ).map((x) => ({ id: x.id, label: x.label })),
      tonos: [...new Set([...acc.tonos, ...part.tonos])].sort((x, y) =>
        x.localeCompare(y, 'es'),
      ),
    }
  }, empty)
}

async function rpcMetaLegacyOrV199(
  filters: CatalogoFilterStateExtended,
  esPe: boolean,
): Promise<CatalogoMetaRpc | null> {
  const admin = getSupabaseAdmin()
  // MIG-199 opcional — legacy MIG-181 sigue siendo canónico en prod hasta migrar.
  const legacy = await admin.rpc('rimec_catalogo_meta', rpcParamsLegacy181(filters, esPe))
  let data = legacy.data as CatalogoMetaRpc | null
  if (legacy.error) {
    const v199 = await admin.rpc('rimec_catalogo_meta', rpcParamsV199(filters, esPe))
    if (v199.error) {
      console.error('[catalogoMetaRpc]', esPe ? 'PE' : 'CP', v199.error.message)
      return null
    }
    data = v199.data as CatalogoMetaRpc | null
  }
  return normalizeMetaRpcRaw(data)
}

async function fetchMetaRpcOnce(
  filters: CatalogoFilterStateExtended,
  esPe: boolean,
): Promise<CatalogoMetaRpc | null> {
  const marcaIds = filters.marca_ids?.length
    ? filters.marca_ids
    : filters.marca_id
      ? [Number(filters.marca_id)]
      : []
  // Legacy MIG-181 solo acepta 1 marca — multi → 1 RPC por id y merge (evita universo 841).
  if (marcaIds.length > 1) {
    const parts = await Promise.all(
      marcaIds.map((id) =>
        rpcMetaLegacyOrV199(
          { ...filters, marca_id: String(id), marca_ids: [id] },
          esPe,
        ),
      ),
    )
    const ok = parts.filter((p): p is CatalogoMetaRpc => Boolean(p))
    if (!ok.length) return null
    return mergeMetaRpcParts(ok)
  }
  return rpcMetaLegacyOrV199(filters, esPe)
}

/** Dimensión sidebar (AB-CR · Marca · Género · quincena…) activa — acota meta desde stock. */
function tieneFiltrosDimensionMeta(filters: CatalogoFilterStateExtended): boolean {
  return (
    (filters.tipo_ids?.length ?? 0) > 0 ||
    (filters.marca_ids?.length ?? 0) > 0 ||
    Boolean(filters.marca_id) ||
    (filters.grupo_estilo_ids?.length ?? 0) > 0 ||
    Boolean(filters.grupo_estilo_id) ||
    generoCodigosActivos(filters).length > 0 ||
    (filters.dato_duro_cp?.length ?? 0) > 0 ||
    (filters.preventas?.length ?? 0) > 0 ||
    Boolean(filters.deposito_codigo?.trim()) ||
    (filters.quincenas?.length ?? 0) > 0 ||
    (filters.tipo_grupos?.length ?? 0) > 0
  )
}

/** Molécula (Línea · Material · Color · Tono) — cascada hacia hoja. */
function tieneFiltrosMoleculaMeta(filters: CatalogoFilterStateExtended): boolean {
  return (
    (filters.linea_ids?.length ?? 0) > 0 ||
    (filters.colores?.length ?? 0) > 0 ||
    (filters.tonos?.length ?? 0) > 0 ||
    Boolean(filters.sin_tono) ||
    (filters.material_familias?.length ?? 0) > 0 ||
    (filters.color_familias?.length ?? 0) > 0
  )
}

export function tieneFiltrosAcotarMeta(filters: CatalogoFilterStateExtended): boolean {
  return tieneFiltrosDimensionMeta(filters) || tieneFiltrosMoleculaMeta(filters)
}

export { tieneFiltrosMoleculaMeta }

/** @deprecated alias interno */
function tieneFiltrosCascadaMeta(filters: CatalogoFilterStateExtended): boolean {
  return tieneFiltrosAcotarMeta(filters)
}

/** Facetas acotadas por stock vivo cuando hay filtro activo; sin filtros = universo completo. */
async function fetchMetaRpc(
  filters: CatalogoFilterStateExtended,
  esPe: boolean,
): Promise<CatalogoMetaRpc | null> {
  if (!tieneFiltrosAcotarMeta(filters)) {
    return fetchMetaRpcOnce(filtersForFacetUniverse(filters), esPe)
  }
  return fetchMetaRpcOnce(filters, esPe)
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

/** TODOS+Calzado: 1 RPC/origen si landing; cascada si dimensión o molécula activa. */
async function fetchMetaRpcEfficient(
  filters: CatalogoFilterStateExtended,
  esPe: boolean,
): Promise<CatalogoMetaRpc | null> {
  if (tieneFiltrosAcotarMeta(filters)) return fetchMetaRpc(filters, esPe)
  return fetchMetaRpcOnce(filtersForFacetUniverse(filters), esPe)
}

/** Ley siamese — landing sin filtros: orden maestras. Con cascada activa: stock manda (no inflar). */
async function applyMaestrasTrianguloPilares(
  meta: CatalogoMetaRpc | null,
  filters: CatalogoFilterStateExtended,
): Promise<CatalogoMetaRpc | null> {
  if (!meta) return null
  if (esRamoAccesorios(filters.ramo_tipo)) return meta

  const acotar = tieneFiltrosAcotarMeta(filters)
  if (acotar) {
    return finalizeMeta(meta, filters)
  }

  const { loadMaestrasTrianguloCatalogo } = await import('@/lib/pilares/loadMaestrasTriangulo')
  const maestras = await loadMaestrasTrianguloCatalogo(filters.ramo_tipo)
  if (!maestras) return finalizeMeta(meta, filters)

  const next: CatalogoMetaRpc = {
    ...meta,
    estilos: maestras.estilos.length ? maestras.estilos : meta.estilos,
    generos: maestras.generos.length ? maestras.generos : meta.generos,
  }
  return finalizeMeta(next, filters) ?? next
}

/** Dimensión sola — meta Estilo/Marca/Tipo sin molécula (evita linea_ids obsoletos en URL). */
export function filtersForMetaDimension(filters: CatalogoFilterStateExtended): CatalogoFilterStateExtended {
  return {
    ...filters,
    grupo_estilo_id: '',
    grupo_estilo_ids: [],
    linea_ids: [],
    material_familias: [],
    color_familias: [],
    colores: [],
    tonos: [],
    sin_tono: false,
  }
}

/** Dimensión + Estilo — acota Línea/Color/Tono; sin línea/material/color hoja. */
export function filtersForMetaEstilo(filters: CatalogoFilterStateExtended): CatalogoFilterStateExtended {
  return {
    ...filters,
    linea_ids: [],
    material_familias: [],
    color_familias: [],
    colores: [],
    tonos: [],
    sin_tono: false,
  }
}

export function tieneFiltrosEstiloMeta(filters: CatalogoFilterStateExtended): boolean {
  return (filters.grupo_estilo_ids?.length ?? 0) > 0 || Boolean(filters.grupo_estilo_id)
}

/** Meta sidebar en capas: dimensión → estilo → molécula completa. */
export async function fetchCatalogoMetaViaRpcCascada(
  filters: CatalogoFilterStateExtended,
): Promise<CatalogoMetaRpc | null> {
  const dim = await fetchCatalogoMetaViaRpc(filtersForMetaDimension(filters))
  if (!dim) return null
  if (!tieneFiltrosEstiloMeta(filters) && !tieneFiltrosMoleculaMeta(filters)) {
    return dim
  }
  const est = await fetchCatalogoMetaViaRpc(filtersForMetaEstilo(filters))
  if (!est) return dim
  const merged: CatalogoMetaRpc = {
    ...dim,
    lineas: est.lineas,
    colores: est.colores,
    tonos: est.tonos,
  }
  if (!tieneFiltrosMoleculaMeta(filters)) return merged
  const full = await fetchCatalogoMetaViaRpc(filters)
  if (!full) return merged
  return {
    ...merged,
    lineas: full.lineas.length ? full.lineas : merged.lineas,
    colores: full.colores.length ? full.colores : merged.colores,
    tonos: full.tonos.length ? full.tonos : merged.tonos,
  }
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
      const [cp, pe] = await Promise.all([fetchMetaRpcEfficient(cpConf, false), fetchMetaRpcEfficient(peConf, true)])
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
    const [cp, pe] = await Promise.all([fetchMetaRpcEfficient(cpF, false), fetchMetaRpcEfficient(peF, true)])
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

/** tipo_grupos no vive en RPC SQL — acota meta desde filas filtradas en memoria. */
export function acotarMetaRpcDesdeFilas(
  meta: CatalogoMetaRpc,
  rows: StockRow[],
  ramo_tipo?: string,
): CatalogoMetaRpc {
  if (!rows.length) return meta
  const f = buildFiltrosFromRows(rows, ramo_tipo)
  const idSet = (items: { id: number }[]) => new Set(items.map((x) => x.id))
  const marcaIds = idSet(f.todasMarcas)
  const lineaIds = idSet(f.todasLineas)
  const estiloIds = idSet(f.todosEstilos)
  const tipoIds = idSet(f.todosTipos)
  const genCodigos = new Set(f.todosGeneros.map((g) => g.codigo))
  return {
    marcas: meta.marcas.filter((m) => marcaIds.has(m.id)),
    lineas: meta.lineas.filter((l) => lineaIds.has(l.id)),
    estilos: meta.estilos.filter((e) => estiloIds.has(e.id)),
    tipos: meta.tipos.filter((t) => tipoIds.has(t.id)),
    generos: meta.generos.filter((g) => genCodigos.has(g.codigo)),
    colores: buildColoresFromRows(rows),
    quincenas: meta.quincenas,
    tonos: buildTonosDisponiblesFromRows(rows),
  }
}
