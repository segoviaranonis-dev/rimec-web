/**
 * Hotfix PE/CP — asegura descuentos_lote.facturas alineado al carrito actual.
 * Sin esto el botón «Editar descuentos» desaparece (UI exige facturaConfig en sesión).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FacturaConfig } from '@/lib/carritoApi'
import { normalizarDescuentos4 } from '@/lib/carritoDescuentosFi'
import { fetchCarritoStockByDetIds } from '@/lib/carritoStockEnrich'
import {
  cadenaComercialFi,
  claveCelulaFi,
  etiquetaCelulaFi,
} from '@/lib/facturaCelulaClave'
import { sintetizarFacturaConfig } from '@/lib/facturaConfigMatch'
import { aplicarDescuentoDiccionarioPe, fetchPeDiccionarioMap } from '@/lib/peDiccionario'
import { resolverDescuentosFiPe } from '@/lib/resolverDescuentosFiPe'

type ItemRow = {
  det_id: number
  pp_id: number
  marca_snapshot: string
  marca_id_snapshot: number | null
  caso_snapshot: string
  caso_id_snapshot: number | null
}

type CellAcc = {
  pp_id: number
  marca: string
  marca_id: number | null
  caso_id: number | null
  caso_raw: string
  es_promo: boolean | null
  es_liquidacion: boolean | null
  cadena_comercial: string | null
  cod_grupo: string | null
  count: number
  /** Moda de descuento comercial dictado (PE) */
  descuento_comercial_pct: number | null
}

function matchPrev(
  prev: FacturaConfig[],
  cell: {
    pp_id: number
    marca: string
    caso: string
    caso_id: number | null
  },
): FacturaConfig | undefined {
  const exact = prev.find(
    (f) =>
      Number(f.pp_id) === cell.pp_id &&
      String(f.marca) === cell.marca &&
      ((cell.caso_id != null &&
        f.caso_id != null &&
        Number(f.caso_id) === Number(cell.caso_id)) ||
        String(f.caso) === cell.caso),
  )
  if (exact) return exact

  // PE: pp_id cambió de sintético/positivo a -pp_real — conservar descuentos por marca+caso.
  return prev.find(
    (f) =>
      String(f.marca) === cell.marca &&
      ((cell.caso_id != null &&
        f.caso_id != null &&
        Number(f.caso_id) === Number(cell.caso_id)) ||
        String(f.caso) === cell.caso) &&
      (Math.abs(Number(f.pp_id)) === Math.abs(cell.pp_id) || Number(f.pp_id) <= 0),
  )
}

function facturasIguales(a: FacturaConfig[], b: FacturaConfig[]): boolean {
  if (a.length !== b.length) return false
  const key = (f: FacturaConfig) =>
    `${f.pp_id}|${f.marca}|${f.caso_id ?? ''}|${f.caso}|${JSON.stringify(f.descuentos)}|${f.lista_precio_id}|${f.items_count}`
  const sa = [...a].map(key).sort()
  const sb = [...b].map(key).sort()
  return sa.every((k, i) => k === sb[i])
}

/**
 * Regenera facturas del lote desde ítems + stock; preserva descuentos/lista previos.
 * Persiste en carrito_sesion si cambió.
 */
export async function asegurarFacturasDescuentosLote(
  sb: SupabaseClient,
  idUsuario: number,
): Promise<{ facturas: FacturaConfig[]; updated: boolean }> {
  const [{ data: sesion }, { data: items }] = await Promise.all([
    sb
      .from('carrito_sesion')
      .select('descuentos_lote, lista_precio_id, descuentos')
      .eq('id_usuario', idUsuario)
      .maybeSingle(),
    sb
      .from('carrito_item')
      .select('det_id, pp_id, marca_snapshot, marca_id_snapshot, caso_snapshot, caso_id_snapshot')
      .eq('id_usuario', idUsuario),
  ])

  if (!sesion || !items?.length) {
    return {
      facturas:
        (sesion?.descuentos_lote as { facturas?: FacturaConfig[] } | null)?.facturas ?? [],
      updated: false,
    }
  }

  const prevLote = (sesion.descuentos_lote as { facturas?: FacturaConfig[] } | null) ?? {}
  const prev = Array.isArray(prevLote.facturas) ? prevLote.facturas : []
  const listaCab = Number(sesion.lista_precio_id) || 1
  const descCab = normalizarDescuentos4(sesion.descuentos)

  await fetchPeDiccionarioMap()

  const stockMap = await fetchCarritoStockByDetIds(
    sb,
    items.map((i) => Number(i.det_id)),
  )

  const cells = new Map<string, CellAcc>()

  for (const raw of items as ItemRow[]) {
    const stock = stockMap.get(Number(raw.det_id)) as Record<string, unknown> | undefined
    const casoId =
      raw.caso_id_snapshot != null && Number(raw.caso_id_snapshot) > 0
        ? Number(raw.caso_id_snapshot)
        : stock?.caso_id != null && Number(stock.caso_id) > 0
          ? Number(stock.caso_id)
          : null
    const casoRaw = String(raw.caso_snapshot || stock?.descp_caso || '').trim()
    const marca = String(raw.marca_snapshot || '').trim() || 'Sin marca'
    const celula = {
      caso: casoRaw,
      caso_id: casoId,
      es_promo: stock?.es_promo != null ? Boolean(stock.es_promo) : null,
      es_liquidacion: stock?.es_liquidacion != null ? Boolean(stock.es_liquidacion) : null,
      cadena_comercial: stock?.cadena_comercial != null ? String(stock.cadena_comercial) : null,
      cod_grupo: stock?.cod_grupo != null ? String(stock.cod_grupo) : null,
      linea_codigo: stock?.linea_codigo != null ? String(stock.linea_codigo) : null,
    }
    const key = `${Number(raw.pp_id)}|${marca}|${claveCelulaFi(celula)}`
    const pctDictado = (() => {
      const n = Number(stock?.descuento_comercial_pct)
      return Number.isFinite(n) && n > 0 ? n : null
    })()
    const existing = cells.get(key)
    if (existing) {
      existing.count += 1
      if (pctDictado != null && existing.descuento_comercial_pct == null) {
        existing.descuento_comercial_pct = pctDictado
      }
      continue
    }
    cells.set(key, {
      pp_id: Number(raw.pp_id),
      marca,
      marca_id: raw.marca_id_snapshot != null ? Number(raw.marca_id_snapshot) : null,
      caso_id: casoId,
      caso_raw: casoRaw,
      es_promo: celula.es_promo,
      es_liquidacion: celula.es_liquidacion,
      cadena_comercial: celula.cadena_comercial,
      cod_grupo: celula.cod_grupo,
      count: 1,
      descuento_comercial_pct: pctDictado,
    })
  }

  const facturasOut: FacturaConfig[] = []
  for (const cell of cells.values()) {
    const signals = {
      caso: cell.caso_raw,
      caso_id: cell.caso_id,
      es_promo: cell.es_promo,
      es_liquidacion: cell.es_liquidacion,
      cadena_comercial: cell.cadena_comercial,
      cod_grupo: cell.cod_grupo,
    }
    const caso = etiquetaCelulaFi(signals)
    const cadena = cadenaComercialFi(signals)
    const old = matchPrev(prev, {
      pp_id: cell.pp_id,
      marca: cell.marca,
      caso,
      caso_id: cell.caso_id,
    })
    const esPe = Number(cell.pp_id) < 0
    const descuentosBase = old?.descuentos ?? descCab
    let descuentos = aplicarDescuentoDiccionarioPe(normalizarDescuentos4(descuentosBase), {
      cadena_comercial: cadena,
      es_liquidacion: cell.es_liquidacion,
      es_promo: cell.es_promo,
      esPe,
    })
    if (esPe) {
      descuentos = resolverDescuentosFiPe({
        listaPrecioId: Number(old?.lista_precio_id) || listaCab,
        descuentosPrevios: descuentos,
        dictadoComercialPct: cell.descuento_comercial_pct,
        preAutorizado: Boolean(old?.pre_autorizado),
      })
    }
    const base = sintetizarFacturaConfig({
      pp_id: cell.pp_id,
      marca: cell.marca,
      marca_id: cell.marca_id,
      caso,
      caso_id: cell.caso_id,
      lista_precio_id: Number(old?.lista_precio_id) || listaCab,
      descuentos,
      items_count: cell.count,
      cadena_comercial: cadena,
    })
    facturasOut.push({
      ...base,
      pre_autorizado: Boolean(old?.pre_autorizado),
    })
  }

  if (facturasIguales(prev, facturasOut)) {
    return { facturas: prev, updated: false }
  }

  const { error } = await sb
    .from('carrito_sesion')
    .update({
      descuentos_lote: { ...prevLote, facturas: facturasOut },
      actualizada_en: new Date().toISOString(),
    })
    .eq('id_usuario', idUsuario)

  if (error) throw new Error(`asegurarFacturasDescuentosLote: ${error.message}`)

  return { facturas: facturasOut, updated: true }
}
