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
import { syntheticPpIdForPe } from '@/lib/prontaEntregaVenta'
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
  esPe: boolean,
) {
  const v = line.variante
  const precioVal = line.precio
  const ppIdPe = esPe
    ? syntheticPpIdForPe({ deposito_id: v.deposito_id, proforma: v.proforma, pp_nro: v.pp_nro })
    : (v.pp_id ?? 0)
  const precioLpc03Snap = resolverLpc03(v.lpn ?? null, v.lpc03 ?? null, lote.descp_caso) ?? 0
  const precioLpc04Snap = resolverLpc04(v.lpn ?? null, v.lpc04 ?? null, lote.descp_caso) ?? 0

  return {
    det_id: v.det_id,
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

function BotonTalla({
  line,
  qty,
  onTap,
}: {
  line: TallaVentaLine
  qty: number
  onTap: () => void
}) {
  const agotado = qty >= line.stock
  const seleccionado = qty > 0
  return (
    <button
      type="button"
      title={line.gradas_fmt}
      disabled={agotado}
      onClick={onTap}
      className={`flex h-[1.625rem] min-w-[1.625rem] flex-1 flex-col items-center justify-center rounded border px-0.5 text-center transition active:scale-95 disabled:opacity-35 ${
        seleccionado
          ? 'border-rimec-azul bg-rimec-azul text-white'
          : 'border-slate-200/90 bg-white text-slate-800 hover:border-rimec-azul/40'
      }`}
    >
      <span className="text-[9px] font-black leading-none">{line.talle}</span>
      <span
        className={`mt-px text-[6px] font-semibold leading-none tabular-nums ${
          seleccionado ? 'text-white/80' : 'text-slate-400'
        }`}
      >
        {seleccionado ? `${qty}/${line.stock}` : line.stock}
      </span>
    </button>
  )
}

function FilaTallas({
  tallas,
  carrito,
  onTap,
}: {
  tallas: TallaVentaLine[]
  carrito: Record<string, { cajas?: number }>
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
  const esPe = lote.origen_tipo === 'PRONTA_ENTREGA'

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

  const handleTap = (line: TallaVentaLine) => {
    if (!activa) {
      onNeedSession()
      return
    }
    const key = `det_${line.det_id}`
    const qty = carrito[key]?.cajas ?? 0
    if (qty >= line.stock) return
    void agregarCaja(buildCartItem(lote, line, listaPrecioId, esPe))
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
              <FilaTallas tallas={fila1} carrito={carrito} onTap={handleTap} />
              <FilaTallas tallas={fila2} carrito={carrito} onTap={handleTap} />
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
