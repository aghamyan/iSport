'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import {
  adminDeleteChampionshipAction,
  adminSetChampionshipActiveAction,
  adminUpdateChampionshipMatchAction,
  adminDeleteChampionshipMatchAction,
} from './actions'

type CMatch = {
  id: string
  homePlayer: string
  awayPlayer: string
  homeScore: number | null
  awayScore: number | null
  status: 'pending' | 'confirmed' | 'final'
  cycle: number
}

type Championship = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  playerCount: number
  matches: CMatch[]
}

type Props = { championships: Championship[] }

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
}

function EditCMatchModal({
  champId,
  match,
  onClose,
}: {
  champId: string
  match: CMatch
  onClose: () => void
}) {
  const [homeScore, setHome] = useState(match.homeScore ?? 0)
  const [awayScore, setAway] = useState(match.awayScore ?? 0)
  const [status, setStatus]  = useState<'pending' | 'confirmed' | 'final'>(match.status)
  const [error, setError]    = useState('')
  const [pending, start]     = useTransition()

  function save() {
    start(async () => {
      try {
        await adminUpdateChampionshipMatchAction(champId, match.id, homeScore, awayScore, status)
        onClose()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit Match</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Cycle {match.cycle}: {match.homePlayer} vs {match.awayPlayer}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {[['HOME', homeScore, setHome], ['AWAY', awayScore, setAway]].map(([label, val, setter], i) => (
            <div key={String(label)}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{label}</div>
              <input
                type="number" min={0} max={99}
                value={val as number}
                onChange={(e) => (setter as (v: number) => void)(Number(e.target.value))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 52, textAlign: 'center' }}
              />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%' }}>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="final">Final (locked)</option>
          </select>
        </div>
        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btn('#374151', '#f3f4f6')}>Cancel</button>
          <button onClick={save} disabled={pending} style={S.btn('#fff', '#2563eb')}>{pending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function ChampionshipRow({ champ }: { champ: Championship }) {
  const [expanded, setExpanded]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editMatch, setEditMatch]   = useState<CMatch | null>(null)
  const [confirmMatchDel, setConfirmMatchDel] = useState<CMatch | null>(null)
  const [pending, start]            = useTransition()

  function doDeleteChamp() {
    start(async () => {
      await adminDeleteChampionshipAction(champ.id)
      setConfirmDelete(false)
    })
  }

  function doDeleteMatch() {
    if (!confirmMatchDel) return
    start(async () => {
      await adminDeleteChampionshipMatchAction(champ.id, confirmMatchDel.id)
      setConfirmMatchDel(null)
    })
  }

  function toggleActive() {
    start(async () => { await adminSetChampionshipActiveAction(champ.id, !champ.isActive) })
  }

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{champ.name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: champ.isActive ? '#dcfce7' : '#f3f4f6', color: champ.isActive ? '#16a34a' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {champ.isActive ? 'Active' : 'Ended'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {champ.playerCount} players · {champ.matches.length} matches · {new Date(champ.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href={`/championships/${champ.id}`} style={{ ...S.btn('#374151', '#f3f4f6'), textDecoration: 'none', display: 'inline-block' }}>
              View
            </Link>
            <button onClick={toggleActive} disabled={pending} style={S.btn('#fff', champ.isActive ? '#d97706' : '#16a34a')}>
              {champ.isActive ? 'Mark Complete' : 'Reactivate'}
            </button>
            <button onClick={() => setExpanded(!expanded)} style={S.btn('#2563eb', '#eff6ff')}>
              {expanded ? 'Hide Matches' : 'Matches'}
            </button>
            <button onClick={() => setConfirmDelete(true)} disabled={pending} style={S.btn('#fff', '#dc2626')}>Delete</button>
          </div>
        </div>

        {expanded && (
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 20px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['Cycle', 'Match', 'Score', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {champ.matches.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '8px', fontSize: 12, color: '#6b7280' }}>{m.cycle}</td>
                    <td style={{ padding: '8px', fontSize: 13 }}>{m.homePlayer} vs {m.awayPlayer}</td>
                    <td style={{ padding: '8px', fontSize: 13, fontWeight: 600 }}>
                      {m.homeScore !== null ? `${m.homeScore} – ${m.awayScore}` : '—'}
                    </td>
                    <td style={{ padding: '8px', fontSize: 12 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: m.status === 'final' ? '#dcfce7' : m.status === 'confirmed' ? '#dbeafe' : '#fef3c7', color: m.status === 'final' ? '#16a34a' : m.status === 'confirmed' ? '#2563eb' : '#d97706' }}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditMatch(m)} style={S.btn('#374151', '#f3f4f6')}>Edit</button>
                        <button onClick={() => setConfirmMatchDel(m)} style={S.btn('#fff', '#dc2626')}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${champ.name}"?`}
          message="All matches and standings will be permanently deleted. Player career stats will be recomputed."
          confirmLabel="Delete Championship"
          danger
          onConfirm={doDeleteChamp}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {editMatch && (
        <EditCMatchModal champId={champ.id} match={editMatch} onClose={() => setEditMatch(null)} />
      )}
      {confirmMatchDel && (
        <ConfirmDialog
          title="Delete match?"
          message={`Cycle ${confirmMatchDel.cycle}: ${confirmMatchDel.homePlayer} vs ${confirmMatchDel.awayPlayer} will be removed and standings recomputed.`}
          confirmLabel="Delete"
          danger
          onConfirm={doDeleteMatch}
          onCancel={() => setConfirmMatchDel(null)}
        />
      )}
    </>
  )
}

export function ChampAdminClient({ championships }: Props) {
  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>Championships</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          {championships.length} championship{championships.length !== 1 ? 's' : ''} · Create new ones from the{' '}
          <Link href="/championships" style={{ color: '#2563eb' }}>Championships page</Link>
        </p>
      </div>

      {championships.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          No championships yet.
        </div>
      ) : (
        championships.map((c) => <ChampionshipRow key={c.id} champ={c} />)
      )}
    </div>
  )
}
