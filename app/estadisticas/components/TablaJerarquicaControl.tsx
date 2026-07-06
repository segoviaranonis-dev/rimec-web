'use client'

import { useState } from 'react'
import type { NodoControl } from '@/lib/controlStock/types'

const fmt = (n: number) => n.toLocaleString('es-PY')

function walkIds(nodes: NodoControl[], out: Set<string>) {
  for (const n of nodes) {
    if (n.hijos?.length) {
      out.add(n.id)
      walkIds(n.hijos, out)
    }
  }
}

function FilaRecursive({
  nodo,
  expandidos,
  onToggle,
}: {
  nodo: NodoControl
  expandidos: Set<string>
  onToggle: (id: string) => void
}) {
  const tieneHijos = Boolean(nodo.hijos?.length)
  const expandido = expandidos.has(nodo.id)
  const indent = (nodo.nivel - 1) * 20

  const bg =
    nodo.nivel === 1
      ? 'bg-gradient-to-r from-yellow-500/15 to-transparent'
      : nodo.nivel === 2
        ? 'bg-white/[0.04]'
        : ''

  const text =
    nodo.nivel === 1
      ? 'text-yellow-200/95 font-semibold'
      : nodo.nivel === 2
        ? 'text-white/90 font-medium'
        : 'text-white/75'

  return (
    <>
      <tr
        className={`${bg} border-b border-emerald-900/40 transition-colors ${
          tieneHijos ? 'cursor-pointer hover:bg-white/[0.06]' : 'hover:bg-white/[0.03]'
        }`}
        onClick={tieneHijos ? () => onToggle(nodo.id) : undefined}
      >
        <td className="py-2.5 pr-2" style={{ paddingLeft: 12 + indent }}>
          <div className="flex items-center min-w-0">
            {tieneHijos ? (
              <span className="inline-block w-4 text-emerald-400/90 text-[10px] mr-1 shrink-0">
                {expandido ? '▼' : '▶'}
              </span>
            ) : (
              <span className="inline-block w-4 mr-1 shrink-0" />
            )}
            <span className={`${text} truncate`}>
              {nodo.nombre}
              {nodo.count > 0 ? (
                <span className="text-white/35 font-normal ml-1">({nodo.count})</span>
              ) : null}
            </span>
          </div>
        </td>
        <td className="py-2.5 px-3 text-right text-white/85 tabular-nums">{fmt(nodo.vendido)}</td>
        <td className="py-2.5 px-3 text-right text-sky-300/95 font-medium tabular-nums">
          {fmt(nodo.saldo)}
        </td>
      </tr>
      {expandido &&
        nodo.hijos?.map(h => (
          <FilaRecursive key={h.id} nodo={h} expandidos={expandidos} onToggle={onToggle} />
        ))}
    </>
  )
}

export function TablaJerarquicaControl({ arbol }: { arbol: NodoControl[] }) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())

  const toggle = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    const s = new Set<string>()
    walkIds(arbol, s)
    setExpandidos(s)
  }

  if (!arbol.length) {
    return (
      <p className="text-center text-white/50 py-16 text-sm">
        Sin datos para los filtros seleccionados.
      </p>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={expandAll}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/15"
        >
          Expandir todo
        </button>
        <button
          type="button"
          onClick={() => setExpandidos(new Set())}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/15"
        >
          Colapsar todo
        </button>
      </div>
      <div className="rounded-xl border border-emerald-900/50 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="bg-[#0a1628] text-[10px] uppercase tracking-widest text-emerald-400/90">
              <th className="text-left py-3 px-3 font-semibold">Estructura de análisis</th>
              <th className="text-right py-3 px-3 font-semibold w-28">Vendido</th>
              <th className="text-right py-3 px-3 font-semibold w-28">Disponible</th>
            </tr>
          </thead>
          <tbody className="bg-[#0f1f35]">
            {arbol.map(n => (
              <FilaRecursive key={n.id} nodo={n} expandidos={expandidos} onToggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
