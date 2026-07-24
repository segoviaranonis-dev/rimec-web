/**
 * Match / síntesis de FacturaConfig (descuentos_lote.facturas) vs FI del carrito.
 * PE + R-FI-2: pp_id negativo y caso = etiquetaCelulaFi — no exigir fila previa en BD.
 */
import type { FacturaConfig } from '@/lib/carritoApi'
import { normalizarDescuentos4 } from '@/lib/carritoDescuentosFi'

export function findFacturaConfig(
  facturas: FacturaConfig[] | null | undefined,
  ppId: number,
  marca: string,
  caso: string,
  casoId?: number | null,
): FacturaConfig | undefined {
  if (!facturas?.length) return undefined

  const samePpMarca = facturas.filter(
    (f) => Number(f.pp_id) === Number(ppId) && String(f.marca) === String(marca),
  )
  if (!samePpMarca.length) return undefined

  // 1) Etiqueta exacta (R-FI-2: «X · PROMOCIONAL» ≠ «X» REGULAR)
  const byCaso = samePpMarca.find((f) => String(f.caso) === String(caso))
  if (byCaso) return byCaso

  // 2) caso_id — solo si no hay ambigüedad entre cadenas
  if (casoId != null && Number(casoId) > 0) {
    const byId = samePpMarca.filter(
      (f) => f.caso_id != null && Number(f.caso_id) === Number(casoId),
    )
    if (byId.length === 1) return byId[0]
    if (byId.length > 1) {
      const prefer = byId.find((f) => String(f.caso) === String(caso))
      if (prefer) return prefer
    }
  }

  return undefined
}

export function mismaFacturaConfig(
  f: Pick<FacturaConfig, 'pp_id' | 'marca' | 'caso' | 'caso_id'>,
  ppId: number,
  marca: string,
  caso: string,
  casoId?: number | null,
): boolean {
  return Boolean(findFacturaConfig([f as FacturaConfig], ppId, marca, caso, casoId))
}

export function sintetizarFacturaConfig(input: {
  pp_id: number
  marca: string
  marca_id?: number | null
  caso: string
  caso_id?: number | null
  lista_precio_id: number
  descuentos?: unknown
  items_count: number
  cadena_comercial?: string | null
}): FacturaConfig {
  return {
    pp_id: input.pp_id,
    marca: input.marca,
    marca_id: input.marca_id ?? null,
    caso: input.caso,
    caso_id: input.caso_id ?? null,
    lista_precio_id: input.lista_precio_id,
    descuentos: [...normalizarDescuentos4(input.descuentos)],
    pre_autorizado: false,
    items_count: input.items_count,
    ...(input.cadena_comercial ? { cadena_comercial: input.cadena_comercial } : {}),
  } as FacturaConfig
}

/** Config efectiva para UI: BD si matchea, si no cabecera sintetizada (siempre editable). */
export function resolverFacturaConfig(
  facturas: FacturaConfig[] | null | undefined,
  input: {
    pp_id: number
    marca: string
    marca_id?: number | null
    caso: string
    caso_id?: number | null
    lista_precio_id: number
    descuentos_cabecera?: unknown
    items_count: number
    cadena_comercial?: string | null
  },
): FacturaConfig {
  const hit = findFacturaConfig(
    facturas,
    input.pp_id,
    input.marca,
    input.caso,
    input.caso_id,
  )
  if (hit) {
    return {
      ...hit,
      items_count: input.items_count || hit.items_count || 0,
    }
  }
  return sintetizarFacturaConfig({
    pp_id: input.pp_id,
    marca: input.marca,
    marca_id: input.marca_id,
    caso: input.caso,
    caso_id: input.caso_id,
    lista_precio_id: input.lista_precio_id,
    descuentos: input.descuentos_cabecera,
    items_count: input.items_count,
    cadena_comercial: input.cadena_comercial,
  })
}
