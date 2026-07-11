/**
 * Validación Pronta entrega — RPC carrito_validar solo mira v_stock_rimec (CP).
 * PE-only: validar en app sin RPC (el RPC pisa precio_snapshot a 0).
 */
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCarritoStockByDetIds } from '@/lib/carritoStockEnrich'
import { getPrecioActivoPe, type ListaPrecioId } from '@/lib/precioLista'
import { isProntaEntregaStockRow } from '@/lib/prontaEntregaVenta'

export type ValidarItem = {
  det_id: number
  ok: boolean
  motivo: string | null
  cajas_actuales?: number
  cajas_solicitadas?: number
  precio_actual?: number | null
  precio_carrito?: number | null
}

export type ValidarResponse = {
  success: boolean
  estado: 'OK' | 'DIFERENCIAS' | 'ERROR'
  token?: string | null
  expira_en?: string | null
  items?: ValidarItem[]
  items_recalculados?: number
  detail?: string
}

function listaParaItem(
  sesion: { lista_precio_id?: number; descuentos_lote?: { facturas?: Array<Record<string, unknown>> } },
  item: { pp_id: number; marca_snapshot: string; caso_snapshot: string },
): ListaPrecioId {
  const facturas = sesion.descuentos_lote?.facturas ?? []
  const hit = facturas.find(
    (f) =>
      Number(f.pp_id) === item.pp_id &&
      String(f.marca) === item.marca_snapshot &&
      String(f.caso) === item.caso_snapshot,
  )
  const lista = Number(hit?.lista_precio_id ?? sesion.lista_precio_id ?? 1)
  if (lista >= 1 && lista <= 4) return lista as ListaPrecioId
  return 1
}

async function emitirTokenValidacion(
  sb: SupabaseClient,
  idUsuario: number,
): Promise<{ token: string; expira_en: string }> {
  const token = randomUUID()
  const now = new Date()
  const expira = new Date(now.getTime() + 60_000)
  await sb
    .from('carrito_sesion')
    .update({
      validacion_token: token,
      validacion_estado: 'OK',
      validada_en: now.toISOString(),
      actualizada_en: now.toISOString(),
    })
    .eq('id_usuario', idUsuario)
  return { token, expira_en: expira.toISOString() }
}

async function validarItemsPeEnCarrito(
  sb: SupabaseClient,
  idUsuario: number,
  items: Array<Record<string, unknown>>,
  sesion: Record<string, unknown>,
): Promise<{ items: ValidarItem[]; recalculados: number }> {
  const stockMap = await fetchCarritoStockByDetIds(
    sb,
    items.map((i) => Number(i.det_id)),
  )

  const out: ValidarItem[] = []
  let recalculados = 0

  for (const raw of items) {
    const item = raw as {
      det_id: number
      pp_id: number
      cantidad_cajas: number
      precio_snapshot: number
      marca_snapshot: string
      caso_snapshot: string
    }
    const detId = Number(item.det_id)
    const stock = stockMap.get(detId)
    const isPe = isProntaEntregaStockRow({
      det_id: detId,
      pp_id: item.pp_id,
      origen_tipo: stock?.origen_tipo as string | null | undefined,
    })

    if (!isPe) continue

    if (!stock) {
      out.push({
        det_id: detId,
        ok: false,
        motivo: 'ITEM_OBSOLETO',
        cajas_actuales: 0,
        cajas_solicitadas: Number(item.cantidad_cajas ?? 0),
        precio_actual: null,
        precio_carrito: Number(item.precio_snapshot ?? 0),
      })
      continue
    }

    const listaId = listaParaItem(sesion, item)
    const caso = String(item.caso_snapshot ?? stock.descp_caso ?? '')
    const precioActual = getPrecioActivoPe(
      {
        lpn: Number(stock.lpn) || null,
        lpc02: Number(stock.lpc02) || null,
        lpc03: Number(stock.lpc03) || null,
        lpc04: Number(stock.lpc04) || null,
        descp_caso: String(stock.descp_caso ?? caso),
      },
      listaId,
      caso,
    )
    const cajasActuales = Number(stock.cajas_disponibles ?? 0)
    const cajasSolicitadas = Number(item.cantidad_cajas ?? 0)
    const precioCarrito = Number(item.precio_snapshot ?? 0)

    let ok = true
    let motivo: string | null = null

    if (!precioActual || precioActual <= 0) {
      ok = false
      motivo = 'SIN_PRECIO'
    } else if (cajasSolicitadas > cajasActuales) {
      ok = false
      motivo = 'STOCK_INSUFICIENTE'
    } else if (precioCarrito > 0 && precioCarrito !== precioActual) {
      ok = false
      motivo = 'PRECIO_CAMBIO'
    }

    if (ok && precioActual !== precioCarrito) {
      await sb
        .from('carrito_item')
        .update({
          precio_snapshot: precioActual,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id_usuario', idUsuario)
        .eq('det_id', detId)
      recalculados += 1
    }

    out.push({
      det_id: detId,
      ok,
      motivo,
      cajas_actuales: cajasActuales,
      cajas_solicitadas: cajasSolicitadas,
      precio_actual: precioActual,
      precio_carrito: precioCarrito,
    })
  }

  return { items: out, recalculados }
}

/** Carrito 100% PE — no invocar RPC (pisa snapshots). */
export async function validarCarritoPeApp(
  sb: SupabaseClient,
  idUsuario: number,
): Promise<ValidarResponse> {
  const [{ data: items }, { data: sesion }] = await Promise.all([
    sb.from('carrito_item').select('*').eq('id_usuario', idUsuario),
    sb.from('carrito_sesion').select('*').eq('id_usuario', idUsuario).maybeSingle(),
  ])

  if (!items?.length) {
    return { success: false, estado: 'ERROR', detail: 'Carrito vacío' }
  }
  if (!sesion) {
    return { success: false, estado: 'ERROR', detail: 'Sesión de venta no activa' }
  }

  const { items: validados, recalculados } = await validarItemsPeEnCarrito(
    sb,
    idUsuario,
    items,
    sesion,
  )

  if (validados.length !== items.length) {
    return {
      success: false,
      estado: 'ERROR',
      detail: 'Carrito mixto — usar validación combinada',
    }
  }

  const allOk = validados.every((i) => i.ok)
  if (!allOk) {
    await sb
      .from('carrito_sesion')
      .update({
        validacion_token: null,
        validacion_estado: 'DIFERENCIAS',
        validada_en: new Date().toISOString(),
        actualizada_en: new Date().toISOString(),
      })
      .eq('id_usuario', idUsuario)

    return {
      success: true,
      estado: 'DIFERENCIAS',
      token: null,
      items: validados,
      items_recalculados: recalculados,
    }
  }

  const { token, expira_en } = await emitirTokenValidacion(sb, idUsuario)
  return {
    success: true,
    estado: 'OK',
    token,
    expira_en,
    items: validados,
    items_recalculados: recalculados,
  }
}

export async function parcheValidarProntaEntrega(
  sb: SupabaseClient,
  idUsuario: number,
  rpc: ValidarResponse,
): Promise<ValidarResponse> {
  const [{ data: items }, { data: sesion }] = await Promise.all([
    sb.from('carrito_item').select('*').eq('id_usuario', idUsuario),
    sb.from('carrito_sesion').select('*').eq('id_usuario', idUsuario).maybeSingle(),
  ])

  if (!items?.length || !sesion) return rpc

  const { items: peItems, recalculados } = await validarItemsPeEnCarrito(
    sb,
    idUsuario,
    items,
    sesion,
  )
  if (!peItems.length) return rpc

  const byDet = new Map<number, ValidarItem>()
  for (const row of rpc.items ?? []) {
    byDet.set(Number(row.det_id), { ...row, det_id: Number(row.det_id) })
  }
  for (const row of peItems) {
    byDet.set(row.det_id, row)
  }

  const mergedItems = items.map((i) => byDet.get(Number(i.det_id))).filter(Boolean) as ValidarItem[]
  const allOk = mergedItems.every((i) => i.ok)
  const estado = allOk ? 'OK' : 'DIFERENCIAS'

  if (allOk) {
    const tokenData =
      rpc.token && rpc.estado === 'OK'
        ? { token: rpc.token, expira_en: rpc.expira_en ?? null }
        : await emitirTokenValidacion(sb, idUsuario)

    return {
      success: true,
      estado: 'OK',
      items: mergedItems,
      items_recalculados: (rpc.items_recalculados ?? 0) + recalculados,
      ...tokenData,
    }
  }

  await sb
    .from('carrito_sesion')
    .update({
      validacion_token: null,
      validacion_estado: 'DIFERENCIAS',
      validada_en: new Date().toISOString(),
      actualizada_en: new Date().toISOString(),
    })
    .eq('id_usuario', idUsuario)

  return {
    success: true,
    estado: 'DIFERENCIAS',
    token: null,
    items: mergedItems,
    items_recalculados: (rpc.items_recalculados ?? 0) + recalculados,
  }
}

export async function clasificarCarritoPeCp(
  sb: SupabaseClient,
  idUsuario: number,
): Promise<{ hasPe: boolean; hasCp: boolean; count: number }> {
  const { data: items } = await sb
    .from('carrito_item')
    .select('pp_id')
    .eq('id_usuario', idUsuario)
  const rows = items ?? []
  return {
    hasPe: rows.some((i) => Number(i.pp_id) < 0),
    hasCp: rows.some((i) => Number(i.pp_id) > 0),
    count: rows.length,
  }
}
