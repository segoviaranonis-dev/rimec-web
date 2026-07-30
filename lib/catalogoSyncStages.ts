/**
 * Etapas visibles «RIMEC sincronizando» — warm CP → PE → Confecciones → Todos.
 * Hotfix 2026-07-28: mínimo ~5 s · seed con force · cierra al tener Todos warm.
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
    filters: () => ({ ...effectiveCpWarmFilters(), ramo_tipo: 'CALZADO' }),
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

/** Hotfix login: no castigar al vendedor con 30 s teatrales si el warm ya respondió. */
export const CATALOG_SYNC_MIN_TOTAL_MS = 5_000

/** Prod: overlay warm. Local: activar con NEXT_PUBLIC_CATALOG_SYNC_OVERLAY=1. */
export function isCatalogSyncOverlayEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_CATALOG_SYNC_OVERLAY === '1') return true
  return process.env.NODE_ENV === 'production'
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitStageMin(
  stageStartMs: number,
  stage: CatalogSyncStageDef,
  stageMinMs: number,
): Promise<void> {
  if (isStageWarm(stage)) return
  await delay(Math.max(0, stageMinMs - (Date.now() - stageStartMs)))
}

function stagePreviewTarjetas(stage: CatalogSyncStageDef): TarjetaGrilla[] {
  const cache = getPageWarmCache(catalogWarmCacheKey(stage.filters()))
  return priorizarTarjetasConImagen(cache?.tarjetas ?? [], CATALOG_SYNC_GRID_SLOTS)
}

/** Fotos de entretención: etapa actual, o PE/CP ya calientes si el lote aún no llegó. */
function entertainmentPreview(
  stage: CatalogSyncStageDef,
  pool: CatalogSyncStageDef[] = CATALOG_SYNC_STAGES,
): TarjetaGrilla[] {
  const own = stagePreviewTarjetas(stage)
  if (own.length > 0) return own
  for (const alt of pool) {
    if (alt.id === stage.id) continue
    const cards = stagePreviewTarjetas(alt)
    if (cards.length > 0) return cards
  }
  return []
}

export function isStageWarm(stage: CatalogSyncStageDef): boolean {
  return isCatalogWarmEnough(getPageWarmCache(catalogWarmCacheKey(stage.filters())))
}

type SyncScopeOpts = { soloCalzado?: boolean; soloConfecciones?: boolean }

/** Etapas del overlay según scope login (calzado 654 / confecciones 638). */
export function catalogSyncStagesForScope(opts?: SyncScopeOpts | boolean): CatalogSyncStageDef[] {
  // Compat: areAllSyncStagesWarm(true) legado
  const scope: SyncScopeOpts =
    typeof opts === 'boolean' ? { soloCalzado: opts } : (opts ?? {})

  if (scope.soloConfecciones) {
    return CATALOG_SYNC_STAGES.filter((s) => s.id === 'confecciones' || s.id === 'todos').map(
      (s) => {
        if (s.id !== 'todos') return s
        return {
          ...s,
          filters: () => ({
            ...effectiveTodosWarmFilters(),
            ramo_tipo: 'CONFECCIONES' as const,
          }),
        }
      },
    )
  }
  if (scope.soloCalzado) {
    return CATALOG_SYNC_STAGES.filter((s) => s.id !== 'confecciones')
  }
  return CATALOG_SYNC_STAGES
}

/** true si las etapas visibles + Todos ya están en cache — omitir overlay. */
export function areAllSyncStagesWarm(opts?: SyncScopeOpts | boolean): boolean {
  return catalogSyncStagesForScope(opts).every(isStageWarm)
}

const MAX_GATE_RETRIES = 3

async function warmStageWithRetry(stage: CatalogSyncStageDef): Promise<void> {
  for (let i = 0; i < MAX_GATE_RETRIES; i++) {
    if (isStageWarm(stage)) return

    await prefetchCatalogPage(stage.filters(), {
      withFiltros: stage.withFiltros,
      force: true,
      maxAttempts: 3,
    }).catch(() => undefined)

    // Confecciones: también CP confecciones (≥30) para cambio de pill ~3 s.
    if (stage.id === 'confecciones') {
      await prefetchCatalogPage(CP_CONFECCIONES_FILTERS, {
        withFiltros: false,
        force: true,
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
  const preview = entertainmentPreview(stage)
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
  opts?: { soloCalzado?: boolean; soloConfecciones?: boolean },
): Promise<CatalogIntegrityLedger> {
  const stages = catalogSyncStagesForScope(opts)
  const stageMinMs = Math.ceil(CATALOG_SYNC_MIN_TOTAL_MS / Math.max(1, stages.length))
  const completedIds: CatalogSyncStageId[] = []
  const auditEntries: ReturnType<typeof auditWarmPayload>[] = []
  const runStartMs = Date.now()
  let marqueeTarjetas: TarjetaGrilla[] = []

  const emit = (
    partial: Omit<CatalogSyncProgress, 'audit'> & { audit?: CatalogIntegrityLedger },
  ) => {
    onProgress({ ...partial, audit: partial.audit })
  }

  const cpStage = stages.find((s) => s.id === 'cp')
  const peStage = stages.find((s) => s.id === 'pe')
  const confStage = stages.find((s) => s.id === 'confecciones')
  const todosStage = stages.find((s) => s.id === 'todos')!
  const seedAltStage = cpStage ?? confStage ?? todosStage

  // Seed fotos YA (ruta quick) — Todos primero (vista home) + CP/PE en paralelo.
  emit({
    stageIndex: stages.length - 1,
    stage: todosStage,
    phase: 'start',
    completedIds: [],
    marqueeTarjetas: [],
  })

  // force:true — warm de fondo está OFF hasta 1.ª grilla; sin force el seed era no-op.
  const seedTodos = prefetchCatalogPage(todosStage.filters(), {
    withFiltros: true,
    maxAttempts: 2,
    force: true,
  }).catch(() => undefined)
  const seedCp = cpStage
    ? prefetchCatalogPage(cpStage.filters(), { maxAttempts: 1, force: true }).catch(() => undefined)
    : Promise.resolve()
  const seedPe = peStage
    ? prefetchCatalogPage(peStage.filters(), { maxAttempts: 1, force: true }).catch(() => undefined)
    : confStage
      ? prefetchCatalogPage(confStage.filters(), { maxAttempts: 1, force: true }).catch(() => undefined)
      : Promise.resolve()

  // Poll agresivo los primeros ~4 s — preview = grilla Todos si ya calentó.
  const seedDeadline = Date.now() + 4_500
  while (Date.now() < seedDeadline) {
    const todosPreview = stagePreviewTarjetas(todosStage)
    const mid =
      todosPreview.length > 0
        ? {
            preview: todosPreview,
            marquee: mergeMarqueeTarjetas(marqueeTarjetas, todosPreview),
          }
        : emitPreviewFromCache(seedAltStage, marqueeTarjetas)
    if (mid.preview.length > 0) {
      marqueeTarjetas = mid.marquee
      warmCatalogImages(mid.preview, CATALOG_SYNC_GRID_SLOTS)
      emit({
        stageIndex: todosPreview.length > 0 ? stages.length - 1 : 0,
        stage: todosPreview.length > 0 ? todosStage : seedAltStage,
        phase: 'start',
        completedIds: [],
        previewTarjetas: mid.preview,
        marqueeTarjetas: [...marqueeTarjetas],
      })
      break
    }
    await delay(200)
  }

  // Warm completo en paralelo (incluye stages restantes).
  const stageWarmTasks = stages.map((stage) => {
    if (stage.id === 'todos') {
      return seedTodos.then(() => warmStageWithRetry(stage))
    }
    if (stage.id === 'cp') return seedCp.then(() => warmStageWithRetry(stage))
    if (stage.id === 'pe') return seedPe.then(() => warmStageWithRetry(stage))
    if (stage.id === 'confecciones') return seedPe.then(() => warmStageWithRetry(stage))
    return warmStageWithRetry(stage)
  })

  for (let i = 0; i < stages.length; i++) {
    const stageStartMs = i === 0 ? runStartMs : Date.now()
    const stage = stages[i]

    emit({
      stageIndex: i,
      stage,
      phase: 'start',
      completedIds: [...completedIds],
      marqueeTarjetas: [...marqueeTarjetas],
      previewTarjetas: entertainmentPreview(stage, stages),
      audit: buildIntegrityLedger(
        auditEntries,
        getPageWarmCache(catalogWarmCacheKey(effectiveTodosWarmFilters())),
      ),
    })

    const warmPromise = stageWarmTasks[i]
    let warmDone = false
    void warmPromise.finally(() => {
      warmDone = true
    })

    // Seguir emitiendo fotos durante toda la etapa (no cortar al primer preview).
    while (Date.now() - stageStartMs < stageMinMs) {
      const mid = emitPreviewFromCache(stage, marqueeTarjetas)
      if (mid.preview.length > 0) {
        marqueeTarjetas = mid.marquee
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
      if (warmDone && isStageWarm(stage)) break
      await delay(280)
    }

    await warmPromise
    if (!isStageWarm(stage)) {
      await warmStageWithRetry(stage)
    }

    const payload = getPageWarmCache(catalogWarmCacheKey(stage.filters()))
    auditEntries.push(auditWarmPayload(stage.id, stage.filters(), payload))

    const midFinal = emitPreviewFromCache(stage, marqueeTarjetas)
    marqueeTarjetas = midFinal.marquee
    if (midFinal.preview.length > 0) {
      emit({
        stageIndex: i,
        stage,
        phase: 'start',
        completedIds: [...completedIds],
        previewTarjetas: midFinal.preview,
        marqueeTarjetas: [...marqueeTarjetas],
        audit: buildIntegrityLedger(
          auditEntries,
          getPageWarmCache(catalogWarmCacheKey(effectiveTodosWarmFilters())),
        ),
      })
    }

    await waitStageMin(stageStartMs, stage, stageMinMs)

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

  const elapsedBeforeTail = Date.now() - runStartMs
  const todosWarmNow = isStageWarm(todosStage)
  const allStagesWarm = stages.every(isStageWarm)
  if (todosWarmNow) {
    // Gate listo: salir ya (máx ~1.2 s de marca si el warm fue instantáneo).
    const MIN_BRAND_MS = allStagesWarm ? 400 : 1_200
    if (elapsedBeforeTail < MIN_BRAND_MS) {
      await delay(MIN_BRAND_MS - elapsedBeforeTail)
    }
  } else {
    await delay(Math.max(0, CATALOG_SYNC_MIN_TOTAL_MS - elapsedBeforeTail))
    if (!isStageWarm(todosStage)) {
      await warmStageWithRetry(todosStage)
    }
  }

  const finalLedger = buildIntegrityLedger(
    auditEntries,
    getPageWarmCache(catalogWarmCacheKey(effectiveTodosWarmFilters())),
  )

  emit({
    stageIndex: stages.length - 1,
    stage: todosStage,
    phase: 'done',
    completedIds: [...completedIds],
    previewTarjetas: stagePreviewTarjetas(todosStage),
    marqueeTarjetas: [...marqueeTarjetas],
    audit: finalLedger,
  })

  return finalLedger
}
