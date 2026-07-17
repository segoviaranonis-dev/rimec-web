'use client'

import { tonoCircleStyle } from '@/lib/pilares/color-canon'
import { estandarToTono, type ColorEstandar } from '@/lib/pilares/colores-estandar'

type Props = {
  catalogo: ColorEstandar[]
  tonosSel: string[]
  sinTono: boolean
  onChange: (tonos: string[], sinTono: boolean) => void
  /** Sin scale/ring — cabecera minimal */
  compact?: boolean
}

/** Fila TONO — círculos canónicos + Sin asignar. */
export function FiltroTonoCabecera({ catalogo, tonosSel, sinTono, onChange, compact = false }: Props) {
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
    <div className="flex min-w-max items-center gap-2">
      <button
        type="button"
        title="Todos los tonos"
        aria-pressed={todos}
        onClick={() => onChange([], false)}
        className={[
          'shrink-0 h-7 w-7 rounded-full border flex items-center justify-center',
          todos ? 'border-slate-800' : 'border-slate-300 opacity-70 hover:opacity-100',
        ].join(' ')}
      >
        <span className="block h-4 w-4 rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
      </button>

      <button
        type="button"
        onClick={() => toggleEtiqueta('__sin__')}
        aria-pressed={sinTono}
        className={[
          'shrink-0 rounded border px-2.5 py-1 text-[11px] font-semibold',
          sinTono
            ? 'border-slate-800 bg-slate-800 text-white'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-500',
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
              'shrink-0 h-7 w-7 rounded-full border',
              active ? 'border-slate-800 ring-1 ring-slate-400' : 'border-slate-300',
              compact ? '' : '',
            ].join(' ')}
            style={style}
          />
        )
      })}
    </div>
  )
}
