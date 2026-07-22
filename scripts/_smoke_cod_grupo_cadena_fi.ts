/**
 * Smoke: COD.GRUPO Carlos (dígito 04) → LIQUIDACION sin flags PE.
 */
import assert from "assert"
import { cadenaComercialFi } from "../lib/facturaCelulaClave"
import { cadenaComercialDesdeCodGrupo } from "../lib/pilares/codGrupoCadena"
import { fragmentarCarrito, type ItemCarrito } from "../store/sesionVenta"

assert.equal(cadenaComercialDesdeCodGrupo("0201040000"), "LIQUIDACION")
assert.equal(cadenaComercialDesdeCodGrupo("0201020000"), "PROMOCIONAL")
assert.equal(cadenaComercialDesdeCodGrupo("0202010000"), "REGULAR")
assert.equal(cadenaComercialDesdeCodGrupo("1000000400"), "LIQUIDACION") // confecciones d67

assert.equal(
  cadenaComercialFi({ caso_id: 59, caso: "BR-VZ", cod_grupo: "0201040000" }),
  "LIQUIDACION",
)
assert.equal(
  cadenaComercialFi({ caso_id: 59, caso: "BR-VZ", cod_grupo: "0201020000" }),
  "PROMOCIONAL",
)

function item(p: Partial<ItemCarrito> & Pick<ItemCarrito, "det_id" | "cod_grupo">): ItemCarrito {
  return {
    linea_codigo: "X",
    referencia_codigo: "1",
    material_code: "1",
    color_code: "1",
    color_nombre: "N",
    pp_id: -1,
    pp_nro: "PE",
    proforma: "PE",
    quincena_desc: null,
    marca: "VIZZANO",
    marca_id: 2,
    caso: "BR-VZ-MD-ML-MKA-O",
    caso_id: 59,
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
    ...p,
  }
}

const carrito = {
  a: item({ det_id: 1, cod_grupo: "0201040000" }),
  b: item({ det_id: 2, cod_grupo: "0201020000" }),
  c: item({ det_id: 3, cod_grupo: "0202010000" }),
}
const fis = fragmentarCarrito(carrito, [0, 0, 0, 0], {}).flatMap((l) =>
  l.marcas.flatMap((m) => m.facturas),
)
assert.equal(fis.length, 3, `got ${fis.length}`)
console.log("PASS_COD_GRUPO_CADENA_FI", fis.map((f) => f.caso))
