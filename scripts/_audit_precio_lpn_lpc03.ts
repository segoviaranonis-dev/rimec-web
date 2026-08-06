import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { getPrecioActivoPe, resolverLpc03, lpcDesdeLpn } from '../lib/precioLista'
import { precioNetoPeCatalogo } from '../lib/pePrecioNetoCatalogo'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  for (const linea of ['4076', '4876']) {
    const { data, error } = await sb
      .from('v_stock_pe_rimec')
      .select(
        'linea_codigo,referencia_codigo,material_code,color_code,lpn,lpc02,lpc03,lpc04,descp_caso,descp_marca,cajas_disponibles',
      )
      .eq('linea_codigo', linea)
      .eq('referencia_codigo', '1304')
      .gt('cajas_disponibles', 0)
      .limit(5)
    console.log('LINEA', linea, error?.message ?? '', data)
    for (const r of data ?? []) {
      const row = {
        lpn: r.lpn,
        lpc02: r.lpc02,
        lpc03: r.lpc03,
        lpc04: r.lpc04,
        descp_caso: r.descp_caso,
      }
      const lpn = getPrecioActivoPe(row, 1, r.descp_caso)
      const lpc03 = getPrecioActivoPe(row, 3, r.descp_caso)
      const calc112 = r.lpn != null ? lpcDesdeLpn(Number(r.lpn), 1.12) : null
      const res = resolverLpc03(r.lpn, r.lpc03, r.descp_caso, null)
      const okTachado = lpn !== lpc03 && lpc03 === calc112
      console.log({
        sku: `${r.linea_codigo}-${r.referencia_codigo}-${r.material_code}-${r.color_code}`,
        bd: { lpn: r.lpn, lpc03: r.lpc03, caso: r.descp_caso },
        getLPN: lpn,
        getLPC03: lpc03,
        resolverLpc03: res,
        lpnx112: calc112,
        netoLPN_25: lpn ? precioNetoPeCatalogo(lpn, 1, 25, false) : null,
        netoLPC03_10_25: lpc03 ? precioNetoPeCatalogo(lpc03, 3, 25, false) : null,
        OK_TACHADO_DISTINTO: okTachado,
      })
      if (!okTachado) throw new Error(`tachado LPN===LPC03 o ≠×1.12 sku=${r.linea_codigo}`)
    }
  }
  console.log('PASS_AUDIT_PRECIO_LPN_LPC03')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
