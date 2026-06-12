'use client'

import { useEffect, useMemo, useState } from 'react'
import { getMatchMarketsAction } from '@/app/betting/odds/actions'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { MarketPanel } from '@/app/betting/MarketPanel'
import { getMarketLabel, type SlipLeg } from '@/lib/betting/validation'
import type { MarketRow } from '@/lib/odds/markets'

const C = {
  backdrop: 'rgba(15,23,42,0.42)',
  card:     '#ffffff',
  panel:    '#f8fafc',
  border:   '#e5e7eb',
  text:     '#111827',
  text2:    '#6b7280',
  muted:    '#9ca3af',
  win:      '#10b981',
  closed:   '#64748b',
  accent:   '#3b82f6',
  pink:     '#e91e8c',
  dark:     '#0c1422',
  dark2:    '#111d2e',
  darkBord: '#1a2840',
}

// ─── Market grouping ──────────────────────────────────────────────────────────

type GroupKey = 'ou_table' | 'hcp_table' | 'it_home_table' | 'it_away_table' | 'solo'

function classifyMarket(m: MarketRow): GroupKey {
  const t = m.marketType
  if (t.startsWith('OU_') || t === 'OU2_5') return 'ou_table'
  if (t.startsWith('HCP_') || t === 'HANDICAP') return 'hcp_table'
  if (t.startsWith('IT_HOME_')) return 'it_home_table'
  if (t.startsWith('IT_AWAY_')) return 'it_away_table'
  return 'solo'
}

function extractLine(market: MarketRow): number {
  const t = market.marketType
  if (t === 'OU2_5') return 2.5
  if (t === 'HANDICAP') {
    // Fall back to 0 — the old HANDICAP market is a single line
    return 0
  }
  if (t.startsWith('OU_'))      return parseFloat(t.slice(3).replace('_', '.'))
  if (t.startsWith('HCP_M'))    return -(parseFloat(t.slice(5).replace('_', '.')))
  if (t.startsWith('HCP_P'))    return  (parseFloat(t.slice(5).replace('_', '.')))
  if (t.startsWith('IT_HOME_')) return parseFloat(t.slice(8).replace('_', '.'))
  if (t.startsWith('IT_AWAY_')) return parseFloat(t.slice(8).replace('_', '.'))
  return 0
}

const SOLO_ORDER = ['1X2', 'DOUBLE_CHANCE', 'BTTS', 'EXACT_SCORE', 'CUSTOM_PROP']

function soloMarketSort(a: MarketRow, b: MarketRow): number {
  const ai = SOLO_ORDER.indexOf(a.marketType)
  const bi = SOLO_ORDER.indexOf(b.marketType)
  const as = ai === -1 ? SOLO_ORDER.length : ai
  const bs = bi === -1 ? SOLO_ORDER.length : bi
  return as - bs
}

// ─── Table group component ────────────────────────────────────────────────────

function OddsCell({
  market,
  optionKey,
  matchId,
  matchType,
  matchTitle,
}: {
  market:     MarketRow
  optionKey:  string
  matchId:    string
  matchType:  'friendly' | 'championship'
  matchTitle: string
}) {
  const { addLeg, removeLeg, isInSlip, getLeg } = useBetSlip()
  const [hovered, setHovered] = useState(false)

  const option  = market.options?.[optionKey] as { key: string; label: string } | undefined
  const odds    = Number(market.odds?.[optionKey] ?? 1)
  const closed  = market.status !== 'OPEN'
  const leg     = getLeg(market.marketId)
  const selected = leg?.selectedOption === optionKey

  if (!option || !Number.isFinite(odds) || odds <= 1) {
    return <td style={{ padding: '6px 8px', color: C.muted, fontSize: 12, textAlign: 'center' }}>—</td>
  }

  function toggle() {
    if (closed) return
    if (selected) { removeLeg(market.marketId); return }
    if (isInSlip(market.marketId)) removeLeg(market.marketId)
    const slipLeg: SlipLeg = {
      marketId:       market.marketId,
      matchId,
      matchType,
      marketType:     market.marketType,
      marketLabel:    getMarketLabel(market.marketType),
      selectedOption: optionKey,
      selectionLabel: option?.label ?? optionKey,
      odds,
      matchTitle,
    }
    addLeg(slipLeg)
  }

  const bg     = selected ? `${C.pink}22` : hovered && !closed ? `${C.accent}14` : 'transparent'
  const border = selected ? C.pink        : hovered && !closed ? `${C.accent}60` : C.darkBord

  return (
    <td style={{ padding: '4px 5px' }}>
      <button
        onClick={toggle}
        disabled={closed}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
          minWidth: 64,
          padding: '8px 6px',
          borderRadius: 6,
          border: `1.5px solid ${border}`,
          background: bg,
          cursor: closed ? 'not-allowed' : 'pointer',
          opacity: closed ? 0.45 : 1,
          transition: 'border-color 0.1s, background 0.1s',
        }}
      >
        <span style={{ fontSize: 11, color: C.win }}>🚀</span>
        <span style={{
          fontSize: 14, fontWeight: 900, letterSpacing: '-0.02em',
          color: selected ? '#fff' : C.accent,
        }}>
          {odds.toFixed(2)}
        </span>
        {selected && (
          <span style={{ fontSize: 9, color: '#fff', fontWeight: 800 }}>✓</span>
        )}
      </button>
    </td>
  )
}

function MarketTableGroup({
  title,
  markets,
  col1Label,
  col2Label,
  getOption1Key,
  getOption2Key,
  getRowLabel,
  matchId,
  matchType,
  matchTitle,
}: {
  title:         string
  markets:       MarketRow[]
  col1Label:     string
  col2Label:     string
  getOption1Key: (m: MarketRow) => string
  getOption2Key: (m: MarketRow) => string
  getRowLabel:   (m: MarketRow) => string
  matchId:       string
  matchType:     'friendly' | 'championship'
  matchTitle:    string
}) {
  if (markets.length === 0) return null

  const openCount = markets.filter(m => m.status === 'OPEN').length
  const closed    = openCount === 0

  return (
    <section style={{
      background: C.dark,
      border: `1px solid ${C.darkBord}`,
      borderRadius: 10,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px 8px',
        borderBottom: `1px solid ${C.darkBord}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
            {title}
          </h3>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
          color: closed ? C.muted : C.win,
          background: closed ? `${C.muted}14` : `${C.win}14`,
          border: `1px solid ${closed ? C.muted : C.win}30`,
        }}>
          {closed ? 'Closed' : 'Open'}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'auto',
        }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.darkBord}` }}>
              <th style={{
                padding: '6px 14px',
                fontSize: 11, fontWeight: 700, color: C.muted,
                textAlign: 'left', whiteSpace: 'nowrap',
              }} />
              <th style={{
                padding: '6px 8px',
                fontSize: 11, fontWeight: 700, color: C.muted,
                textAlign: 'center', whiteSpace: 'nowrap',
              }}>
                {col1Label}
              </th>
              <th style={{
                padding: '6px 8px',
                fontSize: 11, fontWeight: 700, color: C.muted,
                textAlign: 'center', whiteSpace: 'nowrap',
              }}>
                {col2Label}
              </th>
            </tr>
          </thead>
          <tbody>
            {markets.map(m => (
              <tr key={m.marketId} style={{ borderBottom: `1px solid ${C.darkBord}20` }}>
                <td style={{
                  padding: '6px 14px',
                  fontSize: 13, fontWeight: 700, color: '#94a3b8',
                  whiteSpace: 'nowrap',
                }}>
                  {getRowLabel(m)}
                </td>
                <OddsCell
                  market={m}
                  optionKey={getOption1Key(m)}
                  matchId={matchId}
                  matchType={matchType}
                  matchTitle={matchTitle}
                />
                <OddsCell
                  market={m}
                  optionKey={getOption2Key(m)}
                  matchId={matchId}
                  matchType={matchType}
                  matchTitle={matchTitle}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Helper: find option key by inner 'key' value ─────────────────────────────

function findOptionKey(market: MarketRow, innerKey: string): string {
  const entries = Object.entries(market.options ?? {}) as [string, { key: string }][]
  return entries.find(([, v]) => v.key === innerKey)?.[0] ?? 'option1'
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type Props = {
  matchId:       string
  matchType:     'friendly' | 'championship'
  homeName:      string
  awayName:      string
  matchDateTime?: string | null
  matchStatus?:   string | null
  onClose:      () => void
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'TBD'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function statusLabel(status?: string | null): string {
  if (!status) return 'Pending'
  return status.slice(0, 1).toUpperCase() + status.slice(1)
}

export function OddsMarketModal({
  matchId,
  matchType,
  homeName,
  awayName,
  matchDateTime,
  matchStatus,
  onClose,
}: Props) {
  const [markets, setMarkets] = useState<MarketRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'match' | 'totals' | 'handicap'>('all')
  const { legs } = useBetSlip()

  const matchTitle = `${homeName} vs ${awayName}`

  useEffect(() => {
    let active = true
    setLoading(true)
    getMatchMarketsAction(matchId, matchType)
      .then(data => { if (active) { setMarkets(data); setLoading(false) } })
      .catch(()   => { if (active) { setMarkets([]);   setLoading(false) } })
    return () => { active = false }
  }, [matchId, matchType])

  const { ouMarkets, hcpMarkets, itHomeMarkets, itAwayMarkets, soloMarkets } = useMemo(() => {
    const all = markets ?? []
    const ou:      MarketRow[] = []
    const hcp:     MarketRow[] = []
    const itHome:  MarketRow[] = []
    const itAway:  MarketRow[] = []
    const solo:    MarketRow[] = []

    for (const m of all) {
      switch (classifyMarket(m)) {
        case 'ou_table':      ou.push(m);     break
        case 'hcp_table':     hcp.push(m);    break
        case 'it_home_table': itHome.push(m); break
        case 'it_away_table': itAway.push(m); break
        default:              solo.push(m)
      }
    }

    return {
      ouMarkets:     ou.sort((a, b)     => extractLine(a) - extractLine(b)),
      hcpMarkets:    hcp.sort((a, b)    => extractLine(a) - extractLine(b)),
      itHomeMarkets: itHome.sort((a, b) => extractLine(a) - extractLine(b)),
      itAwayMarkets: itAway.sort((a, b) => extractLine(a) - extractLine(b)),
      soloMarkets:   solo.sort(soloMarketSort),
    }
  }, [markets])

  const openMarkets      = (markets ?? []).filter(m => m.status === 'OPEN').length
  const bettingAvailable = openMarkets > 0
  const slipLegsForMatch = legs.filter(l => l.matchId === matchId).length

  const tableProps = { matchId, matchType, matchTitle }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: C.backdrop, backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 760, maxHeight: '92dvh',
          background: C.card, borderRadius: '18px 18px 0 0',
          border: `1px solid ${C.border}`, borderBottom: 'none',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -18px 48px rgba(15,23,42,0.22)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
        </div>

        <header style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.text2, fontWeight: 700, marginBottom: 5 }}>
                {matchType === 'championship' ? 'Championship Match' : 'Friendly Match'}
              </div>
              <h2 style={{
                margin: 0, color: C.text, fontSize: 22,
                lineHeight: 1.15, fontWeight: 950, overflowWrap: 'anywhere',
              }}>
                {matchTitle}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close market modal"
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.panel,
                color: C.text2, fontSize: 20, cursor: 'pointer',
                lineHeight: 1, flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
            gap: 8, marginTop: 14,
          }}>
            <InfoPill label="Date / Time" value={formatDateTime(matchDateTime)} />
            <InfoPill label="Match Status" value={statusLabel(matchStatus)} />
            <InfoPill
              label="Betting"
              value={bettingAvailable ? 'Open' : 'Closed'}
              tone={bettingAvailable ? 'open' : 'closed'}
            />
            {slipLegsForMatch > 0 && (
              <InfoPill label="In Slip" value={`${slipLegsForMatch} selected`} tone="open" />
            )}
          </div>
        </header>

        {/* ── Filter tabs ─────────────────────────────────────────── */}
        {!loading && (markets ?? []).length > 0 && (
          <MarketTabs
            active={activeTab}
            onChange={setActiveTab}
            matchCount={soloMarkets.length}
            totalsCount={ouMarkets.length + itHomeMarkets.length + itAwayMarkets.length}
            handicapCount={hcpMarkets.length}
          />
        )}

        <main style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 34px', background: C.panel }}>
          {loading && (
            <div style={{ color: C.text2, textAlign: 'center', padding: 38, fontSize: 14 }}>
              Loading markets…
            </div>
          )}

          {!loading && (markets ?? []).length === 0 && (
            <div style={{
              textAlign: 'center', padding: '38px 18px',
              color: C.text2, fontSize: 14,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            }}>
              <div style={{ fontWeight: 800, color: C.text, marginBottom: 6 }}>No Markets Available</div>
              <div>Markets will appear here once opened by an administrator.</div>
            </div>
          )}

          {!loading && (markets ?? []).length > 0 && (
            <div>
              {/* Match tab: 1X2, Double Chance, BTTS, Exact Score, Custom Props */}
              {(activeTab === 'all' || activeTab === 'match') && (
                <>
                  {soloMarkets
                    .filter(m => m.marketType === '1X2' || m.marketType === 'DOUBLE_CHANCE')
                    .map(m => (
                      <MarketPanel
                        key={m.marketId}
                        market={m}
                        homeName={homeName}
                        awayName={awayName}
                        matchId={matchId}
                        matchType={matchType}
                        matchTitle={matchTitle}
                      />
                    ))
                  }
                  {soloMarkets
                    .filter(m => m.marketType === 'BTTS')
                    .map(m => (
                      <MarketPanel
                        key={m.marketId}
                        market={m}
                        homeName={homeName}
                        awayName={awayName}
                        matchId={matchId}
                        matchType={matchType}
                        matchTitle={matchTitle}
                      />
                    ))
                  }
                  {soloMarkets
                    .filter(m => m.marketType !== '1X2' && m.marketType !== 'DOUBLE_CHANCE' && m.marketType !== 'BTTS')
                    .map(m => (
                      <MarketPanel
                        key={m.marketId}
                        market={m}
                        homeName={homeName}
                        awayName={awayName}
                        matchId={matchId}
                        matchType={matchType}
                        matchTitle={matchTitle}
                      />
                    ))
                  }
                </>
              )}

              {/* Totals tab: Total Goals + Individual Totals */}
              {(activeTab === 'all' || activeTab === 'totals') && (
                <>
                  <MarketTableGroup
                    title="Total Goals"
                    markets={ouMarkets}
                    col1Label="Over"
                    col2Label="Under"
                    getOption1Key={m => findOptionKey(m, 'over')}
                    getOption2Key={m => findOptionKey(m, 'under')}
                    getRowLabel={m => String(extractLine(m))}
                    {...tableProps}
                  />
                  <MarketTableGroup
                    title={`${homeName} Total Goals`}
                    markets={itHomeMarkets}
                    col1Label="Over"
                    col2Label="Under"
                    getOption1Key={m => findOptionKey(m, 'over')}
                    getOption2Key={m => findOptionKey(m, 'under')}
                    getRowLabel={m => String(extractLine(m))}
                    {...tableProps}
                  />
                  <MarketTableGroup
                    title={`${awayName} Total Goals`}
                    markets={itAwayMarkets}
                    col1Label="Over"
                    col2Label="Under"
                    getOption1Key={m => findOptionKey(m, 'over')}
                    getOption2Key={m => findOptionKey(m, 'under')}
                    getRowLabel={m => String(extractLine(m))}
                    {...tableProps}
                  />
                </>
              )}

              {/* Handicap tab */}
              {(activeTab === 'all' || activeTab === 'handicap') && (
                <MarketTableGroup
                  title="Handicap"
                  markets={hcpMarkets}
                  col1Label={homeName}
                  col2Label={awayName}
                  getOption1Key={m => findOptionKey(m, 'home_hcap')}
                  getOption2Key={m => findOptionKey(m, 'away_hcap')}
                  getRowLabel={m => {
                    if (m.marketType === 'HANDICAP') return String(extractLine(m))
                    const signChar = m.marketType[4]
                    const absLine  = parseFloat(m.marketType.slice(5).replace('_', '.'))
                    return signChar === 'M' ? `-${absLine}` : `+${absLine}`
                  }}
                  {...tableProps}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Market filter tabs ───────────────────────────────────────────────────────

type TabKey = 'all' | 'match' | 'totals' | 'handicap'

function MarketTabs({
  active,
  onChange,
  matchCount,
  totalsCount,
  handicapCount,
}: {
  active:        TabKey
  onChange:      (t: TabKey) => void
  matchCount:    number
  totalsCount:   number
  handicapCount: number
}) {
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all',      label: 'All' },
    { key: 'match',    label: 'Match',    count: matchCount    },
    { key: 'totals',   label: 'Totals',   count: totalsCount   },
    { key: 'handicap', label: 'Handicap', count: handicapCount },
  ]

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '0 14px',
      borderBottom: `1px solid ${C.darkBord}`,
      background: C.dark2,
      overflowX: 'auto',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 4px 9px',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
              transition: 'border-color 0.15s',
            }}
          >
            <span style={{
              fontSize: 13, fontWeight: isActive ? 800 : 600,
              color: isActive ? '#f8fafc' : C.muted,
            }}>
              {tab.label}
            </span>
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 800,
                padding: '1px 6px', borderRadius: 999,
                background: isActive ? `${C.accent}30` : `${C.muted}20`,
                color: isActive ? C.accent : C.muted,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function InfoPill({
  label, value, tone,
}: {
  label: string; value: string; tone?: 'open' | 'closed'
}) {
  const color = tone === 'open' ? C.win : tone === 'closed' ? C.closed : C.text

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '9px 10px', minWidth: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.text2, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 850, color,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  )
}
