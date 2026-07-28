'use client'

import { useMemo } from 'react'
import type { TarjetaCatalogo } from '@/lib/agruparTarjetasCatalogo'
import type { ListaId } from '@/store/sesionVenta'
import { useSesion } from '@/store/sesionVenta'
import { formatPrecioGs } from '@/lib/formatPrecioGs'
import {
  agruparTallasPorPrecio,
  coloresUnicosEnLote,
  prendasDisponiblesVariante,
  type TallaVentaLine,
  variantesPorColor,
} from '@/lib/confeccionesCatalogo'
import { etiquetaTalleDesdeGrada } from '@/lib/gradaAbierta638'
import { syntheticPpIdForPe, isProntaEntregaStockRow } from '@/lib/prontaEntregaVenta'
import { resolverLpc03, resolverLpc04 } from '@/lib/precioLista'

type Props = {
  lote: TarjetaCatalogo
  activa: boolean
  listaPrecioId: ListaId
  onNeedSession: () => void
  /** Solo si hay >1 color real en la tarjeta */
  activeTonoKey?: string
}

function buildCartItem(
  lote: TarjetaCatalogo,
  line: TallaVentaLine,
  listaPrecioId: ListaId,
) {
  const v = line.variante
  const precioVal = line.precio
  const esPe = isProntaEntregaStockRow({
    det_id: v.det_id,
    origen_tipo: lote.origen_tipo,
    pp_id: v.pp_id,
  })
  const ppIdPe = esPe
    ? syntheticPpIdForPe({ deposito_id: v.deposito_id, proforma: v.proforma, pp_nro: v.pp_nro })
    : (v.pp_id ?? 0)
  const precioLpc03Snap = resolverLpc03(v.lpn ?? null, v.lpc03 ?? null, lote.descp_caso) ?? 0
  const precioLpc04Snap = resolverLpc04(v.lpn ?? null, v.lpc04 ?? null, lote.descp_caso) ?? 0

  return {
    det_id: Number(v.det_id),
    linea_codigo: lote.linea_codigo,
    referencia_codigo: lote.referencia_codigo,
    material_code: v.material_code,
    color_code: v.color_code,
    color_nombre: v.descp_color,
    pp_id: ppIdPe,
    pp_nro: v.pp_nro,
    proforma: v.proforma,
    quincena_desc: v.quincena_desc,
    marca: lote.descp_marca ?? '',
    marca_id: lote.marca_id ?? null,
    caso: lote.descp_caso ?? '',
    caso_id: lote.caso_id ?? null,
    es_promo: lote.es_promo === true,
    es_liquidacion: lote.es_liquidacion === true,
    cadena_comercial: lote.cadena_comercial ?? null,
    cod_grupo: lote.cod_grupo ?? null,
    nombre: lote.nombre,
    gradas_fmt: v.gradas_fmt,
    imagen_url: v.imagen_url,
    lista_precio_id: listaPrecioId,
    precio_base: precioVal,
    precio_lpn: v.lpn ?? 0,
    precio_lpc02: v.lpc02 ?? 0,
    precio_lpc03: precioLpc03Snap,
    precio_lpc04: precioLpc04Snap,
    cant_caja: 1,
    saldo_pares: v.saldo_pares ?? null,
    cajas_disponibles: line.stock,
    origen_tipo: lote.origen_tipo,
    tipo_v2_id: lote.tipo_v2_id ?? 2,
    ramo_tipo: 'CONFECCIONES' as const,
  }
}

function splitDosFilas<T>(items: T[]): [T[], T[]] {
  if (items.length <= 2) return [items, []]
  const mid = Math.ceil(items.length / 2)
  return [items.slice(0, mid), items.slice(mid)]
}

function etiquetaTallePrefijo(talle: string): string {
  const t = String(talle ?? '').trim()
  if (!t || t === '—') return 'T ?'
  return `T ${t}`
}

/** 638 — un toque: 0→1→…→máx→0. Sin +/- (poco espacio en tarjeta). */
function BotonTalla({
  line,
  qty,
  activa,
  onTap,
}: {
  line: TallaVentaLine
  qty: number
  activa: boolean
  onTap: () => void
}) {
  const sinStock = line.stock <= 0
  const seleccionado = qty > 0
  const prefijo = etiquetaTallePrefijo(line.talle)
  const enMax = qty >= line.stock && line.stock > 0

  return (
    <button
      type="button"
      title={
        seleccionado
          ? `${prefijo}: ${qty} · toque otra vez ${enMax ? '→ vaciar' : '→ +1'}`
          : `${line.gradas_fmt} · ${line.stock} disp. · toque para pedir`
      }
      disabled={sinStock && activa}
      onClick={onTap}
      className={`flex h-[1.75rem] min-w-[2.75rem] flex-1 flex-col items-center justify-center rounded border px-0.5 text-center transition active:scale-95 disabled:opacity-35 ${
        seleccionado
          ? 'border-rimec-azul bg-rimec-azul text-white shadow-sm'
          : 'border-slate-200/90 bg-slate-50 text-slate-600 hover:border-slate-300'
      }`}
    >
      {seleccionado ? (
        <span className="whitespace-nowrap text-[8px] font-black tabular-nums leading-none">
          {prefijo}: {qty}
        </span>
      ) : (
        <>
          <span className="whitespace-nowrap text-[8px] font-black leading-none text-slate-700">{prefijo}</span>
          <span className="mt-px text-[6px] font-semibold leading-none tabular-nums text-slate-400">
            {line.stock}
          </span>
        </>
      )}
    </button>
  )
}

function FilaTallas({
  tallas,
  carrito,
  activa,
  onTap,
}: {
  tallas: TallaVentaLine[]
  carrito: Record<string, { cajas?: number }>
  activa: boolean
  onTap: (line: TallaVentaLine) => void
}) {
  if (tallas.length === 0) return null
  return (
    <div className="flex justify-center gap-0.5">
      {tallas.map(line => (
        <BotonTalla
          key={line.det_id}
          line={line}
          qty={carrito[`det_${line.det_id}`]?.cajas ?? 0}
          activa={activa}
          onTap={() => onTap(line)}
        />
      ))}
    </div>
  )
}

export function CatalogConfeccionesTallas({
  lote,
  activa,
  listaPrecioId,
  onNeedSession,
  activeTonoKey,
}: Props) {
  const carrito = useSesion(s => s.carrito)
  const agregarCaja = useSesion(s => s.agregarCaja)
  const setCajas = useSesion(s => s.setCajas)
  const esPe = isProntaEntregaStockRow({
    det_id: lote.variantes[0]?.det_id,
    origen_tipo: lote.origen_tipo,
    pp_id: lote.variantes[0]?.pp_id,
  })

  const colores = useMemo(() => coloresUnicosEnLote(lote), [lote])
  const tonoKey = activeTonoKey && colores.includes(activeTonoKey) ? activeTonoKey : colores[0] ?? ''

  const variantesTalla = useMemo(() => {
    if (colores.length <= 1) {
      return lote.variantes.filter(v => v.cajas_disponibles > 0)
    }
    return variantesPorColor(lote, tonoKey)
  }, [lote, colores.length, tonoKey])

  // Grupos por precio solo para venta activa. Sin sesión: tallas visibles, precio oculto (4.01.04.001).
  const grupos = useMemo(
    () => agruparTallasPorPrecio(variantesTalla, lote, listaPrecioId),
    [variantesTalla, lote, listaPrecioId],
  )

  /** Pre-activación: una sola banda (sin filas por precio = sin fuga por tipología de Gs.). */
  const gruposUi = useMemo(() => {
    if (activa) return grupos
    const tallas = grupos.flatMap((g) => g.tallas)
    if (tallas.length === 0) {
      // Aún sin precio en BD: mostrar tallas crudas por stock (sin Gs.)
      return variantesTalla.length
        ? [
            {
              precio: 0,
              tallas: variantesTalla.map((v) => ({
                det_id: v.det_id,
                talle: etiquetaTalleDesdeGrada(v.gradas_fmt),
                stock: prendasDisponiblesVariante(v),
                gradas_fmt: v.gradas_fmt,
                precio: 0,
                variante: v,
              })),
            },
          ]
        : []
    }
    return [{ precio: 0, tallas }]
  }, [activa, grupos, variantesTalla])

  const detIdsColor = useMemo(
    () => new Set(variantesTalla.map(v => v.det_id)),
    [variantesTalla],
  )

  const handleTapTalla = (line: TallaVentaLine) => {
    if (!activa) {
      onNeedSession()
      return
    }
    if (line.stock <= 0) return
    const key = `det_${line.det_id}`
    const qty = carrito[key]?.cajas ?? 0
    if (qty >= line.stock) {
      void setCajas(line.det_id, 0)
      return
    }
    void agregarCaja(buildCartItem(lote, line, listaPrecioId))
  }

  if (gruposUi.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-center text-[9px] font-semibold text-amber-800">
          {activa
            ? esPe
              ? 'Precio pendiente PE'
              : 'Sin tallas con precio'
            : 'Sin tallas con stock'}
        </p>
        {!activa ? (
          <button
            type="button"
            onClick={onNeedSession}
            className="w-full rounded-lg bg-slate-900 py-1.5 text-[10px] font-bold text-white"
          >
            Activar venta
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {!activa ? (
        <button
          type="button"
          onClick={onNeedSession}
          className="w-full rounded-lg bg-slate-900 py-1 text-[9px] font-bold text-white"
        >
          Activar venta para ver precios
        </button>
      ) : null}
      {gruposUi.map((grupo, idx) => {
        const [fila1, fila2] = splitDosFilas(grupo.tallas)
        return (
          <div
            key={activa ? `p-${grupo.precio}` : `pre-${idx}`}
            className="rounded-md border border-violet-200/70 bg-violet-50/30 px-1 py-1"
          >
            {activa && grupo.precio > 0 ? (
              <p className="mb-0.5 text-center text-[8px] font-bold tabular-nums leading-tight text-orange-600">
                {formatPrecioGs(grupo.precio)}
                <span className="font-normal text-slate-400"> /p</span>
              </p>
            ) : null}
            <div className="flex flex-col gap-0.5">
              <FilaTallas tallas={fila1} carrito={carrito} activa={activa} onTap={handleTapTalla} />
              <FilaTallas tallas={fila2} carrito={carrito} activa={activa} onTap={handleTapTalla} />
            </div>
          </div>
        )
      })}
      {activa && Object.values(carrito).some(i => detIdsColor.has(i.det_id)) ? (
        <a
          href="/carrito"
          className="mt-0.5 block rounded-lg bg-emerald-500 py-1 text-center text-[10px] font-bold text-white"
        >
          En pedido ✅
        </a>
      ) : null}
    </div>
  )
}
