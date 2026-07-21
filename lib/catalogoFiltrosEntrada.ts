import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'

/** Filtros de sidebar que achican la grilla — el usuario debe elegirlos explícitamente. */
export function hasSidebarFilters(f: CatalogoFilterState): boolean {
  return Boolean(
    f.marca_id ||
      f.grupo_estilo_id ||
      (f.marca_ids?.length ?? 0) > 0 ||
      (f.grupo_estilo_ids?.length ?? 0) > 0 ||
      f.genero_codigo ||
      f.buscar?.trim() ||
      f.linea_ids.length ||
      f.tipo_ids.length ||
      f.colores.length ||
      f.quincenas.length ||
      f.deposito_codigo ||
      (f.tonos?.length ?? 0) > 0 ||
      f.sin_tono ||
      f.cadena_comercial?.trim() ||
      (f.tipo_grupos?.length ?? 0) > 0 ||
      (f.material_familias?.length ?? 0) > 0 ||
      (f.color_familias?.length ?? 0) > 0,
  )
}

/** Entrada fría al catálogo — URL sin filtros estrechos; grilla debe mostrar todo (TODOS). */
export function isColdWideOpenCatalogEntry(fromUrl: CatalogoFilterState): boolean {
  return !hasSidebarFilters(fromUrl)
}
