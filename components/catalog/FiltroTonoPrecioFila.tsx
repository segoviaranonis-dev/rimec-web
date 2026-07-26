'use client'

import { FiltroTonoCabecera } from '@/components/catalog/FiltroTonoCabecera'
import { FiltroPrecioRango } from '@/components/catalog/FiltroPrecioRango'
import type { ColorEstandar } from '@/lib/pilares/colores-estandar'
import type { PrecioRangoCatalogo } from '@/lib/catalogoPrecioRango'
import type { ListaId } from '@/store/sesionVenta'

type Props = {
  tonoCatalog: ColorEstandar[]
  tonosSel: string[]
  sinTono: boolean
  onTonoChange: (tonos: string[], sinTono: boolean) => void
  precioMin: number | null
  precioMax: number | null
  onPrecioAplicar: (min: number | null, max: number | null, listaPrecioId: ListaId | null) => void
  rangoPrecioSql?: PrecioRangoCatalogo | null
}

/** Fila cabecera — Tono + Precio (SQL min/max + Aplicar). */
export function FiltroTonoPrecioFila({
  tonoCatalog,
  tonosSel,
  sinTono,
  onTonoChange,
  precioMin,
  precioMax,
  onPrecioAplicar,
  rangoPrecioSql,
}: Props) {
  const tonosActivos = sinTono ? 1 : tonosSel.length

  return (
    <div className="rounded-xl border border-slate-200/90 bg-gradient-to-r from-white via-slate-50/80 to-white shadow-sm">
      <div className="flex flex-col gap-2 px-3 py-2.5 lg:flex-row lg:items-center lg:gap-4">
        {tonoCatalog.length > 0 ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex shrink-0 flex-col items-start gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Tono
              </span>
              {tonosActivos > 0 ? (
                <span className="rounded bg-rimec-azul px-1.5 py-px text-[9px] font-black tabular-nums text-white">
                  {tonosActivos}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
              <FiltroTonoCabecera
                catalogo={tonoCatalog}
                tonosSel={tonosSel}
                sinTono={sinTono}
                onChange={onTonoChange}
                compact
              />
            </div>
          </div>
        ) : null}

        {tonoCatalog.length > 0 ? (
          <div
            className="hidden lg:block h-9 w-px shrink-0 bg-gradient-to-b from-transparent via-slate-200 to-transparent"
            aria-hidden
          />
        ) : null}

        <FiltroPrecioRango
          precioMin={precioMin}
          precioMax={precioMax}
          onAplicar={onPrecioAplicar}
          rangoCatalogo={rangoPrecioSql}
          inline
        />
      </div>
    </div>
  )
}
