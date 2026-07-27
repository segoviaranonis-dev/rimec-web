import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { supabase } from './supabase'
import {
  cargarMetaLineasDesdePilar,
  enriquecerMetaConLinea,
} from './atributosLinea'
import { fetchCatalogoMetaRows } from './catalogoData'
import { cajasDisponiblesDeFila } from './disponibilidad'
import {
  fetchCatalogoMetaViaRpc,
  type CatalogoMetaRpc,
} from './catalogoMetaRpc'
import {
  dedupeFilterItemsByLabel,
  normalizeFilterItems,
  type CatalogoFilterStateExtended,
} from './catalogoFilters'
import { getSupabaseAdmin } from './supabaseAdmin'

export interface FilterItem {
  id: number
  label: string
}

export interface SectionData {
  label:   string
  lineas:  FilterItem[]
  marcas:  FilterItem[]
  estilos: FilterItem[]
  tipos:   FilterItem[]
}

export interface HeaderData {
  mujeres: SectionData
  ninas:   SectionData
  hombres: SectionData
  ninos:   SectionData
}

const FALLBACK = {
  header: {
    mujeres: { label: 'Damas', lineas: [], marcas: [], estilos: [], tipos: [] },
    ninas:   { label: 'Niñas', lineas: [], marcas: [], estilos: [], tipos: [] },
    ninos:   { label: 'Niños', lineas: [], marcas: [], estilos: [], tipos: [] },
    hombres: { label: 'Caballeros', lineas: [], marcas: [], estilos: [], tipos: [] },
  },
  todasLineas: [],
  todasMarcas: [],
  todosEstilos: [],
  todosTipos: [],
}

const GENERO_SECTIONS = [
  { codigo: 'DAMAS', key: 'mujeres' as const, label: 'Damas' },
  { codigo: 'NINAS', key: 'ninas' as const, label: 'Niñas' },
  { codigo: 'NINOS', key: 'ninos' as const, label: 'Niños' },
  { codigo: 'CABALLEROS', key: 'hombres' as const, label: 'Caballeros' },
]

const CP_BASE_FILTERS: CatalogoFilterStateExtended = {
  grupo_estilo_id: '',
  marca_id: '',
  linea_ids: [],
  tipo_ids: [],
  colores: [],
  quincenas: [],
  origen_tipo: 'TRÁNSITO_PP',
  ramo_tipo: 'CALZADO',
  deposito_codigo: '',
  genero_codigo: '',
  tonos: [],
  sin_tono: false,
  buscar: '',
}

function sectionFromMeta(label: string, meta: CatalogoMetaRpc): SectionData {
  return {
    label,
    lineas: meta.lineas,
    marcas: meta.marcas,
    estilos: meta.estilos,
    tipos: meta.tipos,
  }
}

function normalizeMetaSlice(raw: Partial<CatalogoMetaRpc> | null | undefined): CatalogoMetaRpc {
  const empty: CatalogoMetaRpc = {
    marcas: [], lineas: [], estilos: [], tipos: [],
    generos: [], colores: [], quincenas: [], tonos: [],
  }
  if (!raw) return empty
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

/** MIG-157 — 1 RPC header (global + 4 géneros). Fallback: 5× rimec_catalogo_meta. */
async function getFiltrosFromRpc() {
  try {
    const { data, error } = await getSupabaseAdmin().rpc('rimec_catalogo_header_meta')
    if (!error && data) {
      const payload = data as {
        global?: Partial<CatalogoMetaRpc>
        secciones?: Record<string, Partial<CatalogoMetaRpc>>
      }
      const global = normalizeMetaSlice(payload.global)
      const sec = payload.secciones ?? {}
      if (global.lineas.length || global.marcas.length) {
        return {
          header: {
            mujeres: sectionFromMeta('Damas', normalizeMetaSlice(sec.DAMAS ?? global)),
            ninas: sectionFromMeta('Niñas', normalizeMetaSlice(sec.NINAS ?? global)),
            ninos: sectionFromMeta('Niños', normalizeMetaSlice(sec.NINOS ?? global)),
            hombres: sectionFromMeta('Caballeros', normalizeMetaSlice(sec.CABALLEROS ?? global)),
          },
          todasLineas: global.lineas,
          todasMarcas: global.marcas,
          todosEstilos: global.estilos,
          todosTipos: global.tipos,
        }
      }
    } else if (error) {
      console.error('[filtros] header_meta', error.message)
    }
  } catch (e) {
    console.error('[filtros] header_meta', e)
  }

  const [global, ...byGenero] = await Promise.all([
    fetchCatalogoMetaViaRpc(CP_BASE_FILTERS),
    ...GENERO_SECTIONS.map(g =>
      fetchCatalogoMetaViaRpc({ ...CP_BASE_FILTERS, genero_codigo: g.codigo }),
    ),
  ])
  if (!global) return null

  return {
    header: {
      mujeres: sectionFromMeta('Damas', byGenero[0] ?? global),
      ninas: sectionFromMeta('Niñas', byGenero[1] ?? global),
      ninos: sectionFromMeta('Niños', byGenero[2] ?? global),
      hombres: sectionFromMeta('Caballeros', byGenero[3] ?? global),
    },
    todasLineas: global.lineas,
    todasMarcas: global.marcas,
    todosEstilos: global.estilos,
    todosTipos: global.tipos,
  }
}

const cachedHeaderRpc = unstable_cache(
  async () => getFiltrosFromRpc(),
  ['catalogo-header-rpc-v2-mig157'],
  { revalidate: 300 },
)

async function getFiltrosLegacy() {
  const { data: stockMetaRaw, error } = await fetchCatalogoMetaRows<any>(supabase)

  if (error || !stockMetaRaw) {
    console.error('[filtros] Error fetching stockMeta:', {
      error,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    })
    return FALLBACK
  }

  const stockMeta = stockMetaRaw.filter(row => cajasDisponiblesDeFila(row) > 0)
  if (stockMeta.length === 0) return FALLBACK

  const lineaMeta = await cargarMetaLineasDesdePilar(stockMeta.map(m => Number(m.linea_id)))
  const meta = enriquecerMetaConLinea(stockMeta, lineaMeta)

  const init = () => ({
    label: '',
    lineas:  new Map<number, string>(),
    marcas:  new Map<number, string>(),
    estilos: new Map<number, string>(),
    tipos:   new Map<number, string>(),
  })

  const sections: Record<string, ReturnType<typeof init>> = {
    DAMAS: init(),
    NINAS: init(),
    NINOS: init(),
    CABALLEROS: init(),
  }

  const todasMarcas  = new Map<number, string>()
  const todosEstilos = new Map<number, string>()
  const todasLineas  = new Map<number, string>()
  const todosTipos   = new Map<number, string>()

  const addEstilo = (id: number, label: string) => {
    const parsedId = Number(id)
    if (!parsedId) return
    const lbl = String(label || '').trim() || `Estilo ${parsedId}`
    todosEstilos.set(parsedId, lbl)
  }
  const addTipo = (id: number, label: string) => {
    const parsedId = Number(id)
    if (!parsedId) return
    const lbl = String(label || '').trim() || `Tipo ${parsedId}`
    todosTipos.set(parsedId, lbl)
  }

  for (const row of meta) {
    if (row.marca_id) {
      todasMarcas.set(row.marca_id, row.descp_marca || `Marca ${row.marca_id}`)
    }
    if (row.grupo_estilo_id) {
      addEstilo(Number(row.grupo_estilo_id), row.descp_grupo_estilo ?? '')
    }
    if (row.linea_id) {
      todasLineas.set(row.linea_id, row.linea_codigo || `Línea ${row.linea_id}`)
    }
    if (row.tipo_1_id) {
      addTipo(Number(row.tipo_1_id), row.descp_tipo_1 ?? '')
    }

    const genCodigo = String(row.genero_codigo || '').trim()
    const genDesc = String(row.descp_genero || '').trim()
    const sec = sections[genCodigo]
    if (!sec) continue
    if (!sec.label) sec.label = genDesc || genCodigo

    if (row.marca_id) {
      sec.marcas.set(row.marca_id, row.descp_marca || `Marca ${row.marca_id}`)
    }
    if (row.grupo_estilo_id) {
      const estId = Number(row.grupo_estilo_id)
      if (estId) {
        addEstilo(estId, row.descp_grupo_estilo ?? '')
        sec.estilos.set(estId, todosEstilos.get(estId) || `Estilo ${estId}`)
      }
    }
    if (row.linea_id) {
      sec.lineas.set(row.linea_id, row.linea_codigo || `Línea ${row.linea_id}`)
    }
    if (row.tipo_1_id) {
      const tId = Number(row.tipo_1_id)
      if (tId) {
        addTipo(tId, row.descp_tipo_1 ?? '')
        sec.tipos.set(tId, todosTipos.get(tId) || `Tipo ${tId}`)
      }
    }
  }

  const toItems = (m: Map<number, string>): FilterItem[] =>
    normalizeFilterItems(
      Array.from(m.entries()).map(([id, label]) => ({
        id,
        label: String(label || '').trim() || `ID ${id}`,
      })),
    )

  const formatSec = (s: ReturnType<typeof init>): SectionData => ({
    label:   s.label || 'Damas',
    lineas:  toItems(s.lineas),
    marcas:  toItems(s.marcas),
    estilos: toItems(s.estilos),
    tipos:   toItems(s.tipos),
  })

  return {
    header: {
      mujeres: formatSec(sections.DAMAS),
      ninas:   formatSec(sections.NINAS),
      ninos:   formatSec(sections.NINOS),
      hombres: formatSec(sections.CABALLEROS),
    },
    todasLineas:  toItems(todasLineas),
    todasMarcas:  toItems(todasMarcas),
    todosEstilos: toItems(todosEstilos),
    todosTipos:   toItems(todosTipos),
  }
}

export const getFiltros = cache(async function getFiltros() {
  try {
    const rpc = await cachedHeaderRpc()
    if (rpc) return rpc
    return await getFiltrosLegacy()
  } catch (err) {
    console.error('[filtros] Critical error in getFiltros:', err)
    return FALLBACK
  }
})
