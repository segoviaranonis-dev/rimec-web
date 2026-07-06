/** Filtros sidebar derivados de tarjetas ya cargadas (sin scan BD). */
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'

export function buildFiltrosFromTarjetas(tarjetas: TarjetaCatalogo[]) {
  const lineas = new Map<number, string>()
  const marcas = new Map<number, string>()
  const estilos = new Map<number, string>()
  const tipos = new Map<number, string>()
  const colores = new Set<string>()
  const quincenas = new Map<number, string>()

  for (const t of tarjetas) {
    if (t.linea_id && t.linea_codigo) lineas.set(t.linea_id, t.linea_codigo)
    if (t.marca_id && t.descp_marca) marcas.set(t.marca_id, t.descp_marca)
    if (t.grupo_estilo_id && t.descp_grupo_estilo) estilos.set(t.grupo_estilo_id, t.descp_grupo_estilo)
    if (t.tipo_1_id && t.descp_tipo_1) tipos.set(t.tipo_1_id, t.descp_tipo_1)
    for (const v of t.variantes) {
      const c = String(v.descp_color ?? '').trim()
      if (c) colores.add(c)
      if (v.quincena_arribo_id && v.quincena_desc) {
        quincenas.set(v.quincena_arribo_id, v.quincena_desc)
      }
    }
  }

  const toItems = (m: Map<number, string>) =>
    [...m.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }))
      .map(([id, label]) => ({ id, label }))

  return {
    filtros: {
      todasLineas: toItems(lineas),
      todasMarcas: toItems(marcas),
      todosEstilos: toItems(estilos),
      todosTipos: toItems(tipos),
    },
    colores: [...colores].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
    quincenas: [...quincenas.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.id - b.id),
  }
}
