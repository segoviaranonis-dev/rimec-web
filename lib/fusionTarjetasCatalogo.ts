import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'

/** Tarjeta unificada CP+PE — un modelo (SKU), varios lotes/orígenes apilados. */
export interface TarjetaCatalogoFusionada {
  fusionada: true
  cardKey: string
  sku_id: string
  linea_id: number
  linea_codigo: string
  referencia_id: number
  referencia_codigo: string
  nombre: string
  material_code: string
  descp_material: string
  descp_marca: string
  marca_id: number
  descp_grupo_estilo: string
  grupo_estilo_id?: number
  tipo_1_id?: number
  descp_tipo_1?: string | null
  lotes: TarjetaCatalogo[]
}

export type TarjetaGrilla = TarjetaCatalogo | TarjetaCatalogoFusionada

export function fusionCardKey(skuId: string): string {
  return `sku:${skuId}`
}

export function isTarjetaFusionada(t: TarjetaGrilla): t is TarjetaCatalogoFusionada {
  return (t as TarjetaCatalogoFusionada).fusionada === true
}

/** PE primero, luego CP (quincena). Tarjeta única si solo hay un lote. */
export function fusionarTarjetasPorSku(tarjetas: TarjetaCatalogo[]): TarjetaGrilla[] {
  const bySku = new Map<string, TarjetaCatalogo[]>()
  for (const t of tarjetas) {
    const list = bySku.get(t.sku_id) ?? []
    list.push(t)
    bySku.set(t.sku_id, list)
  }

  const out: TarjetaGrilla[] = []
  for (const [skuId, lotesRaw] of bySku) {
    if (lotesRaw.length === 1) {
      out.push(lotesRaw[0]!)
      continue
    }

    const lotes = [...lotesRaw].sort((a, b) => {
      const rank = (t: TarjetaCatalogo) =>
        t.origen_tipo === 'PRONTA_ENTREGA' ? 0 : 1
      const d = rank(a) - rank(b)
      if (d !== 0) return d
      return a.origen_label.localeCompare(b.origen_label, 'es')
    })

    const head = lotes[0]!
    out.push({
      fusionada: true,
      cardKey: fusionCardKey(skuId),
      sku_id: skuId,
      linea_id: head.linea_id,
      linea_codigo: head.linea_codigo,
      referencia_id: head.referencia_id,
      referencia_codigo: head.referencia_codigo,
      nombre: head.nombre,
      material_code: head.material_code,
      descp_material: head.descp_material,
      descp_marca: head.descp_marca,
      marca_id: head.marca_id,
      descp_grupo_estilo: head.descp_grupo_estilo,
      grupo_estilo_id: head.grupo_estilo_id,
      tipo_1_id: head.tipo_1_id,
      descp_tipo_1: head.descp_tipo_1,
      lotes,
    })
  }

  return out
}

/** Imagen compartida: primera variante con thumb entre todos los lotes. */
export function varianteHeroFusionada(t: TarjetaCatalogoFusionada) {
  for (const lote of t.lotes) {
    const v = lote.variantes.find(vv => vv.cajas_disponibles > 0) ?? lote.variantes[0]
    if (v?.imagen_url_thumb || v?.imagen_url) return { lote, variante: v }
  }
  const lote = t.lotes[0]!
  return { lote, variante: lote.variantes[0]! }
}
