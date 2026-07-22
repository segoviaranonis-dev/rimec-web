/**
 * Smoke R-FI-1: no mezclar caso_id distintos aunque el nombre esté vacío.
 * node --experimental-strip-types rimec-web/scripts/_smoke_fi_caso_split.mjs
 * o: npx tsx rimec-web/scripts/_smoke_fi_caso_split.ts
 */
import { claveCasoFi, etiquetaCasoFi, mismoCasoFi } from "../lib/facturaCasoClave"
import { fragmentarCarrito, type ItemCarrito } from "../store/sesionVenta"

function assert(c: unknown, m: string) {
  if (!c) throw new Error(`FAIL: ${m}`)
}

assert(claveCasoFi({ caso: "", caso_id: 10 }) === "id:10", "clave por id")
assert(claveCasoFi({ caso: "", caso_id: 20 }) === "id:20", "clave id distinto")
assert(!mismoCasoFi({ caso: "", caso_id: 10 }, { caso: "", caso_id: 20 }), "no mezclar ids")
assert(claveCasoFi({ caso: "", caso_id: null }) === "sin_caso", "sin id → sin_caso")
assert(etiquetaCasoFi({ caso: "", caso_id: 99 }) === "Caso #99", "etiqueta id")

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
  c: base({ det_id: 3, caso: "PROMO X", caso_id: 303 }),
}

const lotes = fragmentarCarrito(carrito, [0, 0, 0, 0], {})
assert(lotes.length === 1, "1 lote")
assert(lotes[0]!.marcas.length === 1, "1 marca")
assert(lotes[0]!.marcas[0]!.facturas.length === 3, `3 FI (got ${lotes[0]!.marcas[0]!.facturas.length})`)

const ids = new Set(lotes[0]!.marcas[0]!.facturas.map((f) => f.caso_id))
assert(ids.has(101) && ids.has(202) && ids.has(303), "caso_ids separados")

const colapsoViejo = fragmentarCarrito(
  {
    x: base({ det_id: 10, caso: "", caso_id: null }),
    y: base({ det_id: 11, caso: "", caso_id: null }),
  },
  [0, 0, 0, 0],
  {},
)
assert(colapsoViejo[0]!.marcas[0]!.facturas.length === 1, "dos sin caso → 1 FI ok")

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
