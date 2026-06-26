'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import supabase from '@/lib/supabase/client'
import { deleteRivalryAction, setRivalryScoreAction, setRivalryHistoryAction } from '../actions'
import { RecordMatchModal } from '../RecordMatchModal'
import { useTranslation } from '@/lib/i18n/context'
import { BottomNav } from '@/app/components/BottomNav'

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
  draws: number
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

// ─── Main component ───────────────────────────────────────────────────────────

export function RivalryDetail({ rivalry: initial, initialMatches, currentUserId, isAdmin, badgeEarnedAt }: Props) {
  const { t } = useTranslation()
  const [rivalry, setRivalry] = useState<Rivalry>(initial)
  const [matches, setMatches] = useState<MatchRecord[]>(initialMatches)
  const [showRecord, setShowRecord] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  const [showEditScore, setShowEditScore] = useState(false)
  const [editP1Wins, setEditP1Wins] = useState(rivalry.player1Wins)
  const [editP2Wins, setEditP2Wins] = useState(rivalry.player2Wins)
  const [editDraws, setEditDraws] = useState(rivalry.draws)
  const [editScoreError, setEditScoreError] = useState<string | null>(null)
  const [isSavingScore, startSaveScoreTransition] = useTransition()

  const [showSetHistory, setShowSetHistory] = useState(false)
  const [histP1Wins, setHistP1Wins] = useState(rivalry.player1Wins)
  const [histP2Wins, setHistP2Wins] = useState(rivalry.player2Wins)
  const [histDraws, setHistDraws] = useState(rivalry.draws)
  const [histError, setHistError] = useState<string | null>(null)
  const [isSavingHistory, startSaveHistoryTransition] = useTransition()

  const isParticipant = rivalry.player1Id === currentUserId || rivalry.player2Id === currentUserId
  const canRecord = isParticipant || isAdmin

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
            draws:       r.draws as number,
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
  const recordedMatches = matches.length
  const totalMatches = rivalry.player1Wins + rivalry.player2Wins + rivalry.draws
  const winnerName = rivalry.winnerId === rivalry.player1Id ? p1
    : rivalry.winnerId === rivalry.player2Id ? p2 : null

  return (
    <div className="app-page page-content-wide" style={{ padding: '28px 16px', paddingBottom: 'var(--nav-h)', fontFamily: 'system-ui, sans-serif' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 16 }}>
        <Link href="/rivalries" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
          {t('rivalry.title')}
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
          <Trophy size={28} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#92400e' }}>
              {t('rivalry.wonSeries', { name: winnerName })}
            </div>
            {badgeEarnedAt && (
              <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                {t('rivalry.badgeEarned', { date: new Date(badgeEarnedAt).toLocaleDateString() })}
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
            {t('rivalry.viewProfile')}
          </Link>
        </div>
      )}

      {/* Series scoreboard */}
      <div
        style={{
          border: '1px solid #e5e7eb', borderRadius: 14,
          padding: '24px 28px', background: 'var(--card)',
          boxShadow: '0 2px 8px rgba(var(--rgb-overlay),0.06)',
          marginBottom: 24,
        }}
      >
        {/* Big score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
            <div
              style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text2)', marginBottom: 4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                ...(rivalry.winnerId === rivalry.player1Id ? { color: 'var(--gold)' } : {}),
              }}
            >
              {rivalry.winnerId === rivalry.player1Id && <Trophy size={13} style={{ color: 'var(--gold)', marginRight: 4, verticalAlign: 'middle' }} />}
              {p1}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 90, justifyContent: 'center' }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
              {rivalry.player1Wins}
            </span>
            <span style={{ fontSize: 20, color: 'var(--border)', fontWeight: 700 }}>–</span>
            <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
              {rivalry.player2Wins}
            </span>
          </div>

          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div
              style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text2)', marginBottom: 4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                ...(rivalry.winnerId === rivalry.player2Id ? { color: 'var(--gold)' } : {}),
              }}
            >
              {rivalry.winnerId === rivalry.player2Id && <Trophy size={13} style={{ color: 'var(--gold)', marginRight: 4, verticalAlign: 'middle' }} />}
              {p2}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--muted2)',
          }}
        >
          <span>
            {t('rivalry.scoreMeta', { target: rivalry.bestOf, played: totalMatches })}
            {recordedMatches < totalMatches && (
              <span style={{ color: 'var(--muted2)' }}> {t('rivalry.recorded', { n: recordedMatches })}</span>
            )}
          </span>
          {rivalry.draws > 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
              {rivalry.draws === 1
                ? `${rivalry.draws} ${t('rivalry.draw.one')}`
                : t('rivalry.draws', { n: rivalry.draws })}
            </span>
          )}
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t('rivalry.matchHistory')}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isParticipant && matches.length === 0 && rivalry.status !== 'completed' && (
            <button
              onClick={() => {
                setHistP1Wins(rivalry.player1Wins)
                setHistP2Wins(rivalry.player2Wins)
                setHistDraws(rivalry.draws)
                setHistError(null)
                setShowSetHistory(true)
              }}
              style={{
                padding: '7px 14px', border: '1px solid #d1d5db',
                borderRadius: 7, background: 'var(--card)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--text2)',
              }}
            >
              {t('rivalry.setPriorRecord')}
            </button>
          )}
          {canRecord && (
            <button
              onClick={() => setShowRecord(true)}
              style={{
                padding: '7px 16px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              {t('rivalry.recordSession')}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                setEditP1Wins(rivalry.player1Wins)
                setEditP2Wins(rivalry.player2Wins)
                setEditDraws(rivalry.draws)
                setEditScoreError(null)
                setShowEditScore(true)
              }}
              style={{
                padding: '7px 14px', border: '1px solid #d1d5db',
                borderRadius: 7, background: 'var(--card)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--text2)',
              }}
            >
              {t('rivalry.editScore')}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '7px 14px', border: '1px solid #fecaca',
                borderRadius: 7, background: 'var(--card)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--accent)',
              }}
            >
              {t('common.delete')}
            </button>
          )}
        </div>
      </div>

      {/* Match history */}
      {matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted2)', fontSize: 14 }}>
          {t('rivalry.noMatchesYet')}
          {canRecord && (
            <> <button
              onClick={() => setShowRecord(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: 0 }}
            >{t('rivalry.recordFirstOne')}</button></>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...matches].reverse().map((m, idx) => {
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
                  border: '1px solid var(--border)', background: 'var(--card)', gap: 12,
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--muted2)', width: 20, flexShrink: 0 }}>
                  #{matchNum}
                </span>

                {/* Player 1 */}
                <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13, fontWeight: p1Won ? 700 : 500,
                      color: p1Won ? 'var(--win)' : isDraw ? 'var(--muted)' : 'var(--muted2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                    }}
                  >
                    {p1}
                  </span>
                </div>

                {/* Score */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 60, justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{p1Score}</span>
                  <span style={{ color: 'var(--muted2)', fontWeight: 700 }}>:</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{p2Score}</span>
                </div>

                {/* Player 2 */}
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13, fontWeight: !p1Won && !isDraw ? 700 : 500,
                      color: !p1Won && !isDraw ? 'var(--win)' : isDraw ? 'var(--muted)' : 'var(--muted2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
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
                    background: isDraw ? 'var(--card3)' : 'rgba(34,197,94,0.06)',
                    color: isDraw ? '#6b7280' : '#15803d',
                    flexShrink: 0,
                  }}
                >
                  {isDraw ? t('rivalry.drawLabel') : (p1Won ? 'W1' : 'W2')}
                </span>

                <span style={{ fontSize: 11, color: 'var(--border)', flexShrink: 0 }}>
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
          defaultTarget={rivalry.bestOf}
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

      {/* Edit Score modal (admin only) */}
      {showEditScore && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowEditScore(false)}
        >
          <div
            style={{
              background: 'var(--card)', borderRadius: 12, padding: 28,
              width: 340, maxWidth: '95vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              {t('rivalry.editScore')}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
              {t('rivalry.editScoreDesc')}
            </p>

            {/* Score inputs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
              {/* Player 1 */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                  {p1}
                </div>
                <input
                  type="number"
                  min={0}
                  value={editP1Wins}
                  onChange={(e) => setEditP1Wins(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: 68, padding: '10px 6px', borderRadius: 8,
                    border: '2px solid #2563eb', fontSize: 22, fontWeight: 800,
                    color: 'var(--text)', textAlign: 'center', outline: 'none',
                  }}
                />
              </div>

              <span style={{ color: 'var(--muted2)', fontSize: 20, fontWeight: 700, marginTop: 20 }}>–</span>

              {/* Draws */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                  {t('rivalry.drawsLabel')}
                </div>
                <input
                  type="number"
                  min={0}
                  value={editDraws}
                  onChange={(e) => setEditDraws(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: 58, padding: '10px 6px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 18, fontWeight: 700,
                    color: 'var(--muted)', textAlign: 'center', outline: 'none',
                  }}
                />
              </div>

              <span style={{ color: 'var(--muted2)', fontSize: 20, fontWeight: 700, marginTop: 20 }}>–</span>

              {/* Player 2 */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                  {p2}
                </div>
                <input
                  type="number"
                  min={0}
                  value={editP2Wins}
                  onChange={(e) => setEditP2Wins(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: 68, padding: '10px 6px', borderRadius: 8,
                    border: '2px solid #7c3aed', fontSize: 22, fontWeight: 800,
                    color: 'var(--text)', textAlign: 'center', outline: 'none',
                  }}
                />
              </div>
            </div>

            {editScoreError && (
              <p style={{ color: 'var(--accent)', fontSize: 13, margin: '0 0 12px' }}>{editScoreError}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowEditScore(false)}
                disabled={isSavingScore}
                style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 7, background: 'var(--card)', cursor: 'pointer', fontSize: 14 }}
              >
                {t('common.cancel')}
              </button>
              <button
                disabled={isSavingScore}
                onClick={() => {
                  setEditScoreError(null)
                  startSaveScoreTransition(async () => {
                    try {
                      await setRivalryScoreAction(rivalry.id, editP1Wins, editP2Wins, editDraws)
                      setShowEditScore(false)
                    } catch (e) {
                      setEditScoreError(e instanceof Error ? e.message : 'Failed to save.')
                    }
                  })
                }}
                style={{
                  padding: '8px 20px',
                  background: isSavingScore ? 'rgba(var(--rgb-accent),0.5)' : 'var(--accent)',
                  color: '#fff', border: 'none', borderRadius: 7,
                  cursor: isSavingScore ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                {isSavingScore ? t('common.saving') : t('rivalry.saveScore')}
              </button>
            </div>
          </div>
        </div>
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
              background: 'var(--card)', borderRadius: 12, padding: 28,
              width: 360, maxWidth: '95vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {t('rivalry.deleteTitle')}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--muted)' }}>
              {t('rivalry.deleteDesc', { p1, p2 })}
            </p>
            {deleteError && (
              <p style={{ color: 'var(--accent)', fontSize: 13, margin: '0 0 12px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 7, background: 'var(--card)', cursor: 'pointer', fontSize: 14 }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 20px',
                  background: isDeleting ? 'rgba(var(--rgb-accent),0.5)' : 'var(--accent)',
                  color: '#fff', border: 'none', borderRadius: 7,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                {isDeleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Prior Record modal (participants only, before first match) */}
      {showSetHistory && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowSetHistory(false)}
        >
          <div
            style={{
              background: 'var(--card)', borderRadius: 12, padding: 28,
              width: 360, maxWidth: '95vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              {t('rivalry.setPriorRecord')}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
              {t('rivalry.setPriorRecordDesc')}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{p1}</div>
                <input
                  type="number"
                  min={0}
                  value={histP1Wins}
                  onChange={(e) => setHistP1Wins(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: 68, padding: '10px 6px', borderRadius: 8,
                    border: '2px solid #2563eb', fontSize: 22, fontWeight: 800,
                    color: 'var(--text)', textAlign: 'center', outline: 'none',
                  }}
                />
              </div>

              <span style={{ color: 'var(--muted2)', fontSize: 20, fontWeight: 700, marginTop: 20 }}>–</span>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{t('rivalry.drawsLabel')}</div>
                <input
                  type="number"
                  min={0}
                  value={histDraws}
                  onChange={(e) => setHistDraws(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: 58, padding: '10px 6px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 18, fontWeight: 700,
                    color: 'var(--muted)', textAlign: 'center', outline: 'none',
                  }}
                />
              </div>

              <span style={{ color: 'var(--muted2)', fontSize: 20, fontWeight: 700, marginTop: 20 }}>–</span>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{p2}</div>
                <input
                  type="number"
                  min={0}
                  value={histP2Wins}
                  onChange={(e) => setHistP2Wins(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: 68, padding: '10px 6px', borderRadius: 8,
                    border: '2px solid #7c3aed', fontSize: 22, fontWeight: 800,
                    color: 'var(--text)', textAlign: 'center', outline: 'none',
                  }}
                />
              </div>
            </div>

            {histError && (
              <p style={{ color: 'var(--accent)', fontSize: 13, margin: '0 0 12px' }}>{histError}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowSetHistory(false)}
                disabled={isSavingHistory}
                style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 7, background: 'var(--card)', cursor: 'pointer', fontSize: 14 }}
              >
                {t('common.cancel')}
              </button>
              <button
                disabled={isSavingHistory}
                onClick={() => {
                  setHistError(null)
                  startSaveHistoryTransition(async () => {
                    try {
                      await setRivalryHistoryAction(rivalry.id, histP1Wins, histP2Wins, histDraws)
                      setShowSetHistory(false)
                    } catch (e) {
                      setHistError(e instanceof Error ? e.message : 'Failed to save.')
                    }
                  })
                }}
                style={{
                  padding: '8px 20px',
                  background: isSavingHistory ? 'rgba(var(--rgb-accent),0.5)' : 'var(--accent)',
                  color: '#fff', border: 'none', borderRadius: 7,
                  cursor: isSavingHistory ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                {isSavingHistory ? t('common.saving') : t('rivalry.saveRecord')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav userId={currentUserId} />
    </div>
  )
}
