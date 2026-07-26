import type { StockRow } from '@/app/catalogo-types'

/** Depósitos legales PE importadora (paridad Report `RIMEC_SDRM_DEPOSIT_MAP`). */
export const RIMEC_PE_DEPOSITOS = [
  { codigo: 'D1' as const, label: 'D1 · piso' },
  { codigo: 'DEP2' as const, label: 'DEP2 · bodega' },
  { codigo: 'D3' as const, label: 'D3 · pronta' },
]

export type PeDepositoCodigo = (typeof RIMEC_PE_DEPOSITOS)[number]['codigo']
/** ACCESORIOS = categoría UI PE (carteras · accesorios · anteojos) — fuera grupo uno. */
export type PeRamoTipo = 'CALZADO' | 'CONFECCIONES' | 'ACCESORIOS'

export const PE_RAMO_CATEGORIA_LABEL: Record<PeRamoTipo, string> = {
  CALZADO: 'Calzado',
  CONFECCIONES: 'Confecciones',
  ACCESORIOS: 'Carteras y accesorios',
}

/** Heurística local hasta `tipo_v2_id` en vista (MIG-139). */
export function inferPeRamoTipo(row: Pick<StockRow, 'referencia_codigo' | 'linea_codigo' | 'marca_id' | 'nombre' | 'material_code'>): PeRamoTipo {
  const ref = String(row.referencia_codigo ?? '').trim().toUpperCase()
  if (ref === 'K') return 'CONFECCIONES'

  const mat = String(row.material_code ?? '').trim()
  if (mat.startsWith('638')) return 'CONFECCIONES'

  const linea = String(row.linea_codigo ?? '').trim()
  if (linea.startsWith('638')) return 'CONFECCIONES'

  const nombre = String(row.nombre ?? '').trim()
  if (nombre.startsWith('638.')) return 'CONFECCIONES'

  const marcaId = Number(row.marca_id ?? 0)
  if (marcaId >= 10 && marcaId <= 15) return 'CONFECCIONES'

  return 'CALZADO'
}
