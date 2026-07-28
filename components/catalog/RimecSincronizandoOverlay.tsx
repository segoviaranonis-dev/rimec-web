'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CATALOG_SYNC_MIN_TOTAL_MS,
  CATALOG_SYNC_STAGES,
  type CatalogSyncProgress,
  type CatalogSyncStageId,
} from '@/lib/catalogoSyncStages'
import { SyncStagePreview } from '@/components/catalog/SyncStagePreview'
import { SyncBackgroundMarquee } from '@/components/catalog/SyncBackgroundMarquee'
import { CATALOG_SYNC_GRID_SLOTS } from '@/lib/catalogoSyncStages'

type Props = {
  progress: CatalogSyncProgress | null
  startedAt: number | null
  waitingGrid?: boolean
}

function StageCardsSkeleton({ accent }: { accent: string }) {
  return (
    <div className="rimec-sync-cards" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="rimec-sync-card"
          style={
            {
              '--sync-accent': accent,
              animationDelay: `${i * 0.07}s`,
            } as React.CSSProperties
          }
        >
          <div className="rimec-sync-card-img" />
          <div className="rimec-sync-card-line rimec-sync-card-line--wide" />
          <div className="rimec-sync-card-line" />
        </div>
      ))}
    </div>
  )
}

function SyncOrbitCore({ accent, glow }: { accent: string; glow: string }) {
  return (
    <div className="rimec-sync-orbit" aria-hidden>
      <div
        className="rimec-sync-orbit-ring rimec-sync-orbit-ring--outer"
        style={{ '--orbit-accent': accent, '--orbit-glow': glow } as React.CSSProperties}
      />
      <div
        className="rimec-sync-orbit-ring rimec-sync-orbit-ring--mid"
        style={{ '--orbit-accent': accent, '--orbit-glow': glow } as React.CSSProperties}
      />
      <div
        className="rimec-sync-orbit-core"
        style={{ '--orbit-accent': accent, '--orbit-glow': glow } as React.CSSProperties}
      />
    </div>
  )
}

export function RimecSincronizandoOverlay({
  progress,
  startedAt,
  waitingGrid = false,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    setMounted(true)
    document.body.classList.add('rimec-sync-body-lock')
    return () => {
      document.body.classList.remove('rimec-sync-body-lock')
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 120)
    return () => window.clearInterval(id)
  }, [])

  if (!mounted) return null

  const stageIndex = progress?.stageIndex ?? 0
  const stage = progress?.stage ?? CATALOG_SYNC_STAGES[0]
  const phase = progress?.phase ?? 'start'
  const completed = new Set<CatalogSyncStageId>(progress?.completedIds ?? [])

  // % por reloj; si Todos ya PASS → 99% sin quedarse congelado hasta el final.
  const elapsedMs = startedAt ? Math.max(0, nowMs - startedAt) : 0
  const rawPct = (elapsedMs / CATALOG_SYNC_MIN_TOTAL_MS) * 100
  const todosListo = (progress?.audit?.todosTarjetas ?? 0) >= 30 && progress?.audit?.allPass
  const progressPct = waitingGrid
    ? 100
    : todosListo && phase === 'done'
      ? 99
      : Math.min(99, Math.max(1, Math.round(rawPct)))

  const label =
    waitingGrid && phase === 'done'
      ? 'Desplegando catálogo en pantalla…'
      : phase === 'done'
        ? stage.labelDone
        : stage.labelActive

  const accent = stage.accent
  const glow = stage.glow
  const tint = stage.tint
  const previewTarjetas = progress?.previewTarjetas ?? []
  const marqueeTarjetas = progress?.marqueeTarjetas ?? previewTarjetas
  const ghostSlots = Math.max(0, CATALOG_SYNC_GRID_SLOTS - previewTarjetas.length)

  const content = (
    <div
      className="rimec-sync-overlay rimec-sync-overlay--enter"
      role="status"
      aria-live="polite"
      aria-busy={waitingGrid || phase === 'start'}
      style={
        {
          '--sync-accent': accent,
          '--sync-glow': glow,
          '--sync-tint': tint,
        } as React.CSSProperties
      }
    >
      <div className="rimec-sync-bg-wash" aria-hidden />
      <div className="rimec-sync-aurora rimec-sync-aurora--a" aria-hidden />
      <div className="rimec-sync-aurora rimec-sync-aurora--b" aria-hidden />
      <div className="rimec-sync-aurora rimec-sync-aurora--c" aria-hidden />

      <SyncBackgroundMarquee tarjetas={marqueeTarjetas} accent={accent} />

      <div className="rimec-sync-shell rimec-sync-shell--deploy">
        <header className="rimec-sync-header">
          <SyncOrbitCore accent={accent} glow={glow} />
          <div className="rimec-sync-title-wrap">
            <h2 className="rimec-sync-brand">
              <span className="rimec-sync-brand-r">RIMEC</span>
              <span className="rimec-sync-brand-action"> sincronizando!!!!</span>
            </h2>
            <p className="rimec-sync-sub">{label}</p>
            <div className="rimec-sync-pct">
              <span className="rimec-sync-pct-num">{progressPct}</span>
              <span className="rimec-sync-pct-sym">%</span>
            </div>
          </div>
        </header>

        <div className="rimec-sync-rail" aria-label="Etapas de sincronización">
          {CATALOG_SYNC_STAGES.map((s, i) => {
            const done = completed.has(s.id)
            const active = i === stageIndex && (phase === 'start' || waitingGrid)
            const pending = !done && !active
            return (
              <div
                key={s.id}
                className={[
                  'rimec-sync-rail-node',
                  done ? 'rimec-sync-rail-node--done' : '',
                  active ? 'rimec-sync-rail-node--active' : '',
                  pending ? 'rimec-sync-rail-node--pending' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--node-accent': s.accent, '--node-glow': s.glow } as React.CSSProperties}
              >
                <span className="rimec-sync-rail-icon">
                  {done ? (
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.2 6.4 11 12.5 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : active ? (
                    <span className="rimec-sync-rail-pulse" />
                  ) : (
                    <span className="rimec-sync-rail-idle" />
                  )}
                </span>
                <span className="rimec-sync-rail-label">
                  {done ? s.labelDone : s.labelActive}
                </span>
              </div>
            )
          })}
        </div>

        {previewTarjetas.length > 0 ? (
          <SyncStagePreview
            tarjetas={previewTarjetas}
            stageId={stage.id}
            ghostSlots={ghostSlots}
            accent={accent}
          />
        ) : (
          <StageCardsSkeleton accent={accent} />
        )}

        <div className="rimec-sync-bar-wrap">
          <div className="rimec-sync-bar-track">
            <div className="rimec-sync-bar-fill" style={{ width: `${progressPct}%` }} />
            <div className="rimec-sync-bar-head" style={{ left: `${progressPct}%` }} />
          </div>
        </div>

        {progress?.audit ? (
          <div className="rimec-sync-audit" aria-label="Control integridad catálogo">
            <span className={progress.audit.allPass ? 'rimec-sync-audit-ok' : 'rimec-sync-audit-warn'}>
              {progress.audit.allPass ? '✓ Control PASS' : '⚠ Verificando…'}
            </span>
            <span>Todos: {progress.audit.todosTarjetas} tarjetas</span>
            <span>Acum: {progress.audit.acumuladoTarjetas}</span>
          </div>
        ) : null}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
