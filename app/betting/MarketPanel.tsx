'use client'

import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { MARKET_LABELS, type SlipLeg } from '@/lib/betting/validation'
import type { MarketRow } from '@/lib/odds/markets'

// ─── Design tokens ────────────────────────────────────────────────────────────
const CARD2  = '#111d2e'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const TEXT2  = '#94a3b8'
const MUTED  = '#4b5a73'
const WIN    = '#10b981'
const GOLD   = '#f59e0b'

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ score, label }: { score: number; label: string }) {
  const color = label === 'high' ? WIN : label === 'medium' ? GOLD : MUTED
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px',
      borderRadius: 10, background: `${color}22`, color,
      border: `1px solid ${color}44`,
    }}>
      {label === 'high' ? '↑ High' : label === 'medium' ? '~ Med' : '↓ Low'}
      {' · '}{score}
    </span>
  )
}

// ─── Option button ─────────────────────────────────────────────────────────────

export function OptionBtn({
  label, odds, selected, onToggle, disabled,
}: {
  label:    string
  odds:     number
  selected: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        flex: 1, padding: '10px 8px', borderRadius: 10,
        border: `1.5px solid ${selected ? WIN : BORDER}`,
        background: selected ? `${WIN}18` : CARD2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s',
        textAlign: 'center',
        minWidth: 0,
      }}
    >
      <div style={{
        fontSize: 11, color: selected ? WIN : TEXT2,
        fontWeight: 600, marginBottom: 4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 17, fontWeight: 800,
        color: selected ? WIN : ACCENT,
        transition: 'color 0.2s',
      }}>
        {odds.toFixed(2)}
      </div>
      {selected && (
        <div style={{ fontSize: 9, color: WIN, marginTop: 3, fontWeight: 700 }}>✓ IN SLIP</div>
      )}
    </button>
  )
}

// ─── Market panel ─────────────────────────────────────────────────────────────

export function MarketPanel({
  market, homeName, awayName, matchId, matchType, matchTitle,
}: {
  market:     MarketRow
  homeName:   string
  awayName:   string
  matchId:    string
  matchType:  'friendly' | 'championship'
  matchTitle: string
}) {
  const { addLeg, removeLeg, isInSlip, getLeg } = useBetSlip()

  const options = market.options
  const odds    = market.odds
  const locked  = market.status !== 'OPEN'

  function toggleOption(optionKey: 'option1' | 'option2' | 'option3') {
    if (isInSlip(market.marketId)) {
      const existing = getLeg(market.marketId)
      if (existing?.selectedOption === optionKey) {
        removeLeg(market.marketId)
        return
      }
      removeLeg(market.marketId)
    }
    const leg: SlipLeg = {
      marketId:       market.marketId,
      matchId,
      matchType,
      marketType:     market.marketType,
      marketLabel:    MARKET_LABELS[market.marketType] ?? market.marketType,
      selectedOption: optionKey,
      selectionLabel: options[optionKey]?.label ?? optionKey,
      odds:           odds[optionKey] ?? 1.0,
      matchTitle,
    }
    addLeg(leg)
  }

  const optionKeys = (['option1', 'option2', 'option3'] as const).filter(k => options[k])
  const confidence = market.aiCalculatedOdds?.confidence as { score: number; label: string } | undefined

  return (
    <div style={{
      background: '#0c1422', border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: '12px 14px', marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, color: ACCENT,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {MARKET_LABELS[market.marketType] ?? market.marketType}
          </span>
          {market.adminOverride && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: `${GOLD}22`, color: GOLD, fontWeight: 700 }}>
              ADJUSTED
            </span>
          )}
          {locked && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: '#1a2840', color: MUTED, fontWeight: 700 }}>
              LOCKED
            </span>
          )}
        </div>
        {confidence && <ConfidenceBadge score={confidence.score} label={confidence.label} />}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: 8 }}>
        {optionKeys.map(key => (
          <OptionBtn
            key={key}
            label={options[key]?.label ?? key}
            odds={odds[key] ?? 1.0}
            selected={getLeg(market.marketId)?.selectedOption === key}
            disabled={locked}
            onToggle={() => toggleOption(key)}
          />
        ))}
      </div>
    </div>
  )
}
