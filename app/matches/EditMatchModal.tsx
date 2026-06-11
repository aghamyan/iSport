'use client'

import { useState, useTransition } from 'react'
import { updateMatchAction } from './actions'
import { useTranslation } from '@/lib/i18n/context'
// ─── Types ────────────────────────────────────────────────────────────────────

type MatchSnapshot = {
  id: string
  homeScore: number | null
  awayScore: number | null
  notes: string | null
  editDeadline: string | null
  status: 'pending' | 'confirmed' | 'final'
}

type Props = {
  match: MatchSnapshot
  homePlayerName: string
  awayPlayerName: string
  isAdmin: boolean
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditMatchModal({
  match,
  homePlayerName,
  awayPlayerName,
  isAdmin,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '')
  const [notes, setNotes] = useState(match.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)

    const h = homeScore !== '' ? parseFloat(homeScore) : undefined
    const a = awayScore !== '' ? parseFloat(awayScore) : undefined

    if ((h !== undefined && !Number.isInteger(h)) || (a !== undefined && !Number.isInteger(a))) {
      setError(t('match.edit.errWholeNumbers'))
      return
    }

    startTransition(async () => {
      try {
        await updateMatchAction(match.id, {
          homeScore: h,
          awayScore: a,
          notes: notes.trim() || undefined,
        })
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('match.edit.errFailed'))
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
          width: 440,
          maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Edit match"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('match.edit.title')}</h2>
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

        {/* Score inputs */}
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
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              disabled={false}
              style={{
                width: 72,
                textAlign: 'center',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 24,
                fontWeight: 800,
                color: '#111827',
                background: '#fff',
              }}
            />
          </div>

          <span style={{ fontSize: 20, color: '#d1d5db', fontWeight: 700 }}>:</span>

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
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              disabled={false}
              style={{
                width: 72,
                textAlign: 'center',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 24,
                fontWeight: 800,
                color: '#111827',
                background: '#fff',
              }}
            />
          </div>
        </div>

        {/* Notes */}
        <textarea
          placeholder={t('match.edit.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={false}
          rows={3}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 7,
            fontSize: 13,
            resize: 'vertical',
            boxSizing: 'border-box',
            background: '#fff',
            color: '#111827',
            fontFamily: 'inherit',
          }}
        />

        {error && (
          <p style={{ color: '#dc2626', fontSize: 13, margin: '10px 0 0' }}>{error}</p>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 20,
          }}
        >
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
              padding: '8px 18px',
              background: isPending ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 14,
              minWidth: 110,
            }}
          >
            {isPending ? t('common.saving') : t('match.edit.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  )
}
