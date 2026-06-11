'use client'

import { useState, useTransition } from 'react'
import { recordChampionshipScoreAction, updateChampionshipMatchAction } from './actions'
import { useTranslation } from '@/lib/i18n/context'

type Props = {
  championshipId: string
  matchId: string
  homePlayerName: string
  awayPlayerName: string
  /** null = match is pending (first-time score entry) */
  editDeadline: string | null
  isAdmin: boolean
  onClose: () => void
}

export function ScoreModal({
  championshipId,
  matchId,
  homePlayerName,
  awayPlayerName,
  editDeadline,
  isAdmin,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEditMode = editDeadline !== null

  function handleSave() {

    const h = homeScore !== '' ? parseInt(homeScore, 10) : NaN
    const a = awayScore !== '' ? parseInt(awayScore, 10) : NaN

    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError(t('champ.score.errInvalid'))
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        if (editDeadline === null) {
          // First-time score recording (pending match)
          await recordChampionshipScoreAction(championshipId, matchId, h, a)
        } else {
          // Editing a confirmed match
          await updateChampionshipMatchAction(championshipId, matchId, h, a)
        }
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('champ.score.errFailed'))
      }
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          width: 400,
          maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={editDeadline === null ? t('champ.score.recordTitle') : t('champ.score.editTitle')}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {editDeadline === null ? t('champ.score.recordTitle') : t('champ.score.editTitle')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 22,
              color: '#6b7280',
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                fontSize: 11,
                color: '#9ca3af',
                fontWeight: 600,
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              {homePlayerName}
            </div>
            <input
              type="number"
              min={0}
              max={99}
              placeholder="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              disabled={isPending}
              autoFocus
              style={{
                width: 72,
                textAlign: 'center',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 28,
                fontWeight: 800,
                color: '#111827',
                background: '#fff',
              }}
            />
          </div>

          <span style={{ fontSize: 22, color: '#d1d5db', fontWeight: 700 }}>:</span>

          <div style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                fontSize: 11,
                color: '#9ca3af',
                fontWeight: 600,
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              {awayPlayerName}
            </div>
            <input
              type="number"
              min={0}
              max={99}
              placeholder="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              disabled={isPending}
              style={{
                width: 72,
                textAlign: 'center',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 28,
                fontWeight: 800,
                color: '#111827',
                background: '#fff',
              }}
            />
          </div>
        </div>

        {error && (
          <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              border: '1px solid #d1d5db',
              borderRadius: 7,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            style={{
              padding: '8px 20px',
              background: isPending ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 14,
              minWidth: 100,
            }}
          >
            {isPending ? t('common.saving') : t('champ.saveDate')}
          </button>
        </div>
      </div>
    </div>
  )
}
