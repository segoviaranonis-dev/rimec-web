import {
  parseTonoCanon,
  tonoCircleStyle,
  tonoSolido,
  type TonoCanon,
} from '@/lib/pilares/color-canon'

export type VarianteTonoInput = {
  color_hex?: string | null
  tono_canon?: unknown
  descp_color?: string | null
}

export function tonoFromVariante(v: VarianteTonoInput): {
  tono: TonoCanon | null
  style: ReturnType<typeof tonoCircleStyle>
  title: string
} {
  const parsed = parseTonoCanon(v.tono_canon)
  if (parsed) {
    return {
      tono: parsed,
      style: tonoCircleStyle(parsed),
      title: `${parsed.etiqueta}${v.descp_color ? ` · ${v.descp_color}` : ''}`,
    }
  }

  const hex = v.color_hex?.trim()
  if (hex && /^#[0-9a-fA-F]{3,8}$/.test(hex)) {
    const t = tonoSolido(v.descp_color?.trim() || 'Color', hex)
    return {
      tono: t,
      style: tonoCircleStyle(t),
      title: `${t.etiqueta}${v.descp_color ? ` · ${v.descp_color}` : ''}`,
    }
  }

  return {
    tono: null,
    style: tonoCircleStyle(null),
    title: v.descp_color?.trim() || 'Sin tono — asignar en administrador de color',
  }
}
