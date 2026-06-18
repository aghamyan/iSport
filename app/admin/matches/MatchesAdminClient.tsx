'use client'

import { useState, useTransition } from 'react'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { useTranslation } from '@/lib/i18n/context'
import { adminDeleteFriendlyMatchAction, adminUpdateFriendlyMatchAction, adminCreateFriendlyMatchAction } from './actions'

type Match = {
  id: string
  homePlayer: string
  awayPlayer: string
  homeScore: number | null
  awayScore: number | null
  status: 'pending' | 'confirmed' | 'final'
  createdAt: string
}

type Player = { id: string; name: string }

type Props = { matches: Match[]; players: Player[] }

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

function AddMatchModal({ players, onClose }: { players: Player[]; onClose: () => void }) {
  const { t } = useTranslation()
  const [homeId, setHomeId]   = useState('')
  const [awayId, setAwayId]   = useState('')
  const [homeScore, setHome]  = useState<number>(0)
  const [awayScore, setAway]  = useState<number>(0)
  const [status, setStatus]   = useState<'pending' | 'confirmed' | 'final'>('confirmed')
  const [scoresOn, setScoresOn] = useState(true)
  const [error, setError]     = useState('')
  const [pending, start]      = useTransition()

  function save() {
    if (!homeId || !awayId) { setError('Select both players'); return }
    if (homeId === awayId)  { setError('Home and away must differ'); return }
    start(async () => {
      try {
        await adminCreateFriendlyMatchAction(
          homeId, awayId,
          scoresOn ? homeScore : null,
          scoresOn ? awayScore : null,
          status,
        )
        onClose()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  const sel: React.CSSProperties = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Add Friendly Match</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>HOME PLAYER</div>
            <select value={homeId} onChange={(e) => setHomeId(e.target.value)} style={sel}>
              <option value="">— select —</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>AWAY PLAYER</div>
            <select value={awayId} onChange={(e) => setAwayId(e.target.value)} style={sel}>
              <option value="">— select —</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={scoresOn} onChange={(e) => setScoresOn(e.target.checked)} />
            Enter scores
          </label>
        </div>

        {scoresOn && (
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
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('admin.matches.col.status')}
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} style={sel}>
            <option value="pending">{t('admin.status.pending')}</option>
            <option value="confirmed">{t('admin.status.confirmed')}</option>
            <option value="final">{t('admin.status.final')}</option>
          </select>
        </div>

        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btn('#374151', '#f3f4f6')}>{t('common.cancel')}</button>
          <button onClick={save} disabled={pending} style={S.btn('#fff', '#16a34a')}>
            {pending ? 'Creating…' : 'Create Match'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditMatchModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const { t } = useTranslation()
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
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('admin.matches.editTitle')}</h2>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('admin.matches.col.status')}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%' }}
          >
            <option value="pending">{t('admin.status.pending')}</option>
            <option value="confirmed">{t('admin.status.confirmed')}</option>
            <option value="final">{t('admin.status.final')}</option>
          </select>
        </div>

        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btn('#374151', '#f3f4f6')}>{t('common.cancel')}</button>
          <button onClick={save} disabled={pending} style={S.btn('#fff', '#2563eb')}>
            {pending ? t('common.saving') : t('admin.matches.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  )
}

function MatchRow({
  match,
  deleting,
  onEdit,
  onDelete,
}: {
  match: Match
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const sc = STATUS_COLORS[match.status]

  return (
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
          <button onClick={onEdit} style={S.btn('#374151', '#f3f4f6')}>{t('common.edit')}</button>
          <button onClick={onDelete} disabled={deleting} style={S.btn('#fff', '#dc2626')}>{t('common.delete')}</button>
        </div>
      </td>
    </tr>
  )
}

export function MatchesAdminClient({ matches, players }: Props) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'final'>('all')
  const [editing, setEditing] = useState<Match | null>(null)
  const [confirming, setConfirming] = useState<Match | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [pending, start] = useTransition()

  const visible = filter === 'all' ? matches : matches.filter((m) => m.status === filter)

  const FILTER_LABELS: Record<string, string> = {
    all:       t('rivalry.filter.all'),
    pending:   t('admin.status.pending'),
    confirmed: t('admin.status.confirmed'),
    final:     t('admin.status.final'),
  }

  function doDelete() {
    if (!confirming) return

    start(async () => {
      try {
        setDeleteError('')
        await adminDeleteFriendlyMatchAction(confirming.id)
        setConfirming(null)
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : t('home.err.failedDelete'))
      }
    })
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>{t('admin.card.matches')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {t(matches.length !== 1 ? 'admin.matches.count.many' : 'admin.matches.count.one', { n: matches.length })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setAdding(true)}
            style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
          >
            + Add Match
          </button>
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
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {deleteError && (
        <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
          {deleteError}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {[
                t('admin.matches.col.match'),
                t('admin.matches.col.score'),
                t('admin.matches.col.status'),
                t('admin.matches.col.actions'),
              ].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                deleting={pending && confirming?.id === m.id}
                onEdit={() => setEditing(m)}
                onDelete={() => {
                  setDeleteError('')
                  setConfirming(m)
                }}
              />
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>{t('admin.matches.noMatches')}</div>
        )}
      </div>

      {adding && <AddMatchModal players={players} onClose={() => setAdding(false)} />}
      {editing && <EditMatchModal match={editing} onClose={() => setEditing(null)} />}
      {confirming && (
        <ConfirmDialog
          title={t('admin.matches.deleteTitle')}
          message={t('admin.matches.deleteMsg', { home: confirming.homePlayer, away: confirming.awayPlayer })}
          confirmLabel={pending ? t('common.deleting') : t('common.delete')}
          danger
          onConfirm={doDelete}
          onCancel={() => {
            if (!pending) setConfirming(null)
          }}
        />
      )}
    </div>
  )
}
