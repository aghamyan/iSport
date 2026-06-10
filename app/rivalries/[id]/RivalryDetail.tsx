'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import supabase from '@/lib/supabase/client'
import { deleteRivalryAction } from '../actions'
import { RecordMatchModal } from '../RecordMatchModal'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Rivalry = {
  id: string
  bestOf: number
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
  player1Wins: number
  player2Wins: number
  winnerId: string | null
  status: 'active' | 'completed'
  createdAt: string
  completedAt: string | null
}

type MatchRecord = {
  id: string
  homePlayerId: string
  awayPlayerId: string
  homeScore: number
  awayScore: number
  confirmedAt: string
}

type Props = {
  rivalry: Rivalry
  initialMatches: MatchRecord[]
  currentUserId: string
  isAdmin: boolean
  badgeEarnedAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ProgressBar({ wins, bestOf, color }: { wins: number; bestOf: number; color: string }) {
  const pct = Math.min((wins / bestOf) * 100, 100)
  return (
    <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 4,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RivalryDetail({ rivalry: initial, initialMatches, currentUserId, isAdmin, badgeEarnedAt }: Props) {
  const [rivalry, setRivalry] = useState<Rivalry>(initial)
  const [matches, setMatches] = useState<MatchRecord[]>(initialMatches)
  const [showRecord, setShowRecord] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  const isParticipant = rivalry.player1Id === currentUserId || rivalry.player2Id === currentUserId
  const canRecord = rivalry.status === 'active' && (isParticipant || isAdmin)

  // Realtime: update rivalry scores live
  useEffect(() => {
    const channel = supabase
      .channel(`rivalry-${rivalry.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rivalries', filter: `id=eq.${rivalry.id}` },
        (payload) => {
          const r = payload.new as Record<string, unknown>
          setRivalry((prev) => ({
            ...prev,
            player1Wins: r.player1_wins as number,
            player2Wins: r.player2_wins as number,
            winnerId:    r.winner_id as string | null,
            status:      r.status as 'active' | 'completed',
            completedAt: r.completed_at as string | null,
          }))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [rivalry.id])

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteRivalryAction(rivalry.id)
        window.location.href = '/rivalries'
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : 'Failed to delete.')
      }
    })
  }

  const p1 = rivalry.player1Name
  const p2 = rivalry.player2Name
  const totalMatches = matches.length
  const winnerName = rivalry.winnerId === rivalry.player1Id ? p1
    : rivalry.winnerId === rivalry.player2Id ? p2 : null

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
        <Link href="/rivalries" style={{ color: '#6b7280', textDecoration: 'none' }}>
          Rivalries
        </Link>
        {' /'}
      </div>

      {/* Winner banner */}
      {rivalry.status === 'completed' && winnerName && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            border: '1px solid #fbbf24', borderRadius: 12,
            padding: '14px 20px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span style={{ fontSize: 28 }}>🏆</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#92400e' }}>
              {winnerName} won the series!
            </div>
            {badgeEarnedAt && (
              <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                Rivalry Champion badge earned on {new Date(badgeEarnedAt).toLocaleDateString()}
              </div>
            )}
          </div>
          <Link
            href={`/players/${rivalry.winnerId}`}
            style={{
              marginLeft: 'auto', fontSize: 12, fontWeight: 600,
              color: '#92400e', textDecoration: 'none',
              background: 'rgba(255,255,255,0.5)', padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            View profile →
          </Link>
        </div>
      )}

      {/* Series scoreboard */}
      <div
        style={{
          border: '1px solid #e5e7eb', borderRadius: 14,
          padding: '24px 28px', background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 24,
        }}
      >
        {/* Big score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div
              style={{
                fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 4,
                ...(rivalry.winnerId === rivalry.player1Id ? { color: '#d97706' } : {}),
              }}
            >
              {p1}
              {rivalry.winnerId === rivalry.player1Id && ' 🏆'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 100, justifyContent: 'center' }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#111827', lineHeight: 1 }}>
              {rivalry.player1Wins}
            </span>
            <span style={{ fontSize: 24, color: '#d1d5db', fontWeight: 700 }}>–</span>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#111827', lineHeight: 1 }}>
              {rivalry.player2Wins}
            </span>
          </div>

          <div style={{ flex: 1, textAlign: 'left' }}>
            <div
              style={{
                fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 4,
                ...(rivalry.winnerId === rivalry.player2Id ? { color: '#d97706' } : {}),
              }}
            >
              {rivalry.winnerId === rivalry.player2Id && '🏆 '}
              {p2}
            </div>
          </div>
        </div>

        {/* Progress bars */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', width: 90, textAlign: 'right', flexShrink: 0 }}>
              {rivalry.player1Wins}/{rivalry.bestOf}
            </span>
            <ProgressBar wins={rivalry.player1Wins} bestOf={rivalry.bestOf} color="#2563eb" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', width: 90, textAlign: 'right', flexShrink: 0 }}>
              {rivalry.player2Wins}/{rivalry.bestOf}
            </span>
            <ProgressBar wins={rivalry.player2Wins} bestOf={rivalry.bestOf} color="#7c3aed" />
          </div>
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 12, color: '#9ca3af',
          }}
        >
          <span>First to {rivalry.bestOf} wins · {totalMatches} match{totalMatches !== 1 ? 'es' : ''} played</span>
          <span
            style={{
              padding: '2px 9px', borderRadius: 20, fontWeight: 700, fontSize: 11,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              background: rivalry.status === 'active' ? '#dcfce7' : '#f3f4f6',
              color: rivalry.status === 'active' ? '#16a34a' : '#6b7280',
            }}
          >
            {rivalry.status === 'active' ? 'Active' : 'Completed'}
          </span>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Match History
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {canRecord && (
            <button
              onClick={() => setShowRecord(true)}
              style={{
                padding: '7px 16px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              + Record Match
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '7px 14px', border: '1px solid #fecaca',
                borderRadius: 7, background: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: '#dc2626',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Match history */}
      {matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
          No matches recorded yet.
          {canRecord && (
            <> <button
              onClick={() => setShowRecord(true)}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0 }}
            >Record the first one.</button></>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...matches].reverse().map((m, idx) => {
            // In our convention, home = player1, away = player2
            const p1Score = m.homePlayerId === rivalry.player1Id ? m.homeScore : m.awayScore
            const p2Score = m.awayPlayerId === rivalry.player2Id ? m.awayScore : m.homeScore
            const isDraw = p1Score === p2Score
            const p1Won = p1Score > p2Score
            const matchNum = matches.length - idx

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 9,
                  border: '1px solid #f3f4f6', background: '#fff', gap: 12,
                }}
              >
                <span style={{ fontSize: 11, color: '#9ca3af', width: 20, flexShrink: 0 }}>
                  #{matchNum}
                </span>

                {/* Player 1 */}
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: 13, fontWeight: p1Won ? 700 : 500,
                      color: p1Won ? '#16a34a' : isDraw ? '#6b7280' : '#9ca3af',
                    }}
                  >
                    {p1}
                  </span>
                </div>

                {/* Score */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 72, justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{p1Score}</span>
                  <span style={{ color: '#9ca3af', fontWeight: 700 }}>:</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{p2Score}</span>
                </div>

                {/* Player 2 */}
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span
                    style={{
                      fontSize: 13, fontWeight: !p1Won && !isDraw ? 700 : 500,
                      color: !p1Won && !isDraw ? '#16a34a' : isDraw ? '#6b7280' : '#9ca3af',
                    }}
                  >
                    {p2}
                  </span>
                </div>

                {/* Result chip */}
                <span
                  style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px',
                    borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: isDraw ? '#f3f4f6' : '#f0fdf4',
                    color: isDraw ? '#6b7280' : '#15803d',
                  }}
                >
                  {isDraw ? 'Draw' : (p1Won ? `${p1} wins` : `${p2} wins`)}
                </span>

                <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0 }}>
                  {new Date(m.confirmedAt).toLocaleDateString()}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Record match modal */}
      {showRecord && (
        <RecordMatchModal
          rivalryId={rivalry.id}
          player1Name={p1}
          player2Name={p2}
          onClose={() => setShowRecord(false)}
          onSuccess={(matchId, p1Score, p2Score) => {
            setShowRecord(false)
            setMatches((prev) => [
              ...prev,
              {
                id:           matchId,
                homePlayerId: rivalry.player1Id,
                awayPlayerId: rivalry.player2Id,
                homeScore:    p1Score,
                awayScore:    p2Score,
                confirmedAt:  new Date().toISOString(),
              },
            ])
          }}
        />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 12, padding: 28,
              width: 360, maxWidth: '95vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
              Delete Rivalry?
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              This will permanently delete the rivalry between <strong>{p1}</strong> and{' '}
              <strong>{p2}</strong>, including all match history. This cannot be undone.
            </p>
            {deleteError && (
              <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 20px',
                  background: isDeleting ? '#fca5a5' : '#dc2626',
                  color: '#fff', border: 'none', borderRadius: 7,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
