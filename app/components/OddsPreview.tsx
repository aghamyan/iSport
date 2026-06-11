'use client'

import { useState, useEffect, useRef } from 'react'
import { getPreMatchOddsAction } from '@/app/matches/actions'
import { useOddsFormat } from '@/lib/hooks/useOddsFormat'
import { formatOdds, FORMAT_LABELS, type OddsResult, type OddsFactor } from '@/lib/odds'
import { useTranslation } from '@/lib/i18n/context'

type Props = {
  homeId: string
  awayId: string
  homeName: string
  awayName: string
  matchType?: 'friendly' | 'championship'
  /** Compact layout for use inside a multi-row batch modal. */
  compact?: boolean
}

export function OddsPreview({ homeId, awayId, homeName, awayName, matchType = 'friendly', compact = false }: Props) {
  const { t } = useTranslation()
  const [odds, setOdds]               = useState<OddsResult | null>(null)
  const [loading, setLoading]         = useState(false)
  const [showBreakdown, setBreakdown] = useState(false)
  const { format, cycleFormat }       = useOddsFormat()
  const abortRef                      = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!homeId || !awayId || homeId === awayId) {
      setOdds(null)
      return
    }

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setOdds(null)

    getPreMatchOddsAction(homeId, awayId, matchType)
      .then((result) => {
        if (!ctrl.signal.aborted) {
          setOdds(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })

    return () => ctrl.abort()
  }, [homeId, awayId, matchType])

  if (!homeId || !awayId || homeId === awayId) return null

  if (loading) {
    return (
      <div style={{ padding: compact ? '6px 0' : '10px 0', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
        {t('odds.calculating')}
      </div>
    )
  }

  if (!odds) return null

  // When format is 'percent', display true probabilities (no margin) so the
  // chips match the probability bar. MatchCard uses implied odds for %, which
  // is fine since it only has decimal odds stored — not a concern here.
  const fmtChip = (decimal: number, truePct: number) =>
    format === 'percent' ? `${truePct}%` : formatOdds(decimal, format)

  // Score range: ±0.5 band around the expected value, rounded to integers.
  const rangeFloor = (v: number) => Math.max(0, Math.floor(v - 0.5))
  const rangeCeil  = (v: number) => Math.ceil(v + 0.5)

  const homeWider = odds.homeWinPct >= odds.awayWinPct

  return (
    <div
      style={{
        borderRadius: 8,
        background: '#f8faff',
        border: '1px solid #e0e7ff',
        padding: compact ? '8px 10px' : '12px 14px',
        marginTop: compact ? 6 : 10,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {t('odds.preMatch')}
        </span>
        <button
          onClick={cycleFormat}
          title="Change odds format"
          style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px',
            borderRadius: 4, border: '1px solid #c7d2fe',
            background: '#eef2ff', color: '#4f46e5', cursor: 'pointer',
          }}
        >
          {FORMAT_LABELS[format]}
        </button>
      </div>

      {/* ── Probability bar ── */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 20, marginBottom: 8 }}>
        <div
          style={{
            width: `${odds.homeWinPct}%`,
            background: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden',
          }}
        >
          {odds.homeWinPct >= 15 ? `${odds.homeWinPct}%` : ''}
        </div>
        <div
          style={{
            width: `${odds.drawPct}%`,
            background: '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden',
          }}
        >
          {odds.drawPct >= 12 ? `${odds.drawPct}%` : ''}
        </div>
        <div
          style={{
            width: `${odds.awayWinPct}%`,
            background: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden',
          }}
        >
          {odds.awayWinPct >= 15 ? `${odds.awayWinPct}%` : ''}
        </div>
      </div>

      {/* ── Player name labels under bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>
          {homeName.length > 12 ? homeName.slice(0, 11) + '…' : homeName}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{t('odds.draw')}</span>
        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
          {awayName.length > 12 ? awayName.slice(0, 11) + '…' : awayName}
        </span>
      </div>

      {/* ── Odds chips row ── */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
        <OddsChip label="1" value={fmtChip(odds.homeWinOdds, odds.homeWinPct)} accent="#dbeafe" />
        <OddsChip label="X" value={fmtChip(odds.drawOdds, odds.drawPct)}       accent="#f1f5f9" />
        <OddsChip label="2" value={fmtChip(odds.awayWinOdds, odds.awayWinPct)} accent="#fee2e2" />
        <OddsChip
          label="HDP"
          value={handicapLabel(odds.homeHandicap)}
          accent="#ede9fe"
        />
      </div>

      {/* ── Expected score range ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          {t('odds.expected')}{' '}
          <strong style={{ color: '#111827' }}>
            {Math.round(odds.expectedHomeGoals)} – {Math.round(odds.expectedAwayGoals)}
          </strong>
          <span style={{ color: '#9ca3af', marginLeft: 4 }}>
            (range: {rangeFloor(odds.expectedHomeGoals)}–{rangeCeil(odds.expectedHomeGoals)}
            {' : '}
            {rangeFloor(odds.expectedAwayGoals)}–{rangeCeil(odds.expectedAwayGoals)})
          </span>
        </span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>
          {t('odds.margin', { n: ((odds.overround - 1) * 100).toFixed(0) })}
        </span>
      </div>

      {/* ── Advantage note ── */}
      {Math.abs(odds.homeWinPct - odds.awayWinPct) > 10 && (
        <div
          style={{
            fontSize: 11, padding: '4px 8px', borderRadius: 5,
            background: homeWider ? '#dbeafe' : '#fee2e2',
            color: homeWider ? '#1d4ed8' : '#b91c1c',
            marginBottom: 6,
          }}
        >
          {t('odds.favoured', { name: homeWider ? homeName : awayName })}
          {odds.homeHandicap !== 0 && (
            <> · {t('odds.handicap')} {homeWider
              ? `${awayName} ${handicapLabel(-odds.homeHandicap)}`
              : `${homeName} ${handicapLabel(odds.homeHandicap)}`
            }</>
          )}
        </div>
      )}

      {/* ── Breakdown toggle ── */}
      <button
        onClick={() => setBreakdown((v) => !v)}
        style={{
          fontSize: 11, color: '#6366f1', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, textDecoration: 'underline',
        }}
      >
        {showBreakdown ? t('odds.hideBreakdown') : t('odds.whyOdds')}
      </button>

      {showBreakdown && (
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <FactorsColumn name={homeName} factors={odds.homeFactors} side="home" />
          <FactorsColumn name={awayName} factors={odds.awayFactors} side="away" />
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function OddsChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        flex: 1, textAlign: 'center', padding: '5px 3px',
        background: accent, borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 1 }}>
        {value}
      </div>
    </div>
  )
}

function FactorsColumn({ name, factors, side }: { name: string; factors: OddsFactor[]; side: 'home' | 'away' }) {
  const accent = side === 'home' ? '#3b82f6' : '#ef4444'
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 6 }}>
        {name.length > 14 ? name.slice(0, 13) + '…' : name}
      </div>
      {factors.map((f, i) => (
        <div
          key={i}
          style={{
            marginBottom: 5, paddingLeft: 8,
            borderLeft: `2px solid ${f.impact === 'positive' ? '#22c55e' : f.impact === 'negative' ? '#ef4444' : '#d1d5db'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{f.label}</span>
            {f.ratingDelta !== 0 && (
              <span
                style={{
                  fontSize: 10, fontWeight: 700,
                  color: f.ratingDelta > 0 ? '#16a34a' : '#dc2626',
                }}
              >
                {f.ratingDelta > 0 ? `+${f.ratingDelta}` : f.ratingDelta} Elo
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{f.description}</div>
        </div>
      ))}
    </div>
  )
}

function handicapLabel(h: number): string {
  if (h === 0) return '0'
  return h > 0 ? `+${h}` : `${h}`
}
