'use client'

import { useState, useTransition } from 'react'
import type { SettlementSummary, SettlementPlayerRow, OverrideAuditRow } from '@/lib/betting/settlement'
import { getSettlementReportAction, getBetOverrideAuditAction } from '@/app/betting/odds/actions'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:     '#f9fafb',
  card:   '#ffffff',
  border: '#e5e7eb',
  text:   '#111827',
  text2:  '#6b7280',
  muted:  '#9ca3af',
  accent: '#3b82f6',
  win:    '#10b981',
  loss:   '#ef4444',
  gold:   '#f59e0b',
  purple: '#8b5cf6',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('hy-AM') + ' ֏'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function pct(num: number, den: number) {
  if (den === 0) return '—'
  return Math.round((num / den) * 100) + '%'
}

function exportPlayersCSV(players: SettlementPlayerRow[]) {
  const headers = ['Player', 'Bets Placed', 'Won', 'Lost', 'Returned', 'Total Staked (AMD)', 'Total Won (AMD)', 'Rake (AMD)', 'Net Result (AMD)', 'Win Rate']
  const rows = players.map(p => [
    p.playerName,
    p.betsPlaced,
    p.betsWon,
    p.betsLost,
    p.betsReturned,
    p.totalStaked,
    p.totalWon,
    p.totalRake,
    p.netResult,
    p.betsPlaced > 0 ? pct(p.betsWon, p.betsPlaced) : '0%',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `player_report_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Period picker ────────────────────────────────────────────────────────────

const PERIODS = [
  { label: 'Today',      days: 1   },
  { label: '7 days',     days: 7   },
  { label: '30 days',    days: 30  },
  { label: '90 days',    days: 90  },
] as const

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = C.text }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      flex: 1, minWidth: 150,
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── House earnings section ───────────────────────────────────────────────────

function HouseEarnings({ s }: { s: SettlementSummary['summary'] }) {
  const housePnl = s.totalRake + s.totalStakesLost - s.totalPayout + s.totalPayout
  // House profit = rake collected + stakes kept on losses − payouts on wins
  const houseProfit = s.totalRake + s.totalStakesLost

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: '0 0 16px' }}>
        House Earnings
      </h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Total rake (10%)"      value={fmt(s.totalRake)}        color={C.win}   sub="From winning bets only" />
        <StatCard label="Stakes kept (losses)"  value={fmt(s.totalStakesLost)}  color={C.win}   sub="Losing bet stakes" />
        <StatCard label="Total payouts"         value={fmt(s.totalPayout)}      color={C.loss}  sub="Credited to winners" />
        <StatCard label="Total refunded"        value={fmt(s.totalRefunded)}    color={C.gold}  sub="Returned + cancelled" />
        <StatCard
          label="Net house profit"
          value={fmt(houseProfit)}
          color={houseProfit >= 0 ? C.win : C.loss}
          sub="Rake + stakes lost"
        />
      </div>

    </div>
  )
}

// ─── Overview section ─────────────────────────────────────────────────────────

function Overview({ summary }: { summary: SettlementSummary }) {
  const s = summary.summary
  const winRate = s.totalBets > 0 ? pct(s.totalWon, s.totalBets) : '—'

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: '0 0 16px' }}>
        Settlement Summary
      </h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatCard label="Total bets"   value={String(s.totalBets)}  color={C.text}  />
        <StatCard label="Won"          value={String(s.totalWon)}   color={C.win}   sub={winRate + ' of settled'} />
        <StatCard label="Lost"         value={String(s.totalLost)}  color={C.loss}  />
        <StatCard label="Returned"     value={String(s.totalReturned + s.totalCancelled)} color={C.gold} sub="incl. cancelled" />
        <StatCard label="Biggest win"  value={s.biggestWin != null ? fmt(s.biggestWin) : '—'} color={C.win} />
        <StatCard label="Biggest bet"  value={s.biggestBet != null ? fmt(s.biggestBet) : '—'} />
      </div>

      {/* Single vs Parlay */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {(['single', 'parlay'] as const).map(type => {
          const d = summary.byType[type]
          return (
            <div key={type} style={{
              flex: 1, minWidth: 200,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text2, marginBottom: 8 }}>
                {type === 'single' ? 'Single Bets' : 'Parlay Bets'}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{d.count}</div>
                  <div style={{ color: C.muted, fontSize: 11 }}>total</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.win }}>{d.won}</div>
                  <div style={{ color: C.muted, fontSize: 11 }}>won</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.loss }}>{d.lost}</div>
                  <div style={{ color: C.muted, fontSize: 11 }}>lost</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>
                    {pct(d.won, d.won + d.lost)}
                  </div>
                  <div style={{ color: C.muted, fontSize: 11 }}>win rate</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Player rankings table ────────────────────────────────────────────────────

function PlayerRankings({ players, onExport }: {
  players:  SettlementPlayerRow[]
  onExport: () => void
}) {
  const [sort, setSort] = useState<'staked' | 'won' | 'net' | 'winrate'>('staked')

  const sorted = [...players].sort((a, b) => {
    if (sort === 'staked')  return b.totalStaked - a.totalStaked
    if (sort === 'won')     return b.totalWon - a.totalWon
    if (sort === 'net')     return b.netResult - a.netResult
    // winrate
    const wr = (p: SettlementPlayerRow) =>
      p.betsPlaced > 0 ? p.betsWon / p.betsPlaced : 0
    return wr(b) - wr(a)
  })

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0, flex: 1 }}>
          Player Rankings
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['staked', 'won', 'net', 'winrate'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                padding: '4px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${sort === s ? C.accent : C.border}`,
                background: sort === s ? `${C.accent}12` : 'transparent',
                color: sort === s ? C.accent : C.text2,
              }}
            >
              {s === 'staked' ? 'Volume' : s === 'won' ? 'Winnings' : s === 'net' ? 'Net P&L' : 'Win rate'}
            </button>
          ))}
        </div>
        <button
          onClick={onExport}
          style={{
            padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700,
            border: `1px solid ${C.border}`, background: C.card,
            color: C.text2, cursor: 'pointer',
          }}
        >
          ↓ CSV
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px 90px 90px 90px 90px 90px',
          padding: '10px 16px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <span>#</span>
          <span>Player</span>
          <span style={{ textAlign: 'right' }}>Bets</span>
          <span style={{ textAlign: 'right' }}>Staked</span>
          <span style={{ textAlign: 'right' }}>Winnings</span>
          <span style={{ textAlign: 'right' }}>Rake</span>
          <span style={{ textAlign: 'right' }}>Net P&L</span>
          <span style={{ textAlign: 'right' }}>Win rate</span>
        </div>

        {sorted.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: C.muted }}>No data for this period.</div>
        )}

        {sorted.map((p, idx) => {
          const winRate = p.betsPlaced > 0 ? Math.round((p.betsWon / p.betsPlaced) * 100) : 0
          const netColor = p.netResult >= 0 ? C.win : C.loss
          return (
            <div key={p.playerId} style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 80px 90px 90px 90px 90px 90px',
              padding: '11px 16px',
              borderBottom: `1px solid ${C.border}`,
              alignItems: 'center',
              fontSize: 13,
            }}>
              <span style={{ color: C.muted, fontWeight: 700 }}>{idx + 1}</span>
              <span style={{ fontWeight: 600, color: C.text }}>{p.playerName}</span>
              <span style={{ textAlign: 'right', color: C.text2 }}>
                {p.betsPlaced}
                <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>
                  {p.betsWon}W / {p.betsLost}L / {p.betsReturned}R
                </span>
              </span>
              <span style={{ textAlign: 'right', color: C.text }}>{fmt(p.totalStaked)}</span>
              <span style={{ textAlign: 'right', color: C.win, fontWeight: 600 }}>{fmt(p.totalWon)}</span>
              <span style={{ textAlign: 'right', color: C.gold }}>{fmt(p.totalRake)}</span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: netColor }}>
                {p.netResult >= 0 ? '+' : ''}{fmt(p.netResult)}
              </span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: winRate >= 50 ? C.win : C.loss }}>
                {winRate}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Override audit log ───────────────────────────────────────────────────────

function OverrideLog({ overrides }: { overrides: OverrideAuditRow[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: '0 0 16px' }}>
        Bet Override History
      </h2>

      {overrides.length === 0 && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '24px', textAlign: 'center', color: C.muted, fontSize: 13,
        }}>
          No overrides recorded yet.
        </div>
      )}

      {overrides.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 200px 120px 160px',
            padding: '10px 16px',
            borderBottom: `1px solid ${C.border}`,
            fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span>Player → Admin</span>
            <span>Status change</span>
            <span>Reason</span>
            <span style={{ textAlign: 'right' }}>Balance Δ</span>
            <span style={{ textAlign: 'right' }}>Date</span>
          </div>

          {overrides.map(o => {
            const deltaColor = o.balanceDelta >= 0 ? C.win : C.loss
            return (
              <div key={o.auditId} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 200px 120px 160px',
                padding: '11px 16px',
                borderBottom: `1px solid ${C.border}`,
                alignItems: 'center',
                fontSize: 13,
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: C.text }}>{o.playerName}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>by {o.adminName}</div>
                </div>
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 6,
                    background: `${C.loss}18`, color: C.loss,
                  }}>{o.oldStatus}</span>
                  {' → '}
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 6,
                    background: `${C.win}18`, color: C.win,
                  }}>{o.newStatus}</span>
                </div>
                <div style={{ color: C.text2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.reason}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: deltaColor }}>
                  {o.balanceDelta >= 0 ? '+' : ''}{fmt(o.balanceDelta)}
                </div>
                <div style={{ textAlign: 'right', color: C.muted, fontSize: 12 }}>
                  {fmtDate(o.overriddenAt)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  summary:   SettlementSummary | null
  players:   SettlementPlayerRow[]
  overrides: OverrideAuditRow[]
}

export function ReportsClient({ summary: initialSummary, players: initialPlayers, overrides: initialOverrides }: Props) {
  const [summary,   setSummary]   = useState(initialSummary)
  const [players,   setPlayers]   = useState(initialPlayers)
  const [overrides, setOverrides] = useState(initialOverrides)
  const [period, setPeriod]       = useState(30)
  const [loading, start]          = useTransition()

  function changePeriod(days: number) {
    setPeriod(days)
    start(async () => {
      const to   = new Date()
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const [result, newOverrides] = await Promise.all([
        getSettlementReportAction(from, to),
        getBetOverrideAuditAction(50),
      ])
      setSummary(result.summary)
      setPlayers(result.players)
      setOverrides(newOverrides)
    })
  }

  return (
    <div>
      {/* Period picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => changePeriod(p.days)}
            disabled={loading}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              border: `1px solid ${period === p.days ? C.accent : C.border}`,
              background: period === p.days ? `${C.accent}12` : 'transparent',
              color: period === p.days ? C.accent : C.text2,
            }}
          >
            {p.label}
          </button>
        ))}
        {loading && <span style={{ fontSize: 13, color: C.muted, alignSelf: 'center' }}>Loading…</span>}
      </div>

      {summary ? (
        <>
          <Overview summary={summary} />
          <HouseEarnings s={summary.summary} />
        </>
      ) : (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '32px', textAlign: 'center', color: C.muted, marginBottom: 32,
        }}>
          No settlement data for this period.
        </div>
      )}

      <PlayerRankings
        players={players}
        onExport={() => exportPlayersCSV(players)}
      />

      <OverrideLog overrides={overrides} />
    </div>
  )
}
