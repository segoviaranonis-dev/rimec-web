import { supabase } from './supabase'
import { cargarAtributosDesdePilar, enriquecerMetaConPilar } from './atributosLinea'
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

export async function getFiltros() {
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
    // 1. Obtener todas las combinaciones únicas de la vista normalizada
    // IMPORTANTE: Supabase JS limita a 1000 filas. Usar .range() para obtener hasta 5000.
    const { data: stockMetaRaw, error } = await supabase
      .from('v_stock_rimec')
      .select(`
        marca_id, descp_marca,
        linea_id, linea_codigo, referencia_id, referencia_codigo,
        grupo_estilo_id, descp_grupo_estilo,
        tipo_1_id, descp_tipo_1,
        cajas_disponibles, saldo_pares, cantidad_pares, pares_vendidos, pares_por_caja, cantidad_cajas
      `)
      .range(0, 4999)

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

    const paresCodigo = [
      ...new Map(
        stockMeta
          .map(m => {
            const lc = String(m.linea_codigo ?? '').trim()
            const rc = String(m.referencia_codigo ?? '').trim()
            return [`${lc}:${rc}`, { linea_codigo: lc, referencia_codigo: rc }] as const
          })
          .filter(([k]) => k !== ':'),
      ).values(),
    ]
    const pilar = await cargarAtributosDesdePilar({ paresCodigo })
    const meta = enriquecerMetaConPilar(stockMeta, pilar)

    const lineaIdsReales = [
      ...new Set(meta.map(m => Number(m.linea_id)).filter(id => id > 0)),
    ]

    // 2. Necesitamos el genero_id de cada linea para agrupar (solo si hay lineas reales)
    let lineasGeneros: any[] = []
    if (lineaIdsReales.length > 0) {
      const { data, error: errL } = await supabase
        .from('linea')
        .select('id, genero_id, genero(codigo, descripcion)')
        .in('id', lineaIdsReales)
      if (errL) {
        console.error('[filtros] Error fetching lineasGeneros:', errL)
      } else {
        lineasGeneros = data || []
      }
    }

    const generoMap = new Map<number, any>()
    lineasGeneros.forEach(l => generoMap.set(l.id, l.genero))

    // 3. Estructuras de agrupación por Género
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
      const gen = generoMap.get(row.linea_id)
      const genCodigo = gen?.codigo || 'DAMAS' // Fallback a DAMAS para no perder el item del menu
      
      const sec = sections[genCodigo]
      if (!sec) continue
      if (!sec.label) sec.label = gen?.descripcion || 'Damas'

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

    // Valores del pilar (por código línea/ref, no por IDs erróneos de la vista)
    for (const attr of pilar.porCodigo.values()) {
      if (attr.grupo_estilo_id) addEstilo(attr.grupo_estilo_id, attr.descp_grupo_estilo)
      if (attr.tipo_1_id) addTipo(attr.tipo_1_id, attr.descp_tipo_1)
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
}


