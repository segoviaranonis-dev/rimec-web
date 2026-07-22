/**
 * Verifica que el SELECT PE del enrich trae señales y que Héctor fragmentaría OK.
 */
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { fetchCarritoStockByDetIds } from "../lib/carritoStockEnrich"
import { cadenaComercialFi, violacionSegregacionCadenas } from "../lib/facturaCelulaClave"
import { fragmentarCarrito, type ItemCarrito } from "../store/sesionVenta"

const envText = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8")
function env(k: string): string {
  const m = envText.match(new RegExp(`^${k}=(.+)$`, "m"))
  if (!m) throw new Error(`falta ${k}`)
  return m[1].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: items, error } = await sb.from("carrito_item").select("*").eq("id_usuario", 1)
  if (error) throw error
  if (!items?.length) {
    console.log("SKIP_NO_CART")
    return
  }

  const stockMap = await fetchCarritoStockByDetIds(
    sb,
    items.map((i) => Number(i.det_id)),
  )

  const carrito: Record<string, ItemCarrito> = {}
  const cadenas: Array<"LIQUIDACION" | "PROMOCIONAL" | "REGULAR"> = []

  for (const row of items) {
    const stock = stockMap.get(Number(row.det_id)) as
      | {
          es_promo?: boolean
          es_liquidacion?: boolean
          cadena_comercial?: string
          linea_codigo?: string
          referencia_codigo?: string
          material_code?: string
          color_code?: string
          descp_color?: string
          pp_nro?: string
          proforma?: string
          nombre?: string
          origen_tipo?: string
          lpn?: number
        }
      | undefined
    const it: ItemCarrito = {
      det_id: Number(row.det_id),
      linea_codigo: String(stock?.linea_codigo ?? ""),
      referencia_codigo: String(stock?.referencia_codigo ?? ""),
      material_code: String(stock?.material_code ?? ""),
      color_code: String(stock?.color_code ?? ""),
      color_nombre: String(stock?.descp_color ?? ""),
      pp_id: Number(row.pp_id),
      pp_nro: String(stock?.pp_nro ?? ""),
      proforma: String(stock?.proforma ?? ""),
      quincena_desc: null,
      marca: String(row.marca_snapshot ?? "Sin marca"),
      marca_id: row.marca_id_snapshot != null ? Number(row.marca_id_snapshot) : null,
      caso: String(row.caso_snapshot ?? ""),
      caso_id: row.caso_id_snapshot != null ? Number(row.caso_id_snapshot) : null,
      es_promo: stock?.es_promo != null ? Boolean(stock.es_promo) : null,
      es_liquidacion: stock?.es_liquidacion != null ? Boolean(stock.es_liquidacion) : null,
      cadena_comercial: stock?.cadena_comercial ?? null,
      nombre: String(stock?.nombre ?? ""),
      gradas_fmt: "",
      imagen_url: "",
      lista_precio_id: 1,
      precio_base: Number(row.precio_snapshot) || 0,
      precio_lpn: Number(stock?.lpn) || Number(row.precio_snapshot) || 0,
      precio_lpc02: 0,
      precio_lpc03: 0,
      precio_lpc04: 0,
      cant_caja: 8,
      cajas: Number(row.cantidad_cajas) || 1,
      pares: 8,
      subtotal: 0,
      cajas_disponibles: 0,
      origen_tipo: stock?.origen_tipo ?? null,
    }
    carrito[`det_${it.det_id}`] = it
    cadenas.push(cadenaComercialFi(it))
  }

  const cont: Record<string, number> = {}
  for (const c of cadenas) cont[c] = (cont[c] ?? 0) + 1

  const lotes = fragmentarCarrito(carrito, [0, 0, 0, 0], {})
  const fis = lotes.flatMap((l) => l.marcas.flatMap((m) => m.facturas))

  // Ninguna FI individual debe mezclar cadenas
  let ok = true
  for (const f of fis) {
    const cads = f.items.map((i) => {
      const src = carrito[`det_${i.det_id}`]!
      return cadenaComercialFi(src)
    })
    if (violacionSegregacionCadenas(cads)) {
      ok = false
      console.error("FI_MIX", f.caso, cads)
    }
  }

  console.log(
    JSON.stringify(
      {
        items: items.length,
        cadenas: cont,
        facturas: fis.length,
        por_fi: fis.map((f) => ({
          caso: f.caso,
          n: f.items.length,
          cadenas: [...new Set(f.items.map((i) => cadenaComercialFi(carrito[`det_${i.det_id}`]!)))],
        })),
        ok,
      },
      null,
      2,
    ),
  )
  if (!ok) process.exit(1)
  if (cont.PROMOCIONAL && cont.LIQUIDACION && fis.length < 2) {
    console.error("FAIL: tenía promo+liq pero no fragmentó")
    process.exit(1)
  }
  console.log("PASS_HECTOR_CART_FRAGMENT")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
