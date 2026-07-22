'use client'

import { useSesion, type ListaId } from '@/store/sesionVenta'
import { CatalogTonosFila } from '@/components/catalog/CatalogTonosFila'
import { CatalogConfeccionesTallas } from '@/components/catalog/CatalogConfeccionesTallas'
import { origenChipStyle } from '@/lib/catalogCardChrome'
import { resolveParesPorCaja, syntheticPpIdForPe, etiquetaProntaEntregaCatalogo } from '@/lib/prontaEntregaVenta'
import { etiquetaDatoDuroCp, partesDatoDuroCp } from '@/lib/datoDuroCabecera'
import { esLiquidacionPe } from '@/lib/catalogoComercial'
import { DatoDuroCpFilas } from '@/components/catalog/DatoDuroCpFilas'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import { formatPrecioGs } from '@/lib/formatPrecioGs'
import {
  getPrecioActivo,
  getPrecioActivoPe,
  resolverLpc03,
  resolverLpc04,
} from '@/lib/precioLista'
import { indiceVariantePorTonoKey, tonoKeyDeVariante } from '@/lib/catalogoTonoActivo'
import {
  isConfecciones638Lote,
  stockEnLote,
  unidadStockCorta,
  variantesColorUnicas,
} from '@/lib/confeccionesCatalogo'

const AZUL = '#0F172A'

function paresEnLote(lote: TarjetaCatalogo): number {
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

function precioCatalogo(
  v: { lpn?: number | null; lpc02?: number | null; lpc03?: number | null; lpc04?: number | null },
  listaId: ListaId,
  descpCaso: string | null | undefined,
  origenTipo: TarjetaCatalogo['origen_tipo'] | string | null | undefined,
): number | null {
  const row = {
    lpn: v.lpn ?? null,
    lpc02: v.lpc02 ?? null,
    lpc03: v.lpc03 ?? null,
    lpc04: v.lpc04 ?? null,
    precio_web: null as number | null,
  }
  const ot = String(origenTipo ?? '').toUpperCase().replace(/\s+/g, '_')
  if (ot.includes('PRONTA')) return getPrecioActivoPe(row, listaId, descpCaso)
  return getPrecioActivo(row, listaId, descpCaso)
}

type Props = {
  lote: TarjetaCatalogo
  activa: boolean
  listaPrecioId: ListaId
  onNeedSession: () => void
  stacked?: boolean
  /** Acordeón dato duro: el chip quincena va en la cabecera del acordeón. */
  hideOrigenChip?: boolean
  /** Tono activo de la ficha (compartido entre paneles). */
  activeTonoKey: string
  onSelectTonoKey: (tonoKey: string) => void
}

export function CatalogPanelOrigen({
  lote: p,
  activa,
  listaPrecioId,
  onNeedSession,
  stacked,
  hideOrigenChip,
  activeTonoKey,
  onSelectTonoKey,
}: Props) {
  const carrito = useSesion(s => s.carrito)
  const agregarCaja = useSesion(s => s.agregarCaja)
  const quitarCaja = useSesion(s => s.quitarCaja)

  const variantesConStock = p.variantes.filter(v => v.cajas_disponibles > 0)
  const matchIdx = indiceVariantePorTonoKey(variantesConStock, activeTonoKey)
  const varIdx = matchIdx >= 0 ? matchIdx : 0
  const v = variantesConStock[varIdx] || p.variantes[0]
  if (!v) return null

  // Protocolo: no calcular/mostrar precio sin venta activa (4.01.04.001)
  const precioVal = activa
    ? precioCatalogo(v, listaPrecioId, p.descp_caso, p.origen_tipo)
    : null
  const tienePrecio = precioVal !== null && precioVal > 0
  const shell = p.shell
  const cartItem = carrito[`det_${v.det_id}`]
  const cajas = cartItem ? cartItem.cajas : 0
  const maxCajas = v.cajas_disponibles
  const esPe = p.origen_tipo === 'PRONTA_ENTREGA'
  const esConf = isConfecciones638Lote(p)
  const uCorta = unidadStockCorta(p)
  const coloresUnicos = esConf ? variantesColorUnicas(p) : []
  const puedeAgregar = !!activa && tienePrecio && maxCajas > 0 && cajas < maxCajas
  const precioLpc03Snap = resolverLpc03(v.lpn ?? null, v.lpc03 ?? null, p.descp_caso) ?? 0
  const precioLpc04Snap = resolverLpc04(v.lpn ?? null, v.lpc04 ?? null, p.descp_caso) ?? 0

  const handleAgregar = () => {
    if (!activa || !tienePrecio || cajas >= maxCajas) return
    const ppIdPe = esPe
      ? syntheticPpIdForPe({ deposito_id: v.deposito_id, proforma: v.proforma, pp_nro: v.pp_nro })
      : (v.pp_id ?? 0)
    void agregarCaja({
      det_id: v.det_id,
      linea_codigo: p.linea_codigo,
      referencia_codigo: p.referencia_codigo,
      material_code: v.material_code,
      color_code: v.color_code,
      color_nombre: v.descp_color,
      pp_id: ppIdPe,
      pp_nro: v.pp_nro,
      proforma: v.proforma,
      quincena_desc: v.quincena_desc,
      marca: p.descp_marca ?? '',
      marca_id: p.marca_id ?? null,
      caso: p.descp_caso ?? '',
      caso_id: p.caso_id ?? null,
      es_promo: p.es_promo === true,
      es_liquidacion: p.es_liquidacion === true,
      cadena_comercial: p.cadena_comercial ?? null,
      cod_grupo: p.cod_grupo ?? null,
      nombre: p.nombre,
      gradas_fmt: v.gradas_fmt,
      imagen_url: v.imagen_url,
      lista_precio_id: listaPrecioId,
      precio_base: precioVal as number,
      precio_lpn: v.lpn ?? 0,
      precio_lpc02: v.lpc02 ?? 0,
      precio_lpc03: precioLpc03Snap,
      precio_lpc04: precioLpc04Snap,
      cant_caja: resolveParesPorCaja({
        pares_por_caja: v.pares_por_caja,
        cantidad_cajas: v.cantidad_cajas,
        saldo_pares: v.saldo_pares,
        origen_tipo: p.origen_tipo,
        det_id: v.det_id,
        pp_id: v.pp_id,
      }),
      saldo_pares: v.saldo_pares ?? null,
      cajas_disponibles: maxCajas,
      origen_tipo: p.origen_tipo,
    })
  }

  const botonPlusColor = !activa ? '#CBD5E1' : !tienePrecio ? '#F1F5F9' : cajas >= maxCajas ? '#E2E8F0' : AZUL
  const botonPlusTxt = !activa ? 'white' : !tienePrecio ? '#CBD5E1' : cajas >= maxCajas ? '#94A3B8' : 'white'
  const paresLote = paresEnLote(p)
  const peLabel = etiquetaProntaEntregaCatalogo(p.linea_codigo, p.referencia_codigo, {
    liquidacion: esLiquidacionPe(p),
  })
  const panelBg = esPe
    ? 'rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-2'
    : 'rounded-xl border border-blue-200/80 bg-blue-50/45 p-2'

  return (
    <div className={stacked && !hideOrigenChip ? panelBg : undefined}>
      {!hideOrigenChip ? (
        <div className="mb-1.5 flex items-center justify-between gap-1">
          {esPe ? (
            <span
              className="inline-flex max-w-[75%] items-center gap-1 truncate rounded-lg border px-2 py-0.5 text-[10px] font-bold leading-tight"
              style={origenChipStyle(shell)}
              title={peLabel}
            >
              {peLabel}
            </span>
          ) : (
            <span
              className="inline-flex max-w-[75%] rounded-lg border border-blue-200/80 bg-white px-2 py-1"
              title={etiquetaDatoDuroCp(v.numero_preventa, v.quincena_desc)}
            >
              <DatoDuroCpFilas
                preventa={partesDatoDuroCp(v.numero_preventa, v.quincena_desc).preventa}
                quincena={partesDatoDuroCp(v.numero_preventa, v.quincena_desc).quincena}
                fallbackLabel="Compra previa"
              />
            </span>
          )}
          {stacked && paresLote > 0 ? (
            <span className="shrink-0 rounded-full bg-bazzar-naranja px-1.5 py-0.5 text-[9px] font-bold text-white">
              {Math.round(paresLote)} {uCorta}
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="mb-1 line-clamp-2 text-[10px] leading-snug text-slate-600">
        {p.descp_material} · {v.descp_color}
      </p>
      {v.gradas_fmt && !esConf ? (
        <p className="mb-2 font-mono text-[9px] font-bold text-slate-500">{v.gradas_fmt}</p>
      ) : (
        <div className="mb-2 min-h-[14px]" aria-hidden />
      )}

      {!esConf ? (
        <CatalogTonosFila
          variantes={variantesConStock.map(vv => ({
            det_id: vv.det_id,
            color_hex: vv.color_hex,
            tono_canon: vv.tono_canon,
            descp_color: vv.descp_color,
          }))}
          activeIdx={matchIdx}
          onSelect={idx => {
            const picked = variantesConStock[idx]
            if (!picked) return
            onSelectTonoKey(tonoKeyDeVariante(picked))
          }}
        />
      ) : coloresUnicos.length > 1 ? (
        <CatalogTonosFila
          variantes={coloresUnicos.map(vv => ({
            det_id: vv.det_id,
            color_hex: vv.color_hex,
            tono_canon: vv.tono_canon,
            descp_color: vv.descp_color,
          }))}
          activeIdx={Math.max(
            0,
            coloresUnicos.findIndex(vv => tonoKeyDeVariante(vv) === activeTonoKey),
          )}
          onSelect={idx => {
            const picked = coloresUnicos[idx]
            if (!picked) return
            onSelectTonoKey(tonoKeyDeVariante(picked))
          }}
        />
      ) : null}

      {esConf ? (
        <CatalogConfeccionesTallas
          lote={p}
          activa={activa}
          listaPrecioId={listaPrecioId}
          onNeedSession={onNeedSession}
          activeTonoKey={activeTonoKey}
        />
      ) : (
        <>
          {tienePrecio ? (
            <p className="mb-1 text-[11px] font-bold tabular-nums text-orange-600">
              {formatPrecioGs(precioVal as number)}
              <span className="text-[8px] font-normal text-slate-400"> / par</span>
            </p>
          ) : null}

          <div style={{ opacity: activa && !tienePrecio ? 0.55 : 1 }} className="mt-1">
            {!activa ? (
              <button
                type="button"
                onClick={onNeedSession}
                className="w-full rounded-lg bg-slate-900 py-1.5 text-[10px] font-bold text-white"
              >
                Activar venta
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { if (!tienePrecio) return; void quitarCaja(v.det_id) }}
                    disabled={!tienePrecio || cajas === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-bold disabled:opacity-40"
                    style={{ borderColor: cajas > 0 && tienePrecio ? AZUL : '#E2E8F0', color: cajas > 0 && tienePrecio ? AZUL : '#CBD5E1' }}
                  >−</button>
                  <div className="flex-1 text-center">
                    <p className="text-base font-black leading-none" style={{ color: tienePrecio ? AZUL : '#CBD5E1' }}>{cajas}</p>
                    <p className="text-[8px] text-slate-500">cajas</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAgregar}
                    disabled={!puedeAgregar}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-bold text-white disabled:opacity-40"
                    style={{ borderColor: botonPlusColor, backgroundColor: botonPlusColor, color: botonPlusTxt }}
                  >+</button>
                </div>
                {!tienePrecio && (
                  <p className="mt-1 text-center text-[8px] font-semibold text-amber-800">
                    {esPe ? 'Precio pendiente PE' : 'Precio pendiente PP'}
                  </p>
                )}
                {cajas > 0 && tienePrecio && (
                  <a href="/carrito" className="mt-1 block rounded-lg bg-emerald-500 py-1 text-center text-[10px] font-bold text-white">
                    En pedido ✅
                  </a>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
