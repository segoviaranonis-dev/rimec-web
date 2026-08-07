'use client'

import { create } from 'zustand'
import {
  carritoPatchLogisticaPe,
  carritoDeleteItem,
  carritoDeleteSesion,
  carritoGet,
  carritoGuardarDescuentosFi,
  carritoPatchFactura,
  carritoPatchItem,
  carritoPutSesion,
  carritoRecalcularFactura,
  carritoUpsertItem,
  carritoVaciarItems,
  StockInsuficienteError,
  type CarritoItemBD,
  type CarritoSesionBD,
  type FacturaConfig,
} from '@/lib/carritoApi'
import {
  getPrecioActivo as getPrecioActivoLib,
  getPrecioActivoPe as getPrecioActivoPeLib,
} from '@/lib/precioLista'
import {
  isProntaEntregaStockRow,
  paresCarritoDesdeCajas,
  resolveParesPorCaja,
} from '@/lib/prontaEntregaVenta'
import { normalizarDescuentos4, precioNetoCascada } from '@/lib/carritoDescuentosFi'
import { gradasFmtFromRow } from '@/lib/gradasFmt'
import { etiquetaCasoFi } from '@/lib/facturaCasoClave'
import { cadenaComercialFi, claveCelulaFiPeDictado, etiquetaCelulaFi } from '@/lib/facturaCelulaClave'
import { findFacturaConfig } from '@/lib/facturaConfigMatch'

export { getPrecioActivoLib as getPrecioActivo, getPrecioActivoPeLib as getPrecioActivoPe }

/* ── Tipos ── */
export interface Cliente {
  id_cliente:    number
  descp_cliente: string
  email:         string | null
}

export interface Vendedor {
  id_vendedor:    number
  descp_vendedor: string
}

export interface Plazo {
  id_plazo:         number
  descp_plazo:      string
  cod_oper_carlos:  string
  label_ui?:        string
}

export const LISTAS = [
  { id: 1, nombre: 'LPN'   },
  { id: 2, nombre: 'LPC02' },
  { id: 3, nombre: 'LPC03' },
  { id: 4, nombre: 'LPC04' },
] as const

export type ListaId = 1 | 2 | 3 | 4

export interface ItemCarrito {
  det_id:          number
  linea_codigo:    string
  referencia_codigo: string
  material_code:   string
  color_code:      string
  color_nombre:    string
  pp_id:           number
  pp_nro:          string
  proforma:        string         // Matrimonio con pp_nro
  quincena_desc:   string | null  // Dato duro (reemplaza eta)
  marca:           string
  marca_id:        number | null
  caso:            string
  caso_id:         number | null
  /** R-FI-2 — señales comerciales (PE / SDRM / COD.GRUPO Carlos) */
  es_promo?:       boolean | null
  es_liquidacion?: boolean | null
  cadena_comercial?: string | null
  cod_grupo?:      string | null
  /** % dictado Report (pe_descuento_comercial_molecula) — segregación FI PE */
  descuento_comercial_pct?: number | null
  nombre:          string
  gradas_fmt:      string
  imagen_url:      string
  lista_precio_id: ListaId
  /** Bruto de lista (LPN/LPC de stock). Nunca el neto post-descuento. */
  precio_base:     number
  /**
   * Neto persistido en `carrito_item.precio_snapshot` tras Guardar/Validar.
   * Si > 0 y no hay bruto de lista, fragmentar lo usa sin reaplicar cascada
   * (evita doble descuento).
   */
  precio_snapshot_neto?: number
  // Precios directos de v_stock_rimec (MIG-083 fix) — solo vista stock, nunca snapshot neto
  precio_lpn:      number
  precio_lpc02:    number
  precio_lpc03:    number
  precio_lpc04:    number
  cant_caja:       number
  cajas:           number
  pares:           number
  subtotal:        number
  cajas_disponibles: number  // Stock disponible para validación del botón +
  saldo_pares?:    number | null
  grada?:          string | null
  grades_json?:    Record<string, number> | null
  origen_tipo?: string | null
}

export type ItemCarritoMeta = Omit<ItemCarrito, 'cajas' | 'pares' | 'subtotal'>

export interface SesionVenta {
  cliente:           Cliente | null
  vendedor:          Vendedor | null
  plazo:             Plazo | null
  listaPrecioId:     ListaId
  descuentos:        number[]
  descuentosPorLote: Record<number, number[]>
  facturas:          FacturaConfig[]
  todasPreAutorizadas: boolean
  carrito:           Record<string, ItemCarrito>
  activa:            boolean
  activatedAt:       string | null
  /** True mientras el store está sincronizándose con la BD por primera vez. */
  hydrating:         boolean
  /** True cuando ya hubo al menos un fetch desde la BD. */
  hydrated:          boolean
  /** Último error al hidratar (null = OK). No vacía el carrito local. */
  hydrateError:      string | null
  /** Snapshot de validación más reciente (`carrito_validar` RPC). */
  validacion: {
    estado: 'IDLE' | 'OK' | 'DIFERENCIAS' | 'BLOQUEADO' | 'ERROR'
    token: string | null
    expiraEn: string | null
    items: Array<{
      det_id: number
      ok: boolean
      motivo: string | null
      cajas_actuales: number
      cajas_solicitadas?: number
      pares_actuales?: number
      pares_solicitados?: number
      precio_actual: number | null
    }>
  }

  /** MIG-175 — PE ↔ Logística OK (opcional, sugerido en carrito) */
  observacionPe:         string
  fechaEntregaCliente:   string

  // Acciones (todas async — golpean /api/carrito/*).
  activar:          (cliente: Cliente, vendedor: Vendedor, plazo: Plazo, listaId: ListaId, descuentos: number[]) => Promise<void>
  desactivar:       () => Promise<void>
  setLista:         (id: ListaId) => Promise<void>
  setDescuentos:    (desc: number[]) => Promise<void>
  setDescuentoLote: (ppId: number, desc: number[]) => Promise<void>
  actualizarDescuentosFactura: (pp_id: number, marca: string, caso: string, config: { lista_precio_id?: number; descuentos?: number[]; pre_autorizado?: boolean }) => Promise<void>
  guardarDescuentosFactura: (pp_id: number, marca: string, caso: string, config: { lista_precio_id: number; descuentos: number[]; caso_id?: number | null }) => Promise<{ items_actualizados: number; origen: string }>
  recalcularFactura: (pp_id: number, marca: string, caso: string) => Promise<{ ok: boolean; items_actualizados: number; lista_aplicada: number; descuentos_aplicados: number[] }>
  agregarCaja:      (item: ItemCarritoMeta) => Promise<void>
  quitarCaja:       (det_id: number) => Promise<void>
  setCajas:         (det_id: number, cajas: number) => Promise<void>
  eliminarItem:     (det_id: number) => Promise<void>
  eliminarItems:    (detIds: number[]) => Promise<void>
  vaciarCarrito:    () => Promise<void>

  // Sync (lo usa SesionSyncProvider).
  cargarDesdeBD:    () => Promise<void>
  aplicarSnapshot:  (sesion: CarritoSesionBD | null, items: CarritoItemBD[]) => void
  setVendedor:      (v: Vendedor | null) => void
  setValidacion:    (val: SesionVenta['validacion']) => void
  limpiarValidacion: () => void
  setLogisticaPe:   (observacion: string, fechaEntregaCliente: string) => Promise<void>
  patchLogisticaPeLocal: (observacion: string, fechaEntregaCliente: string) => void
}

/* ── Helpers ── */
export function esSesionDeOtroDia(activatedAt: string | null | undefined): boolean {
  if (!activatedAt) return false
  const t = new Date(activatedAt)
  if (Number.isNaN(t.getTime())) return false
  const now = new Date()
  return (
    t.getFullYear() !== now.getFullYear() ||
    t.getMonth()    !== now.getMonth()    ||
    t.getDate()     !== now.getDate()
  )
}

export function esSesionAntigua(activatedAt: string | null | undefined, horas = 12): boolean {
  if (!activatedAt) return false
  const t = new Date(activatedAt).getTime()
  if (Number.isNaN(t)) return false
  return (Date.now() - t) > horas * 3600 * 1000
}

function calcularPrecioNeto(precioBase: number, descuentos: number[]): number {
  return precioNetoCascada(precioBase, normalizarDescuentos4(descuentos))
}

function paresCalc(item: ItemCarritoMeta, cajas: number): number {
  return paresCarritoDesdeCajas(cajas, item)
}

function brutoListaDesdeStock(
  stock: { lpn?: number; lpc02?: number; lpc03?: number; lpc04?: number } | null | undefined,
  listaId: ListaId,
  caso: string,
  esPe: boolean,
): number {
  const row = {
    lpn: Number(stock?.lpn) > 0 ? Number(stock?.lpn) : null,
    lpc02: Number(stock?.lpc02) > 0 ? Number(stock?.lpc02) : null,
    lpc03: Number(stock?.lpc03) > 0 ? Number(stock?.lpc03) : null,
    lpc04: Number(stock?.lpc04) > 0 ? Number(stock?.lpc04) : null,
  }
  const fromLista = esPe
    ? getPrecioActivoPeLib(row, listaId, caso)
    : getPrecioActivoLib(row, listaId, caso)
  return fromLista != null && fromLista > 0 ? fromLista : 0
}

function itemFromBD(meta: Map<number, ItemCarritoMeta>, row: CarritoItemBD, listaId: ListaId): ItemCarrito | null {
  const base = meta.get(row.det_id)
  // Extraer datos del JOIN con v_stock_rimec (MIG-083 fix: multi-dispositivo)
  const stockRow = row.v_stock_rimec?.[0]
  // Solo precios de lista desde stock. NUNCA rellenar LPN con precio_snapshot
  // (tras Guardar/Validar el snapshot es NETO → doble descuento en fragmentar).
  const precio_lpn = Number(stockRow?.lpn) > 0 ? Number(stockRow?.lpn) : 0
  const precio_lpc02 = Number(stockRow?.lpc02) > 0 ? Number(stockRow?.lpc02) : 0
  const precio_lpc03 = Number(stockRow?.lpc03) > 0 ? Number(stockRow?.lpc03) : 0
  const precio_lpc04 = Number(stockRow?.lpc04) > 0 ? Number(stockRow?.lpc04) : 0
  const snapNeto = Number(row.precio_snapshot) > 0 ? Number(row.precio_snapshot) : 0

  // Si tenemos META_CACHE (localStorage), usarlo
  const stockAny = stockRow as {
    saldo_pares?: number
    grada?: string | null
    cantidad_cajas?: number
    cantidad_pares?: number
    pares_por_caja?: number
    grades_json?: Record<string, number> | null
    origen_tipo?: string
    cajas_disponibles?: number
    es_promo?: boolean | null
    es_liquidacion?: boolean | null
    cadena_comercial?: string | null
    cod_grupo?: string | null
    descuento_comercial_pct?: number | null
  } | undefined
  const stockSaldo = stockAny?.saldo_pares
  const stockGrada = stockAny?.grada
  const stockGrades = stockAny?.grades_json
  // R-FI-2: stock PE manda sobre cache local (si falta, todo colapsa a REGULAR por caso_id).
  const esPromo =
    stockAny?.es_promo != null ? Boolean(stockAny.es_promo) : base?.es_promo ?? null
  const esLiq =
    stockAny?.es_liquidacion != null
      ? Boolean(stockAny.es_liquidacion)
      : base?.es_liquidacion ?? null
  const cadenaCom =
    stockAny?.cadena_comercial != null && String(stockAny.cadena_comercial).trim() !== ''
      ? String(stockAny.cadena_comercial)
      : base?.cadena_comercial ?? null
  const codGrupo =
    stockAny?.cod_grupo != null && String(stockAny.cod_grupo).trim() !== ''
      ? String(stockAny.cod_grupo)
      : base?.cod_grupo ?? null
  const descComercial = (() => {
    const n = Number(stockAny?.descuento_comercial_pct)
    if (Number.isFinite(n) && n > 0) return n
    return base?.descuento_comercial_pct ?? null
  })()

  const origenTipoEarly = stockAny?.origen_tipo ?? base?.origen_tipo ?? null
  const esPeRow =
    isProntaEntregaStockRow({
      det_id: row.det_id,
      origen_tipo: origenTipoEarly,
      pp_id: row.pp_id,
    }) || Number(row.pp_id) < 0
  const casoSnap = String(row.caso_snapshot ?? base?.caso ?? '')
  const precioBrutoLista = brutoListaDesdeStock(
    { lpn: precio_lpn, lpc02: precio_lpc02, lpc03: precio_lpc03, lpc04: precio_lpc04 },
    listaId,
    casoSnap,
    esPeRow,
  )
  // Base de lista = bruto stock. Snapshot solo como neto (subtotal ya neto post-guardar).
  const precioBaseUi = precioBrutoLista > 0 ? precioBrutoLista : 0

  if (base) {
    const enriched: ItemCarritoMeta = {
      ...base,
      saldo_pares: base.saldo_pares ?? stockSaldo ?? null,
      grada: base.grada ?? stockGrada ?? null,
      grades_json: base.grades_json ?? stockGrades ?? null,
      es_promo: esPromo,
      es_liquidacion: esLiq,
      cadena_comercial: cadenaCom,
      cod_grupo: codGrupo,
      descuento_comercial_pct: descComercial,
      origen_tipo: origenTipoEarly ?? base.origen_tipo,
      precio_lpn,
      precio_lpc02,
      precio_lpc03,
      precio_lpc04,
      precio_base: precioBaseUi > 0 ? precioBaseUi : base.precio_base,
      precio_snapshot_neto: snapNeto,
    }
    persistMeta(enriched)
    const pares = paresCalc(enriched, row.cantidad_cajas)
    const unitNeto = snapNeto > 0 ? snapNeto : enriched.precio_base
    return {
      ...enriched,
      lista_precio_id: listaId,
      precio_base: precioBaseUi > 0 ? precioBaseUi : enriched.precio_base,
      precio_snapshot_neto: snapNeto,
      precio_lpn,
      precio_lpc02,
      precio_lpc03,
      precio_lpc04,
      cajas: row.cantidad_cajas,
      pares,
      subtotal: unitNeto * pares,
      cajas_disponibles: stockAny?.cajas_disponibles ?? base.cajas_disponibles ?? 0,
      origen_tipo: origenTipoEarly ?? base.origen_tipo,
    }
  }

  // SIN META_CACHE (otro dispositivo): usar datos de vista stock
  const origenTipo = origenTipoEarly
  const saldo_pares = stockSaldo ?? null
  const cant_caja = resolveParesPorCaja({
    pares_por_caja: stockAny?.pares_por_caja,
    cantidad_cajas: stockAny?.cantidad_cajas,
    cantidad_pares: stockAny?.cantidad_pares,
    saldo_pares,
    grades_json: stockGrades,
    grada: stockGrada,
    origen_tipo: origenTipo,
    det_id: row.det_id,
    pp_id: row.pp_id,
  })
  const pares = paresCarritoDesdeCajas(row.cantidad_cajas, {
    cant_caja,
    saldo_pares,
    grades_json: stockGrades,
    grada: stockGrada,
    origen_tipo: origenTipo,
    det_id: row.det_id,
    pp_id: row.pp_id,
  })
  const unitNeto = snapNeto > 0 ? snapNeto : precioBaseUi

  return {
    det_id: row.det_id,
    linea_codigo: stockRow?.linea_codigo ?? '',
    referencia_codigo: stockRow?.referencia_codigo ?? '',
    material_code: stockRow?.material_code ?? '',
    color_code: stockRow?.color_code ?? '',
    color_nombre: stockRow?.descp_color ?? '',
    pp_id: row.pp_id,
    pp_nro: stockRow?.pp_nro ?? '',
    proforma: stockRow?.proforma ?? '',
    quincena_desc: stockRow?.quincena_desc ?? null,
    marca: row.marca_snapshot,
    marca_id: row.marca_id_snapshot,
    caso: row.caso_snapshot,
    caso_id: row.caso_id_snapshot,
    es_promo: esPromo,
    es_liquidacion: esLiq,
    cadena_comercial: cadenaCom,
    cod_grupo: codGrupo,
    descuento_comercial_pct: descComercial,
    nombre: stockRow?.nombre ?? '',
    gradas_fmt: gradasFmtFromRow({
      grades_json: stockRow?.grades_json as Record<string, number> | null | undefined,
      grada: (stockRow as { grada?: string | null } | undefined)?.grada,
    }),
    imagen_url: stockRow?.imagen_url ?? '',
    lista_precio_id: listaId,
    precio_base: precioBaseUi,
    precio_snapshot_neto: snapNeto,
    precio_lpn,
    precio_lpc02,
    precio_lpc03,
    precio_lpc04,
    cant_caja,
    saldo_pares,
    grada: stockGrada ?? null,
    grades_json: stockGrades ?? null,
    cajas: row.cantidad_cajas,
    pares,
    subtotal: unitNeto * pares,
    cajas_disponibles: stockAny?.cajas_disponibles ?? 0,
    origen_tipo: origenTipo,
  }
}

/**
 * Cache local de metadatos de cada item (línea, color, imagen, gradas, etc.).
 * Se llena cuando el usuario agrega desde el catálogo, así podemos repoblar
 * el shape `ItemCarrito` aunque la BD solo guarde precio + snapshot mínimo.
 */
const META_CACHE: Map<number, ItemCarritoMeta> = new Map()

/** Evita GET /carrito/sesion en cada tap — agrupa sync FI + Realtime. */
let cargarDesdeBDTimer: ReturnType<typeof setTimeout> | null = null
let hydrateGen = 0

function scheduleCargarDesdeBD(get: () => SesionVenta) {
  if (typeof window === 'undefined') return
  if (cargarDesdeBDTimer) clearTimeout(cargarDesdeBDTimer)
  cargarDesdeBDTimer = setTimeout(() => {
    cargarDesdeBDTimer = null
    void get().cargarDesdeBD()
  }, 2000)
}

/** Realtime / multi-tab: debounce hydrate (no pisar con GET viejos). */
export function scheduleCarritoHydrate() {
  scheduleCargarDesdeBD(() => useSesion.getState())
}

function persistMeta(item: ItemCarritoMeta) {
  META_CACHE.set(item.det_id, item)
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('rimec_meta_cache') ?? '{}'
      const obj = JSON.parse(raw) as Record<string, ItemCarritoMeta>
      obj[String(item.det_id)] = item
      window.localStorage.setItem('rimec_meta_cache', JSON.stringify(obj))
    } catch {}
  }
}

function hydrateMetaFromLocal() {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem('rimec_meta_cache')
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, ItemCarritoMeta>
    for (const v of Object.values(obj)) {
      if (v && typeof v.det_id === 'number') META_CACHE.set(v.det_id, v)
    }
  } catch {}
}

/* ── Store ── */
export const useSesion = create<SesionVenta>()((set, get) => ({
  cliente:           null,
  vendedor:          null,
  plazo:             null,
  listaPrecioId:     1,
  descuentos:        [],
  descuentosPorLote: {},
  facturas:          [],
  todasPreAutorizadas: true,
  carrito:           {},
  activa:            false,
  activatedAt:       null,
  hydrating:         false,
  hydrated:          false,
  hydrateError:      null,
  validacion: {
    estado: 'IDLE',
    token: null,
    expiraEn: null,
    items: [],
  },
  observacionPe: '',
  fechaEntregaCliente: '',

  setVendedor: (v) => set({ vendedor: v }),
  setValidacion: (val) => set({ validacion: val }),
  limpiarValidacion: () =>
    set({ validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } }),

  setLogisticaPe: async (observacion, fechaEntregaCliente) => {
    try {
      await carritoPatchLogisticaPe({
        observacion: observacion.trim() || null,
        fecha_entrega_cliente: fechaEntregaCliente.trim().slice(0, 10) || null,
      })
    } catch (e) {
      console.warn('[sesionVenta] setLogisticaPe:', e)
    }
  },

  patchLogisticaPeLocal: (observacion, fechaEntregaCliente) =>
    set({ observacionPe: observacion, fechaEntregaCliente }),

  aplicarSnapshot: (sesion, items) => {
    hydrateMetaFromLocal()
    const listaId = (sesion?.lista_precio_id as ListaId) ?? 1
    const carrito: Record<string, ItemCarrito> = {}
    for (const row of items) {
      const it = itemFromBD(META_CACHE, row, listaId)
      if (it) carrito[`det_${row.det_id}`] = it
    }
    const facturas = sesion?.descuentos_lote?.facturas ?? []
    const todasPreAutorizadas = facturas.every((f) => f.pre_autorizado)
    set((s) => ({
      cliente: sesion
        ? { id_cliente: sesion.cliente_id, descp_cliente: sesion.cliente_nombre, email: null }
        : null,
      plazo: sesion && sesion.plazo_id
        ? {
            id_plazo: sesion.plazo_id,
            descp_plazo: sesion.plazo_nombre ?? '',
            cod_oper_carlos: sesion.cod_oper_carlos ?? '',
          }
        : null,
      listaPrecioId: listaId,
      descuentos: sesion?.descuentos ?? [],
      descuentosPorLote: (sesion?.descuentos_lote as Record<number, number[]> | undefined) ?? {},
      facturas,
      todasPreAutorizadas,
      carrito,
      activa: Boolean(sesion),
      activatedAt: sesion?.iniciada_en ?? null,
      observacionPe: sesion?.observacion ?? '',
      fechaEntregaCliente: sesion?.fecha_entrega_cliente?.slice(0, 10) ?? '',
      vendedor: s.vendedor,
      hydrated: true,
      hydrating: false,
      hydrateError: null,
      validacion:
        sesion?.validacion_estado === 'OK' && sesion?.validacion_token
          ? {
              estado: 'OK',
              token: sesion.validacion_token,
              expiraEn: sesion.validada_en
                ? new Date(new Date(sesion.validada_en).getTime() + 30 * 60_000).toISOString()
                : null,
              items: [],
            }
          : { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    }))
  },

  cargarDesdeBD: async () => {
    if (typeof window === 'undefined') return
    const gen = ++hydrateGen
    set({ hydrating: true, hydrateError: null })
    try {
      const data = await carritoGet()
      // Solo aplicar si este GET es el más reciente (anti-race Realtime/multi-tab).
      if (gen !== hydrateGen) return
      // Snapshot vacío solo con HTTP 200 explícito (BD sin filas).
      get().aplicarSnapshot(data.sesion, data.items ?? [])
    } catch (err) {
      if (gen !== hydrateGen) return
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[sesionVenta] cargarDesdeBD falló — se conserva carrito local:', msg)
      // CRÍTICO: no aplicar vacío. Si ya había items/sesión, se mantienen.
      set({ hydrating: false, hydrated: true, hydrateError: msg })
    }
  },

  activar: async (cliente, vendedor, plazo, listaId, descuentos) => {
    await carritoPutSesion({
      cliente_id: cliente.id_cliente,
      cliente_nombre: cliente.descp_cliente,
      plazo_id: plazo.id_plazo,
      plazo_nombre: plazo.descp_plazo,
      cod_oper_carlos: plazo.cod_oper_carlos,
      lista_precio_id: listaId,
      descuentos: descuentos.slice(0, 4),
      descuentos_lote: {},
    })
    // Rehidratar desde BD — NUNCA dejar carrito:{} como estado final (perdía items BZZP).
    set({
      cliente,
      vendedor,
      plazo,
      listaPrecioId: listaId,
      descuentos: descuentos.slice(0, 4),
      activa: true,
      activatedAt: new Date().toISOString(),
      validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    })
    await get().cargarDesdeBD()
  },

  desactivar: async () => {
    try {
      await carritoDeleteSesion()
    } catch (e) {
      console.warn('[sesionVenta] desactivar falló — no se limpia UI:', e)
      set({
        hydrateError: e instanceof Error ? e.message : 'No se pudo cerrar la venta en el servidor',
      })
      throw e
    }
    set({
      cliente: null, plazo: null,
      activa: false, activatedAt: null,
      carrito: {}, descuentos: [], descuentosPorLote: {},
      facturas: [], todasPreAutorizadas: true,
      observacionPe: '', fechaEntregaCliente: '',
      hydrateError: null,
      validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    })
  },

  setLista: async (id) => {
    const s = get()
    if (!s.cliente) { set({ listaPrecioId: id }); return }
    await carritoPutSesion({
      cliente_id: s.cliente.id_cliente,
      cliente_nombre: s.cliente.descp_cliente,
      plazo_id: s.plazo?.id_plazo ?? null,
      plazo_nombre: s.plazo?.descp_plazo ?? null,
      cod_oper_carlos: s.plazo?.cod_oper_carlos ?? null,
      lista_precio_id: id,
      descuentos: s.descuentos,
      descuentos_lote: s.descuentosPorLote as Record<string, number[]>,
    })
    set({ listaPrecioId: id })
  },

  setDescuentos: async (desc) => {
    const s = get()
    const next = desc.slice(0, 4)
    if (!s.cliente) { set({ descuentos: next }); return }
    await carritoPutSesion({
      cliente_id: s.cliente.id_cliente,
      cliente_nombre: s.cliente.descp_cliente,
      plazo_id: s.plazo?.id_plazo ?? null,
      plazo_nombre: s.plazo?.descp_plazo ?? null,
      cod_oper_carlos: s.plazo?.cod_oper_carlos ?? null,
      lista_precio_id: s.listaPrecioId,
      descuentos: next,
      descuentos_lote: s.descuentosPorLote as Record<string, number[]>,
    })
    set({ descuentos: next })
  },

  setDescuentoLote: async (ppId, desc) => {
    const s = get()
    const nextLote = { ...s.descuentosPorLote, [ppId]: desc }
    if (!s.cliente) { set({ descuentosPorLote: nextLote }); return }
    await carritoPutSesion({
      cliente_id: s.cliente.id_cliente,
      cliente_nombre: s.cliente.descp_cliente,
      plazo_id: s.plazo?.id_plazo ?? null,
      plazo_nombre: s.plazo?.descp_plazo ?? null,
      cod_oper_carlos: s.plazo?.cod_oper_carlos ?? null,
      lista_precio_id: s.listaPrecioId,
      descuentos: s.descuentos,
      descuentos_lote: nextLote as Record<string, number[]>,
    })
    set({ descuentosPorLote: nextLote })
  },

  actualizarDescuentosFactura: async (pp_id, marca, caso, config) => {
    await carritoPatchFactura(pp_id, marca, caso, config)
    await get().cargarDesdeBD()
  },

  guardarDescuentosFactura: async (pp_id, marca, caso, config) => {
    const result = await carritoGuardarDescuentosFi(pp_id, marca, caso, config)
    await get().cargarDesdeBD()
    set({
      validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    })
    return {
      items_actualizados: result.items_actualizados,
      origen: result.origen,
    }
  },

  recalcularFactura: async (pp_id, marca, caso) => {
    try {
      const result = await carritoRecalcularFactura(pp_id, marca, caso)
      await get().cargarDesdeBD()
      return result
    } catch (err) {
      console.error('Error recalculando factura:', err)
      throw err
    }
  },

  agregarCaja: async (item) => {
    persistMeta(item)
    const key = `det_${item.det_id}`
    const s = get()
    const actual = s.carrito[key]?.cajas ?? 0
    const cajas = actual + 1
    const pares = paresCalc(item, cajas)
    const prevEntry = s.carrito[key]

    // UI optimista — el tap no espera 10s al POST.
    set((st) => ({
      carrito: { ...st.carrito, [key]: { ...item, cajas, pares, subtotal: item.precio_base * pares } },
      validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    }))

    try {
      await carritoUpsertItem({
        det_id: item.det_id,
        pp_id: item.pp_id,
        cantidad_cajas: cajas,
        precio_snapshot: item.precio_base,
        caso_snapshot: item.caso,
        caso_id_snapshot: item.caso_id ?? null,
        marca_snapshot: item.marca,
        marca_id_snapshot: item.marca_id ?? null,
        origen_tipo: item.origen_tipo ?? null,
      })
    } catch (err) {
      console.error('[sesionVenta.agregarCaja]', err)
      const rollbackCajas = Math.max(0, cajas - 1)
      set((st) => {
        const next = { ...st.carrito }
        if (rollbackCajas <= 0) {
          if (prevEntry) next[key] = prevEntry
          else delete next[key]
        } else if (prevEntry) {
          const rp = paresCalc(prevEntry, rollbackCajas)
          next[key] = { ...prevEntry, cajas: rollbackCajas, pares: rp, subtotal: prevEntry.precio_base * rp }
        } else {
          delete next[key]
        }
        return { carrito: next, validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } }
      })
      throw err
    }
    scheduleCargarDesdeBD(get)
  },

  quitarCaja: async (det_id) => {
    const key = `det_${det_id}`
    const s = get()
    const actual = s.carrito[key]
    if (!actual) return
    const cajas = actual.cajas - 1
    try {
      if (cajas <= 0) {
        await carritoDeleteItem(det_id)
        const next = { ...s.carrito }
        delete next[key]
        set({ carrito: next, validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } })
        return
      }
      await carritoPatchItem(det_id, cajas)
      const pares = paresCarritoDesdeCajas(cajas, actual)
      set((st) => ({
        carrito: { ...st.carrito, [key]: { ...actual, cajas, pares, subtotal: actual.precio_base * pares } },
        validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
      }))
    } catch (err) {
      console.error('[sesionVenta.quitarCaja]', err)
      throw err
    }
  },

  setCajas: async (det_id, cajas) => {
    const key = `det_${det_id}`
    const s = get()
    const actual = s.carrito[key]
    if (!actual) return
    const safe = Math.max(0, Math.floor(Number.isFinite(cajas) ? cajas : 0))
    if (safe === 0) {
      try {
        await carritoDeleteItem(det_id)
        const next = { ...s.carrito }
        delete next[key]
        set({ carrito: next, validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } })
      } catch (err) {
        console.error('[sesionVenta.setCajas]', err)
      }
      return
    }
    try {
      await carritoPatchItem(det_id, safe)
      const pares = paresCarritoDesdeCajas(safe, actual)
      set((st) => ({
        carrito: { ...st.carrito, [key]: { ...actual, cajas: safe, pares, subtotal: actual.precio_base * pares } },
        validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
      }))
    } catch (err) {
      if (err instanceof StockInsuficienteError) {
        // Validación de stock - no actualizar estado, silencioso
        return
      }
      console.error('[sesionVenta.setCajas]', err)
    }
  },

  eliminarItem: async (det_id) => {
    await carritoDeleteItem(det_id)
    const next = { ...get().carrito }
    delete next[`det_${det_id}`]
    set({ carrito: next, validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } })
  },

  eliminarItems: async (detIds) => {
    if (!detIds.length) return
    await Promise.all(detIds.map((id) => carritoDeleteItem(id)))
    const next = { ...get().carrito }
    for (const id of detIds) delete next[`det_${id}`]
    set({ carrito: next, validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } })
  },

  vaciarCarrito: async () => {
    await carritoVaciarItems()
    set({ carrito: {}, validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } })
  },
}))

/* ── Fragmentación (sin cambios respecto al modelo anterior) ── */
export interface ItemFragmentado {
  det_id:       number
  linea_codigo:  string
  ref_codigo:    string
  material_code: string
  color_code:    string
  color_nombre:  string
  gradas_fmt:    string
  imagen_url:    string
  cajas:         number
  pares:         number
  precio_base:   number
  precio_neto:   number
  subtotal:      number
  cajas_disponibles: number
}

export interface FacturaPrevisible {
  grupo_key:    string
  caso:         string
  caso_id:      number | null
  total_pares:  number
  total_monto:  number
  items:        ItemFragmentado[]
}

export interface MarcaFragmentada {
  marca:        string
  marca_id:     number | null
  total_pares:  number
  total_monto:  number
  cantidad_facturas: number
  facturas:     FacturaPrevisible[]
}

export interface LoteFragmentado {
  pp_id:          number
  pp_nro:         string
  proforma:       string         // Matrimonio con pp_nro
  quincena:       string
  descuentos_lote: number[]
  total_pares:    number
  total_monto:    number
  cantidad_facturas: number
  marcas:         MarcaFragmentada[]
}

export function fragmentarCarrito(
  carrito: Record<string, ItemCarrito>,
  descuentosCabecera: number[],
  descuentosPorLote: Record<number, number[]>,
  facturasConfig?: FacturaConfig[],
): LoteFragmentado[] {
  const byPP: Record<number, ItemCarrito[]> = {}
  for (const item of Object.values(carrito)) {
    if (!byPP[item.pp_id]) byPP[item.pp_id] = []
    byPP[item.pp_id].push(item)
  }

  return Object.entries(byPP).map(([ppIdStr, items]) => {
    const ppId = Number(ppIdStr)
    const descCabecera = normalizarDescuentos4(descuentosCabecera)

    const byMarca: Record<string, ItemCarrito[]> = {}
    for (const item of items) {
      const marca = (item.marca && String(item.marca).trim()) || 'Sin marca'
      if (!byMarca[marca]) byMarca[marca] = []
      byMarca[marca].push(item)
    }

    const marcas: MarcaFragmentada[] = Object.entries(byMarca).map(([marca, mItems]) => {
      // R-FI-1 + R-FI-2: 1 FI = 1 caso × 1 cadena (PROMO ≠ LIQUIDACIÓN ≠ REGULAR).
      const byCelula: Record<string, ItemCarrito[]> = {}
      for (const item of mItems) {
        const esPeItem =
          isProntaEntregaStockRow({
            det_id: item.det_id,
            origen_tipo: item.origen_tipo,
          }) || item.pp_id < 0
        const key = claveCelulaFiPeDictado(item, esPeItem)
        if (!byCelula[key]) byCelula[key] = []
        byCelula[key].push(item)
      }

      const facturas: FacturaPrevisible[] = Object.entries(byCelula).map(([, cItems]) => {
        const casoId =
          cItems.find((i) => i.caso_id != null && Number(i.caso_id) > 0)?.caso_id ?? null
        const caso = etiquetaCelulaFi({
          caso: cItems.find((i) => String(i.caso ?? '').trim())?.caso ?? '',
          caso_id: casoId,
          es_promo: cItems.find((i) => i.es_promo)?.es_promo ?? null,
          es_liquidacion: cItems.find((i) => i.es_liquidacion)?.es_liquidacion ?? null,
          cadena_comercial:
            cItems.find((i) => i.cadena_comercial)?.cadena_comercial ??
            cadenaComercialFi(cItems[0]!),
        })
        const dictadoPct =
          cItems.find((i) => i.descuento_comercial_pct != null && Number(i.descuento_comercial_pct) > 0)
            ?.descuento_comercial_pct ?? null
        const facturaConfig =
          findFacturaConfig(facturasConfig, ppId, marca, caso, casoId) ??
          (facturasConfig ?? []).find(
            (f) =>
              Number(f.pp_id) === ppId &&
              String(f.marca) === marca &&
              String(f.caso) === caso &&
              (dictadoPct == null ||
                Number((f as FacturaConfig & { dictado_comercial_pct?: number }).dictado_comercial_pct) ===
                  Number(dictadoPct)),
          )
        const descFactura = normalizarDescuentos4(facturaConfig?.descuentos ?? descCabecera)
        const listaFactura = facturaConfig?.lista_precio_id ?? 1

        const detalle: ItemFragmentado[] = cItems.map((item) => {
          const precioRow = {
            lpn: item.precio_lpn > 0 ? item.precio_lpn : null,
            lpc02: item.precio_lpc02 > 0 ? item.precio_lpc02 : null,
            lpc03: item.precio_lpc03 > 0 ? item.precio_lpc03 : null,
            lpc04: item.precio_lpc04 > 0 ? item.precio_lpc04 : null,
          }
          const esPeItem =
            isProntaEntregaStockRow({
              det_id: item.det_id,
              origen_tipo: item.origen_tipo,
            }) || item.pp_id < 0
          const fromLista = esPeItem
            ? getPrecioActivoPeLib(precioRow, listaFactura as ListaId, item.caso)
            : getPrecioActivoLib(precioRow, listaFactura as ListaId, item.caso)
          // Bruto solo desde lista/stock. Si no hay: snapshot BD puede ser bruto (al
          // agregar) o neto (post Guardar) — no reaplicar cascada al neto.
          const brutoLista =
            (fromLista != null && fromLista > 0 ? fromLista : 0) ||
            (item.precio_lpn > 0 ? item.precio_lpn : 0)
          const snapNeto = Number(item.precio_snapshot_neto) > 0 ? Number(item.precio_snapshot_neto) : 0
          const brutoMeta = item.precio_base > 0 ? item.precio_base : 0

          let precioBaseLista = 0
          let precioNeto = 0
          if (brutoLista > 0) {
            precioBaseLista = brutoLista
            precioNeto = calcularPrecioNeto(brutoLista, descFactura)
          } else if (snapNeto > 0 && brutoMeta > 0 && snapNeto + 0.5 < brutoMeta) {
            // Meta = lista; snapshot ya neto (post Guardar) — una sola aplicación
            precioBaseLista = brutoMeta
            precioNeto = snapNeto
          } else if (brutoMeta > 0) {
            // Catálogo / pre-guardar: precio_base es bruto
            precioBaseLista = brutoMeta
            precioNeto = calcularPrecioNeto(brutoMeta, descFactura)
          } else if (snapNeto > 0) {
            // Sin lista: confiar en snapshot sin re-descontar
            precioBaseLista = snapNeto
            precioNeto = snapNeto
          }

          const paresConfirmar = paresCarritoDesdeCajas(item.cajas, item)
          const subtotal = precioNeto * paresConfirmar

          return {
            det_id: item.det_id,
            linea_codigo: item.linea_codigo,
            ref_codigo: item.referencia_codigo,
            material_code: item.material_code,
            color_code: item.color_code,
            color_nombre: item.color_nombre,
            gradas_fmt: item.gradas_fmt,
            imagen_url: item.imagen_url,
            cajas: item.cajas,
            pares: paresConfirmar,
            precio_base: precioBaseLista,
            precio_neto: precioNeto,
            subtotal,
            cajas_disponibles: item.cajas_disponibles,
          }
        })
        const esPeGrupo =
          isProntaEntregaStockRow({
            det_id: cItems[0]!.det_id,
            origen_tipo: cItems[0]!.origen_tipo,
          }) || cItems[0]!.pp_id < 0
        return {
          grupo_key: `pp${ppId}__${marca}__${claveCelulaFiPeDictado(cItems[0]!, esPeGrupo)}`,
          caso,
          caso_id: casoId,
          total_pares: detalle.reduce((s, i) => s + i.pares, 0),
          total_monto: detalle.reduce((s, i) => s + i.subtotal, 0),
          items: detalle,
        }
      })

      return {
        marca,
        marca_id: mItems[0].marca_id ?? null,
        total_pares: facturas.reduce((s, f) => s + f.total_pares, 0),
        total_monto: facturas.reduce((s, f) => s + f.total_monto, 0),
        cantidad_facturas: facturas.length,
        facturas,
      }
    })

    const pp = items[0]
    return {
      pp_id: ppId,
      pp_nro: pp.pp_nro,
      proforma: pp.proforma,
      quincena: pp.quincena_desc ?? 'Sin quincena asignada',
      descuentos_lote: [],
      total_pares: marcas.reduce((s, m) => s + m.total_pares, 0),
      total_monto: marcas.reduce((s, m) => s + m.total_monto, 0),
      cantidad_facturas: marcas.reduce((s, m) => s + m.cantidad_facturas, 0),
      marcas,
    }
  })
}

/** Compat: algunos componentes importaban este key para listeners legacy. */
export const STORAGE_KEY_SESION = 'rimec_sesion_venta_v2'
