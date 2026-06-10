'use client'

import { useState, useTransition } from 'react'
import { updateMatchAction } from './actions'
import { useEditTimer } from './useEditTimer'

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
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '')
  const [notes, setNotes] = useState(match.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { timeLeft, isExpired } = useEditTimer(match.editDeadline)

  // Admins bypass the window client-side too; the DB trigger is the hard gate.
  const isLocked = isExpired && !isAdmin

  function handleSave() {
    if (isLocked) return
    setError(null)

    const h = homeScore !== '' ? parseFloat(homeScore) : undefined
    const a = awayScore !== '' ? parseFloat(awayScore) : undefined

    if ((h !== undefined && !Number.isInteger(h)) || (a !== undefined && !Number.isInteger(a))) {
      setError('Scores must be whole numbers.')
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
        setError(e instanceof Error ? e.message : 'Failed to save changes.')
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
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit Match</h2>
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

        {/* Edit window banner */}
        {match.editDeadline && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 7,
              marginBottom: 20,
              background: isExpired ? '#fee2e2' : '#fef9c3',
              color: isExpired ? '#dc2626' : '#854d0e',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {isExpired ? (
              isAdmin ? (
                <>
                  ⚠️ Edit window expired — you are editing as <strong>admin</strong>.
                </>
              ) : (
                '🔒 Edit window has expired. Only admins can make changes.'
              )
            ) : (
              <>
                ⏱ Edit window closes in: <strong>{timeLeft}</strong>
              </>
            )}
          </div>
        )}

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
              disabled={isLocked}
              style={{
                width: 72,
                textAlign: 'center',
                padding: '8px',
                border: `1px solid ${isLocked ? '#e5e7eb' : '#d1d5db'}`,
                borderRadius: 8,
                fontSize: 24,
                fontWeight: 800,
                color: isLocked ? '#9ca3af' : '#111827',
                background: isLocked ? '#f9fafb' : '#fff',
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
              disabled={isLocked}
              style={{
                width: 72,
                textAlign: 'center',
                padding: '8px',
                border: `1px solid ${isLocked ? '#e5e7eb' : '#d1d5db'}`,
                borderRadius: 8,
                fontSize: 24,
                fontWeight: 800,
                color: isLocked ? '#9ca3af' : '#111827',
                background: isLocked ? '#f9fafb' : '#fff',
              }}
            />
          </div>
        </div>

        {/* Notes */}
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isLocked}
          rows={3}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: `1px solid ${isLocked ? '#e5e7eb' : '#d1d5db'}`,
            borderRadius: 7,
            fontSize: 13,
            resize: 'vertical',
            boxSizing: 'border-box',
            background: isLocked ? '#f9fafb' : '#fff',
            color: isLocked ? '#9ca3af' : '#111827',
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
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || isLocked}
            style={{
              padding: '8px 18px',
              background: isPending || isLocked ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              cursor: isPending || isLocked ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 14,
              minWidth: 110,
            }}
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
