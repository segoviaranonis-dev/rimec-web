/**
 * Etapas visibles «RIMEC sincronizando» — warm CP → PE → Confecciones → Todos.
 * Promesa UX (CHUSAR 2.2.1.15): mínimo ~30 s · preview con fotos · % por tiempo.
 */
import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import {
  mergeMarqueeTarjetas,
  priorizarTarjetasConImagen,
} from '@/lib/catalogoSyncPreview'
import {
  auditWarmPayload,
  buildIntegrityLedger,
  type CatalogIntegrityLedger,
} from '@/lib/catalogoIntegrityAudit'
import {
  CARD_PAGE_LIMIT,
  CP_DEFAULT_FILTERS,
  catalogWarmCacheKey,
  effectiveCpWarmFilters,
  effectivePeWarmFilters,
  effectiveTodosWarmFilters,
  getPageWarmCache,
  isCatalogWarmEnough,
  prefetchCatalogPage,
  warmCatalogImages,
} from '@/lib/catalogoPeWarmCache'
import type { TarjetaGrilla } from '@/lib/fusionTarjetasCatalogo'

export type CatalogSyncStageId = 'cp' | 'pe' | 'confecciones' | 'todos'

export type CatalogSyncStageDef = {
  id: CatalogSyncStageId
  labelActive: string
  labelDone: string
  accent: string
  glow: string
  tint: string
  filters: () => CatalogoFilterState
  withFiltros: boolean
  /** Etapa obligatoria para cerrar overlay (grilla inicial). */
  requiredForGate: boolean
}

/** PE Confecciones — 30 primeras prendas 638. */
export const PE_CONFECCIONES_FILTERS: CatalogoFilterState = {
  ...CP_DEFAULT_FILTERS,
  origen_tipo: 'PRONTA_ENTREGA',
  ramo_tipo: 'CONFECCIONES',
}

/** CP Confecciones — warm paralelo (mismo ramo, stock tránsito). */
export const CP_CONFECCIONES_FILTERS: CatalogoFilterState = {
  ...CP_DEFAULT_FILTERS,
  origen_tipo: 'CP',
  ramo_tipo: 'CONFECCIONES',
}

export const CATALOG_SYNC_STAGES: CatalogSyncStageDef[] = [
  {
    id: 'cp',
    labelActive: 'Sincronizando compra previa',
    labelDone: 'Compra previa sincronizada',
    accent: '#0EA5E9',
    tint: 'rgba(224, 242, 254, 0.72)',
    glow: 'rgba(14, 165, 233, 0.35)',
    filters: () => ({ ...effectiveCpWarmFilters(), origen_tipo: 'CP', ramo_tipo: 'CALZADO' }),
    withFiltros: false,
    requiredForGate: false,
  },
  {
    id: 'pe',
    labelActive: 'Sincronizando pronta entrega (calzado)',
    labelDone: 'Pronta entrega calzado sincronizada',
    accent: '#10B981',
    tint: 'rgba(209, 250, 229, 0.72)',
    glow: 'rgba(16, 185, 129, 0.35)',
    filters: () => ({ ...effectivePeWarmFilters(), ramo_tipo: 'CALZADO' }),
    withFiltros: false,
    requiredForGate: false,
  },
  {
    id: 'confecciones',
    labelActive: 'Sincronizando confecciones',
    labelDone: 'Confecciones sincronizadas',
    accent: '#F97316',
    tint: 'rgba(255, 237, 213, 0.72)',
    glow: 'rgba(249, 115, 22, 0.35)',
    filters: () => PE_CONFECCIONES_FILTERS,
    withFiltros: false,
    requiredForGate: false,
  },
  {
    id: 'todos',
    labelActive: 'Verificando grilla completa (Todos)',
    labelDone: 'Grilla completa verificada',
    accent: '#6366F1',
    tint: 'rgba(224, 231, 255, 0.72)',
    glow: 'rgba(99, 102, 241, 0.35)',
    filters: effectiveTodosWarmFilters,
    withFiltros: true,
    requiredForGate: true,
  },
]

export type CatalogSyncProgress = {
  stageIndex: number
  stage: CatalogSyncStageDef
  phase: 'start' | 'done'
  completedIds: CatalogSyncStageId[]
  previewTarjetas?: TarjetaGrilla[]
  marqueeTarjetas?: TarjetaGrilla[]
  /** Ledger acumulador — control bancario por etapa. */
  audit?: CatalogIntegrityLedger
}

export const CATALOG_SYNC_PREVIEW_LIMIT = 12
export const CATALOG_SYNC_GRID_SLOTS = 9

/** CHUSAR 2.2.1.15 — mínimo 30 s aunque el cache responda antes. */
export const CATALOG_SYNC_MIN_TOTAL_MS = 30_000

/** Prod: overlay warm. Local: activar con NEXT_PUBLIC_CATALOG_SYNC_OVERLAY=1. */
export function isCatalogSyncOverlayEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_CATALOG_SYNC_OVERLAY === '1') return true
  return process.env.NODE_ENV === 'production'
}

const STAGE_MIN_MS = Math.ceil(CATALOG_SYNC_MIN_TOTAL_MS / CATALOG_SYNC_STAGES.length)

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitStageMin(stageStartMs: number): Promise<void> {
  await delay(Math.max(0, STAGE_MIN_MS - (Date.now() - stageStartMs)))
}

function stagePreviewTarjetas(stage: CatalogSyncStageDef): TarjetaGrilla[] {
  const cache = getPageWarmCache(catalogWarmCacheKey(stage.filters()))
  return priorizarTarjetasConImagen(cache?.tarjetas ?? [], CATALOG_SYNC_GRID_SLOTS)
}

export function isStageWarm(stage: CatalogSyncStageDef): boolean {
  return isCatalogWarmEnough(getPageWarmCache(catalogWarmCacheKey(stage.filters())))
}

/** true si las etapas visibles + Todos ya están en cache — omitir overlay. */
export function areAllSyncStagesWarm(): boolean {
  return CATALOG_SYNC_STAGES.every(isStageWarm)
}

const MAX_GATE_RETRIES = 3

async function warmStageWithRetry(stage: CatalogSyncStageDef): Promise<void> {
  for (let i = 0; i < MAX_GATE_RETRIES; i++) {
    if (isStageWarm(stage)) return

    await prefetchCatalogPage(stage.filters(), {
      withFiltros: stage.withFiltros,
      force: i > 0,
      maxAttempts: 3,
    }).catch(() => undefined)

    // Confecciones: también CP confecciones (≥30) para cambio de pill ~3 s.
    if (stage.id === 'confecciones') {
      await prefetchCatalogPage(CP_CONFECCIONES_FILTERS, {
        withFiltros: false,
        force: i > 0,
        maxAttempts: 2,
      }).catch(() => undefined)
    }

    if (isStageWarm(stage)) return
    await delay(300 * (i + 1))
  }
}

function emitPreviewFromCache(
  stage: CatalogSyncStageDef,
  marqueeTarjetas: TarjetaGrilla[],
): { preview: TarjetaGrilla[]; marquee: TarjetaGrilla[] } {
  const payload = getPageWarmCache(catalogWarmCacheKey(stage.filters()))
  if (payload?.tarjetas.length) {
    warmCatalogImages(payload.tarjetas, CARD_PAGE_LIMIT)
  }
  const preview = stagePreviewTarjetas(stage)
  if (preview.length > 0) {
    warmCatalogImages(preview, CATALOG_SYNC_GRID_SLOTS)
    return {
      preview,
      marquee: mergeMarqueeTarjetas(marqueeTarjetas, preview),
    }
  }
  return { preview, marquee: marqueeTarjetas }
}

export async function runCatalogSyncStages(
  onProgress: (p: CatalogSyncProgress) => void,
): Promise<CatalogIntegrityLedger> {
  const completedIds: CatalogSyncStageId[] = []
  const auditEntries: ReturnType<typeof auditWarmPayload>[] = []
  const runStartMs = Date.now()
  let marqueeTarjetas: TarjetaGrilla[] = []

  // Warm en paralelo — el overlay recorre etapas a ritmo fijo (~7.5 s c/u).
  const stageWarmTasks = CATALOG_SYNC_STAGES.map((stage) => warmStageWithRetry(stage))

  const emit = (
    partial: Omit<CatalogSyncProgress, 'audit'> & { audit?: CatalogIntegrityLedger },
  ) => {
    onProgress({ ...partial, audit: partial.audit })
  }

  for (let i = 0; i < CATALOG_SYNC_STAGES.length; i++) {
    const stageStartMs = Date.now()
    const stage = CATALOG_SYNC_STAGES[i]

    emit({
      stageIndex: i,
      stage,
      phase: 'start',
      completedIds: [...completedIds],
      marqueeTarjetas: [...marqueeTarjetas],
      audit: buildIntegrityLedger(
        auditEntries,
        getPageWarmCache(catalogWarmCacheKey(effectiveTodosWarmFilters())),
      ),
    })

    await stageWarmTasks[i]
    if (!isStageWarm(stage)) {
      await warmStageWithRetry(stage)
    }

    const payload = getPageWarmCache(catalogWarmCacheKey(stage.filters()))
    auditEntries.push(auditWarmPayload(stage.id, stage.filters(), payload))

    const mid = emitPreviewFromCache(stage, marqueeTarjetas)
    marqueeTarjetas = mid.marquee
    if (mid.preview.length > 0) {
      emit({
        stageIndex: i,
        stage,
        phase: 'start',
        completedIds: [...completedIds],
        previewTarjetas: mid.preview,
        marqueeTarjetas: [...marqueeTarjetas],
        audit: buildIntegrityLedger(
          auditEntries,
          getPageWarmCache(catalogWarmCacheKey(effectiveTodosWarmFilters())),
        ),
      })
    }

    // Siempre respetar cupo de etapa — da tiempo a ver fotos (no atajo 350 ms).
    await waitStageMin(stageStartMs)

    completedIds.push(stage.id)
    const done = emitPreviewFromCache(stage, marqueeTarjetas)
    marqueeTarjetas = done.marquee

    emit({
      stageIndex: i,
      stage,
      phase: 'done',
      completedIds: [...completedIds],
      previewTarjetas: done.preview,
      marqueeTarjetas: [...marqueeTarjetas],
      audit: buildIntegrityLedger(
        auditEntries,
        getPageWarmCache(catalogWarmCacheKey(effectiveTodosWarmFilters())),
      ),
    })
  }

  await delay(Math.max(0, CATALOG_SYNC_MIN_TOTAL_MS - (Date.now() - runStartMs)))

  const todosStage = CATALOG_SYNC_STAGES.find((s) => s.id === 'todos')!
  if (!isStageWarm(todosStage)) {
    await warmStageWithRetry(todosStage)
  }

  const finalLedger = buildIntegrityLedger(
    auditEntries,
    getPageWarmCache(catalogWarmCacheKey(effectiveTodosWarmFilters())),
  )

  emit({
    stageIndex: CATALOG_SYNC_STAGES.length - 1,
    stage: todosStage,
    phase: 'done',
    completedIds: [...completedIds],
    previewTarjetas: stagePreviewTarjetas(todosStage),
    marqueeTarjetas: [...marqueeTarjetas],
    audit: finalLedger,
  })

  return finalLedger
}
