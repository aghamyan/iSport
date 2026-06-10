'use client'

import { useState, useTransition } from 'react'
import { addExtraMatchAction } from './actions'
import { OddsPreview } from '@/app/components/OddsPreview'

type PlayerOption = {
  id: string
  displayName: string
}

type Props = {
  championshipId: string
  players: PlayerOption[]
  onClose: () => void
}

export function AddMatchModal({ championshipId, players, onClose }: Props) {
  const [homeId, setHomeId] = useState('')
  const [awayId, setAwayId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 7,
    fontSize: 14,
    background: '#fff',
    cursor: 'pointer',
  }

  function handleSubmit() {
    if (!homeId || !awayId) { setError('Select both players.'); return }
    if (homeId === awayId) { setError('Home and away must be different players.'); return }
    setError(null)

    startTransition(async () => {
      try {
        await addExtraMatchAction(championshipId, homeId, awayId)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
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
          width: 380,
          maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Add extra match"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add Extra Match</h2>
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

        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Home Player
        </label>
        <select
          style={{ ...selectStyle, marginBottom: 14 }}
          value={homeId}
          onChange={(e) => setHomeId(e.target.value)}
          disabled={isPending}
        >
          <option value="">Select player…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === awayId}>
              {p.displayName}
            </option>
          ))}
        </select>

        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Away Player
        </label>
        <select
          style={{ ...selectStyle, marginBottom: 20 }}
          value={awayId}
          onChange={(e) => setAwayId(e.target.value)}
          disabled={isPending}
        >
          <option value="">Select player…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === homeId}>
              {p.displayName}
            </option>
          ))}
        </select>

        {homeId && awayId && homeId !== awayId && (
          <OddsPreview
            homeId={homeId}
            awayId={awayId}
            homeName={players.find((p) => p.id === homeId)?.displayName ?? ''}
            awayName={players.find((p) => p.id === awayId)?.displayName ?? ''}
            matchType="championship"
          />
        )}

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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !homeId || !awayId}
            style={{
              padding: '8px 20px',
              background: isPending || !homeId || !awayId ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              cursor: isPending || !homeId || !awayId ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {isPending ? 'Adding…' : 'Add Match'}
          </button>
        </div>
      </div>
    </div>
  )
}
