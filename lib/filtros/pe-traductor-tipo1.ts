/**
 * Traductor PE Tipo 1 — Stock valorizado Carlos → pilares Nexus.
 * Paridad Report `pe-traductor-tipo1.ts`.
 */
import seed from '@/lib/filtros/pe-traductor-tipo1.seed.json'
import { canonPeTipo1Valorizado } from '@/lib/filtros/pe-valorizado-tipo1'

export type PeTraductorTipo1Entry = {
  cod_art_carlos: string
  codigo_barras: string
  proveedor_id: number
  linea: string
  referencia: string
  tipo0: string
  tipo1_excel: string
  tipo1_canon: string
  filtro_ab_cr: 'CARTERAS' | 'ANTEOJOS' | 'ACT ROPAS' | null
  marca: string
  descripcion: string
}

export const PE_TRADUCTOR_TIPO1_ARTICULOS: readonly PeTraductorTipo1Entry[] = (
  seed as { articulos: PeTraductorTipo1Entry[] }
).articulos.map((a) => ({
  ...a,
  tipo1_canon: canonPeTipo1Valorizado(a.tipo1_excel),
  filtro_ab_cr: (a.filtro_ab_cr ?? null) as PeTraductorTipo1Entry['filtro_ab_cr'],
}))

const BY_BARRAS = new Map<string, PeTraductorTipo1Entry>()
const BY_LR = new Map<string, PeTraductorTipo1Entry>()

for (const a of PE_TRADUCTOR_TIPO1_ARTICULOS) {
  BY_BARRAS.set(normBarras(a.codigo_barras), a)
  BY_LR.set(lrKey(a.proveedor_id, a.linea, a.referencia), a)
}

export function normBarras(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim().replace(/\s+/g, '')
  if (!s) return ''
  if (s.includes('-')) {
    const [p, q] = s.split('-', 2)
    if (p && q) return `${p}.${q}`
  }
  return s.replace(',', '.')
}

function lrKey(proveedorId: number, linea: string, ref: string): string {
  return `${proveedorId}:${String(linea).trim()}:${String(ref ?? '0').trim()}`
}

export function lookupPeTraductorByBarras(
  codigo_barras: string | null | undefined,
): PeTraductorTipo1Entry | null {
  const k = normBarras(codigo_barras)
  return k ? (BY_BARRAS.get(k) ?? null) : null
}

export function lookupPeTraductorByLineaRef(
  proveedor_id: number | null | undefined,
  linea: string | null | undefined,
  referencia: string | null | undefined,
): PeTraductorTipo1Entry | null {
  if (!proveedor_id || !linea) return null
  return BY_LR.get(lrKey(proveedor_id, linea, referencia ?? '0')) ?? null
}

/** Subtipo AB-CR desde traductor (ANTEOJOS → clave LENTES). */
export function subtipoAbcrDesdeTraductor(entry: PeTraductorTipo1Entry): 'CARTERAS' | 'LENTES' | null {
  if (entry.filtro_ab_cr === 'ANTEOJOS' || entry.tipo1_canon === 'LENTES') return 'LENTES'
  if (entry.filtro_ab_cr === 'CARTERAS' || entry.tipo1_canon === 'CARTERAS') return 'CARTERAS'
  return null
}
