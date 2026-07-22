import type { SupabaseClient } from '@supabase/supabase-js'
import { PE_DET_ID_BASE } from '@/lib/prontaEntregaVenta'
import { normalizarFilaStockVenta } from '@/lib/disponibilidad'

/** CP (v_stock_rimec) — sin proveedor_importacion_id/tipo_v2_id (solo existen en v_stock_pe_rimec). */
const CARRITO_STOCK_SELECT_CP =
  'det_id, lpn, lpc02, lpc03, lpc04, cajas_disponibles, saldo_pares, cantidad_cajas, cantidad_pares, pares_vendidos, grades_json, linea_codigo, referencia_codigo, material_code, color_code, descp_color, pp_nro, proforma, quincena_desc, nombre, imagen_url, pares_por_caja, descp_caso, origen_tipo, pp_id'

/** PE: señales R-FI-2 + COD.GRUPO Carlos (dígito cadena → LIQ/PROMO/REGULAR). */
const CARRITO_STOCK_SELECT_PE =
  `${CARRITO_STOCK_SELECT_CP.replace('grades_json,', 'grades_json, grada,')}, proveedor_importacion_id, tipo_v2_id, es_liquidacion, es_promo, cadena_comercial, cod_grupo`

/** @deprecated Usar select por vista. */
export const CARRITO_STOCK_SELECT = CARRITO_STOCK_SELECT_CP

export type CarritoStockEnriched = Record<string, unknown> & { det_id: number }

const IN_CHUNK = 80

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Expande ids PE legacy (<800M) y sintéticos para lookup en vistas. */
function expandPeDetIds(detIds: number[]): number[] {
  const out = new Set<number>()
  for (const id of detIds) {
    out.add(id)
    if (id > 0 && id < PE_DET_ID_BASE) out.add(id + PE_DET_ID_BASE)
    if (id >= PE_DET_ID_BASE) out.add(id - PE_DET_ID_BASE)
  }
  return [...out]
}

type PpdFallbackRow = {
  id: number
  cantidad_cajas: number | null
  cantidad_pares: number | null
  pares_vendidos: number | null
  precio_lpn: number | null
  precio_lpc02: number | null
  precio_lpc03: number | null
  precio_lpc04: number | null
  descp_caso_snapshot: string | null
  linea: string | null
  referencia: string | null
  material_code: string | null
  color_code: string | null
  descp_color: string | null
  nombre: string | null
  grades_json: Record<string, number> | null
  pedido_proveedor_id: number
  pp: {
    id: number
    numero_registro: string | null
    numero_proforma: string | null
    estado_transito: string | null
  } | null
}

function ppdRowToStock(row: PpdFallbackRow): CarritoStockEnriched {
  const cantidadPares = Number(row.cantidad_pares ?? 0)
  const paresVendidos = Number(row.pares_vendidos ?? 0)
  const saldo = Math.max(0, cantidadPares - paresVendidos)
  const cantidadCajas = Number(row.cantidad_cajas ?? 0)
  const ppc = cantidadCajas > 0 ? cantidadPares / cantidadCajas : 0

  return {
    det_id: row.id,
    pp_id: row.pedido_proveedor_id,
    pp_nro: row.pp?.numero_registro ?? '',
    proforma: row.pp?.numero_proforma ?? '',
    lpn: row.precio_lpn,
    lpc02: row.precio_lpc02,
    lpc03: row.precio_lpc03,
    lpc04: row.precio_lpc04,
    cantidad_cajas: cantidadCajas,
    cantidad_pares: cantidadPares,
    pares_vendidos: paresVendidos,
    saldo_pares: saldo,
    pares_por_caja: ppc,
    cajas_disponibles: null,
    linea_codigo: row.linea ?? '',
    referencia_codigo: row.referencia ?? '',
    material_code: row.material_code ?? '',
    color_code: row.color_code ?? '',
    descp_color: row.descp_color ?? '',
    nombre: row.nombre ?? '',
    descp_caso: row.descp_caso_snapshot ?? '',
    grades_json: row.grades_json,
    origen_tipo: 'TRÁNSITO_PP',
    _fallback_ppd: true,
    _pp_estado_transito: row.pp?.estado_transito ?? null,
  }
}

async function fetchVistaStockChunked(
  sb: SupabaseClient,
  table: 'v_stock_rimec' | 'v_stock_pe_rimec',
  select: string,
  detIds: number[],
): Promise<CarritoStockEnriched[]> {
  const rows: CarritoStockEnriched[] = []
  for (const part of chunk(detIds, IN_CHUNK)) {
    const { data, error } = await sb.from(table).select(select).in('det_id', part)
    if (error) throw new Error(`${table}: ${error.message}`)
    for (const row of data ?? []) {
      rows.push(row as unknown as CarritoStockEnriched)
    }
  }
  return rows
}

/** Fallback PPD — el carrito guarda det_id real; la vista catálogo puede filtrar filas válidas. */
async function fetchPpdStockFallback(
  sb: SupabaseClient,
  detIds: number[],
): Promise<CarritoStockEnriched[]> {
  const cpIds = detIds.filter((id) => id > 0 && id < PE_DET_ID_BASE)
  if (!cpIds.length) return []

  const rows: PpdFallbackRow[] = []
  for (const part of chunk(cpIds, IN_CHUNK)) {
    const { data, error } = await sb
      .from('pedido_proveedor_detalle')
      .select(
        `
        id,
        cantidad_cajas,
        cantidad_pares,
        pares_vendidos,
        precio_lpn,
        precio_lpc02,
        precio_lpc03,
        precio_lpc04,
        descp_caso_snapshot,
        linea,
        referencia,
        material_code,
        color_code,
        descp_color,
        nombre,
        grades_json,
        pedido_proveedor_id,
        pp:pedido_proveedor_id (
          id,
          numero_registro,
          numero_proforma,
          estado_transito
        )
      `,
      )
      .in('id', part)

    if (error) throw new Error(`ppd fallback: ${error.message}`)
    for (const row of data ?? []) {
      rows.push(row as unknown as PpdFallbackRow)
    }
  }
  return rows.map(ppdRowToStock)
}

export async function fetchCarritoStockByDetIds(
  sb: SupabaseClient,
  detIds: number[],
): Promise<Map<number, CarritoStockEnriched>> {
  const map = new Map<number, CarritoStockEnriched>()
  if (!detIds.length) return map

  const unique = [...new Set(detIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
  const expanded = expandPeDetIds(unique)

  const [cpRows, peRows] = await Promise.all([
    fetchVistaStockChunked(sb, 'v_stock_rimec', CARRITO_STOCK_SELECT_CP, expanded),
    fetchVistaStockChunked(sb, 'v_stock_pe_rimec', CARRITO_STOCK_SELECT_PE, expanded),
  ])

  const aliasKeys = new Set(unique)

  function storeRow(row: CarritoStockEnriched) {
    const detId = Number(row.det_id)
    const normalized = normalizarFilaStockVenta(row as unknown as Parameters<typeof normalizarFilaStockVenta>[0])
    map.set(detId, normalized as unknown as CarritoStockEnriched)
    if (detId >= PE_DET_ID_BASE && aliasKeys.has(detId - PE_DET_ID_BASE)) {
      map.set(detId - PE_DET_ID_BASE, { ...normalized, det_id: detId - PE_DET_ID_BASE } as unknown as CarritoStockEnriched)
    }
    if (detId > 0 && detId < PE_DET_ID_BASE && aliasKeys.has(detId + PE_DET_ID_BASE)) {
      map.set(detId, normalized as unknown as CarritoStockEnriched)
    }
  }

  for (const row of cpRows) storeRow(row)
  for (const row of peRows) storeRow(row)

  const missingCp = unique.filter((id) => id < PE_DET_ID_BASE && !map.has(id))
  if (missingCp.length > 0) {
    const fallback = await fetchPpdStockFallback(sb, missingCp)
    for (const row of fallback) {
      storeRow(row)
    }
  }

  return map
}
