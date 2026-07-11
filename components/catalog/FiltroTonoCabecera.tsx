'use client'

import { tonoCircleStyle } from '@/lib/pilares/color-canon'
import { estandarToTono, type ColorEstandar } from '@/lib/pilares/colores-estandar'

type Props = {
  catalogo: ColorEstandar[]
  tonosSel: string[]
  sinTono: boolean
  onChange: (tonos: string[], sinTono: boolean) => void
}

/** Fila TONO — CABECERA DE FILTROS (círculos canónicos + Sin asignar). */
export function FiltroTonoCabecera({ catalogo, tonosSel, sinTono, onChange }: Props) {
  const todos = tonosSel.length === 0 && !sinTono

  function toggleEtiqueta(etiqueta: string) {
    if (etiqueta === '__sin__') {
      onChange([], !sinTono)
      return
    }
    const hit = tonosSel.includes(etiqueta)
    const next = hit ? tonosSel.filter(t => t !== etiqueta) : [...tonosSel, etiqueta]
    onChange(next, false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        title="Todos los tonos"
        aria-pressed={todos}
        onClick={() => onChange([], false)}
        className={[
          'shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
          todos ? 'border-orange-600 ring-2 ring-orange-200' : 'border-slate-300 opacity-70 hover:opacity-100',
        ].join(' ')}
      >
        <span className="w-5 h-5 rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] block" />
      </button>

      <button
        type="button"
        onClick={() => toggleEtiqueta('__sin__')}
        aria-pressed={sinTono}
        className={[
          'rounded-full border-2 px-3 py-1 text-[11px] font-bold transition',
          sinTono
            ? 'border-orange-600 bg-orange-600 text-white'
            : 'border-slate-300 bg-white text-slate-600 hover:border-orange-300',
        ].join(' ')}
      >
        Sin asignar
      </button>

      {catalogo.map(c => {
        const active = tonosSel.includes(c.etiqueta)
        const style = tonoCircleStyle(estandarToTono(c))
        return (
          <button
            key={c.etiqueta}
            type="button"
            title={c.etiqueta}
            aria-pressed={active}
            onClick={() => toggleEtiqueta(c.etiqueta)}
            className={[
              'shrink-0 w-8 h-8 rounded-full border-2 transition-all',
              active ? 'border-orange-600 ring-2 ring-orange-200 scale-95' : 'border-slate-300 hover:scale-110',
            ].join(' ')}
            style={style}
          />
        )
      })}
    </div>
  )
}
