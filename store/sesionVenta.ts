'use client'

import { create } from 'zustand'
import { formatearQuincena } from '@/lib/fecha'
import {
  carritoDeleteItem,
  carritoDeleteSesion,
  carritoGet,
  carritoPatchFactura,
  carritoPatchItem,
  carritoPutSesion,
  carritoRecalcularFactura,
  carritoUpsertItem,
  carritoVaciarItems,
  type CarritoItemBD,
  type CarritoSesionBD,
  type FacturaConfig,
} from '@/lib/carritoApi'

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
  id_plazo:    number
  descp_plazo: string
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
  eta:             string | null
  marca:           string
  marca_id:        number | null
  caso:            string
  caso_id:         number | null
  nombre:          string
  gradas_fmt:      string
  imagen_url:      string
  lista_precio_id: ListaId
  precio_base:     number
  // Precios directos de v_stock_rimec (MIG-083 fix)
  precio_lpn:      number
  precio_lpc02:    number
  precio_lpc03:    number
  precio_lpc04:    number
  cant_caja:       number
  cajas:           number
  pares:           number
  subtotal:        number
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
      precio_actual: number | null
    }>
  }

  // Acciones (todas async — golpean /api/carrito/*).
  activar:          (cliente: Cliente, vendedor: Vendedor, plazo: Plazo, listaId: ListaId, descuentos: number[]) => Promise<void>
  desactivar:       () => Promise<void>
  setLista:         (id: ListaId) => Promise<void>
  setDescuentos:    (desc: number[]) => Promise<void>
  setDescuentoLote: (ppId: number, desc: number[]) => Promise<void>
  actualizarDescuentosFactura: (pp_id: number, marca: string, caso: string, config: { lista_precio_id?: number; descuentos?: number[]; pre_autorizado?: boolean }) => Promise<void>
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

export function getPrecioActivo(
  row: {
    lpn: number | null;
    lpc02: number | null;
    lpc03: number | null;
    lpc04: number | null;
    precio_web?: number | null;
  },
  listaId: ListaId,
): number | null {
  switch (Number(listaId)) {
    case 1: return row.precio_web ?? row.lpn ?? null
    case 2: return row.lpc02 ?? null
    case 3: return row.lpc03 ?? null
    case 4: return row.lpc04 ?? null
    default: return null
  }
}

export function calcularPrecioNeto(precioBase: number, descuentos: number[]): number {
  let precio = precioBase
  for (const d of descuentos) precio = precio * (1 - d / 100)
  return Math.floor(precio / 100) * 100
}

function paresCalc(item: ItemCarritoMeta, cajas: number): number {
  return cajas * item.cant_caja
}

function itemFromBD(meta: Map<number, ItemCarritoMeta>, row: CarritoItemBD, listaId: ListaId): ItemCarrito | null {
  const base = meta.get(row.det_id)
  // Extraer precios del JOIN con v_stock_rimec (MIG-083 fix)
  const stockRow = row.v_stock_rimec?.[0]
  const precio_lpn = stockRow?.lpn ?? 0
  const precio_lpc02 = stockRow?.lpc02 ?? 0
  const precio_lpc03 = stockRow?.lpc03 ?? 0
  const precio_lpc04 = stockRow?.lpc04 ?? 0

  if (!base) {
    // Sin metadatos (catálogo) usamos lo que tenemos en BD.
    return {
      det_id: row.det_id,
      linea_codigo: '',
      referencia_codigo: '',
      material_code: '',
      color_code: '',
      color_nombre: '',
      pp_id: row.pp_id,
      pp_nro: '',
      eta: null,
      marca: row.marca_snapshot,
      marca_id: row.marca_id_snapshot,
      caso: row.caso_snapshot,
      caso_id: row.caso_id_snapshot,
      nombre: '',
      gradas_fmt: '',
      imagen_url: '',
      lista_precio_id: listaId,
      precio_base: row.precio_snapshot,
      precio_lpn,
      precio_lpc02,
      precio_lpc03,
      precio_lpc04,
      cant_caja: 0,
      cajas: row.cantidad_cajas,
      pares: 0,
      subtotal: row.precio_snapshot * 0,
    }
  }
  const pares = paresCalc(base, row.cantidad_cajas)
  return {
    ...base,
    lista_precio_id: listaId,
    precio_base: row.precio_snapshot,
    precio_lpn,
    precio_lpc02,
    precio_lpc03,
    precio_lpc04,
    cajas: row.cantidad_cajas,
    pares,
    subtotal: row.precio_snapshot * pares,
  }
}

/**
 * Cache local de metadatos de cada item (línea, color, imagen, gradas, etc.).
 * Se llena cuando el usuario agrega desde el catálogo, así podemos repoblar
 * el shape `ItemCarrito` aunque la BD solo guarde precio + snapshot mínimo.
 */
const META_CACHE: Map<number, ItemCarritoMeta> = new Map()

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
  validacion: {
    estado: 'IDLE',
    token: null,
    expiraEn: null,
    items: [],
  },

  setVendedor: (v) => set({ vendedor: v }),
  setValidacion: (val) => set({ validacion: val }),
  limpiarValidacion: () =>
    set({ validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } }),

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
        ? { id_plazo: sesion.plazo_id, descp_plazo: sesion.plazo_nombre ?? '' }
        : null,
      listaPrecioId: listaId,
      descuentos: sesion?.descuentos ?? [],
      descuentosPorLote: (sesion?.descuentos_lote as Record<number, number[]> | undefined) ?? {},
      facturas,
      todasPreAutorizadas,
      carrito,
      activa: Boolean(sesion),
      activatedAt: sesion?.iniciada_en ?? null,
      vendedor: s.vendedor,
      hydrated: true,
      hydrating: false,
      validacion:
        sesion?.validacion_estado === 'OK' && sesion?.validacion_token
          ? {
              estado: 'OK',
              token: sesion.validacion_token,
              expiraEn: sesion.validada_en
                ? new Date(new Date(sesion.validada_en).getTime() + 60_000).toISOString()
                : null,
              items: [],
            }
          : { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    }))
  },

  cargarDesdeBD: async () => {
    if (typeof window === 'undefined') return
    set({ hydrating: true })
    try {
      const data = await carritoGet()
      get().aplicarSnapshot(data.sesion, data.items)
    } catch (err) {
      console.warn('[sesionVenta] cargarDesdeBD falló:', err)
      set({ hydrating: false, hydrated: true })
    }
  },

  activar: async (cliente, vendedor, plazo, listaId, descuentos) => {
    await carritoPutSesion({
      cliente_id: cliente.id_cliente,
      cliente_nombre: cliente.descp_cliente,
      plazo_id: plazo.id_plazo,
      plazo_nombre: plazo.descp_plazo,
      lista_precio_id: listaId,
      descuentos: descuentos.slice(0, 4),
      descuentos_lote: {},
    })
    set({
      cliente,
      vendedor,
      plazo,
      listaPrecioId: listaId,
      descuentos: descuentos.slice(0, 4),
      descuentosPorLote: {},
      activa: true,
      activatedAt: new Date().toISOString(),
      carrito: {},
      validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    })
  },

  desactivar: async () => {
    try { await carritoDeleteSesion() } catch (e) { console.warn('[sesionVenta] desactivar:', e) }
    set({
      cliente: null, plazo: null,
      activa: false, activatedAt: null,
      carrito: {}, descuentos: [], descuentosPorLote: {},
      facturas: [], todasPreAutorizadas: true,
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
      })
    } catch (err) {
      console.error('[sesionVenta.agregarCaja]', err)
      throw err
    }
    const pares = paresCalc(item, cajas)
    set((st) => ({
      carrito: { ...st.carrito, [key]: { ...item, cajas, pares, subtotal: item.precio_base * pares } },
      validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    }))
  },

  quitarCaja: async (det_id) => {
    const key = `det_${det_id}`
    const s = get()
    const actual = s.carrito[key]
    if (!actual) return
    const cajas = actual.cajas - 1
    if (cajas <= 0) {
      await carritoPatchItem(det_id, 0)
      const next = { ...s.carrito }
      delete next[key]
      set({ carrito: next, validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } })
      return
    }
    await carritoPatchItem(det_id, cajas)
    const pares = actual.cant_caja * cajas
    set((st) => ({
      carrito: { ...st.carrito, [key]: { ...actual, cajas, pares, subtotal: actual.precio_base * pares } },
      validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    }))
  },

  setCajas: async (det_id, cajas) => {
    const key = `det_${det_id}`
    const s = get()
    const actual = s.carrito[key]
    if (!actual) return
    const safe = Math.max(0, Math.floor(Number.isFinite(cajas) ? cajas : 0))
    if (safe === 0) {
      await carritoPatchItem(det_id, 0)
      const next = { ...s.carrito }
      delete next[key]
      set({ carrito: next, validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] } })
      return
    }
    await carritoPatchItem(det_id, safe)
    const pares = actual.cant_caja * safe
    set((st) => ({
      carrito: { ...st.carrito, [key]: { ...actual, cajas: safe, pares, subtotal: actual.precio_base * pares } },
      validacion: { estado: 'IDLE', token: null, expiraEn: null, items: [] },
    }))
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
  color_nombre:  string
  gradas_fmt:    string
  imagen_url:    string
  cajas:         number
  pares:         number
  precio_base:   number
  precio_neto:   number
  subtotal:      number
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
  quincena:       string
  eta:            string | null
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
    const descLote = descuentosPorLote[ppId] ?? []
    const descTotal = [...descuentosCabecera, ...descLote]

    const byMarca: Record<string, ItemCarrito[]> = {}
    for (const item of items) {
      const marca = (item.marca && String(item.marca).trim()) || 'Sin marca'
      if (!byMarca[marca]) byMarca[marca] = []
      byMarca[marca].push(item)
    }

    const marcas: MarcaFragmentada[] = Object.entries(byMarca).map(([marca, mItems]) => {
      const byCaso: Record<string, ItemCarrito[]> = {}
      for (const item of mItems) {
        const caso = (item.caso && String(item.caso).trim()) || 'Sin caso'
        if (!byCaso[caso]) byCaso[caso] = []
        byCaso[caso].push(item)
      }

      const facturas: FacturaPrevisible[] = Object.entries(byCaso).map(([caso, cItems]) => {
        // Buscar configuración de esta factura específica (MIG-083)
        const facturaConfig = facturasConfig?.find(
          f => f.pp_id === ppId && f.marca === marca && f.caso === caso
        )
        const descFactura = facturaConfig?.descuentos ?? descTotal
        const listaFactura = facturaConfig?.lista_precio_id ?? 1

        const detalle: ItemFragmentado[] = cItems.map((item) => {
          // MIG-083 fix: precio base viene DIRECTO de v_stock_rimec según lista de factura
          const precioBaseLista =
            listaFactura === 1 ? item.precio_lpn :
            listaFactura === 2 ? item.precio_lpc02 :
            listaFactura === 3 ? item.precio_lpc03 :
            listaFactura === 4 ? item.precio_lpc04 :
            item.precio_lpn

          const precioNeto = calcularPrecioNeto(precioBaseLista, descFactura)
          const subtotal = precioNeto * item.pares

          return {
            det_id: item.det_id,
            linea_codigo: item.linea_codigo,
            ref_codigo: item.referencia_codigo,
            color_nombre: item.color_nombre,
            gradas_fmt: item.gradas_fmt,
            imagen_url: item.imagen_url,
            cajas: item.cajas,
            pares: item.pares,
            precio_base: precioBaseLista,
            precio_neto: precioNeto,
            subtotal,
          }
        })
        return {
          grupo_key: `pp${ppId}__${marca}__${caso}`,
          caso,
          caso_id: cItems[0].caso_id ?? null,
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
      quincena: formatearQuincena(pp.eta),
      eta: pp.eta,
      descuentos_lote: descLote,
      total_pares: marcas.reduce((s, m) => s + m.total_pares, 0),
      total_monto: marcas.reduce((s, m) => s + m.total_monto, 0),
      cantidad_facturas: marcas.reduce((s, m) => s + m.cantidad_facturas, 0),
      marcas,
    }
  })
}

/** Compat: algunos componentes importaban este key para listeners legacy. */
export const STORAGE_KEY_SESION = 'rimec_sesion_venta_v2'
