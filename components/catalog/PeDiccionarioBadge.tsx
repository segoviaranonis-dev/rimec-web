'use client'

import { useEffect, useState } from 'react'
import {
  cadenaPeNorm,
  descuentoD1PeClient,
  etiquetaCadenaPeUi,
  warmPeDiccionarioClient,
} from '@/lib/peDiccionarioClient'

type Props = {
  cadena_comercial?: string | null
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
  className?: string
}

/** Badge PE — solo cadena. D1 % = comisión (no imprimir como descuento). */
export function PeDiccionarioBadge({
  cadena_comercial,
  es_liquidacion,
  es_promo,
  className = '',
}: Props) {
  const [, tick] = useState(0)

  useEffect(() => {
    void warmPeDiccionarioClient().then(() => tick((n) => n + 1))
  }, [])

  let cadena = cadenaPeNorm(cadena_comercial)
  if (es_liquidacion) cadena = 'LIQUIDACION'
  else if (es_promo && cadena === 'REGULAR') cadena = 'PROMOCIONAL'
  const comisionPct = descuentoD1PeClient({ cadena_comercial: cadena, es_liquidacion, es_promo })
  const etiqueta = etiquetaCadenaPeUi(cadena)

  const tone =
    cadena === 'LIQUIDACION'
      ? 'border-emerald-500 bg-emerald-600 text-white catalog-card-liquidacion-pulse'
      : cadena === 'PROMOCIONAL'
        ? 'border-amber-500 bg-amber-500 text-white'
        : 'border-slate-600 bg-slate-700 text-white'

  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase leading-tight shadow ${tone} ${className}`}
      title={`DICCIONARIO PE · comisión D1 ${comisionPct}% (no descuento comercial)`}
    >
      {etiqueta}
    </span>
  )
}
