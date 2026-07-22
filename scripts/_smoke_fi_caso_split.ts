/**
 * Smoke R-FI-1 + R-FI-2: caso_id distintos Y promo≠liquidación.
 * npx tsx rimec-web/scripts/_smoke_fi_caso_split.ts
 */
import { claveCasoFi, etiquetaCasoFi, mismoCasoFi } from "../lib/facturaCasoClave"
import {
  cadenaComercialFi,
  claveCelulaFi,
  violacionSegregacionCadenas,
} from "../lib/facturaCelulaClave"
import { fragmentarCarrito, type ItemCarrito } from "../store/sesionVenta"

function assert(c: unknown, m: string) {
  if (!c) throw new Error(`FAIL: ${m}`)
}

assert(claveCasoFi({ caso: "", caso_id: 10 }) === "id:10", "clave por id")
assert(!mismoCasoFi({ caso: "", caso_id: 10 }, { caso: "", caso_id: 20 }), "no mezclar ids")
assert(etiquetaCasoFi({ caso: "", caso_id: 99 }) === "Caso #99", "etiqueta id")

assert(cadenaComercialFi({ es_liquidacion: true }) === "LIQUIDACION", "liq")
assert(cadenaComercialFi({ es_promo: true }) === "PROMOCIONAL", "promo")
assert(cadenaComercialFi({ caso: "PROMOCIONAL" }) === "PROMOCIONAL", "promo por caso")
assert(cadenaComercialFi({ caso: "NORMAL-X" }) === "REGULAR", "regular")
assert(
  claveCelulaFi({ caso_id: 1, es_promo: true }) !==
    claveCelulaFi({ caso_id: 1, es_liquidacion: true }),
  "mismo caso_id promo≠liq",
)
assert(violacionSegregacionCadenas(["PROMOCIONAL", "LIQUIDACION"]), "violacion promo+liq")
assert(!violacionSegregacionCadenas(["PROMOCIONAL"]), "una sola ok")

function base(partial: Partial<ItemCarrito>): ItemCarrito {
  return {
    det_id: 1,
    linea_codigo: "L",
    referencia_codigo: "R",
    material_code: "M",
    color_code: "C",
    color_nombre: "c",
    pp_id: 1,
    pp_nro: "PP-1",
    proforma: "PF",
    quincena_desc: null,
    marca: "KYLY",
    marca_id: 10,
    caso: "",
    caso_id: null,
    es_promo: false,
    es_liquidacion: false,
    cadena_comercial: null,
    nombre: "x",
    gradas_fmt: "",
    imagen_url: "",
    lista_precio_id: 1,
    precio_base: 100,
    precio_lpn: 100,
    precio_lpc02: 0,
    precio_lpc03: 0,
    precio_lpc04: 0,
    cant_caja: 12,
    cajas: 1,
    pares: 12,
    subtotal: 1200,
    cajas_disponibles: 10,
    ...partial,
  }
}

const carrito: Record<string, ItemCarrito> = {
  a: base({ det_id: 1, caso: "", caso_id: 101 }),
  b: base({ det_id: 2, caso: "", caso_id: 202 }),
  c: base({ det_id: 3, caso: "PROMO X", caso_id: 303, es_promo: true }),
  d: base({
    det_id: 4,
    caso: "LIQ X",
    caso_id: 303,
    es_liquidacion: true,
    es_promo: false,
  }),
}

const lotes = fragmentarCarrito(carrito, [0, 0, 0, 0], {})
assert(lotes[0]!.marcas[0]!.facturas.length === 4, `4 FI (got ${lotes[0]!.marcas[0]!.facturas.length})`)

const mismoCasoPromoLiq = fragmentarCarrito(
  {
    p: base({ det_id: 10, caso_id: 999, es_promo: true, caso: "X" }),
    l: base({ det_id: 11, caso_id: 999, es_liquidacion: true, caso: "X" }),
  },
  [0, 0, 0, 0],
  {},
)
assert(
  mismoCasoPromoLiq[0]!.marcas[0]!.facturas.length === 2,
  "mismo caso_id promo+liq → 2 FI",
)

console.log("PASS_FI_CASO_SPLIT")
console.log(
  JSON.stringify(
    {
      facturas: lotes[0]!.marcas[0]!.facturas.map((f) => ({
        caso: f.caso,
        caso_id: f.caso_id,
        items: f.items.length,
      })),
    },
    null,
    2,
  ),
)
