/**
 * Regenera descuentos_lote.facturas del carrito HECTOR según R-FI-2 (cadena Carlos).
 */
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { fetchCarritoStockByDetIds } from "../lib/carritoStockEnrich"
import { etiquetaCelulaFi, cadenaComercialFi } from "../lib/facturaCelulaClave"
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
  const { data: sesion, error: sErr } = await sb
    .from("carrito_sesion")
    .select("*")
    .eq("id_usuario", 1)
    .maybeSingle()
  if (sErr) throw sErr
  if (!sesion) throw new Error("sin sesión Héctor")

  const { data: items, error: iErr } = await sb.from("carrito_item").select("*").eq("id_usuario", 1)
  if (iErr) throw iErr
  if (!items?.length) throw new Error("carrito vacío")

  const stockMap = await fetchCarritoStockByDetIds(
    sb,
    items.map((i) => Number(i.det_id)),
  )
  const carrito: Record<string, ItemCarrito> = {}
  for (const row of items) {
    const stock = stockMap.get(Number(row.det_id)) as Record<string, unknown> | undefined
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
      cadena_comercial: (stock?.cadena_comercial as string) ?? null,
      cod_grupo: (stock?.cod_grupo as string) ?? null,
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
      origen_tipo: (stock?.origen_tipo as string) ?? null,
    }
    carrito[`det_${it.det_id}`] = it
  }

  const lotes = fragmentarCarrito(carrito, [0, 0, 0, 0], {})
  const facturas: Array<Record<string, unknown>> = []
  for (const lote of lotes) {
    for (const marca of lote.marcas) {
      for (const fi of marca.facturas) {
        const sample = fi.items[0] ? carrito[`det_${fi.items[0].det_id}`] : null
        const cadena = sample ? cadenaComercialFi(sample) : "REGULAR"
        facturas.push({
          caso: fi.caso,
          marca: marca.marca,
          pp_id: lote.pp_id,
          caso_id: fi.caso_id,
          marca_id: sample?.marca_id ?? null,
          descuentos: [],
          items_count: fi.items.length,
          pre_autorizado: true,
          lista_precio_id: Number(sesion.lista_precio_id) || 1,
          cadena_comercial: cadena,
        })
      }
    }
  }

  const prev = (sesion.descuentos_lote as { facturas?: unknown[] }) ?? {}
  const next = { ...prev, facturas }
  const { error: uErr } = await sb
    .from("carrito_sesion")
    .update({ descuentos_lote: next, actualizada_en: new Date().toISOString() })
    .eq("id_usuario", 1)
  if (uErr) throw uErr

  console.log(
    JSON.stringify(
      {
        items: items.length,
        facturas_antes: Array.isArray(prev.facturas) ? prev.facturas.length : 0,
        facturas_despues: facturas.length,
        detalle: facturas.map((f) => ({
          marca: f.marca,
          caso: f.caso,
          cadena: f.cadena_comercial,
          n: f.items_count,
        })),
      },
      null,
      2,
    ),
  )
  console.log("OK_HECTOR_DESCUENTOS_LOTE_RFI2")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
