'use client'

export interface CartItem {
  det_id:        number
  pp_id:         number
  pp_nro:        string
  marca:         string
  linea_codigo:  string
  ref_codigo:    string
  nombre:        string
  color_nombre:  string
  cant_caja:     number
  cajas:         number
  pares:         number
  lpn:           number | null
  subtotal:      number
}

export type Cart = Record<string, CartItem>

export function cartKey(det_id: number) {
  return `det_${det_id}`
}

export function addBox(cart: Cart, item: Omit<CartItem, 'cajas' | 'pares' | 'subtotal'>, maxCajas: number): Cart {
  const key     = cartKey(item.det_id)
  const current = cart[key]?.cajas ?? 0
  const next    = Math.min(current + 1, maxCajas)
  return {
    ...cart,
    [key]: {
      ...item,
      cajas:    next,
      pares:    next * item.cant_caja,
      subtotal: next * item.cant_caja * (item.lpn ?? 0),
    },
  }
}

export function removeBox(cart: Cart, det_id: number): Cart {
  const key     = cartKey(det_id)
  const current = cart[key]?.cajas ?? 0
  if (current <= 1) {
    const next = { ...cart }
    delete next[key]
    return next
  }
  const item = cart[key]
  const cajas = current - 1
  return {
    ...cart,
    [key]: { ...item, cajas, pares: cajas * item.cant_caja, subtotal: cajas * item.cant_caja * (item.lpn ?? 0) },
  }
}

export function cartTotals(cart: Cart) {
  const items  = Object.values(cart)
  const cajas  = items.reduce((s, i) => s + i.cajas, 0)
  const pares  = items.reduce((s, i) => s + i.pares, 0)
  const monto  = items.reduce((s, i) => s + i.subtotal, 0)
  return { cajas, pares, monto, count: items.length }
}

export function groupByPP(cart: Cart): Record<string, CartItem[]> {
  const out: Record<string, CartItem[]> = {}
  for (const item of Object.values(cart)) {
    if (!out[item.pp_nro]) out[item.pp_nro] = []
    out[item.pp_nro].push(item)
  }
  return out
}
