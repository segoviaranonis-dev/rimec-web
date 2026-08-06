/**
 * Cascada Molécula catálogo RIMEC Web.
 * Estilo → Línea → Material → Color (familias).
 * Devuelve Partial<CatalogoFilterState> para merge via patch/aplicar.
 */
import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import { toggleFamiliaKey } from '@/lib/pilares/agrupar-etiqueta-pilar'

export type CascadaPatch = Partial<CatalogoFilterState>

export function toggleId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

/** Estilos set (multi) → limpia Línea + Material + Color. */
export function cascadaEstilo(grupo_estilo_ids: number[]): CascadaPatch {
  return {
    grupo_estilo_id: '',
    grupo_estilo_ids,
    linea_ids: [],
    material_familias: [],
    color_familias: [],
    colores: [],
  }
}

/** Toggle Estilo multi-select → limpia descendientes. */
export function toggleEstiloCascada(actual: number[], id: number): CascadaPatch {
  return cascadaEstilo(toggleId(actual, id))
}

/** Línea set → limpia Material + Color. */
export function cascadaLinea(linea_ids: number[]): CascadaPatch {
  return {
    linea_ids,
    material_familias: [],
    color_familias: [],
    colores: [],
  }
}

/** Toggle Línea → limpia Material + Color. */
export function toggleLineaCascada(linea_ids: number[], id: number): CascadaPatch {
  return cascadaLinea(toggleId(linea_ids, id))
}

/** Material set → limpia Color. */
export function cascadaMaterial(material_familias: string[]): CascadaPatch {
  return {
    material_familias,
    color_familias: [],
    colores: [],
  }
}

/** Toggle Material familia → limpia Color. */
export function toggleMaterialCascada(
  material_familias: string[],
  key: string,
): CascadaPatch {
  return cascadaMaterial(toggleFamiliaKey(material_familias, key))
}

/** Color set (hoja). */
export function cascadaColor(color_familias: string[]): CascadaPatch {
  return { color_familias }
}

/** Toggle Color familia (hoja). */
export function toggleColorCascada(color_familias: string[], key: string): CascadaPatch {
  return cascadaColor(toggleFamiliaKey(color_familias, key))
}

/** Alias usados por FiltrosCatalogo (full-state). */
export function setEstiloCascade(
  prev: CatalogoFilterState,
  grupo_estilo_ids: number[],
): CatalogoFilterState {
  return { ...prev, ...cascadaEstilo(grupo_estilo_ids) }
}

export function setLineasCascade(
  prev: CatalogoFilterState,
  linea_ids: number[],
): CatalogoFilterState {
  return { ...prev, ...cascadaLinea(linea_ids) }
}

export function setMaterialFamiliasCascade(
  prev: CatalogoFilterState,
  material_familias: string[],
): CatalogoFilterState {
  return { ...prev, ...cascadaMaterial(material_familias) }
}

export function setColorFamiliasCascade(
  prev: CatalogoFilterState,
  color_familias: string[],
): CatalogoFilterState {
  return { ...prev, ...cascadaColor(color_familias) }
}

/** Al cambiar ramo (Calzado/Confecciones) se resetea cascada de pilares. */
export function resetCascadaAlCambiarRamo(): CascadaPatch {
  return {
    marca_id: '',
    marca_ids: [],
    linea_ids: [],
    tipo_ids: [],
    grupo_estilo_id: '',
    grupo_estilo_ids: [],
    tipo_grupos: [],
    material_familias: [],
    color_familias: [],
    colores: [],
  }
}

/** Dimensión (AB-CR · Marca · Género) → limpia molécula Estilo→Color. CABECERA holding. */
export function cascadaDimensiones(patch: CascadaPatch = {}): CascadaPatch {
  return {
    ...patch,
    grupo_estilo_id: '',
    grupo_estilo_ids: [],
    linea_ids: [],
    material_familias: [],
    color_familias: [],
    colores: [],
  }
}
