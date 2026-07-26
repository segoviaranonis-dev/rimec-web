/**

 * Etapas visibles «RIMEC sincronizando» — warm secuencial CP → PE → Confecciones → Todos.

 * Auditoría bancaria: acumuladores por etapa durante los 30 s de inicio.

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

    requiredForGate: false,

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

    withFiltros: true,

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



export const CATALOG_SYNC_MIN_TOTAL_MS = 30_000

/** Prod: overlay 30s CP→PE→Confecciones→Todos. Local: grilla directa. */
export function isCatalogSyncOverlayEnabled(): boolean {
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

    }).catch(() => undefined)

    if (isStageWarm(stage)) return

    await delay(400 * (i + 1))

  }

}



export async function runCatalogSyncStages(

  onProgress: (p: CatalogSyncProgress) => void,

): Promise<CatalogIntegrityLedger> {

  const completedIds: CatalogSyncStageId[] = []

  const auditEntries: ReturnType<typeof auditWarmPayload>[] = []

  const runStartMs = Date.now()

  let marqueeTarjetas: TarjetaGrilla[] = []



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



    await warmStageWithRetry(stage)



    const payload = getPageWarmCache(catalogWarmCacheKey(stage.filters()))

    auditEntries.push(auditWarmPayload(stage.id, stage.filters(), payload))



    const preview = stagePreviewTarjetas(stage)

    if (preview.length > 0) {

      warmCatalogImages(preview, CATALOG_SYNC_GRID_SLOTS)

      marqueeTarjetas = mergeMarqueeTarjetas(marqueeTarjetas, preview)

      emit({

        stageIndex: i,

        stage,

        phase: 'start',

        completedIds: [...completedIds],

        previewTarjetas: preview,

        marqueeTarjetas: [...marqueeTarjetas],

        audit: buildIntegrityLedger(

          auditEntries,

          getPageWarmCache(catalogWarmCacheKey(effectiveTodosWarmFilters())),

        ),

      })

    }



    await waitStageMin(stageStartMs)



    completedIds.push(stage.id)

    const previewDone = stagePreviewTarjetas(stage)

    if (previewDone.length > 0) {

      warmCatalogImages(previewDone, CATALOG_SYNC_GRID_SLOTS)

      marqueeTarjetas = mergeMarqueeTarjetas(marqueeTarjetas, previewDone)

    }



    emit({

      stageIndex: i,

      stage,

      phase: 'done',

      completedIds: [...completedIds],

      previewTarjetas: previewDone,

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


