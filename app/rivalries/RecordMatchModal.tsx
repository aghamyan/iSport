'use client'

import { useState, useTransition } from 'react'
import { recordRivalryMatchAction } from './actions'
import { useTranslation } from '@/lib/i18n/context'

type Props = {
  rivalryId: string
  player1Name: string
  player2Name: string
  defaultTarget: number
  onClose: () => void
  onSuccess: (matchId: string, p1Score: number, p2Score: number) => void
}

export function RecordMatchModal({ rivalryId, player1Name, player2Name, defaultTarget, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const [sessionTarget, setSessionTarget] = useState(String(defaultTarget))
  const [p1Score, setP1Score] = useState('')
  const [p2Score, setP2Score] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const target = parseInt(sessionTarget, 10)
    if (isNaN(target) || target < 1) {
      setError(t('rivalry.err.invalidTarget'))
      return
    }

    const s1 = parseInt(p1Score, 10)
    const s2 = parseInt(p2Score, 10)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError(t('rivalry.err.invalidScores'))
      return
    }

    if (s1 === s2) {
      if (s1 >= target) {
        setError(t('rivalry.err.tieAtTarget', { n: target }))
        return
      }
    } else {
      if (Math.max(s1, s2) !== target) {
        setError(t('rivalry.err.winnerMustScore', { n: target }))
        return
      }
    }

    setError(null)
    startTransition(async () => {
      try {
        const { matchId } = await recordRivalryMatchAction(rivalryId, s1, s2)
        onSuccess(matchId, s1, s2)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('rivalry.err.failedRecord'))
      }
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14, padding: 28,
          width: 400, maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
          {t('rivalry.record.title')}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Session target */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {t('rivalry.record.target')}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={1}
                value={sessionTarget}
                onChange={(e) => setSessionTarget(e.target.value)}
                style={{
                  width: 72, padding: '8px 10px', borderRadius: 8,
                  border: '2px solid #2563eb', fontSize: 20, fontWeight: 800,
                  textAlign: 'center', color: '#111827', outline: 'none',
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                {t('rivalry.record.winsToTake')}
              </span>
            </div>
          </div>

          {/* Score inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {/* Player 1 */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {player1Name}
              </div>
              <input
                type="number"
                min={0}
                value={p1Score}
                onChange={(e) => setP1Score(e.target.value)}
                placeholder="0"
                autoFocus
                style={{
                  width: '100%', padding: '10px 8px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 24, fontWeight: 800,
                  textAlign: 'center', color: '#111827',
                }}
              />
            </div>

            <span style={{ fontSize: 20, color: '#9ca3af', fontWeight: 700, flexShrink: 0 }}>–</span>

            {/* Player 2 */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {player2Name}
              </div>
              <input
                type="number"
                min={0}
                value={p2Score}
                onChange={(e) => setP2Score(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%', padding: '10px 8px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 24, fontWeight: 800,
                  textAlign: 'center', color: '#111827',
                }}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 14px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: '8px 18px', border: '1px solid #d1d5db',
                borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14,
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '8px 20px',
                background: isPending ? '#93c5fd' : '#2563eb',
                color: '#fff', border: 'none', borderRadius: 7,
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
              }}
            >
              {isPending ? t('rivalry.record.saving') : t('rivalry.record.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
