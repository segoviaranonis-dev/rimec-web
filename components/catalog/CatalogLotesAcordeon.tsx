'use client'

import type { ListaId } from '@/store/sesionVenta'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { CatalogPanelOrigen } from '@/components/catalog/CatalogPanelOrigen'
import { useCatalogAcordeon } from '@/components/catalog/CatalogAcordeonContext'
import { resolveParesPorCaja } from '@/lib/prontaEntregaVenta'
import { formatPrecioGs } from '@/lib/formatPrecioGs'
import { precioDeLoteCatalogo } from '@/lib/precioLoteCatalogo'
import {
  isConfecciones638Lote,
  stockEnLote,
  unidadStockCorta,
} from '@/lib/confeccionesCatalogo'

export function etiquetaDatoDuroLote(lote: TarjetaCatalogo): string {
  const v = lote.variantes.find(vv => vv.cajas_disponibles > 0) ?? lote.variantes[0]
  if (lote.origen_tipo === 'PRONTA_ENTREGA') return 'Pronta entrega'
  if (v?.quincena_desc) return v.quincena_desc
  return lote.origen_label || 'Compra previa'
}

export function paresEnLoteCatalogo(lote: TarjetaCatalogo): number {
  if (isConfecciones638Lote(lote)) return stockEnLote(lote)
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
  activeTonoKey: string
  onSelectTonoKey: (tonoKey: string) => void
}

export function CatalogLotesAcordeon({
  lotes,
  activa,
  listaPrecioId,
  onNeedSession,
  activeTonoKey,
  onSelectTonoKey,
}: Props) {
  const { isOpen, toggle } = useCatalogAcordeon()

  return (
    <div className="space-y-1">
      {lotes.map(lote => {
        const open = isOpen(lote.cardKey)
        const label = etiquetaDatoDuroLote(lote)
        const esConf = isConfecciones638Lote(lote)
        const uCorta = unidadStockCorta(lote)
        const stockUds = paresEnLoteCatalogo(lote)
        const esPe = lote.origen_tipo === 'PRONTA_ENTREGA'
        const accent = esPe ? 'border-l-emerald-500' : 'border-l-sky-600'
        // Protocolo: precio solo con venta activa (4.01.04.001) — confecciones: precio en sub-tarjetas por talla
        const precioVal = activa && !esConf ? precioDeLoteCatalogo(lote, listaPrecioId) : null

        return (
          <div key={lote.cardKey} className="overflow-hidden rounded-lg">
            <button
              type="button"
              onClick={() => toggle(lote.cardKey)}
              aria-expanded={open}
              className={`flex w-full items-start gap-1 border border-slate-200/90 border-l-[3px] bg-white px-1.5 py-1.5 text-left shadow-sm transition hover:bg-slate-50/80 ${accent}`}
            >
              <span
                className="mt-0.5 shrink-0 text-[11px] font-bold leading-none text-slate-400"
                aria-hidden
              >
                {open ? '▾' : '▸'}
              </span>
              <span
                className="min-w-0 flex-1 text-[10px] font-semibold leading-snug text-slate-800 break-words whitespace-normal"
                title={label}
              >
                {label}
              </span>
              <span className="ml-0.5 flex shrink-0 flex-col items-end gap-0.5">
                {stockUds > 0 ? (
                  <span className="rounded-full bg-bazzar-naranja px-2 py-0.5 text-[11px] font-black tabular-nums leading-none text-white shadow-sm">
                    {Math.round(stockUds)}
                    <span className="text-[8px] font-bold opacity-90"> {uCorta}</span>
                  </span>
                ) : null}
                {precioVal != null && precioVal > 0 ? (
                  <span className="max-w-[88px] text-right text-[10px] font-bold leading-tight tabular-nums text-orange-600">
                    {formatPrecioGs(precioVal)}
                    <span className="block text-[7px] font-normal text-slate-400">/ par</span>
                  </span>
                ) : activa && !esConf ? (
                  <span className="text-[7px] font-medium text-slate-400">Sin precio</span>
                ) : null}
              </span>
            </button>

            {open ? (
              <div className="border border-t-0 border-slate-200/90 bg-slate-50/50 px-1.5 pb-1.5 pt-1">
                <CatalogPanelOrigen
                  lote={lote}
                  activa={activa}
                  listaPrecioId={listaPrecioId}
                  onNeedSession={onNeedSession}
                  hideOrigenChip
                  activeTonoKey={activeTonoKey}
                  onSelectTonoKey={onSelectTonoKey}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
