/**
 * Audit CP: LPN vs LPC03 no pueden ser iguales (Normal) cuando hay LPN.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import {
  getPrecioActivo,
  lpcDesdeLpn,
  esCasoPromocional,
} from '../lib/precioLista'
import { precioDeLoteCatalogo } from '../lib/precioLoteCatalogo'
import type { TarjetaCatalogo } from '../lib/agruparTarjetasCatalogo'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await sb
    .from('v_stock_rimec')
    .select(
      'linea_codigo,referencia_codigo,material_code,color_code,lpn,lpc02,lpc03,lpc04,descp_caso,descp_marca,cajas_disponibles,origen_tipo',
    )
    .gt('cajas_disponibles', 0)
    .gt('lpn', 0)
    .limit(80)
  if (error) throw error

  let ok = 0
  let promoOk = 0
  let fail = 0
  const samples: string[] = []

  for (const r of data ?? []) {
    const row = {
      lpn: r.lpn,
      lpc02: r.lpc02,
      lpc03: r.lpc03,
      lpc04: r.lpc04,
      descp_caso: r.descp_caso,
    }
    const lpn = getPrecioActivo(row, 1, r.descp_caso)
    const lpc03 = getPrecioActivo(row, 3, r.descp_caso)
    const fallback112 = lpn != null ? lpcDesdeLpn(lpn, 1.12) : null
    const promo = esCasoPromocional(r.descp_caso)

    const lote = {
      origen_tipo: 'TRÁNSITO_PP',
      descp_caso: r.descp_caso,
      linea_codigo: r.linea_codigo,
      referencia_codigo: r.referencia_codigo,
      variantes: [
        {
          cajas_disponibles: 1,
          lpn: r.lpn,
          lpc02: r.lpc02,
          lpc03: r.lpc03,
          lpc04: r.lpc04,
        },
      ],
    } as unknown as TarjetaCatalogo
    const viaLote1 = precioDeLoteCatalogo(lote, 1)
    const viaLote3 = precioDeLoteCatalogo(lote, 3)

    if (promo) {
      if (lpn === lpc03 && viaLote1 === viaLote3) promoOk++
      else {
        fail++
        samples.push(`PROMO_FAIL ${r.linea_codigo}-${r.referencia_codigo} lpn=${lpn} lpc03=${lpc03}`)
      }
      continue
    }

    // Normal: LPC03 ≠ LPN. Tier BD manda; si null/pegado → ×1.12.
    const good =
      lpn != null &&
      lpc03 != null &&
      lpn !== lpc03 &&
      viaLote1 === lpn &&
      viaLote3 === lpc03 &&
      (r.lpc03 == null || Number(r.lpc03) === lpn
        ? lpc03 === fallback112
        : lpc03 === Number(r.lpc03) || lpc03 === fallback112)
    if (good) ok++
    else {
      fail++
      if (samples.length < 12) {
        samples.push(
          `FAIL ${r.linea_codigo}-${r.referencia_codigo} bd.lpc03=${r.lpc03} getLPN=${lpn} getLPC03=${lpc03} ×1.12=${fallback112} lote1=${viaLote1} lote3=${viaLote3}`,
        )
      }
    }
  }

  console.log({ scanned: data?.length ?? 0, okNormal: ok, promoOk, fail, samples })
  if (fail > 0) throw new Error(`CP_PRECIO_FAIL count=${fail}`)
  console.log('PASS_AUDIT_PRECIO_CP_LPC')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
