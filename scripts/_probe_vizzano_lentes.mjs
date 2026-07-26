import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { SignJWT } from 'jose'

const env = readFileSync('.env.local', 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const sb = createClient(
  get('NEXT_PUBLIC_SUPABASE_URL'),
  get('SUPABASE_SERVICE_ROLE_KEY') || get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
)

const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim()
const token = await new SignJWT({ id_usuario: 1, name: 'Probe', role: 'VENDEDOR' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(new TextEncoder().encode(secret))
const cookie = `rimec_session=${token}`

console.log('=== BD v_stock_pe_rimec · VIZZANO LENTES/OCULOS ===\n')

const { data: lentes, error: e1 } = await sb
  .from('v_stock_pe_rimec')
  .select(
    'det_id,linea_codigo,referencia_codigo,marca_id,descp_marca,descp_tipo_1,descp_grupo_estilo,nombre,cajas_disponibles,deposito_nombre,ramo_tipo',
  )
  .gt('cajas_disponibles', 0)
  .eq('marca_id', 2)
  .or('descp_tipo_1.in.(LENTES,ANTEOJOS,OCULOS),descp_grupo_estilo.in.(LENTES,ANTEOJOS,OCULOS),nombre.ilike.%OCULOS%,nombre.ilike.%LENTES%')
  .limit(20)

if (e1) console.log('err', e1.message)
else {
  console.log('Filas BD:', lentes?.length ?? 0)
  for (const r of lentes ?? []) console.log(r)
}

const { count: cLentes } = await sb
  .from('v_stock_pe_rimec')
  .select('det_id', { count: 'exact', head: true })
  .gt('cajas_disponibles', 0)
  .eq('marca_id', 2)
  .eq('descp_tipo_1', 'LENTES')

console.log('\nTotal VIZZANO descp_tipo_1=LENTES cajas>0:', cLentes)

console.log('\n=== API tarjetas ACCESORIOS + linea 90000 ===\n')
const qs = 'origen_tipo=TODOS&marca_ids=2&ramo_tipo=ACCESORIOS&limit=60'
const res = await fetch(`http://localhost:3001/api/catalogo/tarjetas?${qs}`, {
  headers: { Cookie: cookie },
  signal: AbortSignal.timeout(120000),
})
const json = await res.json()
const tarjetas = json.tarjetas ?? []
const lentesCards = tarjetas.filter((t) => {
  const lotes = t.lotes ?? [t]
  return lotes.some((l) => {
    const t1 = String(l.descp_tipo_1 ?? t.descp_tipo_1 ?? '').toUpperCase()
    const n = String(l.nombre ?? t.nombre ?? '').toUpperCase()
    return t1.includes('LENT') || t1.includes('OCUL') || n.includes('OCUL')
  })
})
console.log('Tarjetas ACCESORIOS total:', tarjetas.length)
console.log('Tarjetas con señal LENTES/OCULOS:', lentesCards.length)
console.log('\n=== Búsqueda ampliada LENTES/90000 ===\n')

for (const [label, fn] of [
  [
    'linea 90000 full cols',
    () =>
      sb
        .from('v_stock_pe_rimec')
        .select(
          'linea_codigo,referencia_codigo,descp_tipo_1,descp_grupo_estilo,descp_estilo,sdrm_tipo0,sdrm_tipo1,sdrm_tipo2,nombre,material_code,cajas_disponibles',
        )
        .eq('linea_codigo', '90000')
        .limit(8),
  ],
  [
    'LENTES global any row',
    () =>
      sb
        .from('v_stock_pe_rimec')
        .select('marca_id,descp_marca,linea_codigo,descp_tipo_1,cajas_disponibles')
        .or('descp_tipo_1.eq.LENTES,sdrm_tipo1.ilike.%LENT%,sdrm_tipo2.ilike.%LENT%')
        .limit(5),
  ],
  [
    'nombre OCULOS cajas>0',
    () =>
      sb
        .from('v_stock_pe_rimec')
        .select('marca_id,descp_marca,descp_tipo_1,cajas_disponibles,linea_codigo,nombre')
        .ilike('nombre', '%OCULOS%')
        .gt('cajas_disponibles', 0)
        .limit(8),
  ],
  [
    'LENTES any cajas>0',
    () =>
      sb
        .from('v_stock_pe_rimec')
        .select('marca_id,descp_marca,cajas_disponibles,linea_codigo', { count: 'exact' })
        .eq('descp_tipo_1', 'LENTES')
        .gt('cajas_disponibles', 0)
        .limit(5),
  ],
  [
    'LENTES marca_id=2 sin filtro cajas',
    () =>
      sb
        .from('v_stock_pe_rimec')
        .select('marca_id,descp_marca,cajas_disponibles,linea_codigo,referencia_codigo', { count: 'exact' })
        .eq('descp_tipo_1', 'LENTES')
        .eq('marca_id', 2)
        .limit(8),
  ],
  [
    'sdrm_tipo1 LENTES VIZZANO',
    () =>
      sb
        .from('v_stock_pe_rimec')
        .select('marca_id,descp_marca,sdrm_marca,sdrm_tipo1,cajas_disponibles,linea_codigo')
        .ilike('sdrm_marca', '%VIZZANO%')
        .ilike('sdrm_tipo1', '%LENT%')
        .limit(8),
  ],
]) {
  const { data, count, error } = await fn()
  console.log(label, error?.message ?? `count=${count ?? data?.length}`)
  for (const r of data ?? []) console.log(' ', r)
}
