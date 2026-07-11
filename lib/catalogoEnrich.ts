import type { StockRow } from '@/app/catalogo-types'
import { cargarMetaLineasDesdePilar, enriquecerMetaConLinea } from './atributosLinea'
import { supabase } from './supabase'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** tono_canon desde pilar color (v_stock_rimec aún sin columna expuesta). */
async function cargarTonoCanonPorCodigos(codes: string[]): Promise<Map<string, unknown>> {
  const uniq = [...new Set(codes.map(c => String(c).trim()).filter(Boolean))]
  const out = new Map<string, unknown>()
  if (!uniq.length) return out

  for (const batch of chunk(uniq, 200)) {
    const nums = batch.map(Number).filter(n => Number.isFinite(n))
    if (!nums.length) continue

    const { data, error } = await supabase
      .from('color')
      .select('codigo_proveedor, tono_canon')
      .in('codigo_proveedor', nums)

    if (error) {
      console.error('[catalogoEnrich] color tono:', error.message)
      continue
    }

    for (const row of data ?? []) {
      const cod = String(row.codigo_proveedor ?? '').trim()
      if (cod && row.tono_canon) out.set(cod, row.tono_canon)
    }
  }

  return out
}

/** Género (línea) + tono_canon (color) — CABECERA DE FILTROS. */
export async function enrichCatalogoRows(rows: StockRow[]): Promise<StockRow[]> {
  if (!rows.length) return rows

  const lineaIds = [...new Set(rows.map(r => Number(r.linea_id)).filter(id => id > 0))]
  const lineas = await cargarMetaLineasDesdePilar(lineaIds)
  let enriched = enriquecerMetaConLinea(rows, lineas)

  const tonoMap = await cargarTonoCanonPorCodigos(enriched.map(r => String(r.color_code ?? '')))
  if (!tonoMap.size) return enriched

  return enriched.map(row => {
    const cod = String(row.color_code ?? '').trim()
    const tono = tonoMap.get(cod)
    return tono ? { ...row, color_tono_canon: tono } : row
  })
}
