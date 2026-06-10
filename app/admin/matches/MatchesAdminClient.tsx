'use client'

import { useState, useTransition } from 'react'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { adminDeleteFriendlyMatchAction, adminUpdateFriendlyMatchAction } from './actions'

type Match = {
  id: string
  homePlayer: string
  awayPlayer: string
  homeScore: number | null
  awayScore: number | null
  status: 'pending' | 'confirmed' | 'final'
  createdAt: string
}

type Props = { matches: Match[] }

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending:   { color: '#d97706', bg: '#fef3c7' },
  confirmed: { color: '#2563eb', bg: '#dbeafe' },
  final:     { color: '#16a34a', bg: '#dcfce7' },
}

const S = {
  btn: (color: string, bg: string): React.CSSProperties => ({
    padding: '5px 10px',
    background: bg,
    color,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  }),
  input: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    width: 52,
    textAlign: 'center' as const,
  } as React.CSSProperties,
}

function EditMatchModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const [homeScore, setHome] = useState(match.homeScore ?? 0)
  const [awayScore, setAway] = useState(match.awayScore ?? 0)
  const [status, setStatus]  = useState<'pending' | 'confirmed' | 'final'>(match.status)
  const [error, setError]    = useState('')
  const [pending, start]     = useTransition()

  function save() {
    start(async () => {
      try {
        await adminUpdateFriendlyMatchAction(match.id, homeScore, awayScore, status)
        onClose()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit Match</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          {match.homePlayer} vs {match.awayPlayer}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>HOME</div>
            <input type="number" min={0} max={99} value={homeScore} onChange={(e) => setHome(Number(e.target.value))} style={S.input} />
          </div>
          <span style={{ fontSize: 18, color: '#9ca3af', marginTop: 16 }}>–</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>AWAY</div>
            <input type="number" min={0} max={99} value={awayScore} onChange={(e) => setAway(Number(e.target.value))} style={S.input} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%' }}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="final">Final (locked)</option>
          </select>
        </div>

        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btn('#374151', '#f3f4f6')}>Cancel</button>
          <button onClick={save} disabled={pending} style={S.btn('#fff', '#2563eb')}>
            {pending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MatchRow({ match }: { match: Match }) {
  const [editing, setEditing]   = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [pending, start]        = useTransition()
  const sc = STATUS_COLORS[match.status]

  function doDelete() {
    start(async () => {
      await adminDeleteFriendlyMatchAction(match.id)
      setConfirm(false)
    })
  }

  return (
    <>
      <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
        <td style={{ padding: '12px 16px', fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: '#111827' }}>
            {match.homePlayer} <span style={{ color: '#9ca3af' }}>vs</span> {match.awayPlayer}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {new Date(match.createdAt).toLocaleDateString()}
          </div>
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {match.homeScore !== null ? `${match.homeScore} – ${match.awayScore}` : '— : —'}
        </td>
        <td style={{ padding: '12px 16px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {match.status}
          </span>
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(true)} style={S.btn('#374151', '#f3f4f6')}>Edit</button>
            <button onClick={() => setConfirm(true)} disabled={pending} style={S.btn('#fff', '#dc2626')}>Delete</button>
          </div>
        </td>
      </tr>
      {editing && <EditMatchModal match={match} onClose={() => setEditing(false)} />}
      {confirm && (
        <ConfirmDialog
          title="Delete match?"
          message={`${match.homePlayer} vs ${match.awayPlayer} will be permanently deleted and player stats will be recomputed.`}
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  )
}

export function MatchesAdminClient({ matches }: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'final'>('all')

  const visible = filter === 'all' ? matches : matches.filter((m) => m.status === filter)

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>Matches</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{matches.length} friendly match{matches.length !== 1 ? 'es' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'pending', 'confirmed', 'final'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                border: '1px solid',
                borderColor: filter === f ? '#2563eb' : '#d1d5db',
                borderRadius: 8,
                background: filter === f ? '#eff6ff' : '#fff',
                color: filter === f ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Match', 'Score', 'Status', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => <MatchRow key={m.id} match={m} />)}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No matches found.</div>
        )}
      </div>
    </div>
  )
}
