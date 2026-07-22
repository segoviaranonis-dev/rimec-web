/**
 * Smoke R-FI-2 hydrate: señales PE en enrich → fragmentarCarrito separa promo/liq.
 * Simula carrito HECTOR (19 ítems) con flags de v_stock_pe_rimec.
 */
import assert from "assert"
import { fragmentarCarrito, type ItemCarrito } from "../store/sesionVenta"
import { cadenaComercialFi } from "../lib/facturaCelulaClave"

function item(
  partial: Partial<ItemCarrito> & Pick<ItemCarrito, "det_id" | "pp_id" | "caso" | "caso_id">,
): ItemCarrito {
  return {
    linea_codigo: "X",
    referencia_codigo: "1",
    material_code: "1",
    color_code: "1",
    color_nombre: "N",
    pp_nro: "PE",
    proforma: "PE",
    quincena_desc: null,
    marca: "VIZZANO",
    marca_id: 2,
    es_promo: null,
    es_liquidacion: null,
    cadena_comercial: null,
    nombre: "t",
    gradas_fmt: "",
    imagen_url: "",
    lista_precio_id: 1,
    precio_base: 1000,
    precio_lpn: 1000,
    precio_lpc02: 0,
    precio_lpc03: 0,
    precio_lpc04: 0,
    cant_caja: 8,
    cajas: 1,
    pares: 8,
    subtotal: 8000,
    cajas_disponibles: 10,
    ...partial,
  }
}

// Mismo caso_id=59 (BR-VZ) — antes colapsaban en 1 FI; deben ser 3 cadenas.
const carrito: Record<string, ItemCarrito> = {
  det_1: item({
    det_id: 1,
    pp_id: -640418586,
    caso: "BR-VZ-MD-ML-MKA-O",
    caso_id: 59,
    es_promo: true,
    cadena_comercial: "PROMOCIONAL",
  }),
  det_2: item({
    det_id: 2,
    pp_id: -640418586,
    caso: "BR-VZ-MD-ML-MKA-O",
    caso_id: 59,
    es_liquidacion: true,
    cadena_comercial: "LIQUIDACION",
  }),
  det_3: item({
    det_id: 3,
    pp_id: -640418586,
    caso: "BR-VZ-MD-ML-MKA-O",
    caso_id: 59,
    es_promo: false,
    es_liquidacion: false,
    cadena_comercial: "REGULAR",
  }),
}

assert.equal(cadenaComercialFi(carrito.det_1!), "PROMOCIONAL")
assert.equal(cadenaComercialFi(carrito.det_2!), "LIQUIDACION")
assert.equal(cadenaComercialFi(carrito.det_3!), "REGULAR")

const lotes = fragmentarCarrito(carrito, [0, 0, 0, 0], {})
const fis = lotes.flatMap((l) => l.marcas.flatMap((m) => m.facturas))
assert.equal(fis.length, 3, `esperaba 3 FI, got ${fis.length}: ${fis.map((f) => f.caso).join(" | ")}`)

const cadenas = new Set(
  [carrito.det_1!, carrito.det_2!, carrito.det_3!].map((i) => cadenaComercialFi(i)),
)
assert.equal(cadenas.size, 3)

console.log("PASS_R_FI2_HYDRATE_FRAGMENT", {
  facturas: fis.map((f) => ({ caso: f.caso, items: f.items.length, pares: f.total_pares })),
})
