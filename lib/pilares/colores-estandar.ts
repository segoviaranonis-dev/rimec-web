/** Catálogo tonos canónicos — paridad Report `colores-estandar.ts` · CHUSAR_BUSQUEDA_COLOR_CANALES */

import { tonoPaleta, tonoSolido, type TonoCanon } from './color-canon'

export type ColorEstandar = {
  etiqueta: string
  hex: string
  aliases: string[]
  orden?: number
  multicolor?: boolean
  swatches?: string[]
}

export const OTROS_MULTICOLOR_SWATCHES = [
  '#c62828', '#1565c0', '#2e7d32', '#ffd54f', '#1a1a1a', '#f48fb1',
]

export const COLORES_ESTANDAR_DEFAULT: ColorEstandar[] = [
  { etiqueta: 'Negro', hex: '#1a1a1a', aliases: ['negro', 'preto', 'black'] },
  { etiqueta: 'Blanco', hex: '#f5f5f0', aliases: ['blanco', 'branco', 'white', 'marfil', 'ivory'] },
  { etiqueta: 'Gris', hex: '#9e9e9e', aliases: ['gris', 'cinza', 'grey', 'gray', 'plata', 'silver'] },
  { etiqueta: 'Dorado', hex: '#ffd54f', aliases: ['dorado', 'oro', 'gold', 'amarillo', 'mostaza'] },
  { etiqueta: 'Beige', hex: '#e8d5b0', aliases: ['beige', 'bege', 'nude', 'natural', 'crema', 'camel', 'capuchino'] },
  { etiqueta: 'Marrón', hex: '#6d4c41', aliases: ['marrón', 'marron', 'brown', 'chocolate', 'café'] },
  { etiqueta: 'Rojo', hex: '#c62828', aliases: ['rojo', 'vermelho', 'red'] },
  { etiqueta: 'Vino', hex: '#880e4f', aliases: ['vino', 'wine', 'bordô', 'burdeo'] },
  { etiqueta: 'Fucsia', hex: '#c026d3', aliases: ['fucsia', 'magenta'] },
  { etiqueta: 'Naranja', hex: '#c2410c', aliases: ['naranja', 'laranja', 'orange', 'coral'] },
  { etiqueta: 'Verde', hex: '#2e7d32', aliases: ['verde', 'green', 'oliva'] },
  { etiqueta: 'Celeste', hex: '#4fc3f7', aliases: ['celeste', 'aqua'] },
  { etiqueta: 'Azul', hex: '#1565c0', aliases: ['azul', 'blue'] },
  { etiqueta: 'Marino', hex: '#1e3a5f', aliases: ['marino', 'marina', 'navy'] },
  { etiqueta: 'Rosado', hex: '#f48fb1', aliases: ['rosado', 'rosa', 'pink'] },
  { etiqueta: 'Bronce', hex: '#b87333', aliases: ['bronce', 'bronze'] },
  {
    etiqueta: 'Otros',
    hex: '#64748b',
    multicolor: true,
    swatches: OTROS_MULTICOLOR_SWATCHES,
    aliases: ['multicolor', 'estampado', 'combinado'],
  },
]

export const SIN_TONO_ETIQUETA = 'Sin asignar'

export function estandarToTono(c: ColorEstandar): TonoCanon {
  if (c.multicolor) {
    return tonoPaleta(c.etiqueta, c.swatches?.length ? c.swatches : OTROS_MULTICOLOR_SWATCHES)
  }
  return tonoSolido(c.etiqueta, c.hex)
}

export function rowToColorEstandar(r: {
  etiqueta: string
  hex: string
  aliases?: unknown
  orden?: number
}): ColorEstandar {
  const aliases = Array.isArray(r.aliases) ? r.aliases.map(String) : []
  const base = COLORES_ESTANDAR_DEFAULT.find(x => x.etiqueta === r.etiqueta)
  return {
    etiqueta: r.etiqueta,
    hex: r.hex,
    aliases,
    orden: r.orden,
    multicolor: base?.multicolor,
    swatches: base?.swatches,
  }
}
