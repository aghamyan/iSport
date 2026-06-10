'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createChampionshipAction } from './actions'
import { splitIntoGroups } from '@/lib/championships/groupKnockout'

export type PlayerOption = {
  id: string
  displayName: string
}

type Props = {
  players: PlayerOption[]
  onClose: () => void
}

type Format = 'round_robin' | 'group_knockout' | 'group_playoff'

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
    width: 560,
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 22,
    color: '#6b7280',
    lineHeight: 1,
    padding: 0,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 7,
    fontSize: 14,
    boxSizing: 'border-box' as const,
    marginBottom: 16,
  },
  formatRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
  },
  formatBtn: (selected: boolean) => ({
    flex: 1,
    padding: '10px 14px',
    border: `2px solid ${selected ? '#2563eb' : '#e5e7eb'}`,
    borderRadius: 8,
    background: selected ? '#eff6ff' : '#fafafa',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.1s',
  }),
  formatBtnTitle: (selected: boolean) => ({
    fontSize: 13,
    fontWeight: 700,
    color: selected ? '#1d4ed8' : '#374151',
    display: 'block',
    marginBottom: 2,
  }),
  formatBtnDesc: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 1.4,
  },
  cycleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cycleInput: {
    width: 72,
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 7,
    fontSize: 14,
    textAlign: 'center' as const,
  },
  cycleNote: { fontSize: 12, color: '#9ca3af' },
  playersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
    marginBottom: 16,
    maxHeight: 240,
    overflowY: 'auto' as const,
    padding: '4px 2px',
  },
  playerChip: (selected: boolean) => ({
    padding: '8px 12px',
    border: `2px solid ${selected ? '#2563eb' : '#e5e7eb'}`,
    borderRadius: 8,
    background: selected ? '#eff6ff' : '#fafafa',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: selected ? 600 : 400,
    color: selected ? '#1d4ed8' : '#374151',
    textAlign: 'left' as const,
    transition: 'all 0.1s',
  }),
  selectionNote: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  groupPreview: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 16,
    padding: 12,
    background: '#f9fafb',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  },
  groupCol: {
    fontSize: 12,
  },
  groupColTitle: {
    fontWeight: 700,
    color: '#374151',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  groupColPlayer: {
    color: '#6b7280',
    lineHeight: 1.6,
  },
  error: { color: '#dc2626', fontSize: 13, margin: '8px 0' },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  cancelBtn: {
    padding: '8px 18px',
    border: '1px solid #d1d5db',
    borderRadius: 7,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  submitBtn: (disabled: boolean) => ({
    padding: '8px 20px',
    background: disabled ? '#93c5fd' : '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontWeight: 600,
    minWidth: 140,
  }),
}

export function CreateChampionshipModal({ players, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [format, setFormat] = useState<Format>('round_robin')
  const [cycles, setCycles] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [playedAt, setPlayedAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedList = Array.from(selectedIds)
  const n = selectedList.length

  const matchCount =
    format === 'round_robin' && n >= 2
      ? ((n * (n - 1)) / 2) * cycles
      : 0

  const canUseGroupKnockout = n >= 4
  const canUseGroupPlayoff = n >= 4

  const groupPreview =
    format === 'group_knockout' && n >= 7
      ? splitIntoGroups(selectedList)
      : null

  function getGroupMatchCount(groupSize: number) {
    return ((groupSize * (groupSize - 1)) / 2) * cycles
  }

  const groupKnockoutMatchCount =
    groupPreview
      ? getGroupMatchCount(groupPreview.groupA.length) +
        getGroupMatchCount(groupPreview.groupB.length) +
        4 + // 2 semi-final ties × 2 legs
        1   // final
      : 0

  const groupPlayoffMatchCount = n >= 4
    ? ((n * (n - 1)) / 2) * cycles + 2 + 1  // group stage + 2 semis + 1 final
    : 0

  function handleSubmit() {
    if (!name.trim()) { setError('Championship name is required.'); return }
    if (format === 'round_robin' && n < 2) { setError('Select at least 2 players.'); return }
    if (format === 'group_knockout' && n < 4) { setError('Group Knockout requires at least 4 players.'); return }
    if (format === 'group_playoff' && n < 4) { setError('Group Playoff requires at least 4 players.'); return }
    if (cycles < 1 || cycles > 10) { setError('Cycles must be between 1 and 10.'); return }
    setError(null)

    startTransition(async () => {
      try {
        const { id } = await createChampionshipAction(
          name.trim(), cycles, selectedList, format, playedAt || null
        )
        onClose()
        router.push(`/championships/${id}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    })
  }

  const isDisabled = isPending || n < (['group_knockout', 'group_playoff'].includes(format) ? 4 : 2) || !name.trim()

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal} role="dialog" aria-modal="true" aria-label="Create championship">
        <div style={S.header}>
          <h2 style={S.title}>New Championship</h2>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <label style={S.label}>Championship name</label>
        <input
          style={S.input}
          type="text"
          placeholder="e.g. Season 1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          autoFocus
        />

        <label style={S.label}>
          Championship date{' '}
          <span style={{ fontWeight: 400, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>
            (optional — set for past championships)
          </span>
        </label>
        <input
          style={{ ...S.input, marginBottom: 4 }}
          type="date"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          disabled={isPending}
          max={new Date().toISOString().slice(0, 10)}
        />
        {playedAt && (
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 16px' }}>
            All matches will be timestamped to this date so they don&apos;t appear in
            &quot;recent matches&quot; for players who played newer championships after it.
          </p>
        )}

        <label style={S.label}>Format</label>
        <div style={S.formatRow}>
          <button
            style={S.formatBtn(format === 'round_robin')}
            onClick={() => setFormat('round_robin')}
            disabled={isPending}
          >
            <span style={S.formatBtnTitle(format === 'round_robin')}>Round Robin</span>
            <span style={S.formatBtnDesc}>Everyone plays everyone. Simple league table.</span>
          </button>
          <button
            style={S.formatBtn(format === 'group_knockout')}
            onClick={() => { if (canUseGroupKnockout) setFormat('group_knockout') }}
            disabled={isPending || !canUseGroupKnockout}
            title={!canUseGroupKnockout ? 'Requires 4+ players' : undefined}
          >
            <span style={S.formatBtnTitle(format === 'group_knockout')}>Group Knockout</span>
            <span style={S.formatBtnDesc}>
              2 groups → top 2 advance → semi-finals (home & away) → final.{' '}
              {!canUseGroupKnockout && <strong>Needs 4+ players.</strong>}
            </span>
          </button>
          <button
            style={S.formatBtn(format === 'group_playoff')}
            onClick={() => { if (canUseGroupPlayoff) setFormat('group_playoff') }}
            disabled={isPending || !canUseGroupPlayoff}
            title={!canUseGroupPlayoff ? 'Requires 4+ players' : undefined}
          >
            <span style={S.formatBtnTitle(format === 'group_playoff')}>Group Playoff</span>
            <span style={S.formatBtnDesc}>
              Single group → top 4 advance → semi-finals → final.{' '}
              {!canUseGroupPlayoff && <strong>Needs 4+ players.</strong>}
            </span>
          </button>
        </div>

        <label style={S.label}>
          {format === 'round_robin' ? 'Number of cycles' : 'Group stage cycles'}
        </label>
        <div style={S.cycleRow}>
          <input
            style={S.cycleInput}
            type="number"
            min={1}
            max={10}
            value={cycles}
            onChange={(e) => setCycles(Math.max(1, Math.min(10, Number(e.target.value))))}
            disabled={isPending}
          />
          <span style={S.cycleNote}>
            {format === 'round_robin'
              ? '1 cycle = each pair plays once. 2 cycles = home + away swap.'
              : '1 cycle = each pair plays once in the group.'}
          </span>
        </div>

        <label style={S.label}>Players ({n} selected)</label>
        <div style={S.playersGrid}>
          {players.map((p) => (
            <button
              key={p.id}
              style={S.playerChip(selectedIds.has(p.id))}
              onClick={() => togglePlayer(p.id)}
              disabled={isPending}
            >
              {selectedIds.has(p.id) ? '✓ ' : ''}{p.displayName}
            </button>
          ))}
        </div>

        {/* Group preview for group_knockout */}
        {groupPreview && (
          <div style={S.groupPreview}>
            <div style={S.groupCol}>
              <div style={S.groupColTitle}>Group A</div>
              {groupPreview.groupA.map((id) => {
                const p = players.find((x) => x.id === id)
                return <div key={id} style={S.groupColPlayer}>{p?.displayName ?? id}</div>
              })}
            </div>
            <div style={S.groupCol}>
              <div style={S.groupColTitle}>Group B</div>
              {groupPreview.groupB.map((id) => {
                const p = players.find((x) => x.id === id)
                return <div key={id} style={S.groupColPlayer}>{p?.displayName ?? id}</div>
              })}
            </div>
          </div>
        )}

        {format === 'round_robin' && matchCount > 0 && (
          <p style={S.selectionNote}>
            This will generate <strong>{matchCount}</strong> match
            {matchCount !== 1 ? 'es' : ''} across <strong>{cycles}</strong> cycle
            {cycles !== 1 ? 's' : ''}.
          </p>
        )}
        {format === 'group_knockout' && groupPreview && (
          <p style={S.selectionNote}>
            Group stage: <strong>{groupKnockoutMatchCount - 5}</strong> matches across{' '}
            <strong>{cycles}</strong> cycle{cycles !== 1 ? 's' : ''}. Plus 4 semi-final legs +
            1 final = <strong>{groupKnockoutMatchCount}</strong> total.
          </p>
        )}
        {format === 'group_playoff' && n >= 4 && (
          <p style={S.selectionNote}>
            Group stage: <strong>{((n * (n - 1)) / 2) * cycles}</strong> matches across{' '}
            <strong>{cycles}</strong> cycle{cycles !== 1 ? 's' : ''}. Plus 2 semi-finals +
            1 final = <strong>{groupPlayoffMatchCount}</strong> total.
          </p>
        )}

        {error && <p style={S.error}>{error}</p>}

        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            style={S.submitBtn(isDisabled)}
            onClick={handleSubmit}
            disabled={isDisabled}
          >
            {isPending ? 'Creating…' : 'Create Championship'}
          </button>
        </div>
      </div>
    </div>
  )
}
