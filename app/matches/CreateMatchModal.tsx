'use client'

import { useState, useTransition, useCallback } from 'react'
import { createMatchesBatchAction, type MatchDraft } from './actions'
import { OddsPreview } from '@/app/components/OddsPreview'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivePlayer = {
  id: string
  displayName: string
}

type DraftRow = MatchDraft & { key: number }

type Props = {
  currentUserId: string
  currentUserName: string
  players: ActivePlayer[]
  onClose: () => void
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    width: 600,
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6b7280', lineHeight: 1, padding: 0 },
  subtitle: { margin: '0 0 20px', fontSize: 13, color: '#6b7280' },
  row: {
    marginBottom: 12,
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fafafa',
  },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 10 },
  teamLabel: { fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.05em', marginBottom: 3 },
  playerName: { fontSize: 14, fontWeight: 600, color: '#111827' },
  scoreInput: {
    width: 48,
    textAlign: 'center' as const,
    padding: '5px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
  },
  vsText: { fontSize: 13, color: '#9ca3af', fontWeight: 600 },
  select: {
    width: '100%',
    padding: '5px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    background: '#fff',
    cursor: 'pointer',
  },
  removeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
    fontSize: 18, padding: '0 2px', lineHeight: 1, flexShrink: 0,
  },
  addBtn: {
    marginTop: 4,
    padding: '7px 14px',
    border: '1px dashed #9ca3af',
    borderRadius: 6,
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: '#374151',
  },
  error: { color: '#dc2626', fontSize: 13, margin: '12px 0 0' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  cancelBtn: { padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14 },
  submitBtn: (disabled: boolean) => ({
    padding: '8px 18px',
    background: disabled ? '#93c5fd' : '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontWeight: 600,
    minWidth: 120,
  }),
}

// ─── DraftRow component ────────────────────────────────────────────────────────

type DraftRowProps = {
  draft: DraftRow
  players: ActivePlayer[]
  currentUserId: string
  currentUserName: string
  onChange: (patch: Partial<MatchDraft>) => void
  onRemove?: () => void
}

function DraftMatchRow({ draft, players, currentUserId, currentUserName, onChange, onRemove }: DraftRowProps) {
  const selectedPlayer = players.find((p) => p.id === draft.awayPlayerId)

  return (
    <div style={S.row}>
      {/* Score + player selector row */}
      <div style={S.scoreRow}>
        {/* Home (always current user) */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={S.teamLabel}>HOME (You)</div>
          <div style={S.playerName} title={currentUserName}>
            {currentUserName.length > 12 ? currentUserName.slice(0, 11) + '…' : currentUserName}
          </div>
        </div>

        {/* Scores */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            style={S.scoreInput}
            type="number"
            min={0}
            max={99}
            placeholder="–"
            value={draft.homeScore ?? ''}
            onChange={(e) => onChange({ homeScore: e.target.value === '' ? null : Number(e.target.value) })}
          />
          <span style={S.vsText}>:</span>
          <input
            style={S.scoreInput}
            type="number"
            min={0}
            max={99}
            placeholder="–"
            value={draft.awayScore ?? ''}
            onChange={(e) => onChange({ awayScore: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>

        {/* Away player selector */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={S.teamLabel}>AWAY (Opponent)</div>
          <select
            style={S.select}
            value={draft.awayPlayerId}
            onChange={(e) => onChange({ awayPlayerId: e.target.value })}
          >
            <option value="">Select player…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        {onRemove ? (
          <button style={S.removeBtn} onClick={onRemove} title="Remove match" aria-label="Remove">×</button>
        ) : (
          <div style={{ width: 22 }} />
        )}
      </div>

      {/* Odds preview — shown as soon as an opponent is selected */}
      {draft.awayPlayerId && (
        <OddsPreview
          homeId={currentUserId}
          awayId={draft.awayPlayerId}
          homeName={currentUserName}
          awayName={selectedPlayer?.displayName ?? ''}
          matchType="friendly"
          compact
        />
      )}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

let _key = 0
function nextKey() { return ++_key }

export function CreateMatchModal({ currentUserId, currentUserName, players, onClose }: Props) {
  const [drafts, setDrafts]           = useState<DraftRow[]>([
    { key: nextKey(), awayPlayerId: '', homeScore: null, awayScore: null },
  ])
  const [error, setError]             = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const addDraft = useCallback(() => {
    setDrafts((prev) => [...prev, { key: nextKey(), awayPlayerId: '', homeScore: null, awayScore: null }])
  }, [])

  const removeDraft = useCallback((key: number) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key))
  }, [])

  const updateDraft = useCallback((key: number, patch: Partial<MatchDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }, [])

  const readyDrafts = drafts.filter((d) => d.awayPlayerId !== '')

  function handleSubmit() {
    if (readyDrafts.length === 0) { setError('Select an opponent for at least one match.'); return }
    setError(null)
    startTransition(async () => {
      try {
        await createMatchesBatchAction(
          readyDrafts.map(({ awayPlayerId, homeScore, awayScore }) => ({ awayPlayerId, homeScore, awayScore }))
        )
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    })
  }

  const submitLabel = isPending
    ? 'Creating…'
    : `Create ${readyDrafts.length} Match${readyDrafts.length !== 1 ? 'es' : ''}`

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal} role="dialog" aria-modal="true" aria-label="Create friendly matches">
        <div style={S.header}>
          <h2 style={S.title}>Create Friendly Matches</h2>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <p style={S.subtitle}>
          You (<strong>{currentUserName}</strong>) are home player in every match.
          Add as many opponents as you like, then submit all at once.
        </p>

        {drafts.map((draft) => (
          <DraftMatchRow
            key={draft.key}
            draft={draft}
            players={players}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onChange={(patch) => updateDraft(draft.key, patch)}
            onRemove={drafts.length > 1 ? () => removeDraft(draft.key) : undefined}
          />
        ))}

        <button style={S.addBtn} onClick={addDraft} disabled={isPending}>
          + Add another match
        </button>

        {error && <p style={S.error}>{error}</p>}

        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            style={S.submitBtn(isPending || readyDrafts.length === 0)}
            onClick={handleSubmit}
            disabled={isPending || readyDrafts.length === 0}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
