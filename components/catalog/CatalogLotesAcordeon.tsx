'use client'

import type { ListaId } from '@/store/sesionVenta'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { CatalogPanelOrigen } from '@/components/catalog/CatalogPanelOrigen'
import { useCatalogAcordeon } from '@/components/catalog/CatalogAcordeonContext'
import { resolveParesPorCaja, etiquetaProntaEntregaCatalogo } from '@/lib/prontaEntregaVenta'
import { esLiquidacionPe } from '@/lib/catalogoComercial'
import { DatoDuroCpFilas } from '@/components/catalog/DatoDuroCpFilas'
import { etiquetaDatoDuroCp, partesDatoDuroCp } from '@/lib/datoDuroCabecera'
import { formatPrecioGs } from '@/lib/formatPrecioGs'
import { precioDeLoteCatalogo } from '@/lib/precioLoteCatalogo'
import {
  etiquetaDescuentosPeCatalogo,
  hayDescuentoPeCatalogo,
  precioNetoPeCatalogo,
} from '@/lib/pePrecioNetoCatalogo'
import { indiceVariantePorTonoKey } from '@/lib/catalogoTonoActivo'
import {
  isConfecciones638Lote,
  stockEnLote,
  unidadStockCorta,
} from '@/lib/confeccionesCatalogo'

export function etiquetaDatoDuroLote(lote: TarjetaCatalogo): string {
  const v = lote.variantes.find(vv => vv.cajas_disponibles > 0) ?? lote.variantes[0]
  if (lote.origen_tipo === 'PRONTA_ENTREGA') {
    return etiquetaProntaEntregaCatalogo(lote.linea_codigo, lote.referencia_codigo, {
      liquidacion: esLiquidacionPe(lote),
    })
  }
  if (v?.numero_preventa || v?.quincena_desc) {
    return etiquetaDatoDuroCp(v.numero_preventa, v.quincena_desc)
  }
  if (v?.quincena_desc) return v.quincena_desc
  return lote.origen_label || 'Compra previa'
}

export function paresEnLoteCatalogo(lote: TarjetaCatalogo): number {
  if (isConfecciones638Lote(lote)) return stockEnLote(lote)
  return lote.variantes
    .filter(v => v.cajas_disponibles > 0)
    .reduce((s, v) => s + paresEnVarianteCatalogo(lote, v), 0)
}

/** Pares de una variante (color) — precisión bancaria por tono activo. */
export function paresEnVarianteCatalogo(
  lote: TarjetaCatalogo,
  v: TarjetaCatalogo['variantes'][number],
): number {
  if (v.cajas_disponibles <= 0) return 0
  if (isConfecciones638Lote(lote)) {
    return Math.max(0, Number(v.saldo_pares ?? v.cajas_disponibles) || 0)
  }
  const ppc = resolveParesPorCaja({
    pares_por_caja: v.pares_por_caja,
    cantidad_cajas: v.cantidad_cajas,
    saldo_pares: v.saldo_pares,
    origen_tipo: lote.origen_tipo,
    det_id: v.det_id,
    pp_id: v.pp_id,
  })
  return Math.max(0, v.cajas_disponibles * ppc)
}

/**
 * Badge acordeón: contraído = total lote · desplegado = color/tono seleccionado.
 * (4.02.04.002 — confusión multi-color si siempre muestra total)
 */
export function stockBadgeAcordeonLote(
  lote: TarjetaCatalogo,
  opts: { open: boolean; activeTonoKey: string },
): number {
  if (!opts.open || isConfecciones638Lote(lote)) {
    return paresEnLoteCatalogo(lote)
  }
  const variantesConStock = lote.variantes.filter(v => v.cajas_disponibles > 0)
  const matchIdx = indiceVariantePorTonoKey(variantesConStock, opts.activeTonoKey)
  const v = variantesConStock[matchIdx >= 0 ? matchIdx : 0]
  return v ? paresEnVarianteCatalogo(lote, v) : paresEnLoteCatalogo(lote)
}

type Props = {
  lotes: TarjetaCatalogo[]
  activa: boolean
  listaPrecioId: ListaId
  onNeedSession: () => void
  activeTonoKey: string
  onSelectTonoKey: (tonoKey: string) => void
  /** Mapa molécula L-R-mat-color → % comercial dictado */
  descuentoPctPorMol?: Map<string, number> | null
}

function molKeyLote(lote: TarjetaCatalogo): string {
  const v = lote.variantes.find(vv => vv.cajas_disponibles > 0) ?? lote.variantes[0]
  return `${lote.linea_codigo}-${lote.referencia_codigo}-${v?.material_code ?? ''}-${v?.color_code ?? ''}`
}

export function CatalogLotesAcordeon({
  lotes,
  activa,
  listaPrecioId,
  onNeedSession,
  activeTonoKey,
  onSelectTonoKey,
  descuentoPctPorMol = null,
}: Props) {
  const { isOpen, toggle } = useCatalogAcordeon()

  return (
    <div className="space-y-1">
      {lotes.map(lote => {
        const esConf = isConfecciones638Lote(lote)
        const esPe = lote.origen_tipo === 'PRONTA_ENTREGA'
        const v = lote.variantes.find(vv => vv.cajas_disponibles > 0) ?? lote.variantes[0]
        const open = esConf || isOpen(lote.cardKey)
        const cpPartes =
          !esPe && v
            ? partesDatoDuroCp(v.numero_preventa, v.quincena_desc)
            : { preventa: '', quincena: '' }
        const labelFallback = etiquetaDatoDuroLote(lote)
        const uCorta = unidadStockCorta(lote)
        const stockUds = stockBadgeAcordeonLote(lote, { open, activeTonoKey })
        const stockBadgeTitle = open
          ? 'Stock del color seleccionado'
          : 'Stock total del lote (todos los colores)'
        const accent = esPe
          ? 'border-l-emerald-500'
          : esConf
            ? 'border-l-amber-400'
            : 'border-l-sky-600'
        /** CP confecciones: amarillo pastel (familia LIQ oro). Calzado: blanco/sky. */
        const headerBg = esPe
          ? 'bg-white'
          : esConf
            ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50/70'
            : 'bg-white'
        const precioVal = activa && !esConf ? precioDeLoteCatalogo(lote, listaPrecioId) : null
        const descPct =
          esPe
            ? (lote.descuento_comercial_pct ??
                descuentoPctPorMol?.get(molKeyLote(lote)) ??
                null)
            : null
        const precioNetoPe =
          esPe && precioVal != null && precioVal > 0 && activa
            ? precioNetoPeCatalogo(precioVal, listaPrecioId, descPct)
            : null
        const etiquetaDescPe =
          esPe && hayDescuentoPeCatalogo(listaPrecioId, descPct)
            ? etiquetaDescuentosPeCatalogo(listaPrecioId, descPct)
            : null

        const datoDuroLabel = esPe ? (
          <span
            className="block text-[10px] font-semibold leading-snug text-slate-800"
            title={labelFallback}
          >
            {labelFallback}
          </span>
        ) : (
          <DatoDuroCpFilas
            preventa={cpPartes.preventa}
            quincena={cpPartes.quincena}
            fallbackLabel={labelFallback}
            layout="center"
            ramo={esConf ? 'confecciones' : 'calzado'}
          />
        )

        return (
          <div key={lote.cardKey} className="overflow-hidden rounded-lg">
            {!esConf ? (
              <button
                type="button"
                onClick={() => toggle(lote.cardKey)}
                aria-expanded={open}
                className={`flex w-full items-center gap-1 border border-slate-200/90 border-l-[3px] px-1.5 py-2 text-left shadow-sm transition hover:brightness-[0.98] ${accent} ${headerBg}`}
              >
                <span
                  className="shrink-0 text-[11px] font-bold leading-none text-slate-400"
                  aria-hidden
                >
                  {open ? '▾' : '▸'}
                </span>
                <span className="flex min-w-0 flex-1 items-center justify-center px-1" title={labelFallback}>
                  {datoDuroLabel}
                </span>
                <span className="ml-0.5 flex shrink-0 flex-col items-end gap-0.5">
                  {stockUds > 0 ? (
                    <span
                      className="rounded-full bg-bazzar-naranja px-2 py-0.5 text-[11px] font-black tabular-nums leading-none text-white shadow-sm"
                      title={stockBadgeTitle}
                    >
                      {Math.round(stockUds)}
                      <span className="text-[8px] font-bold opacity-90"> {uCorta}</span>
                    </span>
                  ) : null}
                  {precioVal != null && precioVal > 0 ? (
                    <span className="max-w-[96px] text-right text-[10px] font-bold leading-tight tabular-nums text-orange-600">
                      {precioNetoPe != null && precioNetoPe < precioVal ? (
                        <>
                          <span className="block text-[9px] font-semibold tabular-nums text-black line-through decoration-black/80">
                            {formatPrecioGs(precioVal)}
                          </span>
                          <span className="block">{formatPrecioGs(precioNetoPe)}</span>
                        </>
                      ) : (
                        formatPrecioGs(precioVal)
                      )}
                      <span className="flex items-center justify-end gap-1">
                        <span className="text-[7px] font-normal text-slate-400">/ par</span>
                        {etiquetaDescPe ? (
                          <span
                            className="text-[7px] font-medium tabular-nums text-emerald-700"
                            title="Descuentos cascada FI PE"
                          >
                            {etiquetaDescPe}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  ) : activa ? (
                    <span className="text-[7px] font-medium text-slate-400">Sin precio</span>
                  ) : null}
                </span>
              </button>
            ) : (
              <div
                className={`flex w-full items-start gap-1 border border-slate-200/90 border-l-[3px] px-1.5 py-1.5 ${accent} ${headerBg}`}
              >
                <span className="min-w-0 flex-1" title={labelFallback}>
                  {datoDuroLabel}
                </span>
                {stockUds > 0 ? (
                  <span className="rounded-full bg-bazzar-naranja px-2 py-0.5 text-[11px] font-black tabular-nums leading-none text-white shadow-sm">
                    {Math.round(stockUds)}
                    <span className="text-[8px] font-bold opacity-90"> {uCorta}</span>
                  </span>
                ) : null}
              </div>
            )}

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
