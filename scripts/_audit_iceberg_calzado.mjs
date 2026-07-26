import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '..', 'report', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim()
if (!url) throw new Error('no DATABASE_URL')

const pool = new pg.Pool({ connectionString: url })

const cp = await pool.query(
  `SELECT public.rimec_catalogo_meta(false, null, null, null, null, null, 'CALZADO', null, null) AS m`,
)
const pe = await pool.query(
  `SELECT public.rimec_catalogo_meta(true, null, null, null, null, null, 'CALZADO', null, null) AS m`,
)

const estilosCp = (cp.rows[0].m.estilos ?? []).map((e) => e.label)
const estilosPe = (pe.rows[0].m.estilos ?? []).map((e) => e.label)
const marcasCp = (cp.rows[0].m.marcas ?? []).map((e) => e.label)

console.log('=== RPC meta p_ramo_tipo=CALZADO ===')
console.log('CP marcas:', marcasCp.join(', '))
console.log('CP estilos:', estilosCp.join(' | '))
console.log(
  'PE estilos confección-like:',
  estilosPe.filter((e) => /PIJAMA|LEGGING|POLO|BLUSA|SHORT|CAMISET/i.test(e)).join(' | ') || '(ninguno)',
)
console.log('PE estilos total:', estilosPe.length, estilosPe.slice(0, 8).join(' | '))

const badPe = await pool.query(`
  SELECT descp_grupo_estilo, descp_tipo_1, descp_marca, proveedor_importacion_id, ramo_tipo, count(*)::int n
  FROM v_stock_pe_rimec
  WHERE cajas_disponibles > 0 AND ramo_tipo = 'CALZADO'
    AND (
      upper(descp_grupo_estilo) LIKE '%PIJAMA%'
      OR upper(descp_tipo_1) LIKE '%CARTERA%'
      OR upper(descp_tipo_1) LIKE '%BOLSO%'
      OR upper(descp_tipo_1) LIKE '%BOLSA%'
    )
  GROUP BY 1,2,3,4,5 ORDER BY n DESC LIMIT 20
`)
console.log('\n=== PE filas CALZADO sospechosas ===')
console.table(badPe.rows)

const cpBad = await pool.query(`
  SELECT descp_grupo_estilo, descp_tipo_1, descp_marca, proveedor_importacion_id, ramo_tipo, count(*)::int n
  FROM v_stock_rimec
  WHERE cajas_disponibles > 0 AND origen_tipo = 'TRÁNSITO_PP'
    AND (
      upper(descp_grupo_estilo) LIKE '%PIJAMA%'
      OR upper(descp_tipo_1) LIKE '%CARTERA%'
      OR descp_marca IN ('KYLY', 'MILON', 'RIMEC')
    )
  GROUP BY 1,2,3,4,5 ORDER BY n DESC LIMIT 20
`)
console.log('\n=== CP TRÁNSITO_PP filas sospechosas ===')
console.table(cpBad.rows)

const pijamaPe = await pool.query(`
  SELECT DISTINCT descp_grupo_estilo, proveedor_importacion_id, ramo_tipo
  FROM v_stock_pe_rimec
  WHERE cajas_disponibles > 0 AND upper(descp_grupo_estilo) LIKE '%PIJAMA%'
  LIMIT 10
`)
console.log('\n=== PIJAMA en PE (cualquier ramo) ===')
console.table(pijamaPe.rows)

await pool.end()
