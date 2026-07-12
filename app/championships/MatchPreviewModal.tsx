'use client'

import { useState, useEffect } from 'react'
import { getMatchPreviewAction, type MatchPreviewData } from './actions'
import { getOrCreateAiMatchPreviewAction, type MatchAiPreview } from './aiPreviewActions'
import { useTranslation } from '@/lib/i18n/context'
import { NumberTicker } from '@/app/components/magicui/number-ticker'

const PREVIEW_ANIMS = `
  @keyframes previewOverlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes previewPanelIn {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes floatLeft {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes floatRight {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes formDotIn {
    from { opacity: 0; transform: scale(0.3); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes barFill {
    from { width: 0 !important; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes statRowIn {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes colorBarSlide {
    from { opacity: 0; transform: scaleX(0.6); }
    to   { opacity: 1; transform: scaleX(1); }
  }
  @keyframes vsIn {
    from { opacity: 0; transform: scale(0.7); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes aiCardIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes aiPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
`

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#84cc16',
]

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function PreviewAvatar({
  url,
  name,
  side,
}: {
  url: string | null | undefined
  name: string
  side: 'home' | 'away'
}) {
  const bg = nameToColor(name)
  const isHome = side === 'home'
  const accent = isHome ? '#dc2626' : '#1d4ed8'
  const w = 148
  const h = 172

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        flexShrink: 0,
        animation: `${isHome ? 'floatLeft' : 'floatRight'} 4s ease-in-out infinite`,
      }}
    >
      {/* Photo / initials */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: 6,
          background: '#f1f5f9',
        }}
      >
        {url ? (
          <img
            src={url}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%', height: '100%', background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em',
            }}
          >
            {getInitials(name)}
          </div>
        )}
        {/* Bottom gradient overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: `linear-gradient(to top, ${accent}22, transparent)`,
          pointerEvents: 'none',
        }} />
      </div>
      {/* Bold accent bar at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        background: accent,
        borderRadius: '0 0 6px 6px',
      }} />
    </div>
  )
}

function FormDot({
  result,
  index,
  goalsFor,
  goalsAgainst,
}: {
  result: 'W' | 'L' | 'D'
  index: number
  goalsFor: number
  goalsAgainst: number
}) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    W: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
    D: { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
    L: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
  }
  const c = colors[result]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        animation: `formDotIn 0.3s ease ${index * 0.06}s both`,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          background: c.bg,
          border: `1.5px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 900, color: c.text, lineHeight: 1 }}>{result}</span>
      </div>
      <span style={{ fontSize: 9, color: '#6b7280', lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {goalsFor}:{goalsAgainst}
      </span>
    </div>
  )
}

type ActiveTab = 'matchup' | 'odds' | 'h2h' | 'form' | 'ai'

function UFCStatRow({
  label,
  homeContent,
  awayContent,
  delay = 0,
}: {
  label: string
  homeContent: React.ReactNode
  awayContent: React.ReactNode
  delay?: number
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 110px 1fr',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid #f1f5f9',
        animation: `statRowIn 0.25s ease ${delay}s both`,
      }}
    >
      <div style={{ textAlign: 'right', paddingRight: 14 }}>{homeContent}</div>
      <div style={{ textAlign: 'center' }}>
        <span style={{
          fontSize: 9,
          fontWeight: 800,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          lineHeight: 1.4,
          display: 'block',
        }}>
          {label}
        </span>
      </div>
      <div style={{ textAlign: 'left', paddingLeft: 14 }}>{awayContent}</div>
    </div>
  )
}

export function MatchPreviewModal({
  matchId,
  homePlayerId,
  awayPlayerId,
  homeName,
  awayName,
  homeAvatarUrl,
  awayAvatarUrl,
  boutLabel,
  onClose,
}: {
  matchId: string
  homePlayerId: string
  awayPlayerId: string
  homeName: string
  awayName: string
  homeAvatarUrl: string | null | undefined
  awayAvatarUrl: string | null | undefined
  boutLabel?: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [data, setData] = useState<MatchPreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('matchup')

  const [aiPreview, setAiPreview] = useState<MatchAiPreview | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getMatchPreviewAction(homePlayerId, awayPlayerId)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Error'); setLoading(false) } })
    return () => { cancelled = true }
  }, [homePlayerId, awayPlayerId])

  const generateAiPreview = () => {
    setAiLoading(true)
    setAiError(null)
    getOrCreateAiMatchPreviewAction(matchId)
      .then((d) => { setAiPreview(d); setAiLoading(false) })
      .catch((e) => { setAiError(e instanceof Error ? e.message : 'Error'); setAiLoading(false) })
  }

  const o = data?.odds
  const h2h = data?.h2h
  const hForm = data?.homeForm ?? []
  const aForm = data?.awayForm ?? []
  const hStats = data?.homeStats
  const aStats = data?.awayStats

  const homePct = o ? Math.round(o.homeWinPct) : 0
  const drawPct = o ? Math.round(o.drawPct) : 0
  const awayPct = o ? Math.round(o.awayWinPct) : 0

  const homeWinRatePct = hStats ? Math.round(hStats.winRate * 100) : 0
  const awayWinRatePct = aStats ? Math.round(aStats.winRate * 100) : 0

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'matchup', label: 'MATCHUP' },
    { key: 'odds', label: 'ODDS' },
    { key: 'h2h', label: 'H2H' },
    { key: 'form', label: 'FORM' },
    { key: 'ai', label: t('champ.preview.aiTab') },
  ]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_ANIMS }} />

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 200,
          animation: 'previewOverlayIn 0.2s ease both',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 680,
            margin: '0 auto',
            padding: '20px 12px 40px',
            minHeight: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Panel */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
              animation: 'previewPanelIn 0.3s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            {/* ── Header ── */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'flex-start', gap: 8 }}>
                {/* Home name */}
                <div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    lineHeight: 1.15,
                  }}>
                    {homeName}
                  </div>
                  {hStats && (
                    <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>
                      {homeWinRatePct}% {t('champ.preview.winRate')}
                    </div>
                  )}
                </div>

                {/* Center: bout label + close */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 2 }}>
                  {boutLabel && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}>
                      {boutLabel}
                    </span>
                  )}
                  <button
                    onClick={onClose}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: 6,
                      color: '#64748b',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '5px 11px',
                      lineHeight: 1,
                      transition: 'background 0.15s',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Away name */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    lineHeight: 1.15,
                  }}>
                    {awayName}
                  </div>
                  {aStats && (
                    <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700, marginTop: 4 }}>
                      {awayWinRatePct}% {t('champ.preview.winRate')}
                    </div>
                  )}
                </div>
              </div>

              {/* Split color bar */}
              <div
                style={{
                  display: 'flex',
                  height: 3,
                  marginTop: 14,
                  animation: 'colorBarSlide 0.4s ease 0.05s both',
                }}
              >
                <div style={{ flex: 1, background: '#dc2626' }} />
                <div style={{ flex: 1, background: '#1d4ed8' }} />
              </div>
            </div>

            {/* ── Hero: avatars + VS ── */}
            <div
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'flex-end',
                padding: '24px 20px 0',
                background: '#fafafa',
                borderBottom: '1px solid #e5e7eb',
                overflow: 'hidden',
              }}
            >
              {/* Home */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <PreviewAvatar url={homeAvatarUrl} name={homeName} side="home" />
                {o && (
                  <div style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: '#dc2626',
                    letterSpacing: '0.02em',
                    lineHeight: 1,
                    padding: '12px 0 16px',
                  }}>
                    {o.homeWinOdds.toFixed(2)}
                  </div>
                )}
              </div>

              {/* VS */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '0 16px',
                paddingBottom: o ? 20 : 24,
                animation: 'vsIn 0.4s ease 0.1s both',
              }}>
                <div style={{
                  fontSize: 52,
                  fontWeight: 900,
                  color: '#0f172a',
                  letterSpacing: '-0.05em',
                  lineHeight: 1,
                  fontStyle: 'italic',
                }}>
                  VS
                </div>
                {o && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>
                    {drawPct}% DRAW
                  </div>
                )}
              </div>

              {/* Away */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <PreviewAvatar url={awayAvatarUrl} name={awayName} side="away" />
                {o && (
                  <div style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: '#1d4ed8',
                    letterSpacing: '0.02em',
                    lineHeight: 1,
                    padding: '12px 0 16px',
                  }}>
                    {o.awayWinOdds.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* ── Tab navigation ── */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e5e7eb',
              background: '#ffffff',
            }}>
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    padding: '13px 4px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab.key ? '3px solid #0f172a' : '3px solid transparent',
                    color: activeTab === tab.key ? '#0f172a' : '#9ca3af',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    transition: 'color 0.15s, border-color 0.15s',
                    marginBottom: -1,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab content ── */}
            <div style={{ padding: '0 20px 24px', minHeight: 160, background: '#ffffff' }}>

              {loading && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    background: 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 50%, #94a3b8 100%)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'shimmer 1.8s linear infinite',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {t('champ.preview.loading')}
                </div>
              )}

              {error && (
                <div style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>
                  {error}
                </div>
              )}

              {data && (
                <>
                  {/* ── MATCHUP tab ── */}
                  {activeTab === 'matchup' && (
                    <div>
                      {(hStats || aStats) ? (
                        <div>
                          {/* RECORD */}
                          <UFCStatRow
                            label="RECORD"
                            delay={0}
                            homeContent={
                              <span style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                                {hStats ? `${hStats.wins}-${hStats.losses}-${hStats.draws}` : '–'}
                              </span>
                            }
                            awayContent={
                              <span style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8', fontVariantNumeric: 'tabular-nums' }}>
                                {aStats ? `${aStats.wins}-${aStats.losses}-${aStats.draws}` : '–'}
                              </span>
                            }
                          />

                          {/* LAST MATCH */}
                          {(hForm.length > 0 || aForm.length > 0) && (
                            <UFCStatRow
                              label="LAST MATCH"
                              delay={0.05}
                              homeContent={(() => {
                                const r = hForm[0]?.result
                                if (!r) return <span style={{ fontSize: 20, fontWeight: 800, color: '#9ca3af' }}>–</span>
                                const clr = r === 'W' ? '#16a34a' : r === 'L' ? '#dc2626' : '#d97706'
                                const lbl = r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Draw'
                                return <span style={{ fontSize: 20, fontWeight: 800, color: clr }}>{lbl}</span>
                              })()}
                              awayContent={(() => {
                                const r = aForm[0]?.result
                                if (!r) return <span style={{ fontSize: 20, fontWeight: 800, color: '#9ca3af' }}>–</span>
                                const clr = r === 'W' ? '#16a34a' : r === 'L' ? '#dc2626' : '#d97706'
                                const lbl = r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Draw'
                                return <span style={{ fontSize: 20, fontWeight: 800, color: clr }}>{lbl}</span>
                              })()}
                            />
                          )}

                          {/* WIN RATE */}
                          <UFCStatRow
                            label={t('champ.preview.winRate')}
                            delay={0.1}
                            homeContent={
                              <span style={{ fontSize: 24, fontWeight: 900, color: '#dc2626' }}>
                                <NumberTicker value={homeWinRatePct} />%
                              </span>
                            }
                            awayContent={
                              <span style={{ fontSize: 24, fontWeight: 900, color: '#1d4ed8' }}>
                                <NumberTicker value={awayWinRatePct} />%
                              </span>
                            }
                          />

                          {/* GOALS FOR */}
                          <UFCStatRow
                            label={t('champ.preview.goalsFor')}
                            delay={0.15}
                            homeContent={
                              <span style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                                <NumberTicker value={hStats?.goalsFor ?? 0} />
                              </span>
                            }
                            awayContent={
                              <span style={{ fontSize: 24, fontWeight: 900, color: '#1d4ed8', fontVariantNumeric: 'tabular-nums' }}>
                                <NumberTicker value={aStats?.goalsFor ?? 0} />
                              </span>
                            }
                          />

                          {/* GOALS AGAINST */}
                          <UFCStatRow
                            label={t('champ.preview.goalsAgainst')}
                            delay={0.2}
                            homeContent={
                              <span style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                                <NumberTicker value={hStats?.goalsAgainst ?? 0} />
                              </span>
                            }
                            awayContent={
                              <span style={{ fontSize: 24, fontWeight: 900, color: '#1d4ed8', fontVariantNumeric: 'tabular-nums' }}>
                                <NumberTicker value={aStats?.goalsAgainst ?? 0} />
                              </span>
                            }
                          />

                          {/* GOAL DIFF */}
                          <UFCStatRow
                            label={t('champ.preview.goalDiff')}
                            delay={0.25}
                            homeContent={(() => {
                              const v = hStats?.goalDiff ?? 0
                              return (
                                <span style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                                  {v > 0 ? `+${v}` : v}
                                </span>
                              )
                            })()}
                            awayContent={(() => {
                              const v = aStats?.goalDiff ?? 0
                              return (
                                <span style={{ fontSize: 24, fontWeight: 900, color: '#1d4ed8', fontVariantNumeric: 'tabular-nums' }}>
                                  {v > 0 ? `+${v}` : v}
                                </span>
                              )
                            })()}
                          />

                          {/* MATCHES */}
                          <UFCStatRow
                            label={t('champ.preview.matches')}
                            delay={0.3}
                            homeContent={
                              <span style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                                <NumberTicker value={hStats?.matchesPlayed ?? 0} />
                              </span>
                            }
                            awayContent={
                              <span style={{ fontSize: 24, fontWeight: 900, color: '#1d4ed8', fontVariantNumeric: 'tabular-nums' }}>
                                <NumberTicker value={aStats?.matchesPlayed ?? 0} />
                              </span>
                            }
                          />
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '32px 0' }}>
                          {t('champ.preview.formNone')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ODDS tab ── */}
                  {activeTab === 'odds' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
                      {o ? (
                        <>
                          {/* Probability bar */}
                          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 2 }}>
                            <div style={{ flex: homePct, background: '#dc2626', borderRadius: '4px 0 0 4px', animation: 'barFill 0.7s ease both' }} />
                            <div style={{ flex: drawPct, background: '#d97706', animation: 'barFill 0.7s ease 0.1s both' }} />
                            <div style={{ flex: awayPct, background: '#1d4ed8', borderRadius: '0 4px 4px 0', animation: 'barFill 0.7s ease 0.2s both' }} />
                          </div>

                          {/* Win / Draw / Win cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 6px', textAlign: 'center' }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                                {homeName.split(' ')[0]}
                              </div>
                              <div style={{ fontSize: 26, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>
                                <NumberTicker value={homePct} />%
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginTop: 4 }}>
                                {o.homeWinOdds.toFixed(2)}
                              </div>
                            </div>
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 6px', textAlign: 'center' }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#d97706', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                                {t('champ.preview.draw')}
                              </div>
                              <div style={{ fontSize: 26, fontWeight: 900, color: '#d97706', lineHeight: 1 }}>
                                <NumberTicker value={drawPct} />%
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginTop: 4 }}>
                                {o.drawOdds.toFixed(2)}
                              </div>
                            </div>
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 6px', textAlign: 'center' }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                                {awayName.split(' ')[0]}
                              </div>
                              <div style={{ fontSize: 26, fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>
                                <NumberTicker value={awayPct} />%
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginTop: 4 }}>
                                {o.awayWinOdds.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* xG row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{o.expectedHomeGoals.toFixed(1)}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em', textAlign: 'center' }}>
                              {t('champ.preview.xg')}<br />
                              {o.homeHandicap !== 0 ? `${homeName.split(' ')[0]} ${o.homeHandicap > 0 ? '+' : ''}${o.homeHandicap}` : t('champ.preview.handicap')}
                            </span>
                            <span style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{o.expectedAwayGoals.toFixed(1)}</span>
                          </div>

                          {/* Key factors */}
                          {(o.homeFactors.length > 0 || o.awayFactors.length > 0) && (
                            <>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                {t('champ.preview.factors')}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {o.homeFactors.slice(0, 3).map((f, i) => (
                                    <div key={i} style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                        <span style={{ fontSize: 9, fontWeight: 800, color: f.impact === 'positive' ? '#16a34a' : f.impact === 'negative' ? '#dc2626' : '#d97706', textTransform: 'uppercase' }}>
                                          {f.impact === 'positive' ? '▲' : f.impact === 'negative' ? '▼' : '●'}
                                        </span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>{f.label}</span>
                                      </div>
                                      <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.35 }}>{f.description}</div>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {o.awayFactors.slice(0, 3).map((f, i) => (
                                    <div key={i} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                        <span style={{ fontSize: 9, fontWeight: 800, color: f.impact === 'positive' ? '#16a34a' : f.impact === 'negative' ? '#dc2626' : '#d97706', textTransform: 'uppercase' }}>
                                          {f.impact === 'positive' ? '▲' : f.impact === 'negative' ? '▼' : '●'}
                                        </span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>{f.label}</span>
                                      </div>
                                      <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.35 }}>{f.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '32px 0' }}>
                          {t('champ.preview.formNone')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── H2H tab ── */}
                  {activeTab === 'h2h' && (
                    <div style={{ paddingTop: 20 }}>
                      {h2h && h2h.totalMatches > 0 ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 40, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>
                                <NumberTicker value={h2h.homeWins} />
                              </div>
                              <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                                {homeName.split(' ')[0]}
                              </div>
                              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>
                                {t('common.wins')}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 28, fontWeight: 900, color: '#d97706', lineHeight: 1 }}>
                                <NumberTicker value={h2h.draws} />
                              </div>
                              <div style={{ fontSize: 10, color: '#d97706', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                                {t('common.draws')}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 40, fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>
                                <NumberTicker value={h2h.awayWins} />
                              </div>
                              <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                                {awayName.split(' ')[0]}
                              </div>
                              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>
                                {t('common.wins')}
                              </div>
                            </div>
                          </div>

                          {/* H2H bar */}
                          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 14 }}>
                            {h2h.homeWins > 0 && <div style={{ flex: h2h.homeWins, background: '#dc2626', animation: 'barFill 0.8s ease both' }} />}
                            {h2h.draws > 0 && <div style={{ flex: h2h.draws, background: '#d97706', animation: 'barFill 0.8s ease 0.1s both' }} />}
                            {h2h.awayWins > 0 && <div style={{ flex: h2h.awayWins, background: '#1d4ed8', animation: 'barFill 0.8s ease 0.2s both' }} />}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 14, color: '#dc2626', fontWeight: 800 }}>{h2h.homeGoals} {t('common.goals')}</span>
                            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
                              {t('champ.preview.totalMeetings').replace('{n}', String(h2h.totalMatches))}
                            </span>
                            <span style={{ fontSize: 14, color: '#1d4ed8', fontWeight: 800 }}>{h2h.awayGoals} {t('common.goals')}</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '32px 0' }}>
                          {t('champ.preview.h2hNone')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── FORM tab ── */}
                  {activeTab === 'form' && (
                    <div style={{ paddingTop: 18 }}>
                      {hForm.length === 0 && aForm.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '32px 0' }}>
                          {t('champ.preview.formNone')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', minWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '38px' }}>
                              {homeName.split(' ')[0]}
                            </span>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                              {hForm.length === 0 ? (
                                <span style={{ fontSize: 12, color: '#9ca3af', lineHeight: '38px' }}>–</span>
                              ) : (
                                hForm.map((f, i) => (
                                  <FormDot key={i} result={f.result} index={i} goalsFor={f.goalsFor} goalsAgainst={f.goalsAgainst} />
                                ))
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', minWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '38px' }}>
                              {awayName.split(' ')[0]}
                            </span>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                              {aForm.length === 0 ? (
                                <span style={{ fontSize: 12, color: '#9ca3af', lineHeight: '38px' }}>–</span>
                              ) : (
                                aForm.map((f, i) => (
                                  <FormDot key={i} result={f.result} index={i} goalsFor={f.goalsFor} goalsAgainst={f.goalsAgainst} />
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── AI PREVIEW tab ── */}
                  {activeTab === 'ai' && (
                    <div style={{ paddingTop: 18 }}>
                      {!aiPreview && !aiLoading && !aiError && (
                        <div style={{ textAlign: 'center', padding: '20px 8px 12px' }}>
                          <div style={{ fontSize: 28, marginBottom: 10 }}>✨</div>
                          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5, marginBottom: 18, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                            {t('champ.preview.aiIntro')}
                          </div>
                          <button
                            onClick={generateAiPreview}
                            style={{
                              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              padding: '11px 22px',
                              fontSize: 13,
                              fontWeight: 800,
                              letterSpacing: '0.02em',
                              cursor: 'pointer',
                              boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                            }}
                          >
                            ✨ {t('champ.preview.aiGenerateBtn')}
                          </button>
                        </div>
                      )}

                      {aiLoading && (
                        <div style={{ textAlign: 'center', padding: '40px 0', animation: 'aiPulse 1.4s ease-in-out infinite' }}>
                          <div style={{ fontSize: 28, marginBottom: 10 }}>✨</div>
                          <div style={{ fontSize: 13, color: '#7c3aed', fontWeight: 700 }}>
                            {t('champ.preview.aiGenerating')}
                          </div>
                        </div>
                      )}

                      {aiError && !aiLoading && (
                        <div style={{ textAlign: 'center', padding: '28px 0' }}>
                          <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{t('champ.preview.aiError')}</div>
                          <button
                            onClick={generateAiPreview}
                            style={{
                              background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6,
                              padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {t('champ.preview.aiRetry')}
                          </button>
                        </div>
                      )}

                      {aiPreview && !aiLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'aiCardIn 0.3s ease both' }}>
                          <div
                            style={{
                              background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(37,99,235,0.08))',
                              border: '1px solid rgba(124,58,237,0.18)',
                              borderRadius: 10,
                              padding: '14px 16px',
                            }}
                          >
                            <div style={{
                              fontSize: 9, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase',
                              letterSpacing: '0.14em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                              ✨ {t('champ.preview.aiTab')}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.3, marginBottom: 8 }}>
                              {aiPreview.headline}
                            </div>
                            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
                              {aiPreview.summary}
                            </div>
                          </div>

                          {aiPreview.insights.map((insight, i) => (
                            <div
                              key={i}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 8,
                                padding: '12px 14px',
                                animation: `aiCardIn 0.3s ease ${0.05 + i * 0.06}s both`,
                              }}
                            >
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: '#7c3aed' }}>●</span>
                                {insight.title}
                              </div>
                              <div style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>
                                {insight.detail}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
