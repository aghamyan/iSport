'use client'

import { useState, useTransition } from 'react'
import {
  adminAdjustBalanceAction,
  adminResetBalanceAction,
  adminBulkResetAction,
  fetchPlayerTransactionsAction,
  adminToggleSuspendAction,
} from '@/app/betting/balance/actions'
import type { PlayerBalanceSummary, BalanceStats, TransactionRow } from '@/lib/betting/balance'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = '#050911'
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('hy-AM') + ' ֏'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const TX_LABELS: Record<string, string> = {
  BET_PLACED:    'Bet placed',
  BET_WON:       'Bet won',
  BET_RETURNED:  'Bet returned',
  BET_CANCELLED: 'Bet cancelled',
  ADMIN_CREDIT:  'Admin credit',
  ADMIN_DEBIT:   'Admin debit',
  ADMIN_RESET:   'Balance reset',
}

function txColor(type: string): string {
  if (['BET_WON','BET_RETURNED','BET_CANCELLED','ADMIN_CREDIT'].includes(type)) return WIN
  if (['BET_PLACED','ADMIN_DEBIT'].includes(type)) return LOSS
  return TEXT2
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = TEXT }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: '16px 20px', minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: TEXT2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Transaction history drawer ───────────────────────────────────────────────

function TransactionDrawer({
  player,
  onClose,
}: {
  player: PlayerBalanceSummary
  onClose: () => void
}) {
  const [txs, setTxs]       = useState<TransactionRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const data = await fetchPlayerTransactionsAction(player.playerId, 30)
    setTxs(data)
    setLoading(false)
  }

  if (txs === null && !loading) {
    load()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, padding: '0 0 0 0',
    }} onClick={onClose}>
      <div style={{
        background: CARD, borderRadius: '16px 16px 0 0',
        width: '100%', maxWidth: 640, maxHeight: '80vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{player.playerName}</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>
              Balance: <span style={{ color: GOLD, fontWeight: 700 }}>{fmt(player.currentBalance)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: TEXT2, fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Transaction list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {loading && (
            <div style={{ color: TEXT2, textAlign: 'center', padding: 32 }}>Loading…</div>
          )}
          {txs && txs.length === 0 && (
            <div style={{ color: MUTED, textAlign: 'center', padding: 32 }}>No transactions yet.</div>
          )}
          {txs && txs.map(tx => (
            <div key={tx.txId} style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              padding: '10px 20px', borderBottom: `1px solid ${BORDER}`,
            }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: txColor(tx.txType) }}>
                  {TX_LABELS[tx.txType] ?? tx.txType}
                </div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tx.description}
                </div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{fmtDate(tx.createdAt)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: tx.amount >= 0 ? WIN : LOSS }}>
                  {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                </div>
                <div style={{ fontSize: 10, color: MUTED }}>→ {fmt(tx.balanceAfter)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Adjust modal ─────────────────────────────────────────────────────────────

function AdjustModal({
  player,
  onClose,
  onDone,
}: {
  player: PlayerBalanceSummary
  onClose: () => void
  onDone: (newBalance: number) => void
}) {
  const [amount, setAmount]   = useState('')
  const [reason, setReason]   = useState('')
  const [mode, setMode]       = useState<'adjust' | 'reset'>('adjust')
  const [error, setError]     = useState('')
  const [pending, start]      = useTransition()

  function handleSubmit() {
    setError('')
    start(async () => {
      try {
        if (mode === 'adjust') {
          const n = parseFloat(amount)
          if (isNaN(n) || n === 0) { setError('Enter a non-zero amount'); return }
          if (!reason.trim()) { setError('Reason is required'); return }
          const { newBalance } = await adminAdjustBalanceAction(player.playerId, n, reason)
          onDone(newBalance)
        } else {
          const n = amount === '' ? 10000 : parseFloat(amount)
          if (isNaN(n) || n < 0) { setError('Enter a valid amount'); return }
          const { newBalance } = await adminResetBalanceAction(player.playerId, n)
          onDone(newBalance)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: CARD, borderRadius: 16, padding: 24,
        width: '100%', maxWidth: 400, margin: '0 16px',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          {mode === 'adjust' ? 'Adjust Balance' : 'Reset Balance'}
        </div>
        <div style={{ fontSize: 12, color: TEXT2, marginBottom: 20 }}>
          {player.playerName} — current: <span style={{ color: GOLD }}>{fmt(player.currentBalance)}</span>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['adjust', 'reset'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${mode === m ? ACCENT : BORDER}`,
              background: mode === m ? `${ACCENT}22` : 'transparent',
              color: mode === m ? ACCENT : TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              {m === 'adjust' ? 'Adjust (+/-)' : 'Reset to amount'}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: TEXT2, display: 'block', marginBottom: 6 }}>
            {mode === 'adjust' ? 'Amount (AMD) — use negative to debit' : 'New balance (AMD)'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={mode === 'adjust' ? 'e.g. 5000 or -2000' : '10000'}
            style={{
              width: '100%', padding: '10px 12px', background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT,
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Reason (adjust only) */}
        {mode === 'adjust' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: TEXT2, display: 'block', marginBottom: 6 }}>
              Reason (required)
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Tournament prize"
              style={{
                width: '100%', padding: '10px 12px', background: CARD2,
                border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT,
                fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {error && <div style={{ color: LOSS, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            border: `1px solid ${BORDER}`, background: 'transparent',
            color: TEXT2, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={pending} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            border: 'none', background: ACCENT, color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}>
            {pending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  balances: PlayerBalanceSummary[]
  stats: BalanceStats | null
}

export function BalancesClient({ balances: initialBalances, stats }: Props) {
  const [balances, setBalances]           = useState(initialBalances)
  const [selected, setSelected]           = useState<PlayerBalanceSummary | null>(null)
  const [adjusting, setAdjusting]         = useState<PlayerBalanceSummary | null>(null)
  const [bulkPending, startBulk]          = useTransition()
  const [bulkConfirm, setBulkConfirm]     = useState(false)
  const [bulkTarget, setBulkTarget]       = useState('10000')
  const [bulkResult, setBulkResult]       = useState<string | null>(null)
  const [suspendingId, setSuspendingId]   = useState<string | null>(null)

  function handleAdjustDone(playerId: string, newBalance: number) {
    setBalances(prev => prev.map(b =>
      b.playerId === playerId ? { ...b, currentBalance: newBalance } : b
    ))
    setAdjusting(null)
  }

  async function handleToggleSuspend(b: PlayerBalanceSummary) {
    setSuspendingId(b.playerId)
    try {
      await adminToggleSuspendAction(b.playerId, !b.isActive)
      setBalances(prev => prev.map(p =>
        p.playerId === b.playerId ? { ...p, isActive: !p.isActive } : p
      ))
    } catch {
      // ignore
    } finally {
      setSuspendingId(null)
    }
  }

  function handleBulkReset() {
    const t = parseFloat(bulkTarget)
    if (isNaN(t) || t < 0) return
    startBulk(async () => {
      const { playersAffected } = await adminBulkResetAction(t)
      setBulkResult(`${playersAffected} player${playersAffected !== 1 ? 's' : ''} reset to ${fmt(t)}`)
      setBulkConfirm(false)
      setBalances(prev => prev.map(b => ({ ...b, currentBalance: t })))
    })
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'system-ui, sans-serif', padding: '24px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Player Balances</h1>
          <p style={{ color: TEXT2, fontSize: 13, margin: '4px 0 0' }}>
            Manage wallets and view transaction history
          </p>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard label="Total pot"    value={fmt(stats.totalBalances)} sub={`${stats.totalPlayers} players`} />
            <StatCard label="In play"      value={fmt(stats.totalInPlay)}   sub="pending bets"  color={GOLD} />
            <StatCard label="House rake"   value={fmt(stats.totalRakeCollected)} color={WIN} />
            <StatCard label="Avg balance"  value={fmt(stats.avgBalance)} />
          </div>
        )}

        {/* Bulk reset */}
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: TEXT2, flex: 1, minWidth: 200 }}>
            Bulk reset all active players
          </span>
          <input
            type="number"
            value={bulkTarget}
            onChange={e => setBulkTarget(e.target.value)}
            style={{
              width: 120, padding: '7px 10px', background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13,
            }}
          />
          <span style={{ fontSize: 12, color: MUTED }}>AMD</span>
          <button
            onClick={() => setBulkConfirm(true)}
            disabled={bulkPending}
            style={{
              padding: '7px 16px', borderRadius: 8, border: `1px solid ${LOSS}`,
              background: 'transparent', color: LOSS,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Bulk Reset
          </button>
        </div>

        {bulkResult && (
          <div style={{
            background: `${WIN}18`, border: `1px solid ${WIN}`, borderRadius: 8,
            padding: '10px 16px', color: WIN, fontSize: 13, marginBottom: 16,
          }}>
            {bulkResult}
          </div>
        )}

        {/* Bulk confirm */}
        {bulkConfirm && (
          <div style={{
            background: `${LOSS}18`, border: `1px solid ${LOSS}`, borderRadius: 12,
            padding: '14px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ flex: 1, fontSize: 13 }}>
              Reset ALL active players to <strong>{fmt(parseFloat(bulkTarget) || 0)}</strong>? This cannot be undone.
            </span>
            <button onClick={() => setBulkConfirm(false)} style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`,
              background: 'transparent', color: TEXT2, fontSize: 13, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleBulkReset} disabled={bulkPending} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: LOSS, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              {bulkPending ? 'Resetting…' : 'Confirm'}
            </button>
          </div>
        )}

        {/* Player table */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 130px 110px 160px',
            padding: '10px 16px', borderBottom: `1px solid ${BORDER}`,
            fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>Player</span>
            <span style={{ textAlign: 'right' }}>Balance</span>
            <span style={{ textAlign: 'right' }}>Rake paid</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {balances.map(b => (
            <div key={b.playerId} style={{
              display: 'grid', gridTemplateColumns: '1fr 130px 110px 160px',
              padding: '12px 16px', borderBottom: `1px solid ${BORDER}`,
              alignItems: 'center',
            }}>
              {/* Name + status */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.playerName}</div>
                <div style={{ fontSize: 11, color: b.isActive ? WIN : LOSS, marginTop: 2 }}>
                  {b.isActive ? 'Active' : 'Suspended'}
                </div>
              </div>

              {/* Balance */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontWeight: 700, fontSize: 15,
                  color: b.currentBalance < 1000 ? LOSS : b.currentBalance >= b.initialBalance ? WIN : TEXT,
                }}>
                  {fmt(b.currentBalance)}
                </div>
                <div style={{ fontSize: 10, color: MUTED }}>
                  start: {fmt(b.initialBalance)}
                </div>
              </div>

              {/* Rake */}
              <div style={{ textAlign: 'right', fontSize: 13, color: TEXT2 }}>
                {fmt(b.totalRakePaid)}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelected(b)}
                  style={{
                    padding: '5px 10px', borderRadius: 6,
                    border: `1px solid ${BORDER}`, background: 'transparent',
                    color: TEXT2, fontSize: 11, cursor: 'pointer',
                  }}
                >
                  History
                </button>
                <button
                  onClick={() => setAdjusting(b)}
                  style={{
                    padding: '5px 10px', borderRadius: 6,
                    border: `1px solid ${ACCENT}`, background: 'transparent',
                    color: ACCENT, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Adjust
                </button>
                <button
                  onClick={() => handleToggleSuspend(b)}
                  disabled={suspendingId === b.playerId}
                  style={{
                    padding: '5px 10px', borderRadius: 6,
                    border: `1px solid ${b.isActive ? LOSS : WIN}`, background: 'transparent',
                    color: b.isActive ? LOSS : WIN,
                    fontSize: 11, fontWeight: 600,
                    cursor: suspendingId === b.playerId ? 'not-allowed' : 'pointer',
                    opacity: suspendingId === b.playerId ? 0.5 : 1,
                  }}
                >
                  {b.isActive ? 'Suspend' : 'Unsuspend'}
                </button>
              </div>
            </div>
          ))}

          {balances.length === 0 && (
            <div style={{ color: MUTED, textAlign: 'center', padding: 32 }}>No players found.</div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selected && (
        <TransactionDrawer player={selected} onClose={() => setSelected(null)} />
      )}
      {adjusting && (
        <AdjustModal
          player={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={(newBalance) => handleAdjustDone(adjusting.playerId, newBalance)}
        />
      )}
    </div>
  )
}
