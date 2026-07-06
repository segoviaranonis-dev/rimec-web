/**
 * Agrupa filas de v_stock_rimec en tarjetas autónomas multi-origen.
 *
 * Regla: no fusionar el mismo SKU si origen_tipo u origen_referencia_id difieren.
 * Dentro de una tarjeta: variantes = colores (det_id) del mismo SKU y mismo origen.
 */

import type { StockRow } from '@/app/catalogo-types'
import {
  buildCardKey,
  buildSkuId,
  deriveOrigenFromStockRow,
  type OrigenMetadatos,
  type OrigenTipo,
  type TarjetaShellStyle,
} from '@/lib/catalogoOrigen'
import { enrichImagenUrls } from '@/lib/productImage'

export interface RimecVariante {
  det_id: number
  pp_id: number | null
  pp_nro: string
  proforma: string                      // Matrimonio con pp_nro
  quincena_desc: string | null          // Dato duro - mostrar en tarjeta
  quincena_arribo_id?: number | null
  deposito_id?: number | null
  material_code: string
  color_code: string
  descp_color: string
  color_hex: string | null
  gradas_fmt: string
  /** Nombre crudo BD / Excel — input para resolver tiers. */
  imagen_nombre: string | null
  /** @deprecated Usar imagen_url_thumb */
  imagen_url: string
  imagen_url_thumb: string | null
  imagen_url_hero: string | null
  imagen_url_flat: string | null
  cantidad_cajas: number
  pares_por_caja: number
  cajas_disponibles: number
  lpn: number | null
  lpc02: number | null
  lpc03: number | null
  lpc04: number | null
}

/** Una instancia de tarjeta en el catálogo (coexistencia multi-origen). */
export interface TarjetaCatalogo {
  /** Clave React única: sku + origen */
  cardKey: string
  sku_id: string
  origen_tipo: OrigenTipo
  origen_referencia_id: string
  origen_label: string
  shell: TarjetaShellStyle
  linea_id: number
  linea_codigo: string
  referencia_id: number
  referencia_codigo: string
  nombre: string
  material_code: string
  descp_material: string
  descp_marca: string
  marca_id: number
  descp_caso: string | null
  caso_id: number | null
  descp_grupo_estilo: string
  grupo_estilo_id?: number
  tipo_1_id?: number
  descp_tipo_1?: string | null
  variantes: RimecVariante[]
}

function gradasFmtFromJson(grades_json: StockRow['grades_json']): string {
  if (!grades_json) return ''
  const g = grades_json
  const keys = Object.keys(g).sort(
    (a, b) => parseFloat(a.split('/')[0]) - parseFloat(b.split('/')[0]),
  )
  if (keys.length === 0) return ''
  return `${keys[0]}(${keys.map(k => g[k]).join('-')})${keys[keys.length - 1]}`
}

export function agruparTarjetasCatalogo(
  items: StockRow[],
  _bucketUrl: string,
  cajasDisponiblesDeFila: (item: StockRow) => number,
): TarjetaCatalogo[] {
  const cardMap = new Map<string, TarjetaCatalogo>()
  const detIdsPorCard = new Map<string, Set<number>>()

  for (const item of items) {
    const cajasDisp = cajasDisponiblesDeFila(item)
    if (cajasDisp <= 0) continue

    const skuId = buildSkuId(item.linea_id, item.referencia_id, item.material_code)
    const origen: OrigenMetadatos = deriveOrigenFromStockRow(item)
    const cardKey = buildCardKey(skuId, origen)

    if (!cardMap.has(cardKey)) {
      cardMap.set(cardKey, {
        cardKey,
        sku_id: skuId,
        origen_tipo: origen.tipo,
        origen_referencia_id: origen.referenciaId,
        origen_label: origen.label,
        shell: origen.shell,
        linea_id: item.linea_id,
        linea_codigo: item.linea_codigo,
        referencia_id: item.referencia_id,
        referencia_codigo: item.referencia_codigo,
        nombre: item.nombre,
        material_code: item.material_code,
        descp_material: item.descp_material,
        descp_marca: item.descp_marca,
        marca_id: item.marca_id,
        descp_caso: item.descp_caso,
        caso_id: item.caso_id,
        descp_grupo_estilo: item.descp_grupo_estilo,
        grupo_estilo_id: item.grupo_estilo_id,
        tipo_1_id: item.tipo_1_id,
        descp_tipo_1: item.descp_tipo_1,
        variantes: [],
      })
      detIdsPorCard.set(cardKey, new Set())
    }

    const seen = detIdsPorCard.get(cardKey)!
    if (seen.has(item.det_id)) continue

    const card = cardMap.get(cardKey)!
    const dupColorIdx = card.variantes.findIndex(
      v => v.color_code === item.color_code && v.descp_color === item.descp_color,
    )
    if (dupColorIdx >= 0) {
      card.variantes[dupColorIdx].cajas_disponibles += cajasDisp
      seen.add(item.det_id)
      continue
    }
    seen.add(item.det_id)

    const imgs = enrichImagenUrls({
      linea: item.linea_codigo,
      referencia: item.referencia_codigo,
      material: item.material_code,
      color: item.color_code,
      imagenNombre: item.imagen_url,
    })

    cardMap.get(cardKey)!.variantes.push({
      det_id: item.det_id,
      pp_id: item.pp_id,
      pp_nro: item.pp_nro,
      proforma: item.proforma,
      quincena_desc: item.quincena_desc,  // Dato duro
      quincena_arribo_id: item.quincena_arribo_id,
      deposito_id: item.deposito_id ?? null,
      material_code: item.material_code,
      color_code: item.color_code,
      descp_color: item.descp_color,
      color_hex: item.color_hex,
      gradas_fmt: gradasFmtFromJson(item.grades_json),
      imagen_nombre: item.imagen_url,
      imagen_url: imgs.imagen_url_thumb ?? imgs.imagen_url_flat ?? '',
      imagen_url_thumb: imgs.imagen_url_thumb,
      imagen_url_hero: imgs.imagen_url_hero,
      imagen_url_flat: imgs.imagen_url_flat,
      cantidad_cajas: item.cantidad_cajas,
      pares_por_caja: item.pares_por_caja,
      cajas_disponibles: cajasDisp,
      lpn: item.lpn,
      lpc02: item.lpc02,
      lpc03: item.lpc03,
      lpc04: item.lpc04,
    })
  }

  return Array.from(cardMap.values()).filter(t => t.variantes.length > 0)
}
