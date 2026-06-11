'use client'

import { useState, useEffect } from 'react'
import { getMatchMarketsAction } from '@/app/betting/odds/actions'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { MARKET_SHORT } from '@/lib/betting/validation'
import { MarketPanel } from '@/app/betting/MarketPanel'
import type { MarketRow } from '@/lib/odds/markets'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = '#050911'
const CARD   = '#0c1422'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const TEXT   = '#f8fafc'
const TEXT2  = '#94a3b8'
const MUTED  = '#4b5a73'
const WIN    = '#10b981'

// ─── Market type order ────────────────────────────────────────────────────────

const MARKET_ORDER = ['1X2', 'OU2_5', 'HANDICAP', 'BTTS', 'EXACT_SCORE', 'CUSTOM_PROP']

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  matchId:   string
  matchType: 'friendly' | 'championship'
  homeName:  string
  awayName:  string
  onClose:   () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OddsMarketModal({ matchId, matchType, homeName, awayName, onClose }: Props) {
  const [markets, setMarkets] = useState<MarketRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setTab]   = useState<string | null>(null)
  const { legs }              = useBetSlip()

  const matchTitle = `${homeName} vs ${awayName}`

  useEffect(() => {
    getMatchMarketsAction(matchId, matchType)
      .then(data => {
        setMarkets(data)
        setLoading(false)
        const firstType = MARKET_ORDER.find(t => data.some(m => m.marketType === t))
        if (firstType) setTab(firstType)
      })
      .catch(() => setLoading(false))
  }, [matchId, matchType])

  const grouped = new Map<string, MarketRow>()
  for (const m of markets ?? []) {
    if (!grouped.has(m.marketType)) grouped.set(m.marketType, m)
  }
  const customProps = (markets ?? []).filter(m => m.marketType === 'CUSTOM_PROP')
  const tabs = MARKET_ORDER.filter(t => grouped.has(t) || (t === 'CUSTOM_PROP' && customProps.length > 0))
  const slipLegsForMatch = legs.filter(l => l.matchId === matchId).length

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(5,9,17,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: BG, borderRadius: '20px 20px 0 0',
          maxHeight: '92dvh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          border: `1px solid ${BORDER}`, borderBottom: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 0',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>{matchTitle}</div>
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>
              {matchType === 'championship' ? 'Championship' : 'Friendly'} · Bet markets
              {slipLegsForMatch > 0 && (
                <span style={{ color: WIN, fontWeight: 700, marginLeft: 6 }}>
                  · {slipLegsForMatch} added to slip
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
            color: TEXT2, fontSize: 18, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        {!loading && tabs.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, padding: '12px 20px 0',
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                style={{
                  padding: '6px 12px', borderRadius: 20, flexShrink: 0,
                  border: `1px solid ${activeTab === tab ? ACCENT : BORDER}`,
                  background: activeTab === tab ? `${ACCENT}22` : 'transparent',
                  color: activeTab === tab ? ACCENT : TEXT2,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {MARKET_SHORT[tab] ?? tab}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 40px' }}>
          {loading && (
            <div style={{ color: TEXT2, textAlign: 'center', padding: 40 }}>
              Calculating odds…
            </div>
          )}

          {!loading && markets?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: TEXT2, fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Betting not available</div>
              <div style={{ color: MUTED, fontSize: 12 }}>
                Admin hasn&apos;t opened markets for this match yet.
              </div>
            </div>
          )}

          {!loading && activeTab && (
            <>
              {activeTab !== 'CUSTOM_PROP' && grouped.has(activeTab) && (
                <MarketPanel
                  market={grouped.get(activeTab)!}
                  homeName={homeName}
                  awayName={awayName}
                  matchId={matchId}
                  matchType={matchType}
                  matchTitle={matchTitle}
                />
              )}
              {activeTab === 'CUSTOM_PROP' && customProps.map(market => (
                <MarketPanel
                  key={market.marketId}
                  market={market}
                  homeName={homeName}
                  awayName={awayName}
                  matchId={matchId}
                  matchType={matchType}
                  matchTitle={matchTitle}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
