import type { DetalleStockRow, NodoControl, ControlKpis, PeDetalleStockRow } from './types'

/** 5 pilares dentro del PP (módulo 500): linea + ref + material + color + grada */
export function molKeyFila(r: DetalleStockRow): string {
  return [
    r.pp_id,
    r.linea,
    r.referencia,
    r.material_code,
    r.color_code,
    r.grada,
  ].join('|')
}

/** Varias filas ppd con la misma molécula → una fila con totales sumados */
export function normalizarFilasMolecula(filas: DetalleStockRow[]): DetalleStockRow[] {
  const map = new Map<string, DetalleStockRow>()
  for (const r of filas) {
    const k = molKeyFila(r)
    const prev = map.get(k)
    if (!prev) {
      map.set(k, { ...r })
      continue
    }
    map.set(k, {
      ...prev,
      inicial: prev.inicial + r.inicial,
      vendido: prev.vendido + r.vendido,
      saldo: prev.saldo + r.saldo,
    })
  }
  return [...map.values()]
}

function sumRows(rows: DetalleStockRow[]) {
  let inicial = 0
  let vendido = 0
  for (const r of rows) {
    inicial += r.inicial
    vendido += r.vendido
  }
  return { inicial, vendido, saldo: inicial - vendido }
}

function nodo(
  id: string,
  nivel: NodoControl['nivel'],
  nombre: string,
  rows: DetalleStockRow[],
  hijos?: NodoControl[],
  extra?: Pick<NodoControl, 'meta' | 'sortEta'>,
): NodoControl {
  const { inicial, vendido, saldo } = sumRows(rows)
  return {
    id,
    nivel,
    nombre,
    meta: extra?.meta,
    sortEta: extra?.sortEta,
    count: hijos?.length ?? rows.length,
    inicial,
    vendido,
    saldo,
    hijos,
  }
}

export function calcularKpis(filas: DetalleStockRow[]): ControlKpis {
  const { inicial, vendido, saldo } = sumRows(filas)
  return {
    inicial,
    vendido,
    saldo,
    pct_vendido: inicial > 0 ? (vendido / inicial) * 100 : null,
    skus: filas.length,
    marcas: new Set(filas.map(f => f.marca)).size,
    pps: new Set(filas.map(f => f.pp_id)).size,
  }
}

/** Formato corto fecha arribo para UI. */
export function fmtEtaCorta(eta: string | null | undefined): string {
  if (!eta) return 'sin ETA'
  const d = new Date(`${eta.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return eta.slice(0, 10)
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Etiqueta nivel PP: proforma primero · ETA · PP secundario. */
export function labelNodoCompraPrevia(proforma: string, ppNro: string, eta: string | null): {
  nombre: string
  meta: string
} {
  const pf = (proforma || '').trim() || 'Sin proforma'
  const etaTxt = fmtEtaCorta(eta)
  return {
    nombre: `${pf} · llega ${etaTxt}`,
    meta: ppNro,
  }
}

export function construirArbolControl(filas: DetalleStockRow[]): NodoControl[] {
  const byPp = new Map<number, DetalleStockRow[]>()
  for (const f of filas) {
    if (!byPp.has(f.pp_id)) byPp.set(f.pp_id, [])
    byPp.get(f.pp_id)!.push(f)
  }

  const arbol: NodoControl[] = []

  for (const [ppId, rowsPp] of byPp) {
    const ppNro = rowsPp[0]?.pp_nro ?? String(ppId)
    const proforma = rowsPp[0]?.pp_proforma ?? ''
    const eta = rowsPp[0]?.pp_eta ?? null
    const { nombre, meta } = labelNodoCompraPrevia(proforma, ppNro, eta)

    const byGen = new Map<string, DetalleStockRow[]>()
    for (const r of rowsPp) {
      const g = r.genero || 'Sin género'
      if (!byGen.has(g)) byGen.set(g, [])
      byGen.get(g)!.push(r)
    }

    const hijosGen: NodoControl[] = []
    for (const [genero, rowsGen] of byGen) {
      const byMarca = new Map<string, DetalleStockRow[]>()
      for (const r of rowsGen) {
        const m = r.marca || '—'
        if (!byMarca.has(m)) byMarca.set(m, [])
        byMarca.get(m)!.push(r)
      }

      const hijosMarca: NodoControl[] = []
      for (const [marca, rowsMarca] of byMarca) {
        const byEstilo = new Map<string, DetalleStockRow[]>()
        for (const r of rowsMarca) {
          const e = r.estilo || 'Sin estilo'
          if (!byEstilo.has(e)) byEstilo.set(e, [])
          byEstilo.get(e)!.push(r)
        }

        const hijosEstilo: NodoControl[] = []
        for (const [estilo, rowsEst] of byEstilo) {
          hijosEstilo.push(
            nodo(`est:${ppId}|${genero}|${marca}|${estilo}`, 4, estilo, rowsEst),
          )
        }
        hijosEstilo.sort((a, b) => b.saldo - a.saldo)
        hijosMarca.push(
          nodo(`mar:${ppId}|${genero}|${marca}`, 3, marca, rowsMarca, hijosEstilo),
        )
      }
      hijosMarca.sort((a, b) => b.saldo - a.saldo)
      hijosGen.push(nodo(`gen:${ppId}|${genero}`, 2, genero, rowsGen, hijosMarca))
    }
    hijosGen.sort((a, b) => b.saldo - a.saldo)
    arbol.push(
      nodo(`pp:${ppId}`, 1, nombre, rowsPp, hijosGen, {
        meta,
        sortEta: eta ?? '',
      }),
    )
  }

  // Más próximo a llegar primero · sin ETA al final
  arbol.sort((a, b) => {
    const ea = a.sortEta || '9999-99-99'
    const eb = b.sortEta || '9999-99-99'
    if (ea !== eb) return ea.localeCompare(eb)
    return a.nombre.localeCompare(b.nombre, 'es')
  })
  return arbol
}

export function molKeyPeFila(r: PeDetalleStockRow): string {
  return [r.deposito, r.linea, r.referencia, r.material_code, r.color_code].join('|')
}

export function normalizarFilasPeMolecula(filas: PeDetalleStockRow[]): PeDetalleStockRow[] {
  const map = new Map<string, PeDetalleStockRow>()
  for (const r of filas) {
    const k = molKeyPeFila(r)
    const prev = map.get(k)
    if (!prev) {
      map.set(k, { ...r })
      continue
    }
    map.set(k, {
      ...prev,
      inicial: prev.inicial + r.inicial,
      vendido: prev.vendido + r.vendido,
      saldo: prev.saldo + r.saldo,
    })
  }
  return [...map.values()]
}

function peRowsAsDetalle(rows: PeDetalleStockRow[]): DetalleStockRow[] {
  return rows.map(r => ({
    pp_id: 0,
    pp_nro: r.deposito,
    pp_proforma: '',
    pp_eta: null,
    genero: '',
    marca: r.marca,
    estilo: r.estilo,
    linea: r.linea,
    referencia: r.referencia,
    material_code: r.material_code,
    descp_material: '',
    color_code: r.color_code,
    descp_color: '',
    grada: '',
    inicial: r.inicial,
    vendido: r.vendido,
    saldo: r.saldo,
  }))
}

export function construirArbolPeControl(filas: PeDetalleStockRow[]): NodoControl[] {
  const byDep = new Map<string, PeDetalleStockRow[]>()
  for (const f of filas) {
    const d = f.deposito || 'Sin depósito'
    if (!byDep.has(d)) byDep.set(d, [])
    byDep.get(d)!.push(f)
  }

  const arbol: NodoControl[] = []

  for (const [deposito, rowsDep] of byDep) {
    const byMarca = new Map<string, PeDetalleStockRow[]>()
    for (const r of rowsDep) {
      const m = r.marca || '—'
      if (!byMarca.has(m)) byMarca.set(m, [])
      byMarca.get(m)!.push(r)
    }

    const hijosMarca: NodoControl[] = []
    for (const [marca, rowsMarca] of byMarca) {
      const byEstilo = new Map<string, PeDetalleStockRow[]>()
      for (const r of rowsMarca) {
        const e = r.estilo || 'Sin estilo'
        if (!byEstilo.has(e)) byEstilo.set(e, [])
        byEstilo.get(e)!.push(r)
      }

      const hijosEstilo: NodoControl[] = []
      for (const [estilo, rowsEst] of byEstilo) {
        hijosEstilo.push(nodo(`pe-est:${deposito}|${marca}|${estilo}`, 3, estilo, peRowsAsDetalle(rowsEst)))
      }
      hijosEstilo.sort((a, b) => b.saldo - a.saldo)
      hijosMarca.push(
        nodo(`pe-mar:${deposito}|${marca}`, 2, marca, peRowsAsDetalle(rowsMarca), hijosEstilo),
      )
    }
    hijosMarca.sort((a, b) => b.saldo - a.saldo)
    arbol.push(nodo(`pe-dep:${deposito}`, 1, deposito, peRowsAsDetalle(rowsDep), hijosMarca))
  }

  arbol.sort((a, b) => b.saldo - a.saldo)
  return arbol
}
