'use client'

import { useState } from 'react'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { getMarketLabel, type SlipLeg } from '@/lib/betting/validation'
import type { MarketRow } from '@/lib/odds/markets'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  card:   '#0c1422',
  card2:  '#111d2e',
  border: '#1a2840',
  text:   '#f8fafc',
  text2:  '#94a3b8',
  muted:  '#4b5a73',
  accent: '#3b82f6',
  win:    '#10b981',
  gold:   '#f59e0b',
  pink:   '#e91e8c',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function optionSort(a: string, b: string): number {
  const ai = Number(a.replace('option', ''))
  const bi = Number(b.replace('option', ''))
  if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi
  return a.localeCompare(b)
}

export function getMarketOptionKeys(market: Pick<MarketRow, 'options' | 'odds'>): string[] {
  return Object.keys(market.options ?? {})
    .filter(key => {
      const odd = Number(market.odds?.[key])
      return Number.isFinite(odd) && odd > 1
    })
    .sort(optionSort)
}

export function impliedProbability(odds: number): string {
  if (!Number.isFinite(odds) || odds <= 1) return '0.0%'
  return `${((1 / odds) * 100).toFixed(1)}%`
}

function marketTitle(market: MarketRow): string {
  if (market.marketType === 'CUSTOM_PROP' && market.description?.trim()) {
    return market.description.trim()
  }
  return getMarketLabel(market.marketType)
}

function marketExplanation(market: MarketRow): string {
  if (market.marketType === 'CUSTOM_PROP') {
    return market.description?.trim() || 'Custom market created for this match.'
  }
  const t = market.marketType
  if (t.startsWith('OU_') || t === 'OU2_5') {
    const line = t === 'OU2_5' ? 2.5 : parseFloat(t.slice(3).replace('_', '.'))
    return `Will total goals be over or under ${line}? Integer lines push (refund) on exact total.`
  }
  if (t.startsWith('HCP_') || t === 'HANDICAP') {
    return 'A virtual goal handicap is applied to the result before deciding the winner.'
  }
  if (t.startsWith('IT_HOME_')) {
    const line = parseFloat(t.slice(8).replace('_', '.'))
    return `Will the home team score more or fewer than ${line} goals?`
  }
  if (t.startsWith('IT_AWAY_')) {
    const line = parseFloat(t.slice(8).replace('_', '.'))
    return `Will the away team score more or fewer than ${line} goals?`
  }
  const info: Record<string, string> = {
    '1X2':          'Pick the match result: home win, draw, or away win.',
    'BTTS':         'Will both teams score at least one goal each?',
    'DOUBLE_CHANCE':'Cover two of three outcomes: 1X (home or draw), X2 (away or draw), 12 (either team wins).',
    'EXACT_SCORE':  'Pick the exact final score. "Other" covers all unlisted results.',
  }
  return info[t] ?? 'Select one outcome from this market.'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBadge({ score, label }: { score: number; label: string }) {
  const color = label === 'high' ? C.win : label === 'medium' ? C.gold : C.muted
  const text  = label === 'high' ? 'High' : label === 'medium' ? 'Mid' : 'Low'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: `${color}16`, color, border: `1px solid ${color}30`,
      whiteSpace: 'nowrap',
    }}>
      {text} confidence
    </span>
  )
}

function OptionBtn({
  label, odds, selected, onToggle, disabled,
}: {
  label: string; odds: number; selected: boolean; onToggle: () => void; disabled: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const borderColor = selected ? C.pink : hovered && !disabled ? `${C.accent}80` : C.border
  const bgColor     = selected ? `${C.pink}22` : hovered && !disabled ? `${C.accent}10` : C.card2

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${impliedProbability(odds)} implied probability`}
      style={{
        minHeight: 68,
        padding: '9px 12px',
        borderRadius: 8,
        border: `1.5px solid ${borderColor}`,
        background: bgColor,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'border-color 0.12s, background 0.12s',
        textAlign: 'left',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 6,
      }}
    >
      <span style={{
        fontSize: 12, lineHeight: 1.3, fontWeight: 700,
        color: selected ? '#fff' : C.text2,
        overflowWrap: 'anywhere',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
        <span style={{
          fontSize: 20, lineHeight: 1, fontWeight: 900,
          color: selected ? '#fff' : C.accent,
          letterSpacing: '-0.02em',
        }}>
          {odds.toFixed(2)}
        </span>
        <span style={{
          fontSize: 10, lineHeight: 1, fontWeight: 700,
          color: selected ? 'rgba(255,255,255,0.8)' : disabled ? C.muted : hovered ? C.text2 : C.muted,
        }}>
          {selected ? '✓ In Slip' : disabled ? 'Closed' : 'Add'}
        </span>
      </div>
    </button>
  )
}

// ─── MarketPanel ──────────────────────────────────────────────────────────────

export function MarketPanel({
  market, matchId, matchType, matchTitle,
}: {
  market:     MarketRow
  homeName:   string
  awayName:   string
  matchId:    string
  matchType:  'friendly' | 'championship'
  matchTitle: string
}) {
  const { addLeg, removeLeg, isInSlip, getLeg } = useBetSlip()

  const options     = market.options
  const odds        = market.odds
  const closed      = market.status !== 'OPEN'
  const optionKeys  = getMarketOptionKeys(market)
  const selectedLeg = getLeg(market.marketId)
  const aiConf      = market.aiCalculatedOdds?.confidence as { score: number; label: string } | undefined
  const confidence  = market.confidence ?? aiConf

  function toggleOption(optionKey: string) {
    if (closed) return
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
      marketLabel:    marketTitle(market),
      selectedOption: optionKey,
      selectionLabel: options[optionKey]?.label ?? optionKey,
      odds:           Number(odds[optionKey] ?? 1),
      matchTitle,
    }
    addLeg(leg)
  }

  return (
    <section style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 8,
      position: 'relative',
    }}>

      {/* Market header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 10, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
            {marketTitle(market)}
          </h3>
          <button
            type="button"
            title={marketExplanation(market)}
            aria-label={`About ${marketTitle(market)}`}
            style={{
              width: 17, height: 17, borderRadius: '50%',
              border: `1px solid ${C.border}`, background: C.card2,
              color: C.muted, fontSize: 11, fontWeight: 900,
              cursor: 'help', lineHeight: 1, flexShrink: 0,
            }}
          >
            ?
          </button>
          {market.adminOverride && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999,
              background: `${C.gold}18`, color: C.gold,
              fontWeight: 700, border: `1px solid ${C.gold}28`,
            }}>
              Admin adjusted
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {confidence && <ConfidenceBadge score={confidence.score} label={confidence.label} />}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            color: closed ? C.muted : C.win,
            background: closed ? `${C.muted}14` : `${C.win}14`,
            border: `1px solid ${closed ? C.muted : C.win}30`,
            whiteSpace: 'nowrap',
          }}>
            {closed ? 'Closed' : 'Open'}
          </span>
        </div>
      </div>

      {/* Options grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: market.marketType === 'EXACT_SCORE'
          ? 'repeat(auto-fit, minmax(80px, 1fr))'
          : 'repeat(auto-fit, minmax(118px, 1fr))',
        gap: 6,
      }}>
        {optionKeys.map(key => (
          <OptionBtn
            key={key}
            label={options[key]?.label ?? key}
            odds={Number(odds[key] ?? 1)}
            selected={selectedLeg?.selectedOption === key}
            disabled={closed}
            onToggle={() => toggleOption(key)}
          />
        ))}
      </div>
    </section>
  )
}
