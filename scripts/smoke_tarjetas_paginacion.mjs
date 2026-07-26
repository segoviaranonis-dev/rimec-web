/** Smoke paginación catálogo — marca + row_from */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const dir = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(resolve(dir, '../.env.local'), 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
const key = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim()
if (!url || !key) throw new Error('env')

const sb = createClient(url, key)
const { data: marcas } = await sb.from('v_stock_rimec').select('marca_id, descp_marca').eq('origen_tipo', 'TRÁNSITO_PP').gt('cajas_disponibles', 0).limit(5000)
const vizz = [...new Map((marcas ?? []).map(r => [r.marca_id, r.descp_marca])).entries()].find(([, n]) => String(n).toLowerCase().includes('vizzano'))
console.log('vizzano', vizz)

const base = 'http://localhost:3001/api/catalogo/tarjetas?origen_tipo=TODOS&ramo_tipo=CALZADO'
const m1 = `${base}&marca_id=${vizz?.[0] ?? 0}&row_from=0&limit=30`
const r1 = await fetch(m1)
const t1 = await r1.text()
console.log('page1 status', r1.status, 'len', t1.length, t1.slice(0, 120))
const j1 = JSON.parse(t1)
const ex = (j1.excludeCardKeys ?? []).join(',')
const m2 = `${base}&marca_id=${vizz?.[0] ?? 0}&row_from=${j1.nextRowFrom ?? 0}&limit=30&exclude=${encodeURIComponent(ex)}`
const r2 = await fetch(m2)
const t2 = await r2.text()
console.log('page2 status', r2.status, 'len', t2.length, t2.slice(0, 120) || '(empty)')
