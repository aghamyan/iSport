'use client'

import { useState, useEffect, useTransition } from 'react'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { fmtAMD, MARKET_SHORT } from '@/lib/betting/validation'
import { placeBetAction, type PlaceBetResult } from '@/app/betting/bets/actions'

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

// ─── Success toast ────────────────────────────────────────────────────────────

export function PlacedBetToast({ result, onDone }: { result: PlaceBetResult; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: CARD, border: `1px solid ${WIN}`, borderRadius: 14,
      padding: '14px 20px', zIndex: 500,
      boxShadow: `0 8px 32px ${WIN}33`,
      minWidth: 260, maxWidth: 340,
      animation: 'slip-in 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>🎲</span>
        <div style={{ fontWeight: 800, fontSize: 15, color: WIN }}>Bet placed!</div>
      </div>
      <div style={{ fontSize: 12, color: TEXT2, marginBottom: 4 }}>
        {result.betType === 'PARLAY' ? 'Parlay' : 'Single'} · {result.combinedOdds.toFixed(2)}×
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>
        Potential: {fmtAMD(result.actualWinnings)}
        <span style={{ fontSize: 10, color: MUTED, fontWeight: 400, marginLeft: 4 }}>
          (after {fmtAMD(result.rake)} rake)
        </span>
      </div>
      <div style={{ fontSize: 11, color: TEXT2, marginTop: 4 }}>
        New balance: {fmtAMD(result.newBalance)}
      </div>
    </div>
  )
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  onConfirm, onCancel, pending, summary,
}: {
  onConfirm: () => void
  onCancel:  () => void
  pending:   boolean
  summary:   NonNullable<ReturnType<typeof useBetSlip>['summary']>
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(5,9,17,0.9)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20,
        padding: 24, maxWidth: 360, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎲</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Confirm Bet</div>
          <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>
            {summary.betType} · {summary.legs} selection{summary.legs > 1 ? 's' : ''} · {summary.combinedOdds.toFixed(2)}×
          </div>
        </div>

        {[
          { label: 'Stake',              value: fmtAMD(summary.stake),             color: TEXT  },
          { label: 'Potential winnings', value: fmtAMD(summary.potentialWinnings), color: TEXT  },
          { label: '10% rake',           value: `− ${fmtAMD(summary.rake)}`,        color: MUTED },
          { label: 'Actual winnings',    value: fmtAMD(summary.actualWinnings),    color: GOLD  },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 0', borderBottom: `1px solid ${BORDER}`,
          }}>
            <span style={{ fontSize: 13, color: TEXT2 }}>{row.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.value}</span>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} disabled={pending} style={{
            flex: 1, padding: '12px 0', borderRadius: 10,
            border: `1px solid ${BORDER}`, background: 'transparent',
            color: TEXT2, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={pending} style={{
            flex: 2, padding: '12px 0', borderRadius: 10,
            border: 'none', background: WIN,
            color: '#fff', fontSize: 14, fontWeight: 800,
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}>
            {pending ? 'Placing…' : `Confirm — ${fmtAMD(summary.stake)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── BetSlipContents ──────────────────────────────────────────────────────────
//
// Shared inner content used by both:
//   • BetSlip — mobile bottom-sheet wrapper (onBetPlaced bubbles toast up)
//   • BettingPageClient — desktop sidebar panel (showToast=true renders inline)

export type BetSlipContentsProps = {
  onClose?:     () => void
  compact?:     boolean
  // Desktop panel: true (panel stays mounted so toast renders here)
  // Mobile sheet: false (sheet unmounts on clear; BetSlip renders toast itself)
  showToast?:   boolean
  onBetPlaced?: (result: PlaceBetResult) => void
}

export function BetSlipContents({
  onClose,
  compact     = false,
  showToast   = true,
  onBetPlaced,
}: BetSlipContentsProps) {
  const {
    legs, betAmount, setBetAmount,
    removeLeg, clearSlip,
    summary, validation, balance,
    setLastPlacedBetId,
  } = useBetSlip()

  const [showConfirm, setShowConfirm]   = useState(false)
  const [placedResult, setPlacedResult] = useState<PlaceBetResult | null>(null)
  const [error, setError]               = useState('')
  const [pending, start]                = useTransition()

  const amount = parseFloat(betAmount) || 0

  function handlePlace() {
    if (!summary || !validation.valid) return
    setShowConfirm(true)
  }

  function handleConfirm() {
    if (!summary) return
    setError('')
    start(async () => {
      try {
        const result = await placeBetAction(legs, amount)
        setLastPlacedBetId(result.betId)
        clearSlip()
        setShowConfirm(false)
        if (showToast) {
          setPlacedResult(result)
        } else {
          onBetPlaced?.(result)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to place bet')
        setShowConfirm(false)
      }
    })
  }

  return (
    <>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: compact ? '10px 14px 8px' : '10px 20px 12px',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>
          Bet Slip
          {legs.length > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 11, background: ACCENT, color: '#fff',
              borderRadius: 10, padding: '2px 8px', fontWeight: 700,
            }}>
              {legs.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {legs.length > 0 && (
            <button onClick={clearSlip} style={{
              background: 'transparent', border: `1px solid ${BORDER}`,
              color: MUTED, fontSize: 11, padding: '4px 10px',
              borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            }}>
              Clear
            </button>
          )}
          {onClose && (
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none',
              color: TEXT2, fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
            }}>
              ↓
            </button>
          )}
        </div>
      </div>

      {/* ── Parlay badge ── */}
      {legs.length > 1 && (
        <div style={{ padding: compact ? '8px 14px 0' : '8px 20px 0' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px',
            borderRadius: 10, background: `${GOLD}22`, color: GOLD,
          }}>
            PARLAY · {legs.length} LEGS
          </span>
        </div>
      )}

      {/* ── Empty state ── */}
      {legs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: MUTED }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
          <div style={{ fontWeight: 700, color: TEXT2, fontSize: 13, marginBottom: 4 }}>
            Slip is empty
          </div>
          <div style={{ fontSize: 12 }}>Click any odds to add a selection</div>
        </div>
      )}

      {/* ── Legs list ── */}
      {legs.length > 0 && (
        <div style={{
          padding: `8px ${compact ? '12px' : '16px'} 0`,
          overflowY: 'auto',
          maxHeight: compact ? 240 : 300,
        }}>
          {legs.map((leg, i) => (
            <div
              key={leg.marketId}
              style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                padding: '9px 12px', marginBottom: 6,
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10,
                animation: 'slip-in 0.2s ease',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {legs.length > 1 && (
                  <span style={{ fontSize: 9, color: MUTED, fontWeight: 700 }}>
                    LEG {i + 1} ·{' '}
                  </span>
                )}
                <span style={{
                  fontSize: 9, fontWeight: 700, color: ACCENT,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {MARKET_SHORT[leg.marketType] ?? leg.marketType}
                </span>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: TEXT, marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {leg.selectionLabel}
                </div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{leg.matchTitle}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT, minWidth: 40, textAlign: 'right' }}>
                  {leg.odds.toFixed(2)}
                </span>
                <button onClick={() => removeLeg(leg.marketId)} style={{
                  background: 'none', border: 'none', color: MUTED,
                  fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom controls (only when legs exist) ── */}
      {legs.length > 0 && (
        <div style={{
          padding: `12px ${compact ? '12px' : '16px'} ${compact ? '16px' : '24px'}`,
          borderTop: `1px solid ${BORDER}`,
          marginTop: 8,
        }}>
          {/* Validation errors */}
          {validation.errors.length > 0 && (
            <div style={{
              background: `${LOSS}18`, border: `1px solid ${LOSS}44`,
              borderRadius: 8, padding: '8px 12px', marginBottom: 10,
            }}>
              {validation.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: LOSS }}>{e}</div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div style={{
              background: `${GOLD}18`, border: `1px solid ${GOLD}44`,
              borderRadius: 8, padding: '8px 12px', marginBottom: 10,
            }}>
              {validation.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 11, color: GOLD }}>{w}</div>
              ))}
            </div>
          )}

          {/* API error */}
          {error && (
            <div style={{
              background: `${LOSS}18`, border: `1px solid ${LOSS}`,
              borderRadius: 8, padding: '8px 12px', marginBottom: 10,
              fontSize: 12, color: LOSS,
            }}>
              {error}
            </div>
          )}

          {/* Amount input */}
          <div style={{ marginBottom: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <label style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>Bet amount</label>
              <span style={{ fontSize: 11, color: MUTED }}>
                Balance: <span style={{ color: GOLD, fontWeight: 700 }}>{fmtAMD(balance)}</span>
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                placeholder="e.g. 1000"
                min={100}
                step={100}
                style={{
                  width: '100%', padding: '11px 44px 11px 14px',
                  background: CARD2, border: `1px solid ${amount > balance ? LOSS : BORDER}`,
                  borderRadius: 10, color: TEXT, fontSize: 16, fontWeight: 700,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <span style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 12, color: MUTED, pointerEvents: 'none',
              }}>
                ֏
              </span>
            </div>

            {/* Quick-amount chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[500, 1000, 2000, 5000].map(v => (
                <button
                  key={v}
                  onClick={() => setBetAmount(String(v))}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 8,
                    border: `1px solid ${betAmount === String(v) ? ACCENT : BORDER}`,
                    background: betAmount === String(v) ? `${ACCENT}22` : 'transparent',
                    color: betAmount === String(v) ? ACCENT : TEXT2,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {summary && (
            <div style={{
              background: CARD2, borderRadius: 10, padding: '10px 14px',
              marginBottom: 12, border: `1px solid ${BORDER}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: TEXT2 }}>
                  {summary.betType} · {summary.combinedOdds.toFixed(2)}×
                </span>
                <span style={{ fontSize: 11, color: MUTED }}>rake 10%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: TEXT2 }}>Potential winnings</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>
                  {fmtAMD(summary.actualWinnings)}
                </span>
              </div>
              {summary.rake > 0 && (
                <div style={{ fontSize: 10, color: MUTED, textAlign: 'right', marginTop: 2 }}>
                  gross {fmtAMD(summary.potentialWinnings)} − rake {fmtAMD(summary.rake)}
                </div>
              )}
            </div>
          )}

          {/* Place bet button */}
          <button
            onClick={handlePlace}
            disabled={!validation.valid || !summary || pending}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              border: 'none',
              background: validation.valid && summary ? WIN : MUTED,
              color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: validation.valid && summary ? 'pointer' : 'not-allowed',
              opacity: pending ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
          >
            {pending ? 'Placing…' : validation.valid && summary
              ? `Place Bet — ${fmtAMD(amount)}`
              : 'Enter a valid bet amount'
            }
          </button>

          {legs.length > 1 && (
            <div style={{ fontSize: 10, color: MUTED, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
              Same match, different markets — correlations flagged as warnings.
            </div>
          )}
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {showConfirm && summary && (
        <ConfirmDialog
          summary={summary}
          pending={pending}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* ── Toast (only when showToast=true — i.e. desktop panel stays mounted) ── */}
      {showToast && placedResult && (
        <PlacedBetToast
          result={placedResult}
          onDone={() => setPlacedResult(null)}
        />
      )}
    </>
  )
}
