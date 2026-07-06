import {
  productImagePrimary,
  productImageCandidatesForUi,
} from './productImage'

export { productImageCandidatesForUi, productImagePrimary } from './productImage'

/** URL canónica sm — legacy alias. */
export function getImageUrl(
  linea: string,
  referencia: string,
  material: string,
  color: string,
): string {
  return productImagePrimary(linea, referencia, material, color, 'thumb')
}

export function getImageCandidatesForUi(
  linea: string,
  referencia: string,
  material: string,
  color: string,
  imagenNombre: string | null | undefined,
  ui: 'thumb' | 'card' | 'modal',
): string[] {
  return productImageCandidatesForUi(linea, referencia, material, color, imagenNombre, ui)
}
