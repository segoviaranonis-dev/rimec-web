'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { formatearQuincena } from '@/lib/fecha'

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
  nombre:          string
  gradas_fmt:      string
  imagen_url:      string
  lista_precio_id: ListaId
  precio_base:     number
  cant_caja:       number
  cajas:           number
  pares:           number
  subtotal:        number
}

export interface SesionVenta {
  cliente:           Cliente | null
  vendedor:          Vendedor | null
  plazo:             Plazo | null
  listaPrecioId:     ListaId
  descuentos:        number[]           // hasta 4 descuentos cabecera
  descuentosPorLote: Record<number, number[]>  // pp_id → descuentos específicos
  carrito:           Record<string, ItemCarrito>
  activa:            boolean

  // Acciones
  activar:          (cliente: Cliente, vendedor: Vendedor, plazo: Plazo, listaId: ListaId, descuentos: number[]) => void
  desactivar:       () => void
  setLista:         (id: ListaId) => void
  setDescuentos:    (desc: number[]) => void
  setDescuentoLote: (ppId: number, desc: number[]) => void
  agregarCaja:      (item: Omit<ItemCarrito, 'cajas' | 'pares' | 'subtotal'>) => void
  quitarCaja:       (det_id: number) => void
  vaciarCarrito:    () => void
}

/* ── Helpers ── */
export function getPrecioActivo(
  row: { lpn: number | null; lpc02: number | null; lpc03: number | null; lpc04: number | null },
  listaId: ListaId,
): number | null {
  switch (listaId) {
    case 1: return row.lpn   ?? null
    case 2: return row.lpc02 ?? null
    case 3: return row.lpc03 ?? null
    case 4: return row.lpc04 ?? null
  }
}

export function calcularPrecioNeto(precioBase: number, descuentos: number[]): number {
  let precio = precioBase
  for (const d of descuentos) precio = precio * (1 - d / 100)
  return Math.floor(precio / 100) * 100
}

function recalcularItem(item: ItemCarrito, listaId: ListaId): ItemCarrito {
  return { ...item, lista_precio_id: listaId, subtotal: item.precio_base * item.pares }
}

/* ── Store (persiste en localStorage) ── */
export const useSesion = create<SesionVenta>()(persist((set, get) => ({
  cliente:           null,
  vendedor:          null,
  plazo:             null,
  listaPrecioId:     1,
  descuentos:        [],
  descuentosPorLote: {},
  carrito:           {},
  activa:            false,

  activar: (cliente, vendedor, plazo, listaId, descuentos) =>
    set({ cliente, vendedor, plazo, listaPrecioId: listaId, descuentos: descuentos.slice(0, 4), activa: true }),

  desactivar: () =>
    set({ cliente: null, vendedor: null, plazo: null, activa: false, carrito: {}, descuentos: [], descuentosPorLote: {} }),

  setLista: (id) => {
    const carrito = get().carrito
    const updated: Record<string, ItemCarrito> = {}
    for (const [k, item] of Object.entries(carrito)) {
      updated[k] = recalcularItem(item, id)
    }
    set({ listaPrecioId: id, carrito: updated })
  },

  setDescuentos: (desc) => set({ descuentos: desc.slice(0, 4) }),

  setDescuentoLote: (ppId, desc) =>
    set(s => ({ descuentosPorLote: { ...s.descuentosPorLote, [ppId]: desc } })),

  agregarCaja: (item) => {
    const key     = `det_${item.det_id}`
    const carrito = get().carrito
    const actual  = carrito[key]?.cajas ?? 0
    const cajas   = actual + 1
    const pares   = cajas * item.cant_caja
    set(s => ({
      carrito: {
        ...s.carrito,
        [key]: { ...item, cajas, pares, subtotal: item.precio_base * pares },
      },
    }))
  },

  quitarCaja: (det_id) => {
    const key     = `det_${det_id}`
    const carrito = get().carrito
    const actual  = carrito[key]?.cajas ?? 0
    if (actual <= 1) {
      const next = { ...carrito }
      delete next[key]
      set({ carrito: next })
    } else {
      const item  = carrito[key]
      const cajas = actual - 1
      const pares = cajas * item.cant_caja
      set(s => ({ carrito: { ...s.carrito, [key]: { ...item, cajas, pares, subtotal: item.precio_base * pares } } }))
    }
  },

  vaciarCarrito: () => set({ carrito: {} }),
}), {
  name: 'rimec_sesion_venta',
  partialize: (s) => ({
    cliente:           s.cliente,
    vendedor:          s.vendedor,
    plazo:             s.plazo,
    listaPrecioId:     s.listaPrecioId,
    descuentos:        s.descuentos,
    descuentosPorLote: s.descuentosPorLote,
    carrito:           s.carrito,
    activa:            s.activa,
  }),
}))

/* ── Fragmentación ── */
export interface LoteFragmentado {
  pp_id:          number
  pp_nro:         string
  quincena:       string
  eta:            string | null
  descuentos_lote: number[]
  total_pares:    number
  total_monto:    number
  marcas: {
    marca:        string
    total_pares:  number
    total_monto:  number
    items: {
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
    }[]
  }[]
}

export function fragmentarCarrito(
  carrito:            Record<string, ItemCarrito>,
  descuentosCabecera: number[],
  descuentosPorLote:  Record<number, number[]>,
): LoteFragmentado[] {
  const byPP: Record<number, ItemCarrito[]> = {}
  for (const item of Object.values(carrito)) {
    if (!byPP[item.pp_id]) byPP[item.pp_id] = []
    byPP[item.pp_id].push(item)
  }

  return Object.entries(byPP).map(([ppIdStr, items]) => {
    const ppId     = Number(ppIdStr)
    const descLote = descuentosPorLote[ppId] ?? []
    const descTotal = [...descuentosCabecera, ...descLote]

    const byMarca: Record<string, ItemCarrito[]> = {}
    for (const item of items) {
      if (!byMarca[item.marca]) byMarca[item.marca] = []
      byMarca[item.marca].push(item)
    }

    const marcas = Object.entries(byMarca).map(([marca, mItems]) => {
      const detalle = mItems.map(item => {
        const precioNeto = calcularPrecioNeto(item.precio_base, descTotal)
        const subtotal   = precioNeto * item.pares
        return {
          det_id:       item.det_id,
          linea_codigo:  item.linea_codigo,
          ref_codigo:    item.referencia_codigo,
          color_nombre:  item.color_nombre,
          gradas_fmt:    item.gradas_fmt,
          imagen_url:    item.imagen_url,
          cajas:         item.cajas,
          pares:         item.pares,
          precio_base:   item.precio_base,
          precio_neto:   precioNeto,
          subtotal,
        }
      })
      return {
        marca,
        total_pares: detalle.reduce((s, i) => s + i.pares, 0),
        total_monto: detalle.reduce((s, i) => s + i.subtotal, 0),
        items: detalle,
      }
    })

    const pp = items[0]
    return {
      pp_id:           ppId,
      pp_nro:          pp.pp_nro,
      quincena:        formatearQuincena(pp.eta),
      eta:             pp.eta,
      descuentos_lote: descLote,
      total_pares:     marcas.reduce((s, m) => s + m.total_pares, 0),
      total_monto:     marcas.reduce((s, m) => s + m.total_monto, 0),
      marcas,
    }
  })
}
