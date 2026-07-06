import { supabase } from '../supabase'
import type { DetalleStockRow, PpOption, ControlStockResponse } from './types'
import { calcularKpis, construirArbolControl, normalizarFilasMolecula } from './buildTree'

function normCodigo(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

const PPD_SELECT =
  'id, pedido_proveedor_id, linea, referencia, material_code, descp_material, color_code, descp_color, grada, cantidad_pares, pares_vendidos, id_marca'

type PpdTransitoRow = {
  id: number
  pedido_proveedor_id: number
  linea: string | null
  referencia: string | null
  material_code: string | null
  descp_material: string | null
  color_code: string | null
  descp_color: string | null
  grada: string | null
  cantidad_pares: number | null
  pares_vendidos: number | null
  id_marca: number | null
}

/** Supabase PostgREST cap = 1000 filas — paginar para no perder PPs nuevos (ej. PP-2026-0014). */
async function fetchPpdTransito(ppIds: number[]): Promise<PpdTransitoRow[]> {
  const pageSize = 1000
  const all: PpdTransitoRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('pedido_proveedor_detalle')
      .select(PPD_SELECT)
      .in('pedido_proveedor_id', ppIds)
      .not('referencia', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const batch = (data ?? []) as PpdTransitoRow[]
    all.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return all
}

export async function fetchControlStock(opts: {
  ppIds?: number[]
  generos?: string[]
  marcas?: string[]
  estilos?: string[]
  soloSaldo?: boolean
}): Promise<ControlStockResponse> {
  const { data: ppsRaw, error: errPp } = await supabase
    .from('pedido_proveedor')
    .select('id, numero_registro, numero_proforma, estado, estado_transito, fecha_arribo_estimada')
    .eq('estado_transito', 'EN_TRANSITO')  // Solo Pre-Venta (en tránsito)
    .order('id', { ascending: false })

  if (errPp) throw new Error(errPp.message)

  const pps: PpOption[] = (ppsRaw ?? []).map(p => ({
    id: p.id,
    nro: String(p.numero_registro ?? p.id),
    proforma: String(p.numero_proforma ?? ''),
    estado: String(p.estado ?? ''),
    eta: p.fecha_arribo_estimada ? String(p.fecha_arribo_estimada).slice(0, 10) : null,
  }))

  const ppIds =
    opts.ppIds?.length ? opts.ppIds : pps.map(p => p.id)

  if (!ppIds.length) {
    return {
      pps,
      generos: [],
      marcas: [],
      estilos: [],
      filas: [],
      kpis: calcularKpis([]),
      arbol: [],
    }
  }

  const ppds = await fetchPpdTransito(ppIds)

  const detalles = ppds
  const ppMap = new Map(pps.map(p => [p.id, p]))

  const codigosLinea = [...new Set(detalles.map(d => normCodigo(d.linea)).filter(Boolean))]
  const lineaByCodigo = new Map<
    string,
    { id: number; genero: string; geLinea: number | null; marcaId: number | null }
  >()

  if (codigosLinea.length) {
    const nums = codigosLinea.map(c => (/^\d+$/.test(c) ? Number(c) : c))
    const { data: lineas } = await supabase
      .from('linea')
      .select(
        'id, codigo_proveedor, genero_id, marca_id, grupo_estilo_id, genero:genero_id(descripcion)',
      )
      .in('codigo_proveedor', nums)

    for (const l of lineas ?? []) {
      const cod = normCodigo(l.codigo_proveedor)
      const gen = (l.genero as { descripcion?: string } | null)?.descripcion ?? 'Sin género'
      lineaByCodigo.set(cod, {
        id: l.id,
        genero: gen,
        geLinea: l.grupo_estilo_id ? Number(l.grupo_estilo_id) : null,
        marcaId: l.marca_id ? Number(l.marca_id) : null,
      })
    }
  }

  const marcaIds = [
    ...new Set(
      [...lineaByCodigo.values()].map(v => v.marcaId).filter((id): id is number => id != null),
    ),
  ]
  const marcaMap = new Map<number, string>()
  if (marcaIds.length) {
    const { data: mvs } = await supabase
      .from('marca_v2')
      .select('id_marca, descp_marca')
      .in('id_marca', marcaIds)
    for (const m of mvs ?? []) marcaMap.set(m.id_marca, String(m.descp_marca ?? '—'))
  }

  const lineaIds = [...new Set([...lineaByCodigo.values()].map(v => v.id))]
  const lrMap = new Map<string, string>()

  if (lineaIds.length) {
    const { data: refs } = await supabase
      .from('referencia')
      .select('id, linea_id, codigo_proveedor')
      .in('linea_id', lineaIds)

    const refIdByLineaCodigo = new Map<string, number>()
    for (const r of refs ?? []) {
      refIdByLineaCodigo.set(
        `${r.linea_id}:${normCodigo(r.codigo_proveedor)}`,
        Number(r.id),
      )
    }

    const { data: lrRows } = await supabase
      .from('linea_referencia')
      .select('linea_id, referencia_id, grupo_estilo_id, descp_grupo_estilo')
      .in('linea_id', lineaIds)

    const geIds = new Set<number>()
    for (const lr of lrRows ?? []) {
      if (lr.grupo_estilo_id) geIds.add(Number(lr.grupo_estilo_id))
    }
    const geLabels = new Map<number, string>()
    if (geIds.size) {
      const { data: ges } = await supabase
        .from('grupo_estilo_v2')
        .select('id_grupo_estilo, descp_grupo_estilo')
        .in('id_grupo_estilo', [...geIds])
      for (const g of ges ?? []) {
        geLabels.set(Number(g.id_grupo_estilo), String(g.descp_grupo_estilo ?? ''))
      }
    }

    const lrByLidRid = new Map<string, NonNullable<typeof lrRows>[number]>()
    for (const lr of lrRows ?? []) {
      lrByLidRid.set(`${lr.linea_id}:${lr.referencia_id}`, lr)
    }

    const lineaIdToCodigo = new Map<number, string>()
    for (const [cod, v] of lineaByCodigo) lineaIdToCodigo.set(v.id, cod)

    for (const [lidRef, refId] of refIdByLineaCodigo) {
      const [lidStr, refCod] = lidRef.split(':')
      const lr = lrByLidRid.get(`${lidStr}:${refId}`)
      if (!lr) continue
      const geId = lr.grupo_estilo_id ? Number(lr.grupo_estilo_id) : null
      const estilo =
        (geId ? geLabels.get(geId) : '') ||
        String(lr.descp_grupo_estilo ?? '').trim() ||
        'Sin estilo'
      const lc = lineaIdToCodigo.get(Number(lidStr))
      if (lc) lrMap.set(`${lc}:${refCod}`, estilo)
    }
  }

  const filas: DetalleStockRow[] = []

  for (const d of detalles) {
    const pp = ppMap.get(d.pedido_proveedor_id)
    if (!pp) continue

    const lc = normCodigo(d.linea)
    const rc = normCodigo(d.referencia)
    const lin = lineaByCodigo.get(lc)
    const genero = lin?.genero ?? 'Sin género'
    const estilo = lrMap.get(`${lc}:${rc}`) ?? 'Sin estilo'
    const marca =
      lin?.marcaId != null ? marcaMap.get(lin.marcaId) ?? '—' : '—'

    const inicial = Number(d.cantidad_pares) || 0
    const vendido = Number(d.pares_vendidos) || 0
    const saldo = inicial - vendido

    if (opts.soloSaldo && saldo <= 0) continue
    if (opts.generos?.length && !opts.generos.includes(genero)) continue
    if (opts.marcas?.length && !opts.marcas.includes(marca)) continue
    if (opts.estilos?.length && !opts.estilos.includes(estilo)) continue

    filas.push({
      pp_id: pp.id,
      pp_nro: pp.nro,
      pp_proforma: pp.proforma,
      genero,
      marca,
      estilo,
      linea: lc,
      referencia: rc,
      material_code: normCodigo(d.material_code),
      descp_material: String(d.descp_material ?? ''),
      color_code: normCodigo(d.color_code),
      descp_color: String(d.descp_color ?? ''),
      grada: String(d.grada ?? ''),
      inicial,
      vendido,
      saldo,
    })
  }

  const filasNorm = normalizarFilasMolecula(filas)

  const generos = [...new Set(filasNorm.map(f => f.genero))].sort()
  const marcas = [...new Set(filasNorm.map(f => f.marca))].sort()
  const estilos = [...new Set(filasNorm.map(f => f.estilo))].sort()

  return {
    pps,
    generos,
    marcas,
    estilos,
    filas: filasNorm,
    kpis: calcularKpis(filasNorm),
    arbol: construirArbolControl(filasNorm),
  }
}
