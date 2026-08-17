/** Smoke CP + Confecciones — npx tsx scripts/_verify_cp_confecciones_20260729.ts */
import fs from 'node:fs'
import { SignJWT } from 'jose'

const env = fs.readFileSync('.env.local', 'utf8')
const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim()
if (!secret) throw new Error('SESSION_SECRET ausente')

async function main() {
  const token = await new SignJWT({ id_usuario: 1, name: 'Audit', role: 'ADMIN', categoria: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret))
  const headers = { Cookie: `rimec_session=${token}` }

  const qs = `origen_tipo=${encodeURIComponent('TRÁNSITO_PP')}&ramo_tipo=CONFECCIONES&lista_precio_id=1`

  console.log('=== FILTROS CP + CONFECCIONES ===')
  const fr = await fetch(`http://localhost:3001/api/catalogo/filtros?${qs}`, { headers })
  const fj = await fr.json()
  console.log('HTTP', fr.status, 'metaSource:', fj.metaSource, 'degraded:', fj.degraded)
  const marcas = (fj.filtros?.todasMarcas ?? []).map((m: { label: string }) => m.label)
  const estilos = (fj.filtros?.todosEstilos ?? []).map((e: { label: string }) => e.label)
  console.log('marcas (' + marcas.length + '):', marcas.join(', ') || '(vacío)')
  console.log('estilos (' + estilos.length + '):', estilos.slice(0, 15).join(', ') || '(vacío)')
  console.log('lineas:', fj.filtros?.todasLineas?.length ?? 0)

  const calzadoMarcas = ['VIZZANO', 'BEIRA RIO', 'MODARE', 'MOLECA', 'ACTVITTA']
  const badM = marcas.filter((l: string) => calzadoMarcas.includes(l.toUpperCase()))
  console.log(badM.length ? 'FAIL marcas calzado: ' + badM.join(', ') : 'PASS marcas sin calzado 654 típico')

  const calzadoEst = ['TACO ALTO', 'TACO MEDIO', 'ZAPATILLA', 'BOTAS', 'CHATITA', 'TENIS']
  const badE = estilos.filter((l: string) => calzadoEst.includes(l.toUpperCase()))
  console.log(badE.length ? 'WARN estilos calzado: ' + badE.join(', ') : 'PASS estilos sin calzado típico')

  console.log('\n=== TARJETAS ===')
  const tr = await fetch(`http://localhost:3001/api/catalogo/tarjetas?${qs}&limit=30&quick=1`, { headers })
  const tj = await tr.json()
  if (tj.error) {
    console.log('ERROR', tj.error)
    process.exit(1)
  }
  const cards = tj.tarjetas ?? []
  console.log('HTTP', tr.status, 'tarjetas:', cards.length, 'hasMore:', tj.hasMore)
  const t2 = cards.filter((c: { tipo_v2_id?: number }) => c.tipo_v2_id === 2).length
  const t1 = cards.filter((c: { tipo_v2_id?: number }) => c.tipo_v2_id === 1).length
  console.log('tipo_v2=2 (638):', t2, ' tipo_v2=1 (654):', t1)
  console.log(t1 > 0 ? 'FAIL mezcla calzado en grilla confecciones' : 'PASS grilla confecciones')
  const img = cards.filter((c: { imagen_url?: string }) => c.imagen_url).length
  console.log('con imagen:', img + '/' + cards.length)
  for (const c of cards.slice(0, 5)) {
    const color = c.descp_color ?? c.color ?? c.colores?.[0] ?? '—'
    const precio = c.precio_lista ?? c.precio ?? c.lpc03 ?? '—'
    const img = c.imagen_url ?? c.imagen ?? c.thumb_url ?? null
    console.log(
      ' -',
      c.descp_marca,
      '| L:' + c.linea_codigo,
      '|',
      c.descp_grupo_estilo,
      '·',
      color,
      '| precio:',
      precio,
      '| img:',
      img ? 'sí' : 'no',
      '| orig:',
      c.origen_tipo,
    )
  }

  const sample = cards[0]
  if (sample) {
    console.log('\nKeys tarjeta[0]:', Object.keys(sample).slice(0, 25).join(', '))
    const shell = (sample as { shell?: Record<string, unknown> }).shell
    if (shell) {
      console.log('shell keys:', Object.keys(shell).join(', '))
      console.log('shell.imagen_url:', shell.imagen_url ?? shell.imagen ?? '—')
      console.log('shell.precio:', shell.precio_lista ?? shell.precio ?? '—')
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
