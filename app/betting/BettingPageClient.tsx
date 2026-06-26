'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { getMatchMarketsAction } from '@/app/betting/odds/actions'
import { MarketPanel } from '@/app/betting/MarketPanel'
import { BetSlipContents } from '@/app/betting/BetSlipContents'
import { ActiveBets } from '@/app/betting/ActiveBets'
import { BalanceWidget } from '@/app/components/BalanceWidget'
import { BetNotificationCenter } from '@/app/components/BetNotificationCenter'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { getMarketLabel } from '@/lib/betting/validation'
import supabase from '@/lib/supabase/client'
import type { MarketRow } from '@/lib/odds/markets'
import { BottomNav } from '@/app/components/BottomNav'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = 'var(--bg)'
const CARD   = 'var(--card)'
const CARD2  = 'var(--card2)'
const CARD3  = 'var(--card3)'
const BORDER = 'var(--border)'
const ACCENT = 'var(--accent)'
const TEXT   = 'var(--text)'
const TEXT2  = 'var(--text2)'
const MUTED  = 'var(--muted)'
const GOLD   = 'var(--gold)'
const WIN    = 'var(--win)'
const PINK   = '#DB2777'

// ─── Market classification ────────────────────────────────────────────────────

type MarketGroup = 'ou' | 'hcp' | 'it_home' | 'it_away' | 'solo'
type MarketTabKey = 'all' | 'match' | 'totals' | 'handicap'

function classifyMarket(m: MarketRow): MarketGroup {
  const t = m.marketType
  if (t.startsWith('OU_') || t === 'OU2_5') return 'ou'
  if (t.startsWith('HCP_') || t === 'HANDICAP') return 'hcp'
  if (t.startsWith('IT_HOME_')) return 'it_home'
  if (t.startsWith('IT_AWAY_')) return 'it_away'
  return 'solo'
}

function extractLine(m: MarketRow): number {
  const t = m.marketType
  if (t === 'OU2_5') return 2.5
  if (t === 'HANDICAP') return 0
  if (t.startsWith('OU_'))      return parseFloat(t.slice(3).replace('_', '.'))
  if (t.startsWith('HCP_M'))    return  parseFloat(t.slice(5).replace('_', '.'))
  if (t.startsWith('HCP_P'))    return -parseFloat(t.slice(5).replace('_', '.'))
  if (t.startsWith('IT_HOME_')) return parseFloat(t.slice(8).replace('_', '.'))
  if (t.startsWith('IT_AWAY_')) return parseFloat(t.slice(8).replace('_', '.'))
  return 0
}

function findOptionKey(market: MarketRow, innerKey: string): string {
  const entries = Object.entries(market.options ?? {}) as [string, { key: string }][]
  return entries.find(([, v]) => v.key === innerKey)?.[0] ?? 'option1'
}

const SOLO_ORDER = ['1X2', 'DOUBLE_CHANCE', 'BTTS', 'EXACT_SCORE', 'CUSTOM_PROP']

// ─── Types ────────────────────────────────────────────────────────────────────

export type PreviewOpt = {
  key:   string   // 'option1', 'option2', etc.
  label: string   // team name or 'Draw'
  odds:  number
}

export type Preview1X2 = {
  marketId: string
  home: PreviewOpt   // W1
  draw: PreviewOpt   // X
  away: PreviewOpt   // W2
}

export type MatchBettingRow = {
  matchId:     string
  matchType:   'friendly' | 'championship'
  homeName:    string
  awayName:    string
  matchStatus: string
  createdAt:   string
  openMarkets: number
  groupLabel:  string
  preview1x2?: Preview1X2
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const check = () => setDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return desktop
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMatchDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'TBD'
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function statusLabel(status: string): string {
  return status.slice(0, 1).toUpperCase() + status.slice(1)
}

// ─── OddsCell (table cell that integrates with bet slip) ─────────────────────

function OddsCell({
  market, optionKey, matchId, matchType, matchTitle,
}: {
  market: MarketRow; optionKey: string
  matchId: string; matchType: 'friendly' | 'championship'; matchTitle: string
}) {
  const { addLeg, removeLeg, isInSlip, getLeg } = useBetSlip()
  const [hovered, setHovered] = useState(false)

  const option  = market.options?.[optionKey] as { key: string; label: string } | undefined
  const odds    = Number(market.odds?.[optionKey] ?? 1)
  const closed  = market.status !== 'OPEN'
  const leg     = getLeg(market.marketId)
  const selected = leg?.selectedOption === optionKey

  if (!option || !Number.isFinite(odds) || odds <= 1)
    return <td style={{ padding: '4px 5px', color: MUTED, fontSize: 11, textAlign: 'center' }}>—</td>

  function toggle() {
    if (closed) return
    if (selected) { removeLeg(market.marketId); return }
    if (isInSlip(market.marketId)) removeLeg(market.marketId)
    addLeg({
      marketId: market.marketId, matchId, matchType,
      marketType: market.marketType,
      marketLabel: getMarketLabel(market.marketType),
      selectedOption: optionKey,
      selectionLabel: option?.label ?? optionKey,
      odds, matchTitle,
    })
  }

  const bg     = selected ? `${PINK}22`   : hovered && !closed ? `${ACCENT}14` : 'transparent'
  const border = selected ? PINK          : hovered && !closed ? `${ACCENT}60` : BORDER

  return (
    <td style={{ padding: '3px 4px' }}>
      <button
        onClick={toggle}
        disabled={closed}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          width: '100%', minWidth: 72, padding: '11px 6px', minHeight: 44,
          borderRadius: 6, border: `1.5px solid ${border}`, background: bg,
          cursor: closed ? 'not-allowed' : 'pointer',
          opacity: closed ? 0.45 : 1, transition: 'border-color 0.1s, background 0.1s',
        }}
      >
        <span style={{ fontSize: 10, color: WIN }}>🚀</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: selected ? '#fff' : ACCENT }}>
          {odds.toFixed(2)}
        </span>
        {selected && <span style={{ fontSize: 9, color: '#fff', fontWeight: 800 }}>✓</span>}
      </button>
    </td>
  )
}

// ─── MarketTableGroup ─────────────────────────────────────────────────────────

function MarketTableGroup({
  title, markets, col1Label, col2Label,
  getOption1Key, getOption2Key, getRowLabel,
  matchId, matchType, matchTitle,
}: {
  title: string; markets: MarketRow[]
  col1Label: string; col2Label: string
  getOption1Key: (m: MarketRow) => string
  getOption2Key: (m: MarketRow) => string
  getRowLabel:   (m: MarketRow) => string
  matchId: string; matchType: 'friendly' | 'championship'; matchTitle: string
}) {
  if (markets.length === 0) return null
  const closed = markets.every(m => m.status !== 'OPEN')

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`,
      borderRadius: 10, marginBottom: 8, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px 7px', borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{title}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          color: closed ? MUTED : WIN,
          background: closed ? `${MUTED}14` : `${WIN}14`,
          border: `1px solid ${closed ? MUTED : WIN}30`,
        }}>
          {closed ? 'Closed' : 'Open'}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <th style={{ padding: '5px 14px', fontSize: 10, fontWeight: 700, color: MUTED, textAlign: 'left' }} />
              <th style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: MUTED, textAlign: 'center' }}>{col1Label}</th>
              <th style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: MUTED, textAlign: 'center' }}>{col2Label}</th>
            </tr>
          </thead>
          <tbody>
            {markets.map(m => (
              <tr key={m.marketId} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                <td style={{ padding: '4px 14px', fontSize: 12, fontWeight: 700, color: TEXT2, whiteSpace: 'nowrap' }}>
                  {getRowLabel(m)}
                </td>
                <OddsCell market={m} optionKey={getOption1Key(m)} matchId={matchId} matchType={matchType} matchTitle={matchTitle} />
                <OddsCell market={m} optionKey={getOption2Key(m)} matchId={matchId} matchType={matchType} matchTitle={matchTitle} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── PreviewOddsBtn ───────────────────────────────────────────────────────────

function PreviewOddsBtn({
  opt, market, matchId, matchType, matchTitle,
}: {
  opt:        PreviewOpt
  market:     Preview1X2
  matchId:    string
  matchType:  'friendly' | 'championship'
  matchTitle: string
}) {
  const { addLeg, removeLeg, isInSlip, getLeg } = useBetSlip()
  const leg      = getLeg(market.marketId)
  const selected = leg?.selectedOption === opt.key
  const [hovered, setHovered] = useState(false)

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (isInSlip(market.marketId)) {
      if (leg?.selectedOption === opt.key) { removeLeg(market.marketId); return }
      removeLeg(market.marketId)
    }
    addLeg({
      marketId:       market.marketId,
      matchId,
      matchType,
      marketType:     '1X2',
      marketLabel:    getMarketLabel('1X2'),
      selectedOption: opt.key,
      selectionLabel: opt.label,
      odds:           opt.odds,
      matchTitle,
    })
  }

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${opt.label} — ${opt.odds.toFixed(2)}`}
      style={{
        width: 52, height: 34, borderRadius: 6, flexShrink: 0,
        border: `1.5px solid ${selected ? PINK : hovered ? `${ACCENT}60` : BORDER}`,
        background: selected ? PINK : hovered ? `${ACCENT}14` : CARD2,
        color: selected ? '#fff' : ACCENT,
        fontSize: 12, fontWeight: 800, cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {opt.odds.toFixed(2)}
    </button>
  )
}

// ─── OddsPlaceholder (no 1X2 market available) ────────────────────────────────

function OddsPlaceholder() {
  return (
    <div style={{
      width: 52, height: 34, borderRadius: 6, flexShrink: 0,
      background: CARD2, border: `1px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: MUTED,
    }}>
      —
    </div>
  )
}

// ─── MatchRow ─────────────────────────────────────────────────────────────────

function MatchRow({
  row, selected, onSelect,
}: {
  row:      MatchBettingRow
  selected: boolean
  onSelect: () => void
}) {
  const { legs } = useBetSlip()
  const legsForMatch = legs.filter(l => l.matchId === row.matchId).length
  const matchTitle   = `${row.homeName} vs ${row.awayName}`
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px',
        background: selected ? `${ACCENT}14` : hovered ? CARD3 : 'transparent',
        borderLeft: `3px solid ${selected ? ACCENT : 'transparent'}`,
        cursor: 'pointer', borderBottom: `1px solid ${BORDER}30`,
        transition: 'background 0.1s',
      }}
    >
      {/* Teams + time */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: selected ? TEXT : TEXT2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {row.homeName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: selected ? TEXT : TEXT2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
          }}>
            {row.awayName}
          </div>
          {legsForMatch > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: PINK,
              background: `${PINK}20`, borderRadius: 4, padding: '1px 5px', flexShrink: 0,
            }}>
              {legsForMatch}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>
          {formatMatchDate(row.createdAt)}
          {row.matchType === 'championship' && (
            <span style={{ color: GOLD, marginLeft: 4 }}>· {row.groupLabel}</span>
          )}
        </div>
      </div>

      {/* Preview odds: W1 / X / W2 */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {row.preview1x2 ? (
          <>
            <PreviewOddsBtn opt={row.preview1x2.home} market={row.preview1x2} matchId={row.matchId} matchType={row.matchType} matchTitle={matchTitle} />
            <PreviewOddsBtn opt={row.preview1x2.draw} market={row.preview1x2} matchId={row.matchId} matchType={row.matchType} matchTitle={matchTitle} />
            <PreviewOddsBtn opt={row.preview1x2.away} market={row.preview1x2} matchId={row.matchId} matchType={row.matchType} matchTitle={matchTitle} />
          </>
        ) : (
          <>
            <OddsPlaceholder />
            <OddsPlaceholder />
            <OddsPlaceholder />
          </>
        )}
      </div>
    </div>
  )
}

// ─── MatchBrowser (left panel) ───────────────────────────────────────────────

function MatchBrowser({
  matches, selectedId, onSelect,
}: {
  matches:    MatchBettingRow[]
  selectedId: string | null
  onSelect:   (row: MatchBettingRow) => void
}) {
  // Group championship matches by label; friendly matches go to "Friendly Matches"
  const groups = new Map<string, MatchBettingRow[]>()
  for (const row of matches) {
    const key = row.matchType === 'championship' ? row.groupLabel : 'Friendly Matches'
    const existing = groups.get(key) ?? []
    existing.push(row)
    groups.set(key, existing)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Sticky column headers: W1 / X / W2 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', background: CARD,
        borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
      }}>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {['W1', 'X', 'W2'].map(label => (
            <div key={label} style={{
              width: 52, textAlign: 'center',
              fontSize: 9, fontWeight: 800, color: MUTED, letterSpacing: '0.07em',
            }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {matches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: MUTED, fontSize: 12 }}>
          No open markets available.
        </div>
      )}

      {Array.from(groups.entries()).map(([label, rows]) => (
        <div key={label}>
          {/* Group header */}
          <div style={{
            padding: '5px 10px',
            background: CARD2, borderBottom: `1px solid ${BORDER}`,
            fontSize: 10, fontWeight: 800, color: TEXT2,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {label}
          </div>
          {rows.map(row => (
            <MatchRow
              key={row.matchId}
              row={row}
              selected={selectedId === row.matchId}
              onSelect={() => onSelect(row)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── MatchMarketsView (middle panel) ─────────────────────────────────────────

function MatchMarketsView({
  row, refreshKey, onBack,
}: {
  row:        MatchBettingRow
  refreshKey: number
  onBack?:    () => void
}) {
  const [markets, setMarkets]     = useState<MarketRow[] | null>(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<MarketTabKey>('all')
  const { legs } = useBetSlip()
  const { matchId, matchType, homeName, awayName } = row
  const matchTitle = `${homeName} vs ${awayName}`

  const reload = useCallback(() => {
    setLoading(true)
    getMatchMarketsAction(matchId, matchType)
      .then(data => { setMarkets(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [matchId, matchType])

  useEffect(() => { reload() }, [reload, refreshKey])

  useEffect(() => {
    const channel = supabase
      .channel(`mkts:${matchId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'bet_markets', filter: `match_id=eq.${matchId}`,
      }, () => {
        getMatchMarketsAction(matchId, matchType).then(setMarkets).catch(() => {})
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [matchId, matchType])

  const allMarkets = markets ?? []
  const openCount  = allMarkets.filter(m => m.status === 'OPEN').length
  const slipCount  = legs.filter(l => l.matchId === matchId).length

  // Classify into groups
  const ouMarkets     = allMarkets.filter(m => classifyMarket(m) === 'ou')    .sort((a,b) => extractLine(a) - extractLine(b))
  const hcpMarkets    = allMarkets.filter(m => classifyMarket(m) === 'hcp')   .sort((a,b) => extractLine(a) - extractLine(b))
  const itHomeMarkets = allMarkets.filter(m => classifyMarket(m) === 'it_home').sort((a,b) => extractLine(a) - extractLine(b))
  const itAwayMarkets = allMarkets.filter(m => classifyMarket(m) === 'it_away').sort((a,b) => extractLine(a) - extractLine(b))
  const soloMarkets   = allMarkets
    .filter(m => classifyMarket(m) === 'solo')
    .sort((a, b) => {
      const ai = SOLO_ORDER.indexOf(a.marketType), bi = SOLO_ORDER.indexOf(b.marketType)
      return (ai === -1 ? SOLO_ORDER.length : ai) - (bi === -1 ? SOLO_ORDER.length : bi)
    })

  const totalsCount   = ouMarkets.length + itHomeMarkets.length + itAwayMarkets.length
  const tabs: { key: MarketTabKey; label: string; count?: number }[] = [
    { key: 'all' as MarketTabKey, label: 'All' },
    ...(soloMarkets.length   > 0 ? [{ key: 'match'    as MarketTabKey, label: 'Match',    count: soloMarkets.length   }] : []),
    ...(totalsCount          > 0 ? [{ key: 'totals'   as MarketTabKey, label: 'Totals',   count: totalsCount          }] : []),
    ...(hcpMarkets.length    > 0 ? [{ key: 'handicap' as MarketTabKey, label: 'Handicap', count: hcpMarkets.length    }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Match header */}
      <div style={{
        padding: '12px 18px', background: CARD,
        borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
              background: 'none', border: 'none', color: TEXT2,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
            }}
          >
            <ChevronLeft size={15} /> Back to matches
          </button>
        )}

        <div style={{ fontSize: 11, color: MUTED, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {row.matchType === 'championship' ? row.groupLabel : 'Friendly Match'}
        </div>
        <div style={{ fontSize: 19, fontWeight: 900, color: TEXT, marginBottom: 8, lineHeight: 1.2 }}>
          {homeName}
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, margin: '0 8px' }}>vs</span>
          {awayName}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: WIN,
            background: `${WIN}14`, padding: '2px 8px', borderRadius: 6,
          }}>
            {openCount} {openCount === 1 ? 'market' : 'markets'} open
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: TEXT2,
            background: CARD2, padding: '2px 8px', borderRadius: 6,
          }}>
            {statusLabel(row.matchStatus)}
          </span>
          {slipCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: PINK,
              background: `${PINK}14`, padding: '2px 8px', borderRadius: 6,
            }}>
              {slipCount} in slip
            </span>
          )}
        </div>
      </div>

      {/* Market type tabs */}
      {allMarkets.length > 0 && tabs.length > 1 && (
        <div style={{
          display: 'flex', background: CARD,
          borderBottom: `1px solid ${BORDER}`,
          overflowX: 'auto', padding: '0 14px',
          flexShrink: 0, scrollbarWidth: 'none',
        }}>
          {tabs.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '10px 10px 9px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                  color: active ? ACCENT : TEXT2,
                  fontSize: 12, fontWeight: active ? 800 : 600,
                  whiteSpace: 'nowrap', flexShrink: 0, transition: 'color 0.12s',
                  marginBottom: -1,
                }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 999,
                    background: active ? `${ACCENT}25` : `${MUTED}20`,
                    color: active ? ACCENT : MUTED,
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Market list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 28px' }}>
        {loading && (
          <div style={{ padding: '32px', color: MUTED, fontSize: 12, textAlign: 'center' }}>
            Loading markets...
          </div>
        )}

        {!loading && allMarkets.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT2, marginBottom: 6 }}>
              No Markets Available
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>
              Markets will appear once opened by an administrator.
            </div>
          </div>
        )}

        {!loading && allMarkets.length > 0 && (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 10,
            }}>
              <span>
                {activeTab === 'all' ? 'All Markets' : `${tabs.find(t => t.key === activeTab)?.label} Markets`}
              </span>
              <span>{openCount} open</span>
            </div>

            {/* Solo markets (Match tab) */}
            {(activeTab === 'all' || activeTab === 'match') && soloMarkets.map(m => (
              <MarketPanel
                key={m.marketId}
                market={m}
                homeName={homeName}
                awayName={awayName}
                matchId={matchId}
                matchType={matchType}
                matchTitle={matchTitle}
              />
            ))}

            {/* Total Goals + Individual Totals (Totals tab) */}
            {(activeTab === 'all' || activeTab === 'totals') && (
              <>
                <MarketTableGroup
                  title="Total Goals"
                  markets={ouMarkets}
                  col1Label="Over" col2Label="Under"
                  getOption1Key={m => findOptionKey(m, 'over')}
                  getOption2Key={m => findOptionKey(m, 'under')}
                  getRowLabel={m => String(extractLine(m))}
                  matchId={matchId} matchType={matchType} matchTitle={matchTitle}
                />
                <MarketTableGroup
                  title={`${homeName} Total Goals`}
                  markets={itHomeMarkets}
                  col1Label="Over" col2Label="Under"
                  getOption1Key={m => findOptionKey(m, 'over')}
                  getOption2Key={m => findOptionKey(m, 'under')}
                  getRowLabel={m => String(extractLine(m))}
                  matchId={matchId} matchType={matchType} matchTitle={matchTitle}
                />
                <MarketTableGroup
                  title={`${awayName} Total Goals`}
                  markets={itAwayMarkets}
                  col1Label="Over" col2Label="Under"
                  getOption1Key={m => findOptionKey(m, 'over')}
                  getOption2Key={m => findOptionKey(m, 'under')}
                  getRowLabel={m => String(extractLine(m))}
                  matchId={matchId} matchType={matchType} matchTitle={matchTitle}
                />
              </>
            )}

            {/* Handicap (Handicap tab) */}
            {(activeTab === 'all' || activeTab === 'handicap') && (
              <MarketTableGroup
                title="Handicap"
                markets={hcpMarkets}
                col1Label={homeName} col2Label={awayName}
                getOption1Key={m => findOptionKey(m, 'home_hcap')}
                getOption2Key={m => findOptionKey(m, 'away_hcap')}
                getRowLabel={m => {
                  if (m.marketType === 'HANDICAP') return String(extractLine(m))
                  const sign = m.marketType[4] === 'M' ? '-' : '+'
                  return `${sign}${parseFloat(m.marketType.slice(5).replace('_', '.'))}`
                }}
                matchId={matchId} matchType={matchType} matchTitle={matchTitle}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Section divider (for My Bets) ───────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: TEXT2,
        letterSpacing: '0.07em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Props = {
  userId:         string
  matches:        MatchBettingRow[]
  initialBalance: number
}

export function BettingPageClient({ userId, matches, initialBalance }: Props) {
  const router     = useRouter()
  const isDesktop  = useIsDesktop()
  const { setBalance } = useBetSlip()

  const [refreshing, setRefreshing]       = useState(false)
  const [refreshKey, setRefreshKey]       = useState(0)
  const [selectedMatch, setSelectedMatch] = useState<MatchBettingRow | null>(() => matches[0] ?? null)
  const [midTab, setMidTab]               = useState<'markets' | 'bets'>('markets')

  useEffect(() => { setBalance(initialBalance) }, [initialBalance, setBalance])

  // Auto-select first match on desktop when none selected
  useEffect(() => {
    if (isDesktop && !selectedMatch && matches.length > 0) {
      setSelectedMatch(matches[0])
    }
  }, [isDesktop, matches, selectedMatch])

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshKey(k => k + 1)
    router.refresh()
    await new Promise(r => setTimeout(r, 800))
    setRefreshing(false)
  }

  const HEADER_H = 52

  // ── Desktop: three-panel layout ───────────────────────────────────────────

  if (isDesktop) {
    return (
      <div className="app-page" style={{ height: '100dvh', overflow: 'hidden', background: BG, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          height: HEADER_H, flexShrink: 0,
          background: 'var(--card)', backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${BORDER}`,
          padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: TEXT }}>Betting</div>
            <span style={{ fontSize: 11, color: MUTED }}>
              {matches.length} {matches.length === 1 ? 'match' : 'matches'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BetNotificationCenter />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent',
                color: refreshing ? MUTED : TEXT2, fontSize: 11, fontWeight: 700,
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={12} strokeWidth={2} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>

        {/* Three-panel body */}
        <div style={{
          flex: 1, overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '300px 1fr 360px',
        }}>
          {/* LEFT: match browser */}
          <div style={{ borderRight: `1px solid ${BORDER}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <MatchBrowser
              matches={matches}
              selectedId={selectedMatch?.matchId ?? null}
              onSelect={row => { setSelectedMatch(row); setMidTab('markets') }}
            />
          </div>

          {/* MIDDLE: markets panel + My Bets tab */}
          <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', background: BG }}>
            {/* Middle tab row */}
            <div style={{
              display: 'flex', borderBottom: `1px solid ${BORDER}`,
              background: CARD, flexShrink: 0,
            }}>
              {(['markets', 'bets'] as const).map(key => {
                const label = key === 'markets' ? 'Markets' : 'My Bets'
                const active = midTab === key
                return (
                  <button
                    key={key}
                    onClick={() => setMidTab(key)}
                    style={{
                      padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
                      borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                      color: active ? ACCENT : TEXT2,
                      fontSize: 13, fontWeight: active ? 800 : 600,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {midTab === 'markets' ? (
              selectedMatch ? (
                <MatchMarketsView
                  key={selectedMatch.matchId}
                  row={selectedMatch}
                  refreshKey={refreshKey}
                />
              ) : (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: MUTED, fontSize: 13,
                }}>
                  Select a match to view markets
                </div>
              )
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <ActiveBets userId={userId} showHistory />
              </div>
            )}
          </div>

          {/* RIGHT: bet slip */}
          <div style={{
            borderLeft: `1px solid ${BORDER}`,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            background: CARD2,
          }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <BetSlipContents compact showToast />
            </div>
            <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <BalanceWidget playerId={userId} initialBalance={initialBalance} compact showHistory={false} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Mobile: single-column, matches → markets ──────────────────────────────

  const showingMarkets = selectedMatch !== null

  return (
    <div className="app-page" style={{ minHeight: '100dvh', background: BG }}>
      {/* Mobile header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--card)', backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '10px 52px 10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          {showingMarkets ? (
            <button
              onClick={() => setSelectedMatch(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', color: TEXT2,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                padding: '12px 8px 12px 0', minHeight: 44,
              }}
            >
              <ChevronLeft size={16} /> Matches
            </button>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 900, color: TEXT }}>Betting</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BalanceWidget playerId={userId} initialBalance={initialBalance} compact showHistory={false} />
          <BetNotificationCenter />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', padding: '10px 12px', minHeight: 44,
              borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent',
              color: refreshing ? MUTED : TEXT2, cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={13} strokeWidth={2} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Mobile content */}
      <div style={{ paddingBottom: 'var(--nav-h)' }}>
        {showingMarkets ? (
          <MatchMarketsView
            key={selectedMatch.matchId}
            row={selectedMatch}
            refreshKey={refreshKey}
            onBack={() => setSelectedMatch(null)}
          />
        ) : (
          <>
            <MatchBrowser
              matches={matches}
              selectedId={null}
              onSelect={setSelectedMatch}
            />
            <div style={{ padding: '24px 14px 0' }}>
              <SectionDivider label="My Bets" />
              <ActiveBets userId={userId} showHistory />
            </div>
          </>
        )}
      </div>

      <BottomNav userId={userId} />
    </div>
  )
}
