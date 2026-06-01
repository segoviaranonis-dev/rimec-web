import { supabase } from './supabase'

export interface AtributosPar {
  linea_id: number
  referencia_id: number
  grupo_estilo_id: number
  descp_grupo_estilo: string
  tipo_1_id: number
  descp_tipo_1: string
}

export interface ParCodigo {
  linea_codigo: string
  referencia_codigo: string
}

export interface StockMetaRow {
  linea_id?: number | null
  referencia_id?: number | null
  linea_codigo?: string | null
  referencia_codigo?: string | null
  marca_id?: number
  descp_marca?: string
  genero_id?: number | null
  genero_codigo?: string | null
  descp_genero?: string | null
  grupo_estilo_id?: number | null
  descp_grupo_estilo?: string | null
  tipo_1_id?: number | null
  descp_tipo_1?: string | null
}

export interface AtributosPilar {
  /** Clave: linea_id:referencia_id (bigint reales del pilar). */
  porPar: Map<string, AtributosPar>
  /** Clave: linea_codigo:referencia_codigo (texto del pedido). */
  porCodigo: Map<string, AtributosPar>
  estiloLinea: Map<number, { id: number; label: string }>
}

export interface LineaMetaPilar {
  linea_id: number
  marca_id: number | null
  descp_marca: string
  genero_id: number | null
  genero_codigo: string
  descp_genero: string
}

const keyPar = (lineaId: number, refId: number) => `${lineaId}:${refId}`
const keyCodigo = (lineaCodigo: string, refCodigo: string) =>
  `${lineaCodigo.trim()}:${refCodigo.trim()}`

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function normCodigo(v: string | number | null | undefined): string {
  if (v == null) return ''
  return String(v).trim()
}

function putAttr(
  porPar: Map<string, AtributosPar>,
  porCodigo: Map<string, AtributosPar>,
  lineaId: number,
  refId: number,
  lineaCodigo: string,
  refCodigo: string,
  attr: Omit<AtributosPar, 'linea_id' | 'referencia_id'>,
) {
  const full: AtributosPar = {
    linea_id: lineaId,
    referencia_id: refId,
    ...attr,
  }
  porPar.set(keyPar(lineaId, refId), full)
  if (lineaCodigo && refCodigo) {
    porCodigo.set(keyCodigo(lineaCodigo, refCodigo), full)
  }
}

async function cargarMaestras(
  geIds: Set<number>,
  t1Ids: Set<number>,
  geLabels: Map<number, string>,
  t1Labels: Map<number, string>,
) {
  if (geIds.size) {
    const { data: ges } = await supabase
      .from('grupo_estilo_v2')
      .select('id_grupo_estilo, descp_grupo_estilo')
      .in('id_grupo_estilo', [...geIds])
    for (const g of ges ?? []) {
      geLabels.set(Number(g.id_grupo_estilo), String(g.descp_grupo_estilo ?? '').trim())
    }
  }
  if (t1Ids.size) {
    const { data: t1s } = await supabase
      .from('tipo_1')
      .select('id_tipo_1, descp_tipo_1')
      .in('id_tipo_1', [...t1Ids])
    for (const t of t1s ?? []) {
      t1Labels.set(Number(t.id_tipo_1), String(t.descp_tipo_1 ?? '').trim())
    }
  }
}

function completarLabels(
  attr: AtributosPar,
  geLabels: Map<number, string>,
  t1Labels: Map<number, string>,
) {
  if (attr.grupo_estilo_id && !attr.descp_grupo_estilo) {
    attr.descp_grupo_estilo =
      geLabels.get(attr.grupo_estilo_id) || `Estilo ${attr.grupo_estilo_id}`
  }
  if (attr.tipo_1_id && !attr.descp_tipo_1) {
    attr.descp_tipo_1 = t1Labels.get(attr.tipo_1_id) || `Tipo ${attr.tipo_1_id}`
  }
}

/**
 * Estilo/tipo desde linea_referencia usando códigos proveedor (1214/1073)
 * o IDs reales de linea/referencia — nunca confundir código con linea_id.
 */
export async function cargarAtributosDesdePilar(opts: {
  paresCodigo?: ParCodigo[]
  lineaIds?: number[]
}): Promise<AtributosPilar> {
  const porPar = new Map<string, AtributosPar>()
  const porCodigo = new Map<string, AtributosPar>()
  const estiloLinea = new Map<number, { id: number; label: string }>()
  const geLabels = new Map<number, string>()
  const t1Labels = new Map<number, string>()
  const lineaGe = new Map<number, number>()

  const paresUnicos = new Map<string, ParCodigo>()
  for (const p of opts.paresCodigo ?? []) {
    const lc = normCodigo(p.linea_codigo)
    const rc = normCodigo(p.referencia_codigo)
    if (!lc || !rc) continue
    paresUnicos.set(keyCodigo(lc, rc), { linea_codigo: lc, referencia_codigo: rc })
  }

  const codigosLinea = [
    ...new Set([...paresUnicos.values()].map(p => p.linea_codigo)),
  ]

  if (codigosLinea.length) {
    for (const batch of chunk(codigosLinea, 100)) {
      const nums = batch.map(c => (/^\d+$/.test(c) ? Number(c) : c))

      const { data: lineas, error: errL } = await supabase
        .from('linea')
        .select('id, codigo_proveedor, grupo_estilo_id')
        .in('codigo_proveedor', nums)

      if (errL) {
        console.error('[atributosLinea] linea por codigo:', errL.message)
        continue
      }

      const lineaByCodigo = new Map<string, { id: number; geId: number }>()
      for (const l of lineas ?? []) {
        const cod = normCodigo(l.codigo_proveedor)
        const geId = l.grupo_estilo_id ? Number(l.grupo_estilo_id) : 0
        lineaByCodigo.set(cod, { id: Number(l.id), geId })
        if (geId) lineaGe.set(Number(l.id), geId)
      }

      const lineaIdsReal = [...new Set([...lineaByCodigo.values()].map(v => v.id))]
      if (!lineaIdsReal.length) continue

      const { data: refs, error: errR } = await supabase
        .from('referencia')
        .select('id, linea_id, codigo_proveedor')
        .in('linea_id', lineaIdsReal)

      if (errR) {
        console.error('[atributosLinea] referencia:', errR.message)
        continue
      }

      const refByPar = new Map<string, number>()
      for (const r of refs ?? []) {
        const lc = [...lineaByCodigo.entries()].find(([, v]) => v.id === r.linea_id)?.[0]
        if (!lc) continue
        refByPar.set(keyCodigo(lc, normCodigo(r.codigo_proveedor)), Number(r.id))
      }

      const { data: lrRows, error: errLr } = await supabase
        .from('linea_referencia')
        .select(
          'linea_id, referencia_id, grupo_estilo_id, tipo_1_id, descp_grupo_estilo, descp_tipo_1',
        )
        .in('linea_id', lineaIdsReal)

      if (errLr) {
        console.error('[atributosLinea] linea_referencia:', errLr.message)
        continue
      }

      const geIds = new Set<number>()
      const t1Ids = new Set<number>()

      for (const p of paresUnicos.values()) {
        const lin = lineaByCodigo.get(p.linea_codigo)
        const rid = refByPar.get(keyCodigo(p.linea_codigo, p.referencia_codigo))
        if (!lin || !rid) continue

        const lr = lrRows?.find(
          row => Number(row.linea_id) === lin.id && Number(row.referencia_id) === rid,
        )

        let geId = lr?.grupo_estilo_id ? Number(lr.grupo_estilo_id) : 0
        if (!geId) geId = lin.geId
        const t1Id = lr?.tipo_1_id ? Number(lr.tipo_1_id) : 0
        if (geId) geIds.add(geId)
        if (t1Id) t1Ids.add(t1Id)

        putAttr(porPar, porCodigo, lin.id, rid, p.linea_codigo, p.referencia_codigo, {
          grupo_estilo_id: geId,
          descp_grupo_estilo: String(lr?.descp_grupo_estilo ?? '').trim(),
          tipo_1_id: t1Id,
          descp_tipo_1: String(lr?.descp_tipo_1 ?? '').trim(),
        })
      }

      await cargarMaestras(geIds, t1Ids, geLabels, t1Labels)
    }
  }

  const idsExtra = [...new Set((opts.lineaIds ?? []).filter(id => id > 0))]
  for (const batch of chunk(idsExtra, 200)) {
    const { data: lineas } = await supabase
      .from('linea')
      .select('id, codigo_proveedor, grupo_estilo_id')
      .in('id', batch)

    for (const l of lineas ?? []) {
      if (l.grupo_estilo_id) lineaGe.set(l.id, Number(l.grupo_estilo_id))
    }

    const { data: lrRows } = await supabase
      .from('linea_referencia')
      .select(
        'linea_id, referencia_id, grupo_estilo_id, tipo_1_id, descp_grupo_estilo, descp_tipo_1',
      )
      .in('linea_id', batch)

    const geIds = new Set<number>()
    const t1Ids = new Set<number>()

    for (const lr of lrRows ?? []) {
      const lid = Number(lr.linea_id)
      const rid = Number(lr.referencia_id)
      if (!lid || !rid || porPar.has(keyPar(lid, rid))) continue

      let geId = lr.grupo_estilo_id ? Number(lr.grupo_estilo_id) : 0
      if (!geId) geId = lineaGe.get(lid) ?? 0
      const t1Id = lr.tipo_1_id ? Number(lr.tipo_1_id) : 0
      if (geId) geIds.add(geId)
      if (t1Id) t1Ids.add(t1Id)

      const lin = lineas?.find(l => l.id === lid)
      putAttr(
        porPar,
        porCodigo,
        lid,
        rid,
        normCodigo(lin?.codigo_proveedor),
        '',
        {
          grupo_estilo_id: geId,
          descp_grupo_estilo: String(lr.descp_grupo_estilo ?? '').trim(),
          tipo_1_id: t1Id,
          descp_tipo_1: String(lr.descp_tipo_1 ?? '').trim(),
        },
      )
    }
    await cargarMaestras(geIds, t1Ids, geLabels, t1Labels)
  }

  if (geLabels.size === 0 && lineaGe.size) {
    await cargarMaestras(new Set(lineaGe.values()), new Set(), geLabels, t1Labels)
  }

  for (const m of [porPar, porCodigo]) {
    for (const v of m.values()) completarLabels(v, geLabels, t1Labels)
  }

  for (const [lid, geId] of lineaGe) {
    const label = geLabels.get(geId) || `Estilo ${geId}`
    estiloLinea.set(lid, { id: geId, label })
  }

  return { porPar, porCodigo, estiloLinea }
}

export function enriquecerMetaConPilar<T extends StockMetaRow>(
  rows: T[],
  pilar: AtributosPilar,
): T[] {
  const { porPar, porCodigo, estiloLinea } = pilar

  return rows.map(row => {
    const lc = normCodigo(row.linea_codigo)
    const rc = normCodigo(row.referencia_codigo)
    const lid = Number(row.linea_id)
    const rid = Number(row.referencia_id)

    const attr =
      (lc && rc ? porCodigo.get(keyCodigo(lc, rc)) : undefined) ??
      (lid > 0 && rid > 0 ? porPar.get(keyPar(lid, rid)) : undefined)

    const realLid = attr?.linea_id ?? lid
    const lineaEst = estiloLinea.get(realLid)

    const geId =
      attr?.grupo_estilo_id ||
      Number(row.grupo_estilo_id) ||
      lineaEst?.id ||
      0
    const t1Id = attr?.tipo_1_id || Number(row.tipo_1_id) || 0

    if (!attr && !geId && !t1Id) return row

    return {
      ...row,
      linea_id: realLid,
      referencia_id: attr?.referencia_id ?? rid,
      grupo_estilo_id: geId,
      descp_grupo_estilo:
        attr?.descp_grupo_estilo ||
        String(row.descp_grupo_estilo ?? '').trim() ||
        lineaEst?.label ||
        '',
      tipo_1_id: t1Id,
      descp_tipo_1:
        attr?.descp_tipo_1 || String(row.descp_tipo_1 ?? '').trim() || '',
    }
  })
}

export async function cargarMetaLineasDesdePilar(lineaIds: number[]): Promise<Map<number, LineaMetaPilar>> {
  const ids = [...new Set(lineaIds.map(Number).filter(id => Number.isFinite(id) && id > 0))]
  const out = new Map<number, LineaMetaPilar>()
  if (!ids.length) return out

  for (const batch of chunk(ids, 500)) {
    const { data, error } = await supabase
      .from('linea')
      .select('id, marca_id, genero_id, marca_v2(descp_marca), genero(codigo, descripcion)')
      .in('id', batch)

    if (error) {
      console.error('[atributosLinea] meta linea:', error.message)
      continue
    }

    for (const row of data ?? []) {
      const marca = row.marca_v2 as any
      const genero = row.genero as any
      out.set(Number(row.id), {
        linea_id: Number(row.id),
        marca_id: row.marca_id == null ? null : Number(row.marca_id),
        descp_marca: String(marca?.descp_marca ?? '').trim(),
        genero_id: row.genero_id == null ? null : Number(row.genero_id),
        genero_codigo: String(genero?.codigo ?? '').trim(),
        descp_genero: String(genero?.descripcion ?? '').trim(),
      })
    }
  }

  return out
}

/** Marca/género vienen del pilar línea; denormalizados de la vista son legacy. */
export function enriquecerMetaConLinea<T extends StockMetaRow>(
  rows: T[],
  lineas: Map<number, LineaMetaPilar>,
): T[] {
  return rows.map(row => {
    const meta = lineas.get(Number(row.linea_id))
    if (!meta) return row
    return {
      ...row,
      marca_id: meta.marca_id ?? row.marca_id,
      descp_marca: meta.descp_marca || row.descp_marca,
      genero_id: meta.genero_id,
      genero_codigo: meta.genero_codigo,
      descp_genero: meta.descp_genero,
    }
  })
}

/** Consulta diagnóstica para pares línea/ref (códigos proveedor). */
export async function consultarPilarPorCodigos(
  pares: ParCodigo[],
): Promise<
  Array<{
    linea_codigo: string
    referencia_codigo: string
    linea_id: number | null
    referencia_id: number | null
    grupo_estilo_id: number
    descp_grupo_estilo: string
    tipo_1_id: number
    descp_tipo_1: string
    encontrado_lr: boolean
  }>
> {
  const pilar = await cargarAtributosDesdePilar({ paresCodigo: pares })
  return pares.map(p => {
    const lc = normCodigo(p.linea_codigo)
    const rc = normCodigo(p.referencia_codigo)
    const attr = pilar.porCodigo.get(keyCodigo(lc, rc))
    return {
      linea_codigo: lc,
      referencia_codigo: rc,
      linea_id: attr?.linea_id ?? null,
      referencia_id: attr?.referencia_id ?? null,
      grupo_estilo_id: attr?.grupo_estilo_id ?? 0,
      descp_grupo_estilo: attr?.descp_grupo_estilo ?? '',
      tipo_1_id: attr?.tipo_1_id ?? 0,
      descp_tipo_1: attr?.descp_tipo_1 ?? '',
      encontrado_lr: !!(attr?.tipo_1_id || attr?.grupo_estilo_id),
    }
  })
}
