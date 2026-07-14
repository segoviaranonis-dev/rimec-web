'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ListaId } from '@/store/sesionVenta'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { CatalogPanelOrigen } from '@/components/catalog/CatalogPanelOrigen'
import { origenChipStyle } from '@/lib/catalogCardChrome'
import { resolveParesPorCaja } from '@/lib/prontaEntregaVenta'

/** Etiqueta visible del acordeón = quincena_desc (dato duro FK quincena_arribo_id). */
function etiquetaDatoDuro(lote: TarjetaCatalogo): string {
  const v = lote.variantes.find(vv => vv.cajas_disponibles > 0) ?? lote.variantes[0]
  if (lote.origen_tipo === 'PRONTA_ENTREGA') return 'Pronta entrega'
  if (v?.quincena_desc) return v.quincena_desc
  return lote.origen_label || 'Compra previa'
}

function paresEnLote(lote: TarjetaCatalogo): number {
  return lote.variantes
    .filter(v => v.cajas_disponibles > 0)
    .reduce((s, v) => {
      const ppc = resolveParesPorCaja({
        pares_por_caja: v.pares_por_caja,
        cantidad_cajas: v.cantidad_cajas,
        saldo_pares: v.saldo_pares,
        origen_tipo: lote.origen_tipo,
        det_id: v.det_id,
        pp_id: v.pp_id,
      })
      return s + Math.max(0, v.cajas_disponibles * ppc)
    }, 0)
}

type Props = {
  lotes: TarjetaCatalogo[]
  activa: boolean
  listaPrecioId: ListaId
  onNeedSession: () => void
}

export function CatalogLotesAcordeon({ lotes, activa, listaPrecioId, onNeedSession }: Props) {
  const keys = useMemo(() => lotes.map(l => l.cardKey), [lotes])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const isOpen = useCallback((key: string) => expanded[key] === true, [expanded])

  const toggleOne = useCallback((key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const expandAll = useCallback(() => {
    setExpanded(Object.fromEntries(keys.map(k => [k, true])))
  }, [keys])

  const collapseAll = useCallback(() => {
    setExpanded(Object.fromEntries(keys.map(k => [k, false])))
  }, [keys])

  const anyOpen = keys.some(k => expanded[k])
  const allOpen = keys.length > 0 && keys.every(k => expanded[k])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={expandAll}
          disabled={allOpen}
          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-700 disabled:opacity-40"
        >
          Expandir todo
        </button>
        <button
          type="button"
          onClick={collapseAll}
          disabled={!anyOpen}
          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-700 disabled:opacity-40"
        >
          Colapsar todo
        </button>
      </div>

      {lotes.map(lote => {
        const open = isOpen(lote.cardKey)
        const label = etiquetaDatoDuro(lote)
        const pares = paresEnLote(lote)
        const esPe = lote.origen_tipo === 'PRONTA_ENTREGA'
        const panelBg = esPe
          ? 'border-emerald-200/80 bg-emerald-50/40'
          : 'border-blue-200/80 bg-blue-50/40'

        return (
          <div
            key={lote.cardKey}
            className={`overflow-hidden rounded-xl border ${panelBg}`}
          >
            <button
              type="button"
              onClick={() => toggleOne(lote.cardKey)}
              aria-expanded={open}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
            >
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-[10px] font-bold text-slate-600"
                aria-hidden
              >
                {open ? '−' : '+'}
              </span>
              <span
                className="inline-flex min-w-0 flex-1 items-center truncate rounded-lg border px-2 py-0.5 text-[10px] font-bold leading-tight"
                style={origenChipStyle(lote.shell)}
                title={label}
              >
                {label}
              </span>
              {pares > 0 ? (
                <span className="shrink-0 rounded-full bg-bazzar-naranja px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {Math.round(pares)} p
                </span>
              ) : null}
            </button>

            {open ? (
              <div className="border-t border-slate-200/70 px-2 pb-2 pt-1">
                <CatalogPanelOrigen
                  lote={lote}
                  activa={activa}
                  listaPrecioId={listaPrecioId}
                  onNeedSession={onNeedSession}
                  hideOrigenChip
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
