import { cache } from 'react'
import { supabase } from './supabase'
import {
  cargarMetaLineasDesdePilar,
  enriquecerMetaConLinea,
} from './atributosLinea'
import { fetchCatalogoMetaRows } from './catalogoData'
import { cajasDisponiblesDeFila } from './disponibilidad'

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
  ninos:   SectionData
  hombres: SectionData
}

export const getFiltros = cache(async function getFiltros() {
  const fallback = {
    header: {
      mujeres: { label: 'Damas', lineas: [], marcas: [], estilos: [], tipos: [] },
      ninas:   { label: 'Niñas', lineas: [], marcas: [], estilos: [], tipos: [] },
      ninos:   { label: 'Niños', lineas: [], marcas: [], estilos: [], tipos: [] },
      hombres: { label: 'Caballeros', lineas: [], marcas: [], estilos: [], tipos: [] }
    },
    todasLineas: [],
    todasMarcas: [],
    todosEstilos: [],
    todosTipos: []
  }

  try {
    // 1. Obtener todas las combinaciones únicas de la vista normalizada.
    // La lectura es paginada para no caer en el límite Supabase de 1000 filas.
    const { data: stockMetaRaw, error } = await fetchCatalogoMetaRows<any>(supabase)

    if (error || !stockMetaRaw) {
      console.error('[filtros] Error fetching stockMeta:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      })
      return fallback
    }

    // Filtrar para mantener solo filas con cajas disponibles > 0
    const stockMeta = stockMetaRaw.filter(row => cajasDisponiblesDeFila(row) > 0)

    if (stockMeta.length === 0) {
      return fallback
    }

    const lineaMeta = await cargarMetaLineasDesdePilar(stockMeta.map(m => Number(m.linea_id)))
    const meta = enriquecerMetaConLinea(stockMeta, lineaMeta)

    // 2. Estructuras de agrupación por Género (desde pilar línea)
    const init = () => ({ 
      label: '', 
      lineas:  new Map<number, string>(), 
      marcas:  new Map<number, string>(), 
      estilos: new Map<number, string>(), 
      tipos:   new Map<number, string>() 
    })
    
    const sections: Record<string, ReturnType<typeof init>> = {
      'DAMAS':      init(),
      'NINAS':      init(),
      'NINOS':      init(),
      'CABALLEROS': init()
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
      // 3.1 Poblar Listas Globales (Independiente del Género)
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

      // 3.2 Clasificar por Género en el Header
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
          sec.estilos.set(
            estId,
            todosEstilos.get(estId) || `Estilo ${estId}`,
          )
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
      Array.from(m.entries())
        .map(([id, label]) => ({ id, label: String(label || '').trim() || `ID ${id}` }))
        .sort((a, b) => a.label.localeCompare(b.label))

    const formatSec = (s: ReturnType<typeof init>): SectionData => ({
      label:   s.label || 'Damas',
      lineas:  toItems(s.lineas),
      marcas:  toItems(s.marcas),
      estilos: toItems(s.estilos),
      tipos:   toItems(s.tipos)
    })

    return {
      header: {
        mujeres: formatSec(sections['DAMAS']),
        ninas:   formatSec(sections['NINAS']),
        ninos:   formatSec(sections['NINOS']),
        hombres: formatSec(sections['CABALLEROS'])
      },
      todasLineas:  toItems(todasLineas),
      todasMarcas:  toItems(todasMarcas),
      todosEstilos: toItems(todosEstilos),
      todosTipos:   toItems(todosTipos)
    }
  } catch (err) {
    console.error('[filtros] Critical error in getFiltros:', err)
    return fallback
  }
})


