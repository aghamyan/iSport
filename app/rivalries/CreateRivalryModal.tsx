'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createRivalryAction } from './actions'

export type PlayerOption = { id: string; name: string }

type Props = {
  players: PlayerOption[]
  onClose: () => void
}

export function CreateRivalryModal({ players, onClose }: Props) {
  const router = useRouter()
  const [opponentId, setOpponentId] = useState('')
  const [bestOf, setBestOf] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!opponentId) { setError('Select an opponent'); return }
    setError(null)
    startTransition(async () => {
      try {
        const { id } = await createRivalryAction(opponentId, bestOf)
        router.push(`/rivalries/${id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create rivalry')
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
          width: 420, maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
          Start a Rivalry
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Opponent
            </label>
            <select
              value={opponentId}
              onChange={(e) => setOpponentId(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 7,
                border: '1px solid #d1d5db', fontSize: 14, color: '#111827',
                background: '#fff',
              }}
            >
              <option value="">Select opponent…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              First to N wins
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={1}
                max={20}
                value={bestOf}
                onChange={(e) => setBestOf(Number(e.target.value))}
                style={{
                  width: 80, padding: '8px 10px', borderRadius: 7,
                  border: '1px solid #d1d5db', fontSize: 14, color: '#111827',
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                wins to claim the series
              </span>
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
              {isPending ? 'Creating…' : 'Start Rivalry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
