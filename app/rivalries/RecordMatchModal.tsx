'use client'

import { useState, useTransition } from 'react'
import { recordRivalryMatchAction } from './actions'

type Props = {
  rivalryId: string
  player1Name: string
  player2Name: string
  targetScore: number
  onClose: () => void
  onSuccess: (matchId: string, p1Score: number, p2Score: number) => void
}

export function RecordMatchModal({ rivalryId, player1Name, player2Name, targetScore, onClose, onSuccess }: Props) {
  const [p1Score, setP1Score] = useState('')
  const [p2Score, setP2Score] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const s1 = parseInt(p1Score, 10)
    const s2 = parseInt(p2Score, 10)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError('Enter valid non-negative scores')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const { matchId } = await recordRivalryMatchAction(rivalryId, s1, s2)
        onSuccess(matchId, s1, s2)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record match')
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
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
          Record Match
        </h2>
        <div style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            First to score {targetScore} wins the match (+1 in series).
          </p>
          <span
            style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700,
              padding: '2px 8px', borderRadius: 10,
              background: '#eff6ff', color: '#2563eb',
              border: '1px solid #bfdbfe',
            }}
          >
            Target: {targetScore}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
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
              Cancel
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
              {isPending ? 'Saving…' : 'Save Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
