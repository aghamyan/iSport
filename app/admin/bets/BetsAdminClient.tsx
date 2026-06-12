'use client'

import { useState, useCallback, useTransition } from 'react'
import type { AdminBetRow, BetStatusFilter } from './actions'
import { getAdminAllBetsAction, adminCancelPendingBetAction } from './actions'
import { adminOverrideBetAction } from '@/app/betting/odds/actions'
import { getMarketLabel } from '@/lib/betting/validation'

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

const STATUS_COLORS: Record<string, string> = {
  PENDING:   C.accent,
  WON:       C.win,
  LOST:      C.loss,
  RETURNED:  C.gold,
  CANCELLED: C.muted,
}

const FILTERS: BetStatusFilter[] = ['ALL', 'PENDING', 'WON', 'LOST', 'RETURNED', 'CANCELLED']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('hy-AM') + ' ֏'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function exportCSV(bets: AdminBetRow[]) {
  const headers = [
    'Bet ID', 'Player', 'Type', 'Match/Market', 'Selection',
    'Amount (AMD)', 'Odds', 'Potential (AMD)', 'Actual Win (AMD)',
    'Rake (AMD)', 'Status', 'Placed At', 'Settled At',
  ]
  const rows = bets.map(b => [
    b.betId,
    b.playerName,
    b.betType,
    b.matchTitle,
    b.selectionLabel || b.marketType,
    b.betAmount,
    b.combinedOdds.toFixed(2),
    b.potentialWinnings,
    b.actualWinnings,
    b.rakeAmount,
    b.status,
    fmtDate(b.placedAt),
    b.settledAt ? fmtDate(b.settledAt) : '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `bets_export_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type Toast = { id: number; msg: string; ok: boolean }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.ok ? C.win : C.loss, color: '#fff',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: 340,
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ─── Override modal ───────────────────────────────────────────────────────────

function OverrideModal({
  bet, onClose, onDone,
}: {
  bet:    AdminBetRow
  onClose:() => void
  onDone: (newStatus: string) => void
}) {
  const [newStatus, setNewStatus] = useState<'WON' | 'LOST' | 'RETURNED'>('RETURNED')
  const [reason, setReason]       = useState('')
  const [error, setError]         = useState('')
  const [pending, start]          = useTransition()

  const options: Array<{ value: 'WON' | 'LOST' | 'RETURNED'; label: string; color: string }> = [
    { value: 'WON',      label: 'WON',      color: C.win  },
    { value: 'LOST',     label: 'LOST',     color: C.loss },
    { value: 'RETURNED', label: 'RETURNED', color: C.gold },
  ]

  function handleSubmit() {
    setError('')
    if (!reason.trim()) { setError('Reason is required'); return }
    start(async () => {
      try {
        await adminOverrideBetAction(bet.betId, newStatus, reason.trim())
        onDone(newStatus)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: C.card, borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 440, margin: '0 16px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          Override Bet
        </div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>
          {bet.playerName} — {bet.matchTitle} — {fmt(bet.betAmount)}
        </div>

        <div style={{ marginBottom: 4, fontSize: 12, color: C.text2 }}>Current status</div>
        <div style={{
          display: 'inline-block', marginBottom: 20,
          padding: '3px 12px', borderRadius: 8,
          background: `${STATUS_COLORS[bet.status] ?? C.muted}18`,
          color: STATUS_COLORS[bet.status] ?? C.muted,
          fontSize: 12, fontWeight: 700,
        }}>
          {bet.status}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.text2, marginBottom: 8 }}>New status</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {options.filter(o => o.value !== bet.status).map(o => (
              <button
                key={o.value}
                onClick={() => setNewStatus(o.value)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  border: `2px solid ${newStatus === o.value ? o.color : C.border}`,
                  background: newStatus === o.value ? `${o.color}12` : 'transparent',
                  color: newStatus === o.value ? o.color : C.text2,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: C.text2, display: 'block', marginBottom: 6 }}>
            Reason (required)
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Score correction, data error"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, fontSize: 13, color: C.text,
              background: C.bg, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {error && <div style={{ color: C.loss, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: `1px solid ${C.gold}33` }}>
          24-hour window enforced by the database. Overrides outside the window will be rejected.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.text2, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={pending || !reason.trim()} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            border: 'none', background: C.accent, color: '#fff',
            fontSize: 14, fontWeight: 700,
            cursor: pending || !reason.trim() ? 'not-allowed' : 'pointer',
            opacity: pending || !reason.trim() ? 0.6 : 1,
          }}>
            {pending ? 'Saving…' : 'Confirm Override'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cancel modal ─────────────────────────────────────────────────────────────

function CancelModal({
  bet, onClose, onDone,
}: {
  bet:    AdminBetRow
  onClose:() => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError]   = useState('')
  const [pending, start]    = useTransition()

  function handleSubmit() {
    setError('')
    if (!reason.trim()) { setError('Reason is required'); return }
    start(async () => {
      try {
        await adminCancelPendingBetAction(bet.betId, reason.trim())
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: C.card, borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 400, margin: '0 16px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          Cancel Bet & Refund
        </div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>
          {bet.playerName} — {bet.matchTitle} — {fmt(bet.betAmount)}
        </div>

        <div style={{
          background: `${C.loss}08`, border: `1px solid ${C.loss}33`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: C.text2,
        }}>
          This will cancel the bet and refund <strong>{fmt(bet.betAmount)}</strong> to {bet.playerName}.
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: C.text2, display: 'block', marginBottom: 6 }}>
            Reason (required)
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Match cancelled, duplicate bet"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, fontSize: 13, color: C.text,
              background: C.bg, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {error && <div style={{ color: C.loss, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.text2, fontSize: 14, cursor: 'pointer',
          }}>Back</button>
          <button onClick={handleSubmit} disabled={pending || !reason.trim()} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            border: 'none', background: C.loss, color: '#fff',
            fontSize: 14, fontWeight: 700,
            cursor: pending || !reason.trim() ? 'not-allowed' : 'pointer',
            opacity: pending || !reason.trim() ? 0.6 : 1,
          }}>
            {pending ? 'Cancelling…' : 'Cancel & Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bet row ──────────────────────────────────────────────────────────────────

function BetRow({
  bet, onOverride, onCancel,
}: {
  bet:        AdminBetRow
  onOverride: (b: AdminBetRow) => void
  onCancel:   (b: AdminBetRow) => void
}) {
  const statusColor = STATUS_COLORS[bet.status] ?? C.muted
  const isPending   = bet.status === 'PENDING'
  const isSettled   = !isPending

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 120px 90px 90px 110px 120px 140px',
      padding: '12px 16px',
      borderBottom: `1px solid ${C.border}`,
      alignItems: 'center',
      fontSize: 13,
    }}>
      {/* Player + match */}
      <div>
        <div style={{ fontWeight: 700, color: C.text }}>{bet.playerName}</div>
        <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>
          {bet.matchTitle}
        </div>
        {bet.selectionLabel && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
            {getMarketLabel(bet.marketType)}: {bet.selectionLabel}
          </div>
        )}
        {bet.betType === 'PARLAY' && (
          <div style={{ fontSize: 11, color: C.purple, marginTop: 1, fontWeight: 600 }}>
            PARLAY · {bet.legCount} legs
          </div>
        )}
      </div>

      {/* Amount */}
      <div style={{ textAlign: 'right', fontWeight: 700, color: C.text }}>
        {fmt(bet.betAmount)}
      </div>

      {/* Odds */}
      <div style={{ textAlign: 'right', fontWeight: 700, color: C.accent }}>
        {bet.combinedOdds.toFixed(2)}×
      </div>

      {/* Potential / actual */}
      <div style={{ textAlign: 'right' }}>
        {isSettled && bet.status === 'WON' ? (
          <span style={{ fontWeight: 700, color: C.win }}>{fmt(bet.actualWinnings)}</span>
        ) : (
          <span style={{ color: C.text2 }}>{fmt(bet.potentialWinnings)}</span>
        )}
      </div>

      {/* Status */}
      <div style={{ textAlign: 'center' }}>
        <span style={{
          padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          background: `${statusColor}18`, color: statusColor,
        }}>
          {bet.status}
        </span>
      </div>

      {/* Date */}
      <div style={{ color: C.muted, fontSize: 12 }}>
        {fmtDate(bet.placedAt)}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {isPending && (
          <button
            onClick={() => onCancel(bet)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              border: `1px solid ${C.loss}`, background: 'transparent',
              color: C.loss, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
        {isSettled && (
          <button
            onClick={() => onOverride(bet)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              border: `1px solid ${C.gold}`, background: 'transparent',
              color: C.gold, cursor: 'pointer',
            }}
          >
            Override
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = { initialBets: AdminBetRow[] }

export function BetsAdminClient({ initialBets }: Props) {
  const [bets, setBets]           = useState<AdminBetRow[]>(initialBets)
  const [filter, setFilter]       = useState<BetStatusFilter>('ALL')
  const [overriding, setOverriding] = useState<AdminBetRow | null>(null)
  const [cancelling, setCancelling] = useState<AdminBetRow | null>(null)
  const [toasts, setToasts]       = useState<Toast[]>([])
  const [loading, startLoad]      = useTransition()

  let toastId = 0
  const pushToast = useCallback((msg: string, ok = true) => {
    const id = ++toastId
    setToasts(t => [...t, { id, msg, ok }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = {
    ALL:       bets.length,
    PENDING:   bets.filter(b => b.status === 'PENDING').length,
    WON:       bets.filter(b => b.status === 'WON').length,
    LOST:      bets.filter(b => b.status === 'LOST').length,
    RETURNED:  bets.filter(b => b.status === 'RETURNED').length,
    CANCELLED: bets.filter(b => b.status === 'CANCELLED').length,
  }

  function applyFilter(f: BetStatusFilter) {
    setFilter(f)
    startLoad(async () => {
      const data = await getAdminAllBetsAction(f)
      setBets(data)
    })
  }

  const displayed = filter === 'ALL' ? bets : bets.filter(b => b.status === filter)

  // Stats
  const totalStaked  = displayed.reduce((s, b) => s + b.betAmount, 0)
  const totalPayout  = displayed.filter(b => b.status === 'WON').reduce((s, b) => s + b.actualWinnings, 0)
  const totalRake    = displayed.filter(b => b.status === 'WON').reduce((s, b) => s + b.rakeAmount, 0)
  const winCount     = displayed.filter(b => b.status === 'WON').length
  const settledCount = displayed.filter(b => b.status !== 'PENDING').length
  const winRate      = settledCount > 0 ? Math.round((winCount / settledCount) * 100) : 0

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total bets',     value: String(displayed.length), color: C.text  },
          { label: 'Total staked',   value: fmt(totalStaked),         color: C.text  },
          { label: 'Total payout',   value: fmt(totalPayout),         color: C.win   },
          { label: 'Total rake',     value: fmt(totalRake),           color: C.gold  },
          { label: 'Player win rate', value: winRate + '%',           color: winRate >= 50 ? C.loss : C.win },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: 140,
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs + export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => applyFilter(f)}
            disabled={loading}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              border: `1px solid ${filter === f ? C.accent : C.border}`,
              background: filter === f ? `${C.accent}12` : 'transparent',
              color: filter === f ? C.accent : C.text2,
            }}
          >
            {f}
            <span style={{
              marginLeft: 6, fontSize: 11,
              background: filter === f ? C.accent : C.border,
              color: filter === f ? '#fff' : C.text2,
              borderRadius: 10, padding: '1px 6px',
            }}>
              {counts[f]}
            </span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => exportCSV(displayed)}
          style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: `1px solid ${C.border}`, background: C.card,
            color: C.text2, cursor: 'pointer',
          }}
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 90px 90px 110px 120px 140px',
          padding: '10px 16px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>Player / Match</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span style={{ textAlign: 'right' }}>Odds</span>
          <span style={{ textAlign: 'right' }}>Payout</span>
          <span style={{ textAlign: 'center' }}>Status</span>
          <span>Placed</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {loading && (
          <div style={{ padding: '32px', textAlign: 'center', color: C.text2, fontSize: 13 }}>
            Loading…
          </div>
        )}

        {!loading && displayed.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: C.muted, fontSize: 14 }}>
            No bets found.
          </div>
        )}

        {!loading && displayed.map(bet => (
          <BetRow
            key={bet.betId}
            bet={bet}
            onOverride={setOverriding}
            onCancel={setCancelling}
          />
        ))}
      </div>

      {/* Modals */}
      {overriding && (
        <OverrideModal
          bet={overriding}
          onClose={() => setOverriding(null)}
          onDone={newStatus => {
            setBets(prev => prev.map(b =>
              b.betId === overriding.betId ? { ...b, status: newStatus } : b
            ))
            setOverriding(null)
            pushToast(`Bet overridden → ${newStatus}`)
          }}
        />
      )}

      {cancelling && (
        <CancelModal
          bet={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setBets(prev => prev.map(b =>
              b.betId === cancelling.betId ? { ...b, status: 'CANCELLED' } : b
            ))
            setCancelling(null)
            pushToast('Bet cancelled — stake refunded')
          }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
