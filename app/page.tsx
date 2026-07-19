import { CatalogoClient } from './CatalogoClient'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    grupo_estilo_id?: string
    marca_id?: string
    linea_ids?: string
    tipo_ids?: string
    colores?: string
    quincenas?: string
    origen_tipo?: string
    ramo_tipo?: string
    deposito_codigo?: string
    genero_codigo?: string
    tonos?: string
    sin_tono?: string
    buscar?: string
    cadena_comercial?: string
    tipo_grupos?: string
    material_familias?: string
    color_familias?: string
  }>
}) {
  const params = await searchParams
  const cadenaUrl = params.cadena_comercial ?? ''
  // Solo URL explícita — no auto-filtrar desde pe_catalogo_filtro_web al abrir catálogo.
  const cadenaComercial = cadenaUrl

  const tipoGrupos = (params.tipo_grupos ?? '')
    .split(',')
    .filter(Boolean)
    .filter(
      (x): x is 'normal' | 'carteras' | 'promo' | 'liquidacion' =>
        x === 'normal' || x === 'carteras' || x === 'promo' || x === 'liquidacion',
    )

  return (
    <CatalogoClient
      initialFilters={{
        grupo_estilo_id: params.grupo_estilo_id ?? '',
        marca_id: params.marca_id ?? '',
        linea_ids: params.linea_ids ? params.linea_ids.split(',').filter(Boolean).map(Number) : [],
        tipo_ids: params.tipo_ids ? params.tipo_ids.split(',').filter(Boolean).map(Number) : [],
        colores: params.colores ? params.colores.split(',').filter(Boolean) : [],
        quincenas: params.quincenas?.split(',').filter(Boolean).map(Number) ?? [],
        origen_tipo: params.origen_tipo ?? 'TODOS',
        ramo_tipo: (() => {
          const esPe = String(params.origen_tipo ?? '').toUpperCase().includes('PRONTA')
          if (params.ramo_tipo === 'CONFECCIONES') return 'CONFECCIONES' as const
          if (params.ramo_tipo === 'CALZADO') return 'CALZADO' as const
          if (esPe) return 'CALZADO' as const
          if (!params.origen_tipo || params.origen_tipo.toUpperCase() === 'TODOS') return 'CALZADO' as const
          return '' as const
        })(),
        deposito_codigo: (() => {
          const d = String(params.deposito_codigo ?? '').toUpperCase()
          return d === 'D1' || d === 'DEP2' || d === 'D3' ? d as 'D1' | 'DEP2' | 'D3' : ''
        })(),
        genero_codigo: params.genero_codigo ?? '',
        tonos: params.sin_tono === '1' ? [] : (params.tonos ? params.tonos.split(',').filter(Boolean) : []),
        sin_tono: params.sin_tono === '1',
        buscar: params.buscar ?? '',
        cadena_comercial: cadenaComercial,
        tipo_grupos: tipoGrupos,
        material_familias: params.material_familias
          ? params.material_familias.split(',').filter(Boolean)
          : [],
        color_familias: params.color_familias
          ? params.color_familias.split(',').filter(Boolean)
          : [],
      }}
    />
  )
}
