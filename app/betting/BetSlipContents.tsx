'use client'

import { useState, useEffect, useTransition } from 'react'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { fmtAMD, getMarketShort } from '@/lib/betting/validation'
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
    const t = setTimeout(onDone, 4200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
      background: CARD, border: `1px solid ${WIN}`, borderRadius: 14,
      padding: '14px 20px', zIndex: 500,
      boxShadow: `0 8px 32px ${WIN}33`,
      minWidth: 268, maxWidth: 340,
      animation: 'slip-in 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${WIN}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          ✓
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, color: WIN }}>Bet Placed!</div>
      </div>
      <div style={{ fontSize: 12, color: TEXT2, marginBottom: 6 }}>
        {result.betType === 'PARLAY' ? 'Parlay' : 'Single'} · {result.combinedOdds.toFixed(2)}×
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12, color: TEXT2 }}>Potential win</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: GOLD }}>
          {fmtAMD(result.actualWinnings)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
        Rake: {fmtAMD(result.rake)} · New balance: {fmtAMD(result.newBalance)}
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
      background: 'rgba(5,9,17,0.92)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20,
        padding: 24, maxWidth: 360, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: TEXT2, marginBottom: 4 }}>
            {summary.betType === 'PARLAY' ? 'Parlay' : 'Single'} · {summary.legs} {summary.legs === 1 ? 'selection' : 'selections'} · {summary.combinedOdds.toFixed(2)}×
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: TEXT }}>Confirm Bet</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          {[
            { label: 'Stake',         value: fmtAMD(summary.stake),             color: TEXT  },
            { label: 'Potential Win', value: fmtAMD(summary.potentialWinnings), color: TEXT  },
            { label: '10% Rake',      value: `− ${fmtAMD(summary.rake)}`,        color: MUTED },
            { label: 'Net Win',       value: fmtAMD(summary.actualWinnings),    color: GOLD  },
          ].map(row => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: `1px solid ${BORDER}`,
            }}>
              <span style={{ fontSize: 13, color: TEXT2 }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
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
            {pending ? 'Placing...' : `Confirm — ${fmtAMD(summary.stake)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── BetSlipContents ──────────────────────────────────────────────────────────

export type BetSlipContentsProps = {
  onClose?:     () => void
  compact?:     boolean
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

  // Detect same-match conflicts for visual highlight
  const matchIdCounts = new Map<string, number>()
  for (const leg of legs) {
    matchIdCounts.set(leg.matchId, (matchIdCounts.get(leg.matchId) ?? 0) + 1)
  }
  const conflictingMatchIds = new Set<string>(
    [...matchIdCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id)
  )
  const hasConflicts = conflictingMatchIds.size > 0

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

  const px = compact ? 14 : 20

  return (
    <>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `12px ${px}px 10px`,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Bet Slip</span>
          {legs.length > 0 && (
            <span style={{
              fontSize: 11, background: ACCENT, color: '#fff',
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
        <div style={{ padding: `8px ${px}px 0` }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px',
            borderRadius: 10, background: `${GOLD}20`, color: GOLD,
            border: `1px solid ${GOLD}30`,
          }}>
            PARLAY · {legs.length} SELECTIONS
          </span>
        </div>
      )}

      {/* ── Same-event conflict warning ── */}
      {hasConflicts && (
        <div style={{
          margin: `6px ${px}px 0`,
          padding: '9px 12px',
          background: `${LOSS}16`,
          border: `1px solid ${LOSS}55`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 15, color: LOSS, flexShrink: 0, lineHeight: 1 }}>⚠</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: LOSS }}>
            Highlighted events cannot be combined
          </span>
        </div>
      )}

      {/* ── Empty state ── */}
      {legs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '36px 20px', color: MUTED }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: CARD2, border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, margin: '0 auto 12px',
          }}>
            🎯
          </div>
          <div style={{ fontWeight: 800, color: TEXT2, fontSize: 14, marginBottom: 6 }}>
            Your Betslip is Empty
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Click on any odds to add a selection
          </div>
        </div>
      )}

      {/* ── Legs ── */}
      {legs.length > 0 && (
        <div style={{
          padding: `8px ${compact ? 12 : 16}px 0`,
          overflowY: 'auto',
          maxHeight: compact ? 240 : 300,
        }}>
          {legs.map((leg, i) => {
            const isConflict = conflictingMatchIds.has(leg.matchId)
            return (
            <div
              key={leg.marketId}
              style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                padding: '9px 12px', marginBottom: 6,
                background: isConflict ? `${LOSS}0c` : CARD,
                border: `1px solid ${isConflict ? LOSS + '55' : BORDER}`,
                borderLeft: `3px solid ${isConflict ? LOSS : BORDER}`,
                borderRadius: 10,
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
                  {getMarketShort(leg.marketType)}
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
          )})}
        </div>
      )}

      {/* ── Bottom controls ── */}
      {legs.length > 0 && (
        <div style={{
          padding: `12px ${compact ? 12 : 16}px ${compact ? 16 : 24}px`,
          borderTop: `1px solid ${BORDER}`,
          marginTop: 8,
        }}>
          {/* Validation errors */}
          {validation.errors.length > 0 && (
            <div style={{
              background: `${LOSS}14`, border: `1px solid ${LOSS}40`,
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
              background: `${GOLD}14`, border: `1px solid ${GOLD}40`,
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
              background: `${LOSS}14`, border: `1px solid ${LOSS}`,
              borderRadius: 8, padding: '8px 12px', marginBottom: 10,
              fontSize: 12, color: LOSS,
            }}>
              {error}
            </div>
          )}

          {/* Stake input */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <label style={{ fontSize: 12, color: TEXT2, fontWeight: 700 }}>Stake Amount</label>
              <span style={{ fontSize: 11, color: MUTED }}>
                Balance: <span style={{ color: GOLD, fontWeight: 700 }}>{fmtAMD(balance)}</span>
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                placeholder="e.g. 500"
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
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              {[500, 1000, 2000, 5000].map(v => (
                <button
                  key={v}
                  onClick={() => setBetAmount(String(v))}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 8,
                    border: `1px solid ${betAmount === String(v) ? ACCENT : BORDER}`,
                    background: betAmount === String(v) ? `${ACCENT}20` : 'transparent',
                    color: betAmount === String(v) ? ACCENT : TEXT2,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {v >= 1000 ? `${v / 1000}k` : v}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: TEXT2 }}>
                  {summary.betType === 'PARLAY' ? 'Parlay' : 'Single'} · {summary.combinedOdds.toFixed(2)}×
                </span>
                <span style={{ fontSize: 11, color: MUTED }}>10% rake</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: TEXT2 }}>Potential Win</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: GOLD }}>
                  {fmtAMD(summary.actualWinnings)}
                </span>
              </div>
              {summary.rake > 0 && (
                <div style={{ fontSize: 10, color: MUTED, textAlign: 'right', marginTop: 3 }}>
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
              transition: 'background 0.18s',
            }}
          >
            {pending
              ? 'Placing...'
              : validation.valid && summary
                ? `Place Bet — ${fmtAMD(amount)}`
                : 'Enter a valid amount'
            }
          </button>

          {legs.length > 1 && (
            <div style={{ fontSize: 10, color: MUTED, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
              Multiple selections from the same match are not allowed in parlays.
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

      {/* ── Toast ── */}
      {showToast && placedResult && (
        <PlacedBetToast
          result={placedResult}
          onDone={() => setPlacedResult(null)}
        />
      )}
    </>
  )
}
