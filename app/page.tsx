import { CatalogoClient } from './CatalogoClient'
import { getSession } from '@/lib/auth/session'
import {
  esUsuarioSoloCalzado,
  esUsuarioSoloConfecciones,
} from '@/lib/auth/catalogoScopeUsuario'
import { parseTipoGruposCsv } from '@/lib/filtros/tipo-grupos-url'
import { sanitizePeAbcrTipoIds } from '@/lib/filtros/pe-abcr-tipo1'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    grupo_estilo_id?: string
    marca_id?: string
    grupo_estilo_ids?: string
    marca_ids?: string
    linea_ids?: string
    tipo_ids?: string
    colores?: string
    quincenas?: string
    origen_tipo?: string
    ramo_tipo?: string
    deposito_codigo?: string
    genero_codigo?: string
    genero_codigos?: string
    tonos?: string
    sin_tono?: string
    buscar?: string
    cadena_comercial?: string
    tipo_grupos?: string
    material_familias?: string
    color_familias?: string
    precio_min?: string
    precio_max?: string
    precio_tope?: string
    lista_precio_id?: string
  }>
}) {
  const params = await searchParams
  const session = await getSession()
  const soloCalzado = esUsuarioSoloCalzado(session?.name)
  const soloConfecciones = esUsuarioSoloConfecciones(session?.name)
  const cadenaUrl = params.cadena_comercial ?? ''
  // Solo URL explícita — no auto-filtrar desde pe_catalogo_filtro_web al abrir catálogo.
  const cadenaComercial = cadenaUrl

  const tipoGrupos = parseTipoGruposCsv(params.tipo_grupos)

  const parsePrecio = (raw: string | undefined): number | null => {
    if (!raw) return null
    const n = Number(String(raw).replace(/\D/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  return (
    <CatalogoClient
      soloCalzado={soloCalzado}
      soloConfecciones={soloConfecciones}
      initialFilters={{
        grupo_estilo_id: params.grupo_estilo_id ?? '',
        marca_id: params.marca_id ?? '',
        grupo_estilo_ids: (params.grupo_estilo_ids ?? params.grupo_estilo_id ?? '')
          .split(',').filter(Boolean).map(Number),
        marca_ids: (params.marca_ids ?? params.marca_id ?? '')
          .split(',').filter(Boolean).map(Number),
        linea_ids: params.linea_ids ? params.linea_ids.split(',').filter(Boolean).map(Number) : [],
        tipo_ids: sanitizePeAbcrTipoIds(
          params.tipo_ids ? params.tipo_ids.split(',').filter(Boolean).map(Number) : [],
        ),
        colores: params.colores ? params.colores.split(',').filter(Boolean) : [],
        quincenas: params.quincenas?.split(',').filter(Boolean).map(Number) ?? [],
        origen_tipo: params.origen_tipo ?? 'TODOS',
        // Scope login: calzado 654 · confecciones 638 · o libre.
        ramo_tipo: (() => {
          if (soloConfecciones) return 'CONFECCIONES' as const
          if (soloCalzado) return 'CALZADO' as const
          if (params.ramo_tipo === 'CONFECCIONES') return 'CONFECCIONES' as const
          return 'CALZADO' as const
        })(),
        deposito_codigo: (() => {
          const d = String(params.deposito_codigo ?? '').toUpperCase()
          return d === 'D1' || d === 'DEP2' || d === 'D3' ? d as 'D1' | 'DEP2' | 'D3' : ''
        })(),
        genero_codigo: params.genero_codigo ?? '',
        genero_codigos: params.genero_codigos
          ? params.genero_codigos.split(',').map((c) => c.trim()).filter(Boolean)
          : params.genero_codigo
            ? [params.genero_codigo]
            : [],
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
        precio_min: parsePrecio(params.precio_min),
        precio_max: parsePrecio(params.precio_max),
        precio_tope: parsePrecio(params.precio_tope),
        lista_precio_id: (() => {
          const n = Number(params.lista_precio_id)
          return n === 1 || n === 2 || n === 3 || n === 4 ? (n as 1 | 2 | 3 | 4) : null
        })(),
      }}
    />
  )
}
