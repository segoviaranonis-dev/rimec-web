import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import {
  hasSidebarFilters,
  isColdWideOpenCatalogEntry,
} from '@/lib/catalogoFiltrosEntrada'
import {
  MIN_WARM_CARDS,
  type PageWarmPayload,
} from '@/lib/catalogoPeWarmCache'

export type StageAuditEntry = {
  stageId: string
  tarjetas: number
  hasMore: boolean
  wideOpen: boolean
  pass: boolean
  notes: string[]
}

export type CatalogIntegrityLedger = {
  entries: StageAuditEntry[]
  /** Suma tarjetas únicas por etapa (acumulador control). */
  acumuladoTarjetas: number
  todosTarjetas: number
  todosPass: boolean
  allPass: boolean
  warnings: string[]
}

export function auditWarmPayload(
  stageId: string,
  filters: CatalogoFilterState,
  payload: PageWarmPayload | null | undefined,
): StageAuditEntry {
  const wideOpen = isColdWideOpenCatalogEntry(filters)
  const tarjetas = payload?.tarjetas.length ?? 0
  const hasMore = Boolean(payload?.hasMore)
  const notes: string[] = []

  if (!wideOpen) notes.push('filtros no amplios en warm')
  if (tarjetas < MIN_WARM_CARDS) {
    notes.push(`tarjetas ${tarjetas} < mínimo ${MIN_WARM_CARDS}`)
  }
  if (!payload) notes.push('sin payload cache')

  const pass = Boolean(payload && wideOpen && tarjetas >= MIN_WARM_CARDS)

  return { stageId, tarjetas, hasMore, wideOpen, pass, notes }
}

export function buildIntegrityLedger(
  entries: StageAuditEntry[],
  todosPayload: PageWarmPayload | null | undefined,
): CatalogIntegrityLedger {
  const acumuladoTarjetas = entries.reduce((s, e) => s + e.tarjetas, 0)
  const todosTarjetas = todosPayload?.tarjetas.length ?? 0
  const todosPass = Boolean(todosPayload && todosTarjetas >= MIN_WARM_CARDS)
  const warnings: string[] = []

  for (const e of entries) {
    if (!e.pass) warnings.push(`${e.stageId}: ${e.notes.join(' · ') || 'FAIL'}`)
  }
  if (!todosPass) {
    warnings.push(
      `todos: tarjetas ${todosTarjetas} < mínimo ${MIN_WARM_CARDS} (grilla inicial incompleta)`,
    )
  }

  const allPass = entries.every((e) => e.pass) && todosPass

  return {
    entries,
    acumuladoTarjetas,
    todosTarjetas,
    todosPass,
    allPass,
    warnings,
  }
}

/** Re-export para diagnóstico DEV en grilla. */
export { hasSidebarFilters, isColdWideOpenCatalogEntry, MIN_WARM_CARDS }
