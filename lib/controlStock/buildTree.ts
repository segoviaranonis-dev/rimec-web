import type { DetalleStockRow, NodoControl, ControlKpis } from './types'

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
): NodoControl {
  const { inicial, vendido, saldo } = sumRows(rows)
  return {
    id,
    nivel,
    nombre,
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

export function construirArbolControl(filas: DetalleStockRow[]): NodoControl[] {
  const byPp = new Map<number, DetalleStockRow[]>()
  for (const f of filas) {
    if (!byPp.has(f.pp_id)) byPp.set(f.pp_id, [])
    byPp.get(f.pp_id)!.push(f)
  }

  const arbol: NodoControl[] = []

  for (const [ppId, rowsPp] of byPp) {
    const ppNro = rowsPp[0]?.pp_nro ?? String(ppId)

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
          const hojas: NodoControl[] = rowsEst.map(r => {
            const label = [
              r.linea,
              r.referencia,
              r.descp_material || r.material_code,
              r.descp_color || r.color_code,
              r.grada,
            ]
              .filter(Boolean)
              .join(' · ')
            return nodo(
              `leaf:${ppId}|${genero}|${marca}|${estilo}|${r.linea}|${r.referencia}|${r.material_code}|${r.color_code}|${r.grada}`,
              5,
              label,
              [r],
            )
          })
          hojas.sort((a, b) => b.saldo - a.saldo)
          hijosEstilo.push(
            nodo(`est:${ppId}|${genero}|${marca}|${estilo}`, 4, estilo, rowsEst, hojas),
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
    arbol.push(nodo(`pp:${ppId}`, 1, ppNro, rowsPp, hijosGen))
  }

  arbol.sort((a, b) => b.saldo - a.saldo)
  return arbol
}
