'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { getMatchMarketsAction } from '@/app/betting/odds/actions'
import { MarketPanel } from '@/app/betting/MarketPanel'
import { BetSlipContents } from '@/app/betting/BetSlipContents'
import { ActiveBets } from '@/app/betting/ActiveBets'
import { BalanceWidget } from '@/app/components/BalanceWidget'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { MARKET_SHORT } from '@/lib/betting/validation'
import supabase from '@/lib/supabase/client'
import type { MarketRow } from '@/lib/odds/markets'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = '#050911'
const CARD   = '#0c1422'
const CARD2  = '#111d2e'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const TEXT   = '#f8fafc'
const TEXT2  = '#94a3b8'
const MUTED  = '#4b5a73'
const GOLD   = '#f59e0b'
const WIN    = '#10b981'

// ─── Market display order ─────────────────────────────────────────────────────
const MARKET_ORDER = ['1X2', 'OU2_5', 'HANDICAP', 'BTTS', 'EXACT_SCORE', 'CUSTOM_PROP']

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchBettingRow = {
  matchId:     string
  matchType:   'friendly' | 'championship'
  homeName:    string
  awayName:    string
  openMarkets: number
  groupLabel:  string
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

// ─── Inline markets section ───────────────────────────────────────────────────

function InlineMarkets({
  matchId, matchType, homeName, awayName, refreshKey,
}: {
  matchId:    string
  matchType:  'friendly' | 'championship'
  homeName:   string
  awayName:   string
  refreshKey: number
}) {
  const [markets, setMarkets] = useState<MarketRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setTab]   = useState<string | null>(null)
  const matchTitle = `${homeName} vs ${awayName}`

  const reload = useCallback(() => {
    getMatchMarketsAction(matchId, matchType)
      .then(data => {
        setMarkets(data)
        setLoading(false)
        if (!activeTab) {
          const first = MARKET_ORDER.find(t => data.some(m => m.marketType === t))
          if (first) setTab(first)
        }
      })
      .catch(() => setLoading(false))
  }, [matchId, matchType, activeTab])

  // Initial fetch + re-fetch when parent triggers refresh
  useEffect(() => {
    reload()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, matchType, refreshKey])

  // Realtime: refresh when any market for this match changes (admin override / status)
  useEffect(() => {
    const channel = supabase
      .channel(`markets:${matchId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'bet_markets', filter: `match_id=eq.${matchId}`,
      }, () => {
        getMatchMarketsAction(matchId, matchType).then(setMarkets).catch(() => {})
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [matchId, matchType])

  const grouped     = new Map<string, MarketRow>()
  const customProps: MarketRow[] = []
  for (const m of markets ?? []) {
    if (m.marketType === 'CUSTOM_PROP') customProps.push(m)
    else if (!grouped.has(m.marketType)) grouped.set(m.marketType, m)
  }
  const tabs = MARKET_ORDER.filter(t =>
    grouped.has(t) || (t === 'CUSTOM_PROP' && customProps.length > 0)
  )

  return (
    <div style={{
      borderTop: `1px solid ${BORDER}`,
      animation: 'market-expand 0.2s ease',
      overflow: 'hidden',
    }}>
      {loading && (
        <div style={{ padding: '20px 14px', color: TEXT2, fontSize: 12, textAlign: 'center' }}>
          Loading markets…
        </div>
      )}

      {!loading && markets?.length === 0 && (
        <div style={{ padding: '20px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🔒</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT2, marginBottom: 3 }}>
            No markets yet
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>Admin hasn&apos;t opened betting for this match.</div>
        </div>
      )}

      {!loading && tabs.length > 0 && (
        <>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 6, padding: '10px 14px 0',
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                style={{
                  padding: '5px 12px', borderRadius: 20, flexShrink: 0,
                  border: `1px solid ${activeTab === tab ? ACCENT : BORDER}`,
                  background: activeTab === tab ? `${ACCENT}22` : 'transparent',
                  color: activeTab === tab ? ACCENT : TEXT2,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {MARKET_SHORT[tab] ?? tab}
              </button>
            ))}
          </div>

          {/* Markets */}
          <div style={{ padding: '10px 14px 14px' }}>
            {activeTab && activeTab !== 'CUSTOM_PROP' && grouped.has(activeTab) && (
              <MarketPanel
                market={grouped.get(activeTab)!}
                homeName={homeName}
                awayName={awayName}
                matchId={matchId}
                matchType={matchType}
                matchTitle={matchTitle}
              />
            )}
            {activeTab === 'CUSTOM_PROP' && customProps.map(m => (
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
          </div>
        </>
      )}
    </div>
  )
}

// ─── Expandable match card ────────────────────────────────────────────────────

function MatchCard({ row, refreshKey }: { row: MatchBettingRow; refreshKey: number }) {
  const [expanded, setExpanded] = useState(false)
  const { legs } = useBetSlip()

  const legsForMatch = legs.filter(l => l.matchId === row.matchId).length

  return (
    <div style={{
      background: CARD,
      border: `1px solid ${expanded ? ACCENT + '66' : BORDER}`,
      borderRadius: 14,
      marginBottom: 8,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Card header — click to expand */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left',
        }}
      >
        {/* VS block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: TEXT,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '44%',
            }}>
              {row.homeName}
            </span>
            <span style={{ fontSize: 10, color: MUTED, fontWeight: 600, flexShrink: 0 }}>vs</span>
            <span style={{
              fontSize: 14, fontWeight: 700, color: TEXT,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '44%',
            }}>
              {row.awayName}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: WIN,
              background: `${WIN}18`, padding: '2px 8px', borderRadius: 8,
            }}>
              {row.openMarkets} market{row.openMarkets !== 1 ? 's' : ''}
            </span>
            {row.matchType === 'championship' && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: GOLD,
                background: `${GOLD}18`, padding: '2px 8px', borderRadius: 8,
              }}>
                {row.groupLabel}
              </span>
            )}
            {legsForMatch > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: ACCENT,
                background: `${ACCENT}18`, padding: '2px 8px', borderRadius: 8,
              }}>
                {legsForMatch} in slip
              </span>
            )}
          </div>
        </div>

        {/* Status + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: WIN, background: `${WIN}18`,
            padding: '4px 10px', borderRadius: 10,
          }}>
            Betting Open
          </span>
          <span style={{ color: expanded ? ACCENT : MUTED, transition: 'color 0.2s' }}>
            {expanded
              ? <ChevronUp size={16} strokeWidth={2} />
              : <ChevronDown size={16} strokeWidth={2} />
            }
          </span>
        </div>
      </button>

      {/* Inline markets (expanded) */}
      {expanded && (
        <InlineMarkets
          matchId={row.matchId}
          matchType={row.matchType}
          homeName={row.homeName}
          awayName={row.awayName}
          refreshKey={refreshKey}
        />
      )}
    </div>
  )
}

// ─── Group header ─────────────────────────────────────────────────────────────

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 8, marginTop: 20,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: TEXT2,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 800,
        background: `${ACCENT}22`, color: ACCENT,
        padding: '1px 7px', borderRadius: 8,
      }}>
        {count}
      </span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  )
}

// ─── Desktop bet slip panel ───────────────────────────────────────────────────

function DesktopSlipPanel({ userId }: { userId: string }) {
  return (
    <div style={{
      background: CARD2,
      border: `1px solid ${BORDER}`,
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Bet slip content — showToast=true since panel stays mounted after clearSlip */}
      <BetSlipContents compact showToast />

      {/* Wallet below the slip */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${BORDER}` }}>
        <BalanceWidget playerId={userId} initialBalance={0} compact showHistory={false} />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Props = {
  userId:  string
  matches: MatchBettingRow[]
}

export function BettingPageClient({ userId, matches }: Props) {
  const router     = useRouter()
  const isDesktop  = useIsDesktop()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const headerRef  = useRef<HTMLDivElement>(null)

  // Group matches
  const champGroups = new Map<string, MatchBettingRow[]>()
  const friendlyRows: MatchBettingRow[] = []
  for (const row of matches) {
    if (row.matchType === 'friendly') {
      friendlyRows.push(row)
    } else {
      const existing = champGroups.get(row.groupLabel) ?? []
      existing.push(row)
      champGroups.set(row.groupLabel, existing)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshKey(k => k + 1)
    router.refresh()
    await new Promise(r => setTimeout(r, 800))
    setRefreshing(false)
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG }}>
      {/* ── Sticky header ── */}
      <div
        ref={headerRef}
        style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'rgba(12,20,34,0.96)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${BORDER}`,
          padding: '12px 16px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: TEXT, letterSpacing: '-0.01em' }}>
            Betting
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>
            {matches.length} match{matches.length !== 1 ? 'es' : ''} open
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Balance (compact pill — also shown in desktop panel, but useful on mobile header) */}
          {!isDesktop && (
            <BalanceWidget playerId={userId} initialBalance={0} compact showHistory={false} />
          )}

          {/* Refresh odds button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh odds"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: 'transparent',
              color: refreshing ? MUTED : TEXT2,
              fontSize: 12, fontWeight: 700,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'color 0.15s',
            }}
          >
            <RefreshCw
              size={13}
              strokeWidth={2}
              style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}
            />
            {!isDesktop && <span>Refresh</span>}
          </button>
        </div>
      </div>

      {/* ── Body — two-column on desktop ── */}
      <div style={{
        display: isDesktop ? 'grid' : 'block',
        gridTemplateColumns: isDesktop ? '1fr 380px' : undefined,
        gap: isDesktop ? 24 : undefined,
        maxWidth: 1320,
        margin: '0 auto',
        padding: isDesktop ? '20px 24px' : '0',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
      }}>

        {/* ── Left column: match list ── */}
        <div>
          <div style={{ padding: isDesktop ? '0' : '8px 14px 0' }}>
            {matches.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '60px 20px', color: MUTED,
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT2, marginBottom: 4 }}>
                  No open markets right now
                </div>
                <div style={{ fontSize: 12 }}>
                  Check back soon — markets open before each match.
                </div>
              </div>
            )}

            {/* Championship groups */}
            {Array.from(champGroups.entries()).map(([label, rows]) => (
              <div key={label}>
                <GroupHeader label={label} count={rows.length} />
                {rows.map(row => <MatchCard key={row.matchId} row={row} refreshKey={refreshKey} />)}
              </div>
            ))}

            {/* Friendly group */}
            {friendlyRows.length > 0 && (
              <div>
                <GroupHeader label="Friendly" count={friendlyRows.length} />
                {friendlyRows.map(row => <MatchCard key={row.matchId} row={row} refreshKey={refreshKey} />)}
              </div>
            )}
          </div>

          {/* My Bets section */}
          <div style={{ padding: isDesktop ? '24px 0 0' : '24px 14px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 800, color: TEXT2,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                My Bets
              </span>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>
            <ActiveBets userId={userId} showHistory />
          </div>
        </div>

        {/* ── Right column: desktop bet slip panel ── */}
        {isDesktop && (
          <div style={{
            position: 'sticky',
            top: (headerRef.current?.offsetHeight ?? 60) + 16,
            maxHeight: `calc(100dvh - ${(headerRef.current?.offsetHeight ?? 60) + 32}px)`,
            overflowY: 'auto',
            alignSelf: 'start',
          }}>
            <DesktopSlipPanel userId={userId} />
          </div>
        )}
      </div>
    </div>
  )
}
