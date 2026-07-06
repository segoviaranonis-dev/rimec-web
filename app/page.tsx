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
  }>
}) {
  const params = await searchParams

  return (
    <CatalogoClient
      initialFilters={{
        grupo_estilo_id: params.grupo_estilo_id ?? '',
        marca_id: params.marca_id ?? '',
        linea_ids: params.linea_ids ? params.linea_ids.split(',').filter(Boolean).map(Number) : [],
        tipo_ids: params.tipo_ids ? params.tipo_ids.split(',').filter(Boolean).map(Number) : [],
        colores: params.colores ? params.colores.split(',').filter(Boolean) : [],
        quincenas: params.quincenas?.split(',').filter(Boolean).map(Number) ?? [],
      }}
    />
  )
}
