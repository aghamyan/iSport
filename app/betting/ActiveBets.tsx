'use client'

import { useState, useEffect, useCallback } from 'react'
import supabase from '@/lib/supabase/client'
import { getActiveBetsAction, getBetHistoryAction, type BetHistoryRow } from './bets/actions'
import { fmtAMD, MARKET_SHORT } from '@/lib/betting/validation'
import { useBetSlip } from '@/lib/betting/BetSlipContext'

// ─── Design tokens ────────────────────────────────────────────────────────────
const CARD   = '#0c1422'
const CARD2  = '#111d2e'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const TEXT   = '#f8fafc'
const TEXT2  = '#94a3b8'
const MUTED  = '#4b5a73'
const WIN    = '#10b981'
const LOSS   = '#ef4444'
const GOLD   = '#f59e0b'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:   { label: 'Pending',   color: GOLD,   icon: '⏳' },
  WON:       { label: 'Won',       color: WIN,    icon: '🏆' },
  LOST:      { label: 'Lost',      color: LOSS,   icon: '✗' },
  RETURNED:  { label: 'Returned',  color: ACCENT, icon: '↩' },
  CANCELLED: { label: 'Cancelled', color: MUTED,  icon: '✕' },
}

const LEG_RESULT_COLOR: Record<string, string> = {
  PENDING: MUTED,
  WON:     WIN,
  LOST:    LOSS,
  RETURNED:ACCENT,
}

// ─── Single bet row ───────────────────────────────────────────────────────────

function BetRow({ bet }: { bet: BetHistoryRow }) {
  const [expanded, setExpanded] = useState(false)
  const meta = STATUS_META[bet.status] ?? STATUS_META.PENDING

  const isPending = bet.status === 'PENDING'
  const isWon     = bet.status === 'WON'

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
      marginBottom: 8, overflow: 'hidden',
    }}>
      {/* Main row */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '12px 14px',
          cursor: bet.betType === 'PARLAY' ? 'pointer' : 'default',
        }}
        onClick={() => bet.betType === 'PARLAY' && setExpanded(e => !e)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 8,
              background: `${meta.color}22`, color: meta.color,
              letterSpacing: '0.04em',
            }}>
              {meta.icon} {meta.label}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
              background: bet.betType === 'PARLAY' ? `${GOLD}18` : `${ACCENT}18`,
              color: bet.betType === 'PARLAY' ? GOLD : ACCENT,
            }}>
              {bet.betType === 'PARLAY' ? `PARLAY ${bet.legs.length}` : 'SINGLE'}
            </span>
          </div>

          {/* Match / selection info */}
          {bet.betType === 'SINGLE' ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 1 }}>
                {bet.selectionLabel}
              </div>
              <div style={{ fontSize: 11, color: TEXT2 }}>
                {MARKET_SHORT[bet.marketType ?? ''] ?? bet.marketType} · {bet.matchTitle}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
              {bet.legs.length} selections
              {bet.betType === 'PARLAY' && (
                <span style={{ fontSize: 11, color: TEXT2, fontWeight: 400, marginLeft: 6 }}>
                  {expanded ? '▲ hide' : '▼ show'}
                </span>
              )}
            </div>
          )}

          <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
            {fmtDate(bet.placedAt)}
            {bet.settledAt && <> · settled {fmtDate(bet.settledAt)}</>}
          </div>
        </div>

        {/* Right side: odds + amounts */}
        <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>
            {bet.combinedOdds.toFixed(2)}×
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, marginTop: 2 }}>
            {fmtAMD(bet.betAmount)}
          </div>
          {isWon && (
            <div style={{ fontSize: 13, fontWeight: 800, color: WIN, marginTop: 3 }}>
              +{fmtAMD(bet.actualWinnings)}
            </div>
          )}
          {isPending && (
            <div style={{ fontSize: 11, color: GOLD, marginTop: 3 }}>
              → {fmtAMD(bet.actualWinnings)}
            </div>
          )}
        </div>
      </div>

      {/* Parlay legs (expandable) */}
      {bet.betType === 'PARLAY' && expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 14px 12px' }}>
          {bet.legs.map(leg => (
            <div key={leg.legId} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 0', borderBottom: `1px solid ${BORDER}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 9, color: MUTED, fontWeight: 700, marginRight: 6 }}>
                  {MARKET_SHORT[leg.marketType] ?? leg.marketType}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                  {leg.selectionLabel}
                </span>
                <div style={{ fontSize: 10, color: TEXT2, marginTop: 1 }}>{leg.matchTitle}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
                  {leg.oddsAtPlacement.toFixed(2)}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                  background: `${LEG_RESULT_COLOR[leg.result]}22`,
                  color: LEG_RESULT_COLOR[leg.result],
                }}>
                  {leg.result}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  userId:      string
  showHistory?: boolean
}

export function ActiveBets({ userId, showHistory = false }: Props) {
  const [bets, setBets]       = useState<BetHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'active' | 'history'>('active')
  const { lastPlacedBetId }   = useBetSlip()

  const load = useCallback(async () => {
    setLoading(true)
    const data = tab === 'active'
      ? await getActiveBetsAction()
      : await getBetHistoryAction(30)
    setBets(data)
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  // Refresh when a new bet is placed
  useEffect(() => {
    if (lastPlacedBetId) load()
  }, [lastPlacedBetId, load])

  // Realtime: refresh when any of the user's bets are settled
  useEffect(() => {
    const channel = supabase
      .channel(`bets:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'bets',
        filter: `player_id=eq.${userId}`,
      }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  const activeBets  = bets.filter(b => b.status === 'PENDING')
  const settledBets = bets.filter(b => b.status !== 'PENDING')

  return (
    <div>
      {/* Tabs */}
      {showHistory && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['active', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 16px', borderRadius: 20, flexShrink: 0,
                border: `1px solid ${tab === t ? ACCENT : BORDER}`,
                background: tab === t ? `${ACCENT}22` : 'transparent',
                color: tab === t ? ACCENT : TEXT2,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t === 'active' ? `Active (${activeBets.length})` : 'History'}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ color: TEXT2, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
          Loading bets…
        </div>
      )}

      {!loading && bets.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 0',
          color: MUTED, fontSize: 13,
        }}>
          {tab === 'active' ? 'No active bets.' : 'No bet history yet.'}
        </div>
      )}

      {!loading && tab === 'active' && activeBets.map(bet => (
        <BetRow key={bet.betId} bet={bet} />
      ))}

      {!loading && tab === 'history' && bets.map(bet => (
        <BetRow key={bet.betId} bet={bet} />
      ))}

      {/* Active count banner */}
      {!showHistory && activeBets.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: TEXT2, fontWeight: 700 }}>
            Active bets
            <span style={{
              marginLeft: 6, background: GOLD, color: BG ?? '#050911',
              borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 900,
            }}>
              {activeBets.length}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Compact summary widget (for home page / profile) ────────────────────────

export function ActiveBetsSummary({ userId }: { userId: string }) {
  const [count, setCount] = useState(0)
  const [totalStake, setTotalStake] = useState(0)

  useEffect(() => {
    getActiveBetsAction().then(bets => {
      setCount(bets.length)
      setTotalStake(bets.reduce((s, b) => s + b.betAmount, 0))
    })
  }, [userId])

  if (count === 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10,
      padding: '8px 14px',
    }}>
      <span style={{ fontSize: 16 }}>⏳</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>
          {count} active bet{count !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: 11, color: TEXT2 }}>
          {fmtAMD(totalStake)} in play
        </div>
      </div>
    </div>
  )
}

const BG = '#050911'
