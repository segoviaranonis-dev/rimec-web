/**
 * Etapas visibles «RIMEC sincronizando» — warm secuencial CP → PE → Confecciones.
 */
import type { CatalogoFilterState } from '@/app/components/FiltrosCatalogo'
import {
  mergeMarqueeTarjetas,
  priorizarTarjetasConImagen,
} from '@/lib/catalogoSyncPreview'
import {
  CP_DEFAULT_FILTERS,
  PE_DEFAULT_FILTERS,
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

export type CatalogSyncStageId = 'cp' | 'pe' | 'confecciones'

export type CatalogSyncStageDef = {
  id: CatalogSyncStageId
  labelActive: string
  labelDone: string
  /** Color acento etapa (borde · barra · tarjetas fantasma) */
  accent: string
  /** Resplandor neón etapa */
  glow: string
  /** Fondo suave etapa */
  tint: string
  filters: () => CatalogoFilterState
  withFiltros: boolean
}

/** Pronta entrega · ramo confecciones (638). */
export const PE_CONFECCIONES_FILTERS: CatalogoFilterState = {
  ...CP_DEFAULT_FILTERS,
  origen_tipo: 'PRONTA_ENTREGA',
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
    filters: () => ({ ...effectiveCpWarmFilters(), origen_tipo: 'CP' }),
    withFiltros: true,
  },
  {
    id: 'pe',
    labelActive: 'Sincronizando pronta entrega',
    labelDone: 'Pronta entrega sincronizada',
    accent: '#10B981',
    tint: 'rgba(209, 250, 229, 0.72)',
    glow: 'rgba(16, 185, 129, 0.35)',
    filters: effectivePeWarmFilters,
    withFiltros: true,
  },
  {
    id: 'confecciones',
    labelActive: 'Sincronizando confecciones',
    labelDone: 'Confecciones sincronizadas',
    accent: '#F97316',
    tint: 'rgba(255, 237, 213, 0.72)',
    glow: 'rgba(249, 115, 22, 0.35)',
    filters: () => PE_CONFECCIONES_FILTERS,
    withFiltros: true,
  },
]

export type CatalogSyncProgress = {
  stageIndex: number
  stage: CatalogSyncStageDef
  phase: 'start' | 'done'
  completedIds: CatalogSyncStageId[]
  /** Tarjetas reales de la etapa activa (con foto priorizada). */
  previewTarjetas?: TarjetaGrilla[]
  /** Acumulado CP + PE + confecciones para el marquee de fondo. */
  marqueeTarjetas?: TarjetaGrilla[]
}

export const CATALOG_SYNC_PREVIEW_LIMIT = 12
export const CATALOG_SYNC_GRID_SLOTS = 9

function stagePreviewTarjetas(stage: CatalogSyncStageDef): TarjetaGrilla[] {
  const cache = getPageWarmCache(catalogWarmCacheKey(stage.filters()))
  return priorizarTarjetasConImagen(cache?.tarjetas ?? [], CATALOG_SYNC_GRID_SLOTS)
}

export const CATALOG_SYNC_MIN_TOTAL_MS = 30_000
const STAGE_MIN_MS = Math.ceil(CATALOG_SYNC_MIN_TOTAL_MS / 3)

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitStageMin(stageStartMs: number): Promise<void> {
  await delay(Math.max(0, STAGE_MIN_MS - (Date.now() - stageStartMs)))
}

export function isStageWarm(stage: CatalogSyncStageDef): boolean {
  return isCatalogWarmEnough(getPageWarmCache(catalogWarmCacheKey(stage.filters())))
}

/** true si las 3 etapas ya están en cache — omitir overlay. */
export function areAllSyncStagesWarm(): boolean {
  return CATALOG_SYNC_STAGES.every(isStageWarm)
}

export async function runCatalogSyncStages(
  onProgress: (p: CatalogSyncProgress) => void,
): Promise<void> {
  const completedIds: CatalogSyncStageId[] = []
  const runStartMs = Date.now()
  let marqueeTarjetas: TarjetaGrilla[] = []

  for (let i = 0; i < CATALOG_SYNC_STAGES.length; i++) {
    const stageStartMs = Date.now()
    const stage = CATALOG_SYNC_STAGES[i]
    onProgress({
      stageIndex: i,
      stage,
      phase: 'start',
      completedIds: [...completedIds],
      marqueeTarjetas: [...marqueeTarjetas],
    })

    if (!isStageWarm(stage)) {
      await prefetchCatalogPage(stage.filters(), { withFiltros: stage.withFiltros }).catch(() => undefined)
    }

    const preview = stagePreviewTarjetas(stage)
    if (preview.length > 0) {
      warmCatalogImages(preview, CATALOG_SYNC_GRID_SLOTS)
      marqueeTarjetas = mergeMarqueeTarjetas(marqueeTarjetas, preview)
      onProgress({
        stageIndex: i,
        stage,
        phase: 'start',
        completedIds: [...completedIds],
        previewTarjetas: preview,
        marqueeTarjetas: [...marqueeTarjetas],
      })
    }

    await waitStageMin(stageStartMs)

    completedIds.push(stage.id)
    const previewDone = stagePreviewTarjetas(stage)
    if (previewDone.length > 0) {
      warmCatalogImages(previewDone, CATALOG_SYNC_GRID_SLOTS)
      marqueeTarjetas = mergeMarqueeTarjetas(marqueeTarjetas, previewDone)
    }
    onProgress({
      stageIndex: i,
      stage,
      phase: 'done',
      completedIds: [...completedIds],
      previewTarjetas: previewDone,
      marqueeTarjetas: [...marqueeTarjetas],
    })
  }

  await delay(Math.max(0, CATALOG_SYNC_MIN_TOTAL_MS - (Date.now() - runStartMs)))

  // Todos calzado (grilla default) — tras etapas visibles, sin bloquear UX
  const todos = effectiveTodosWarmFilters()
  if (!isCatalogWarmEnough(getPageWarmCache(catalogWarmCacheKey(todos)))) {
    void prefetchCatalogPage(todos, { withFiltros: true }).catch(() => undefined)
  }

  // CP legacy sin pill explícita
  const cpLegacy = effectiveCpWarmFilters()
  if (!isCatalogWarmEnough(getPageWarmCache(catalogWarmCacheKey(cpLegacy)))) {
    void prefetchCatalogPage(cpLegacy, { withFiltros: false }).catch(() => undefined)
  }
}
