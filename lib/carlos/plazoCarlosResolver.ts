/**
 * Traductor plazo → Cod. Oper. Carlos (Condiciones - Hector.xlsx col A).
 */
import canon from './condiciones-hector-canon.json'
import { compararPlazosCronologico } from './plazoOrdenUi'

export type PlazoCarlosCanon = {
  cod_oper_carlos: string
  dias_vto: string
  label_ui: string
  orden: number
  id_plazo?: number | null
}

export const PLAZO_CARLOS_FUENTE = canon.fuente

/** Catálogo Carlos · orden Excel (legacy). */
export const PLAZO_CARLOS_FILAS: PlazoCarlosCanon[] = [...canon.filas].sort(
  (a, b) => a.orden - b.orden,
)

/** UI venta — cronológico: contado → días corridos → escalonados. */
export const PLAZO_CARLOS_FILAS_CRONO: PlazoCarlosCanon[] = [...canon.filas].sort(
  compararPlazosCronologico,
)

const BY_COD = new Map(PLAZO_CARLOS_FILAS.map((r) => [r.cod_oper_carlos.toUpperCase(), r]))
const BY_ID_PLAZO = new Map(
  PLAZO_CARLOS_FILAS.filter((r) => r.id_plazo != null).map((r) => [Number(r.id_plazo), r]),
)

export function resolveCodOperCarlos(opts: {
  cod_oper_carlos?: string | null
  plazo_id?: number | string | null
  payload?: unknown
}): string | null {
  const c = String(opts.cod_oper_carlos ?? '').trim().toUpperCase()
  if (c && BY_COD.has(c)) return c

  const fromPayload = pickFromPayload(opts.payload)
  if (fromPayload) return fromPayload

  const pid = Number(opts.plazo_id)
  if (Number.isFinite(pid) && pid > 0) {
    const hit = BY_ID_PLAZO.get(pid)
    if (hit) return hit.cod_oper_carlos
  }
  return null
}

function pickFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const p = payload as Record<string, unknown>
  for (const k of ['cod_oper_carlos', 'cod_oper', 'cod_operacion']) {
    const s = String(p[k] ?? '').trim().toUpperCase()
    if (s && (BY_COD.has(s) || s.startsWith('CR'))) return s
  }
  return null
}

export function labelPlazoCarlos(cod: string): string {
  return BY_COD.get(cod.toUpperCase())?.label_ui ?? cod
}

/** Plazo para UI activación venta — catálogo Carlos completo. */
export type PlazoCarlosOpcion = PlazoCarlosCanon & {
  id_plazo: number | null
}

export function plazosCarlosParaUi(): PlazoCarlosOpcion[] {
  return PLAZO_CARLOS_FILAS_CRONO.map((r) => ({
    ...r,
    id_plazo: r.id_plazo ?? null,
  }))
}
