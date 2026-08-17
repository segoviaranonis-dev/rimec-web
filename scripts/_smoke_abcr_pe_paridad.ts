/** Smoke: AB-CR Web Calzado+Todos = lista PE stock vivo. */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(__dirname, '../.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}

async function main() {
  const { loadPeAbcrTiposDesdeStock } = await import('../lib/catalogoPeAbcrTipos')
  const { fetchCatalogoMetaViaRpc } = await import('../lib/catalogoMetaRpc')

  const filters = {
    origen_tipo: 'TODOS' as const,
    ramo_tipo: 'CALZADO' as const,
    deposito_codigo: '' as const,
    marca_id: '',
    marca_ids: [] as number[],
    grupo_estilo_id: '',
    grupo_estilo_ids: [] as number[],
    linea_ids: [] as number[],
    referencia_ids: [] as number[],
    tipo_ids: [] as number[],
    material_familias: [] as string[],
    color_familias: [] as string[],
    tipo_grupos: [] as never[],
    colores: [] as string[],
    tonos: [] as string[],
    sin_tono: false,
    genero_codigo: '',
    genero_codigos: [] as string[],
    quincenas: [] as number[],
    dato_duro_cp: [] as never[],
    preventas: [] as never[],
    buscar: '',
    cadena_comercial: '',
  }

  const pe = await loadPeAbcrTiposDesdeStock(filters as never)
  const meta = await fetchCatalogoMetaViaRpc(filters as never)
  const peLabels = (pe ?? []).map((t) => t.label).join('|')
  const webLabels = (meta?.tipos ?? []).map((t) => t.label).join('|')
  console.log('PE_STOCK', peLabels)
  console.log('WEB_META', webLabels)
  const need = ['CERRADO', 'ABIERTO', 'ACT PRENDAS', 'MEDIAS']
  const missing = need.filter((n) => !webLabels.includes(n))
  if (missing.length) {
    console.error('FAIL_MISSING', missing.join(','))
    process.exit(1)
  }
  if (peLabels !== webLabels) {
    console.error('FAIL_ORDER_OR_DIFF', { pe: peLabels, web: webLabels })
    process.exit(1)
  }
  console.log('PASS_ABCR_PE_PARIDAD')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
