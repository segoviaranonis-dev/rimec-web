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
      ? 'bg-sky-50'
      : nodo.nivel === 2
        ? 'bg-slate-50/80'
        : 'bg-white'

  const text =
    nodo.nivel === 1
      ? 'text-rimec-azul font-semibold'
      : nodo.nivel === 2
        ? 'text-slate-800 font-medium'
        : 'text-slate-600'

  return (
    <>
      <tr
        className={`${bg} border-b border-slate-200 transition-colors ${
          tieneHijos ? 'cursor-pointer hover:bg-sky-50/80' : 'hover:bg-slate-50'
        }`}
        onClick={tieneHijos ? () => onToggle(nodo.id) : undefined}
      >
        <td className="py-2.5 pr-2" style={{ paddingLeft: 12 + indent }}>
          <div className="flex items-start min-w-0 gap-1">
            {tieneHijos ? (
              <span className="inline-block w-4 text-rimec-azul text-[10px] mt-0.5 shrink-0">
                {expandido ? '▼' : '▶'}
              </span>
            ) : (
              <span className="inline-block w-4 shrink-0" />
            )}
            <div className="min-w-0">
              <span className={`${text} break-words`}>
                {nodo.nombre}
                {nodo.count > 0 ? (
                  <span className="text-slate-400 font-normal ml-1">({nodo.count})</span>
                ) : null}
                {nodo.preventa ? (
                  <span
                    className="ml-2 font-mono text-[11px] font-semibold text-sky-900 bg-sky-100/80 px-1.5 py-0.5 rounded border border-sky-200"
                    title="Nº preventa Carlos"
                  >
                    {nodo.preventa}
                  </span>
                ) : null}
              </span>
              {nodo.meta ? (
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{nodo.meta}</p>
              ) : null}
            </div>
          </div>
        </td>
        <td className="py-2.5 px-3 text-right text-slate-700 tabular-nums">{fmt(nodo.vendido)}</td>
        <td className="py-2.5 px-3 text-right text-rimec-azul font-medium tabular-nums">
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

export function TablaJerarquicaControl({ arbol, compact = false }: { arbol: NodoControl[]; compact?: boolean }) {
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
      <p className="text-center text-slate-500 py-16 text-sm">
        Sin datos para los filtros seleccionados.
      </p>
    )
  }

  return (
    <div>
      {!compact && (
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={expandAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Expandir todo
          </button>
          <button
            type="button"
            onClick={() => setExpandidos(new Set())}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Colapsar todo
          </button>
        </div>
      )}
      <div className="w-full max-w-full min-w-0 rounded-xl border border-slate-200 overflow-hidden overflow-x-auto bg-white -mx-1 sm:mx-0">
        <table className="w-full text-sm min-w-[320px] sm:min-w-[480px]">
          <thead>
            <tr className="bg-slate-100 text-[10px] uppercase tracking-widest text-slate-600">
              <th className="text-left py-3 px-3 font-semibold">Estructura de análisis</th>
              <th className="text-right py-3 px-3 font-semibold w-28">Vendido</th>
              <th className="text-right py-3 px-3 font-semibold w-28">Disponible</th>
            </tr>
          </thead>
          <tbody>
            {arbol.map(n => (
              <FilaRecursive key={n.id} nodo={n} expandidos={expandidos} onToggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
