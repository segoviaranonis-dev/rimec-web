/**
 * Cliente HTTP del carrito persistente en BD (MIG-080 → 083).
 * Reemplaza el carrito localStorage. El frontend nunca habla directo con la tabla;
 * pasa por los route handlers que validan sesión y usan SERVICE_ROLE_KEY.
 */

export class StockInsuficienteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StockInsuficienteError'
  }
}

export interface FacturaConfig {
  pp_id: number
  marca: string
  marca_id: number | null
  caso: string
  caso_id: number | null
  lista_precio_id: number
  descuentos: number[]
  pre_autorizado: boolean
  items_count: number
  /** R-FI-2 — LIQUIDACION | PROMOCIONAL | REGULAR (opcional, sync PE/CP). */
  cadena_comercial?: string | null
}

export interface DescuentosLote {
  facturas: FacturaConfig[]
}

export interface CarritoSesionBD {
  id_usuario: number
  cliente_id: number
  cliente_nombre: string
  plazo_id: number | null
  plazo_nombre: string | null
  cod_oper_carlos: string | null
  lista_precio_id: number
  descuentos: number[]
  descuentos_lote: DescuentosLote
  observacion?: string | null
  fecha_entrega_cliente?: string | null
  iniciada_en: string
  actualizada_en: string
  validada_en: string | null
  validacion_token: string | null
  validacion_estado: 'OK' | 'DIFERENCIAS' | 'BLOQUEADO' | null
}

export interface CarritoItemBD {
  id_usuario: number
  det_id: number
  pp_id: number
  cantidad_cajas: number
  precio_snapshot: number
  caso_snapshot: string
  caso_id_snapshot: number | null
  marca_snapshot: string
  marca_id_snapshot: number | null
  agregado_en: string
  actualizado_en: string
  v_stock_rimec?: Array<{
    det_id: number
    lpn: number | null
    lpc02: number | null
    lpc03: number | null
    lpc04: number | null
    cajas_disponibles: number | null  // Stock disponible para validación
    // METADATA para sesiones multi-dispositivo (MIG-083 fix)
    linea_codigo: string
    referencia_codigo: string
    material_code: string
    color_code: string
    descp_color: string
    pp_nro: string
    proforma: string                  // Matrimonio con pp_nro
    quincena_desc: string | null  // Dato duro (reemplaza eta)
    nombre: string
    imagen_url: string | null
    pares_por_caja: number
    grades_json?: Record<string, unknown> | null
  }>
}

export interface CarritoGetResponse {
  sesion: CarritoSesionBD | null
  items: CarritoItemBD[]
}

export interface ValidarItemResult {
  det_id: number
  cajas_solicitadas: number
  cajas_actuales: number
  pares_solicitados?: number
  pares_actuales?: number
  precio_carrito: number
  precio_actual: number | null
  ok: boolean
  motivo: 'SIN_PRECIO' | 'STOCK_INSUFICIENTE' | 'ITEM_OBSOLETO' | 'PRECIO_CAMBIO' | null
}

export interface ValidarResponse {
  success: boolean
  estado?: 'OK' | 'DIFERENCIAS' | 'BLOQUEADO'
  token?: string | null
  expira_en?: string | null
  items?: ValidarItemResult[]
  detail?: string
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let err = `HTTP ${res.status}`
    try {
      const data = await res.json()
      err = data?.error ?? err
    } catch {}
    throw new Error(err)
  }
  return (await res.json()) as T
}

export async function carritoGet(): Promise<CarritoGetResponse> {
  const res = await fetch('/api/carrito/sesion', { cache: 'no-store', credentials: 'include' })
  if (res.status === 401) return { sesion: null, items: [] }
  return asJson<CarritoGetResponse>(res)
}

export async function carritoPutSesion(payload: {
  cliente_id: number
  cliente_nombre: string
  plazo_id?: number | null
  plazo_nombre?: string | null
  cod_oper_carlos?: string | null
  lista_precio_id?: number
  descuentos?: number[]
  descuentos_lote?: Record<string, number[]>
  observacion?: string | null
  fecha_entrega_cliente?: string | null
}): Promise<CarritoSesionBD> {
  const res = await fetch('/api/carrito/sesion', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  const data = await asJson<{ sesion: CarritoSesionBD }>(res)
  return data.sesion
}

/** MIG-175 — observación + fecha entrega cliente (PE ↔ Logística OK) */
export async function carritoPatchLogisticaPe(payload: {
  observacion?: string | null
  fecha_entrega_cliente?: string | null
}): Promise<CarritoSesionBD> {
  const res = await fetch('/api/carrito/sesion', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  const data = await asJson<{ sesion: CarritoSesionBD }>(res)
  return data.sesion
}

export async function carritoDeleteSesion(): Promise<void> {
  const res = await fetch('/api/carrito/sesion', { method: 'DELETE', credentials: 'include' })
  await asJson<{ ok: boolean }>(res)
}

export async function carritoUpsertItem(item: {
  det_id: number
  pp_id: number
  cantidad_cajas: number
  precio_snapshot: number
  caso_snapshot: string
  caso_id_snapshot?: number | null
  marca_snapshot: string
  marca_id_snapshot?: number | null
  origen_tipo?: string | null
}): Promise<CarritoItemBD> {
  const res = await fetch('/api/carrito/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(item),
  })
  const data = await asJson<{ item: CarritoItemBD }>(res)
  return data.item
}

export async function carritoPatchItem(det_id: number, cantidad_cajas: number): Promise<void> {
  const res = await fetch(`/api/carrito/items/${det_id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ cantidad_cajas }),
  })

  if (!res.ok) {
    let err = `HTTP ${res.status}`
    try {
      const data = (await res.json()) as { error?: string }
      err = data?.error ?? err
      if (res.status === 400 && err.includes('stock insuficiente')) {
        throw new StockInsuficienteError(err)
      }
    } catch (parseErr) {
      if (parseErr instanceof StockInsuficienteError) throw parseErr
    }
    throw new Error(err)
  }

  await res.json().catch(() => null)
}

export async function carritoDeleteItem(det_id: number): Promise<void> {
  const res = await fetch(`/api/carrito/items/${det_id}`, { method: 'DELETE', credentials: 'include' })
  await asJson<{ ok: boolean }>(res)
}

export async function carritoVaciarItems(): Promise<void> {
  const res = await fetch('/api/carrito/items', { method: 'DELETE', credentials: 'include' })
  await asJson<{ ok: boolean }>(res)
}

export async function carritoValidar(): Promise<ValidarResponse> {
  const res = await fetch('/api/carrito/validar', { method: 'POST', credentials: 'include' })
  return asJson<ValidarResponse>(res)
}

export async function carritoPatchFactura(
  pp_id: number,
  marca: string,
  caso: string,
  config: {
    lista_precio_id?: number
    descuentos?: number[]
    pre_autorizado?: boolean
  }
): Promise<FacturaConfig> {
  const res = await fetch('/api/carrito/factura', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ pp_id, marca, caso, ...config }),
  })
  const data = await asJson<{ factura: FacturaConfig }>(res)
  return data.factura
}

export async function carritoRecalcularFactura(
  pp_id: number,
  marca: string,
  caso: string
): Promise<{ ok: boolean; items_actualizados: number; lista_aplicada: number; descuentos_aplicados: number[] }> {
  const res = await fetch('/api/carrito/factura/recalcular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ pp_id, marca, caso }),
  })
  return asJson(res)
}

export async function carritoGuardarDescuentosFi(
  pp_id: number,
  marca: string,
  caso: string,
  config: { lista_precio_id: number; descuentos: number[] },
): Promise<{
  ok: boolean
  items_actualizados: number
  lista_aplicada: number
  descuentos_aplicados: number[]
  origen: 'CP' | 'PE' | 'MIXTO'
}> {
  const res = await fetch('/api/carrito/factura/guardar-descuentos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ pp_id, marca, caso, ...config }),
  })
  return asJson(res)
}

export async function carritoLimpiar(): Promise<{
  ok: boolean
  ajustados: number
  eliminados: number
  detalle: { ajustados: number[]; eliminados: number[] }
}> {
  const res = await fetch('/api/carrito/limpiar', {
    method: 'POST',
    credentials: 'include',
  })
  return asJson(res)
}
