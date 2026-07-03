'use client'

import { useState, useEffect, useCallback } from 'react'
import supabase from '@/lib/supabase/client'
import type { TransactionRow, TxType } from '@/lib/betting/balance'

// Client-side transaction fetch — uses the browser Supabase client to avoid
// importing next/headers (which is server-only) into the client bundle.
async function fetchTxHistory(playerId: string, limit: number): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('balance_transactions')
    .select('tx_id, tx_type, amount, balance_before, balance_after, reference_id, description, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map(r => ({
    txId:          r.tx_id,
    txType:        r.tx_type as TxType,
    amount:        Number(r.amount),
    balanceBefore: Number(r.balance_before),
    balanceAfter:  Number(r.balance_after),
    referenceId:   r.reference_id,
    description:   r.description,
    createdAt:     r.created_at,
  }))
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const CARD   = '#0c1422'
const BORDER = '#1a2840'
const TEXT   = '#f8fafc'
const TEXT2  = '#94a3b8'
const MUTED  = '#4b5a73'
const WIN    = '#10b981'
const LOSS   = '#ef4444'
const GOLD   = '#f59e0b'
const ACCENT = '#3b82f6'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('hy-AM') + ' ֏'
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const TX_ICONS: Record<TxType, string> = {
  BET_PLACED:    '🎲',
  BET_WON:       '🏆',
  BET_RETURNED:  '↩️',
  BET_CANCELLED: '✖️',
  ADMIN_CREDIT:  '➕',
  ADMIN_DEBIT:   '➖',
  ADMIN_RESET:   '🔄',
  CASINO_BET:    '🎰',
  CASINO_WIN:    '💰',
}

const TX_LABELS: Record<TxType, string> = {
  BET_PLACED:    'Bet placed',
  BET_WON:       'Bet won',
  BET_RETURNED:  'Void — stake returned',
  BET_CANCELLED: 'Cancelled',
  ADMIN_CREDIT:  'Credit',
  ADMIN_DEBIT:   'Debit',
  ADMIN_RESET:   'Balance reset',
  CASINO_BET:    'Casino bet',
  CASINO_WIN:    'Casino win',
}

function txColor(type: TxType): string {
  if (['BET_WON','BET_RETURNED','BET_CANCELLED','ADMIN_CREDIT','CASINO_WIN'].includes(type)) return WIN
  if (['BET_PLACED','ADMIN_DEBIT','ADMIN_RESET','CASINO_BET'].includes(type)) return LOSS
  return TEXT2
}

// ─── Balance change toast ─────────────────────────────────────────────────────

function BalanceToast({
  prev,
  next,
  onDone,
}: {
  prev: number
  next: number
  onDone: () => void
}) {
  const diff  = next - prev
  const gain  = diff >= 0
  const color = gain ? WIN : LOSS

  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: CARD, border: `1px solid ${color}`, borderRadius: 12,
      padding: '12px 20px', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: `0 4px 24px ${color}44`,
      animation: 'fadeInUp 0.3s ease',
    }}>
      <span style={{ fontSize: 18 }}>{gain ? '🏆' : '📉'}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>
          {gain ? '+' : ''}{fmt(diff)}
        </div>
        <div style={{ fontSize: 11, color: TEXT2 }}>
          Balance: {fmt(next)}
        </div>
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  playerId: string
  initialBalance: number
  showHistory?: boolean   // show last 3 transactions inline
  compact?: boolean       // minimal pill variant for nav/header
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BalanceWidget({ playerId, initialBalance, showHistory = true, compact = false }: Props) {
  const [balance, setBalance]     = useState(initialBalance)
  const [prevBalance, setPrev]    = useState<number | null>(null)
  const [txs, setTxs]             = useState<TransactionRow[]>([])
  const [loadingTxs, setLoading]  = useState(false)
  const [expanded, setExpanded]   = useState(false)

  // Load recent transactions
  const loadTxs = useCallback(async () => {
    setLoading(true)
    const data = await fetchTxHistory(playerId, 10)
    setTxs(data)
    setLoading(false)
  }, [playerId])

  useEffect(() => {
    if (showHistory) loadTxs()
  }, [showHistory, loadTxs])

  // Realtime subscription: watch player_balances for changes
  useEffect(() => {
    const channel = supabase
      .channel(`balance:${playerId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'player_balances',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          const newBal = Number((payload.new as { current_balance: number }).current_balance)
          setBalance(prev => {
            setPrev(prev)
            return newBal
          })
          // Refresh transaction list
          loadTxs()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [playerId, loadTxs])

  // Compact pill for nav bar / header
  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: `${GOLD}18`, border: `1px solid ${GOLD}44`,
        borderRadius: 20, padding: '5px 12px',
      }}>
        <span style={{ fontSize: 13 }}>💰</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: GOLD }}>{fmt(balance)}</span>
      </div>
    )
  }

  // Full wallet card
  return (
    <>
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Balance header */}
        <div style={{
          padding: '18px 20px',
          background: 'linear-gradient(135deg, #0c1422 0%, #101c30 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Betting Wallet
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: GOLD, letterSpacing: '-0.02em' }}>
              {fmt(balance)}
            </div>
          </div>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: `${GOLD}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            💰
          </div>
        </div>

        {/* Transaction history */}
        {showHistory && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderTop: `1px solid ${BORDER}`,
            }}>
              <span style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Recent activity
              </span>
              {txs.length > 3 && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  style={{
                    background: 'none', border: 'none', color: ACCENT,
                    fontSize: 11, cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  {expanded ? 'Show less' : `See all (${txs.length})`}
                </button>
              )}
            </div>

            {loadingTxs && (
              <div style={{ color: TEXT2, fontSize: 12, textAlign: 'center', padding: '12px 16px' }}>Loading…</div>
            )}

            {!loadingTxs && txs.length === 0 && (
              <div style={{ color: MUTED, fontSize: 12, textAlign: 'center', padding: '12px 16px' }}>
                No transactions yet. Place a bet to get started.
              </div>
            )}

            {!loadingTxs && txs.slice(0, expanded ? undefined : 3).map(tx => (
              <div key={tx.txId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 16px', borderTop: `1px solid ${BORDER}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>
                    {TX_ICONS[tx.txType] ?? '•'}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: txColor(tx.txType) }}>
                      {TX_LABELS[tx.txType] ?? tx.txType}
                    </div>
                    <div style={{ fontSize: 10, color: MUTED }}>{fmtShortDate(tx.createdAt)}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tx.amount >= 0 ? WIN : LOSS }}>
                    {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>{fmt(tx.balanceAfter)}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Realtime balance change toast */}
      {prevBalance !== null && (
        <BalanceToast
          prev={prevBalance}
          next={balance}
          onDone={() => setPrev(null)}
        />
      )}
    </>
  )
}
