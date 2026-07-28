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
import { gradasFmtFromRow } from '@/lib/gradasFmt'
import { resolveParesPorCaja } from '@/lib/prontaEntregaVenta'
import { cadenaComercialDesdeCodGrupo } from '@/lib/pilares/codGrupoCadena'
import {
  esLiquidacionRow,
  esPromoRow,
  type TipoGrupoId,
} from '@/lib/filtros/filtro-tipo-canonico'

/** Separar Normal / Promo / LIQ — PE: triunvirato COD.GRUPO · CP: BCL si no hay grupo. */
export function commercialBucketFromRow(item: {
  cod_grupo?: string | null
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
  cadena_comercial?: string | null
  descp_caso?: string | null
  caso_precio?: string | null
}): TipoGrupoId | 'otro' {
  const desdeGrupo = cadenaComercialDesdeCodGrupo(item.cod_grupo)
  if (desdeGrupo === 'LIQUIDACION') return 'liquidacion'
  if (desdeGrupo === 'PROMOCIONAL') return 'promo'
  if (desdeGrupo === 'REGULAR' || desdeGrupo === 'COMUN') return 'normal'

  const signals = {
    es_liquidacion: item.es_liquidacion,
    es_promo: item.es_promo,
    cadena_comercial: item.cadena_comercial,
    descp_caso: item.descp_caso,
    caso_precio: item.caso_precio ?? item.descp_caso,
  }
  if (esLiquidacionRow(signals)) return 'liquidacion'
  if (esPromoRow(signals)) return 'promo'
  return 'normal'
}

export interface RimecVariante {
  det_id: number
  pp_id: number | null
  pp_nro: string
  proforma: string                      // Matrimonio con pp_nro
  numero_preventa: string | null        // Nº preventa Carlos
  quincena_desc: string | null          // Dato duro - mostrar en tarjeta
  quincena_arribo_id?: number | null
  deposito_id?: number | null
  deposito_nombre?: string | null
  material_code: string
  color_code: string
  descp_color: string
  color_hex: string | null
  /** JSON administrador tonos — `color.tono_canon` vía vista (MIG-140). */
  tono_canon?: unknown | null
  gradas_fmt: string
  /** Nombre crudo BD / Excel — input para resolver tiers. */
  imagen_nombre: string | null
  /** Color Excel Kyly (K6824) — stem imagen 638, no descripción color. */
  imagen_color_excel?: string | null
  /** @deprecated Usar imagen_url_thumb */
  imagen_url: string
  imagen_url_thumb: string | null
  imagen_url_hero: string | null
  imagen_url_flat: string | null
  imagen_candidates_thumb: string[]
  imagen_candidates_hero: string[]
  cantidad_cajas: number
  pares_por_caja: number
  /** Pares realmente disponibles (vista). */
  saldo_pares?: number
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
  es_liquidacion?: boolean
  es_promo?: boolean
  cadena_comercial?: string | null
  /** COD.GRUPO Carlos — dígito cadena → LIQ/PROMO/REGULAR (R-FI-2) */
  cod_grupo?: string | null
  /** Descuento comercial dictado PE (BD) · no comisión D1 */
  descuento_comercial_pct?: number | null
  tipo_v2_id?: number | null
  ramo_tipo?: string | null
  variantes: RimecVariante[]
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
    const bucket = commercialBucketFromRow(item)
    const cardKey = `${buildCardKey(skuId, origen)}|${bucket}`

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
        es_liquidacion: item.es_liquidacion === true,
        es_promo: item.es_promo === true,
        cadena_comercial: item.cadena_comercial ?? null,
        cod_grupo: item.cod_grupo ?? null,
        tipo_v2_id: item.tipo_v2_id ?? null,
        ramo_tipo: item.ramo_tipo ?? null,
        variantes: [],
      })
      detIdsPorCard.set(cardKey, new Set())
    }

    const seen = detIdsPorCard.get(cardKey)!
    if (seen.has(item.det_id)) continue

    const card = cardMap.get(cardKey)!
    const dupColorIdx =
      item.tipo_v2_id === 2
        ? -1
        : card.variantes.findIndex(
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
      proveedorImportacionId: item.proveedor_importacion_id ?? null,
      tipoV2Id: item.tipo_v2_id ?? null,
      imagenColorExcel: item.imagen_color_excel ?? null,
    })

    cardMap.get(cardKey)!.variantes.push({
      det_id: item.det_id,
      pp_id: item.pp_id,
      pp_nro: item.pp_nro,
      proforma: item.proforma,
      numero_preventa: item.numero_preventa ?? null,
      quincena_desc: item.quincena_desc,  // Dato duro
      quincena_arribo_id: item.quincena_arribo_id,
      deposito_id: item.deposito_id ?? null,
      deposito_nombre: item.deposito_nombre ?? null,
      material_code: item.material_code,
      color_code: item.color_code,
      descp_color: item.descp_color,
      color_hex: item.color_hex,
      tono_canon: item.color_tono_canon ?? null,
      // 638: preferir texto `grada` (1 talle) — grades_json PE a veces trae stock, no curva.
      gradas_fmt:
        item.tipo_v2_id === 2 || String(item.ramo_tipo ?? '').toUpperCase() === 'CONFECCIONES'
          ? gradasFmtFromRow({ grada: item.grada, grades_json: null }) || gradasFmtFromRow(item)
          : gradasFmtFromRow(item),
      imagen_nombre: item.imagen_url,
      imagen_color_excel: item.imagen_color_excel ?? null,
      imagen_url: imgs.imagen_url_thumb ?? imgs.imagen_url_flat ?? '',
      imagen_url_thumb: imgs.imagen_url_thumb,
      imagen_url_hero: imgs.imagen_url_hero,
      imagen_url_flat: imgs.imagen_url_flat,
      imagen_candidates_thumb: imgs.imagen_candidates_thumb,
      imagen_candidates_hero: imgs.imagen_candidates_hero,
      cantidad_cajas: item.cantidad_cajas,
      // PE y CP: grada real vía resolveParesPorCaja (ignora vista MIG-144 contaminada).
      pares_por_caja: resolveParesPorCaja({
        pares_por_caja: item.pares_por_caja,
        cantidad_cajas: item.cantidad_cajas,
        cantidad_pares: item.cantidad_pares,
        saldo_pares: item.saldo_pares,
        grades_json: item.grades_json,
        grada: item.grada,
        origen_tipo: item.origen_tipo,
        det_id: item.det_id,
        pp_id: item.pp_id,
        tipo_v2_id: item.tipo_v2_id,
        ramo_tipo: item.ramo_tipo,
      }),
      saldo_pares: item.saldo_pares,
      cajas_disponibles: cajasDisp,
      lpn: item.lpn,
      lpc02: item.lpc02,
      lpc03: item.lpc03,
      lpc04: item.lpc04,
    })
  }

  return Array.from(cardMap.values()).filter(t => t.variantes.length > 0)
}
