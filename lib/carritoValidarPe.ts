/**
 * Validación carrito CP + PE con misma lógica que catálogo (disponibilidad.ts).
 * RPC carrito_validar recalcula precios; el parche app re-valida stock/precio neto por FI.
 */
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarDescuentos4, precioNetoCascada } from '@/lib/carritoDescuentosFi'
import { fetchCarritoStockByDetIds } from '@/lib/carritoStockEnrich'
import {
  cajasDisponiblesDeFila,
  normalizarFilaStockVenta,
  paresDisponiblesDeFila,
  type StockRowMin,
} from '@/lib/disponibilidad'
import { getPrecioActivo, getPrecioActivoPe, type ListaPrecioId } from '@/lib/precioLista'
import { isProntaEntregaStockRow, paresDesdeCajasCerradas } from '@/lib/prontaEntregaVenta'

export type ValidarItem = {
  det_id: number
  ok: boolean
  motivo: string | null
  cajas_actuales?: number
  cajas_solicitadas?: number
  pares_actuales?: number
  pares_solicitados?: number
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

function descuentosParaItem(
  sesion: { descuentos_lote?: { facturas?: Array<Record<string, unknown>> }; descuentos?: number[] },
  item: { pp_id: number; marca_snapshot: string; caso_snapshot: string },
): number[] {
  const facturas = sesion.descuentos_lote?.facturas ?? []
  const hit = facturas.find(
    (f) =>
      Number(f.pp_id) === item.pp_id &&
      String(f.marca) === item.marca_snapshot &&
      String(f.caso) === item.caso_snapshot,
  )
  const raw = hit?.descuentos ?? sesion.descuentos ?? []
  return [...normalizarDescuentos4(raw)]
}

function filaValidacion(stock: Record<string, unknown>, detId: number, ppId: number): StockRowMin {
  const norm = normalizarFilaStockVenta(stock as unknown as StockRowMin)
  return { ...norm, det_id: detId, pp_id: ppId }
}

function paresInputDeFila(fila: StockRowMin): Parameters<typeof paresDesdeCajasCerradas>[1] {
  return {
    pares_por_caja: fila.pares_por_caja,
    cantidad_cajas: fila.cantidad_cajas,
    cantidad_pares: fila.cantidad_pares,
    saldo_pares: fila.saldo_pares,
    pares_vendidos: fila.pares_vendidos,
    grades_json: fila.grades_json,
    grada: fila.grada,
    origen_tipo: fila.origen_tipo,
    det_id: fila.det_id,
    pp_id: fila.pp_id,
  }
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
      actualizada_en: new Date().toISOString(),
    })
    .eq('id_usuario', idUsuario)
  return { token, expira_en: expira.toISOString() }
}

/** CP + PE — paridad catálogo (cajas + pares + precio neto por FI). */
async function validarItemsStockEnCarrito(
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
    const stockRaw = stockMap.get(detId)
    const cajasSolicitadas = Number(item.cantidad_cajas ?? 0)
    const precioCarrito = Number(item.precio_snapshot ?? 0)

    if (!stockRaw) {
      out.push({
        det_id: detId,
        ok: false,
        motivo: 'ITEM_OBSOLETO',
        cajas_actuales: 0,
        cajas_solicitadas: cajasSolicitadas,
        pares_actuales: 0,
        pares_solicitados: 0,
        precio_actual: null,
        precio_carrito: precioCarrito,
      })
      continue
    }

    const isPe = isProntaEntregaStockRow({
      det_id: detId,
      pp_id: item.pp_id,
      origen_tipo: stockRaw.origen_tipo as string | null | undefined,
    })
    const fila = filaValidacion(stockRaw, detId, item.pp_id)
    const cajasActuales = cajasDisponiblesDeFila(fila)
    const paresActuales = paresDisponiblesDeFila(fila)
    const paresSolicitados = paresDesdeCajasCerradas(cajasSolicitadas, paresInputDeFila(fila))

    const listaId = listaParaItem(sesion, item)
    const descuentos = descuentosParaItem(sesion, item)
    const caso = String(item.caso_snapshot ?? stockRaw.descp_caso ?? '')
    const rowPrecio = {
      lpn: Number(stockRaw.lpn) || null,
      lpc02: Number(stockRaw.lpc02) || null,
      lpc03: Number(stockRaw.lpc03) || null,
      lpc04: Number(stockRaw.lpc04) || null,
      descp_caso: String(stockRaw.descp_caso ?? caso),
    }
    const precioBruto = isPe
      ? getPrecioActivoPe(rowPrecio, listaId, caso)
      : getPrecioActivo(rowPrecio, listaId, caso)
    const precioEsperado =
      precioBruto != null && precioBruto > 0
        ? precioNetoCascada(precioBruto, descuentos)
        : null

    let ok = true
    let motivo: string | null = null

    if (precioEsperado == null || precioEsperado <= 0) {
      ok = false
      motivo = 'SIN_PRECIO'
    } else if (cajasActuales <= 0 || paresActuales <= 0) {
      ok = false
      motivo = 'STOCK_INSUFICIENTE'
    } else if (cajasSolicitadas > cajasActuales || paresSolicitados > paresActuales) {
      ok = false
      motivo = 'STOCK_INSUFICIENTE'
    } else if (precioCarrito > 0 && precioCarrito !== precioEsperado) {
      ok = false
      motivo = 'PRECIO_CAMBIO'
    }

    if (ok && precioEsperado != null && precioCarrito !== precioEsperado) {
      await sb
        .from('carrito_item')
        .update({
          precio_snapshot: precioEsperado,
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
      pares_actuales: paresActuales,
      pares_solicitados: paresSolicitados,
      precio_actual: precioEsperado,
      precio_carrito: precioCarrito,
    })
  }

  return { items: out, recalculados }
}

/** Carrito 100% PE — no invocar RPC (pisa snapshots CP). */
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

  const { items: validados, recalculados } = await validarItemsStockEnCarrito(
    sb,
    idUsuario,
    items,
    sesion,
  )

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

/** Reemplaza stock/precio del RPC con validación enriquecida (CP + PE). */
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

  const { items: stockItems, recalculados } = await validarItemsStockEnCarrito(
    sb,
    idUsuario,
    items,
    sesion,
  )

  const mergedItems = stockItems
  const allOk = mergedItems.every((i) => i.ok)

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
