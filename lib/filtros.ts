import { supabase } from './supabase'

export interface SectionData {
  label:   string
  lineas:  string[]
  marcas:  string[]
  estilos: string[]
  tipos:   string[]
}

export interface HeaderData {
  mujeres: SectionData
  ninas:   SectionData
  ninos:   SectionData
  hombres: SectionData
}

export async function getFiltros() {
  // Paso 1: Obtener todos los productos con stock
  const { data: stockData } = await supabase
    .from('v_stock_web')
    .select('linea_codigo, marca')

  if (!stockData) return null

  const lineasCodigos = [...new Set(stockData.map(item => item.linea_codigo))]

  // Paso 2: Obtener metadata desde tabla linea
  const { data: lineasData } = await supabase
    .from('linea')
    .select('id, codigo_proveedor, genero_id, marca_id, genero(codigo, descripcion), marca_v2(descp_marca)')
    .in('codigo_proveedor', lineasCodigos)
    .not('genero_id', 'is', null)

  const lineaMetaMap = new Map<string, any>()
  for (const item of lineasData ?? []) {
    const genObj = item.genero as any
    const marcaObj = item.marca_v2 as any

    lineaMetaMap.set(String(item.codigo_proveedor), {
      linea_id: item.id,
      genero: genObj?.codigo,
      generoLabel: genObj?.descripcion,
      marca: marcaObj?.descp_marca
    })
  }

  // Paso 3: Obtener estilos y tipos desde linea_referencia (FK a grupo_estilo_v2)
  const lineaIds = (lineasData ?? []).map(l => l.id)
  const { data: estilosData } = await supabase
    .from('linea_referencia')
    .select('linea_id, grupo_estilo_id, tipo_1, grupo_estilo_v2(descp_grupo_estilo)')
    .in('linea_id', lineaIds)
    .not('grupo_estilo_id', 'is', null)

  const estiloMap = new Map<number, { estilos: Set<string>, tipos: Set<string> }>()
  for (const e of estilosData ?? []) {
    if (!estiloMap.has(e.linea_id)) estiloMap.set(e.linea_id, { estilos: new Set(), tipos: new Set() })

    const grupoEstiloObj = e.grupo_estilo_v2 as any
    const descp_estilo = grupoEstiloObj?.descp_grupo_estilo
    if (descp_estilo) estiloMap.get(e.linea_id)!.estilos.add(descp_estilo)

    if (e.tipo_1) estiloMap.get(e.linea_id)!.tipos.add(e.tipo_1)
  }

  // Agrupar por género
  const init = () => ({ label: '', lineas: new Set<string>(), marcas: new Set<string>(), estilos: new Set<string>(), tipos: new Set<string>() })
  const mujeres = init()
  const ninas = init()
  const ninos = init()
  const hombres = init()

  const todasMarcas = new Set<string>()
  const todosEstilos = new Set<string>()
  const todosTipos = new Set<string>()

  // Mapas para filtrado por FK: texto → lineas que lo contienen
  const marcaToLineas = new Map<string, Set<string>>()
  const estiloToLineas = new Map<string, Set<string>>()
  const tipoToLineas = new Map<string, Set<string>>()

  for (const item of stockData) {
    const linea = String(item.linea_codigo)
    const meta = lineaMetaMap.get(linea)
    const genero = meta?.genero
    const marca = meta?.marca

    if (!genero) continue

    const processSection = (section: any) => {
      section.lineas.add(linea)
      if (marca) {
        section.marcas.add(marca)
        todasMarcas.add(marca)
        if (!marcaToLineas.has(marca)) marcaToLineas.set(marca, new Set())
        marcaToLineas.get(marca)!.add(linea)
      }
      if (meta?.linea_id && estiloMap.has(meta.linea_id)) {
        const rel = estiloMap.get(meta.linea_id)!
        rel.estilos.forEach(e => {
          section.estilos.add(e)
          todosEstilos.add(e)
          if (!estiloToLineas.has(e)) estiloToLineas.set(e, new Set())
          estiloToLineas.get(e)!.add(linea)
        })
        rel.tipos.forEach(t => {
          section.tipos.add(t)
          todosTipos.add(t)
          if (!tipoToLineas.has(t)) tipoToLineas.set(t, new Set())
          tipoToLineas.get(t)!.add(linea)
        })
      }
    }

    if (genero === 'DAMAS') {
      processSection(mujeres)
      if (!mujeres.label) mujeres.label = meta?.generoLabel || 'Damas'
    } else if (genero === 'NINAS') {
      processSection(ninas)
      if (!ninas.label) ninas.label = meta?.generoLabel || 'Niñas'
    } else if (genero === 'NINOS') {
      processSection(ninos)
      if (!ninos.label) ninos.label = meta?.generoLabel || 'Niños'
    } else if (genero === 'CABALLEROS') {
      processSection(hombres)
      if (!hombres.label) hombres.label = meta?.generoLabel || 'Caballeros'
    }
  }

  const formatSection = (s: any): SectionData => ({
    label:   s.label,
    lineas:  Array.from(s.lineas).sort() as string[],
    marcas:  Array.from(s.marcas).sort() as string[],
    estilos: Array.from(s.estilos).sort() as string[],
    tipos:   Array.from(s.tipos).sort() as string[]
  })

  // Convertir mapas a objetos simples para facilitar lookup
  const marcaLineasMap: Record<string, string[]> = {}
  marcaToLineas.forEach((lineas, marca) => {
    marcaLineasMap[marca] = Array.from(lineas)
  })

  const estiloLineasMap: Record<string, string[]> = {}
  estiloToLineas.forEach((lineas, estilo) => {
    estiloLineasMap[estilo] = Array.from(lineas)
  })

  const tipoLineasMap: Record<string, string[]> = {}
  tipoToLineas.forEach((lineas, tipo) => {
    tipoLineasMap[tipo] = Array.from(lineas)
  })

  return {
    header: {
      mujeres: formatSection(mujeres),
      ninas:   formatSection(ninas),
      ninos:   formatSection(ninos),
      hombres: formatSection(hombres)
    },
    todasLineas:  Array.from(lineasCodigos).sort(),
    todasMarcas:  Array.from(todasMarcas).sort(),
    todosEstilos: Array.from(todosEstilos).sort(),
    todosTipos:   Array.from(todosTipos).sort(),
    // Mapas para filtrado por FK (texto → lineas)
    marcaLineasMap,
    estiloLineasMap,
    tipoLineasMap
  }
}
