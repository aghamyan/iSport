'use client'

import { useState, useEffect } from 'react'
import { getMatchPreviewAction, type MatchPreviewData } from './actions'
import { useTranslation } from '@/lib/i18n/context'

const PREVIEW_ANIMS = `
  @keyframes previewOverlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes previewPanelIn {
    from { opacity: 0; transform: scale(0.93) translateY(16px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes homeGlow {
    0%, 100% { box-shadow: 0 0 22px 5px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.18); }
    50%       { box-shadow: 0 0 38px 10px rgba(59,130,246,0.75), 0 0 90px rgba(59,130,246,0.32); }
  }
  @keyframes awayGlow {
    0%, 100% { box-shadow: 0 0 22px 5px rgba(239,68,68,0.5), 0 0 60px rgba(239,68,68,0.18); }
    50%       { box-shadow: 0 0 38px 10px rgba(239,68,68,0.75), 0 0 90px rgba(239,68,68,0.32); }
  }
  @keyframes vsFlicker {
    0%, 80%, 100% { opacity: 1; }
    82%, 86%      { opacity: 0.55; }
    84%           { opacity: 0.9; }
    88%           { opacity: 1; }
  }
  @keyframes floatLeft {
    0%, 100% { transform: translateY(0) rotate(-4deg); }
    50%       { transform: translateY(-7px) rotate(-4deg); }
  }
  @keyframes floatRight {
    0%, 100% { transform: translateY(0) rotate(4deg); }
    50%       { transform: translateY(-7px) rotate(4deg); }
  }
  @keyframes formDotIn {
    from { opacity: 0; transform: scale(0.3); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes barFill {
    from { width: 0 !important; }
  }
  @keyframes rotateLeft {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes rotateRight {
    from { transform: rotate(0deg); }
    to   { transform: rotate(-360deg); }
  }
  @keyframes scanLine {
    0%   { transform: translateY(-100%); opacity: 0.07; }
    100% { transform: translateY(100%); opacity: 0; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
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
  const accent = isHome ? '#3b82f6' : '#ef4444'
  const accentMid = isHome ? 'rgba(59,130,246,0.35)' : 'rgba(239,68,68,0.35)'
  const accentFaint = isHome ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)'

  return (
    /* Outer decoration ring */
    <div
      style={{
        position: 'relative',
        width: 116,
        height: 116,
        flexShrink: 0,
        animation: `${isHome ? 'floatLeft' : 'floatRight'} 3.2s ease-in-out infinite`,
      }}
    >
      {/* Outer glow disc */}
      <div
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentFaint} 0%, transparent 70%)`,
          animation: `${isHome ? 'homeGlow' : 'awayGlow'} 2.4s ease-in-out infinite`,
        }}
      />
      {/* Dashed outer ring */}
      <div
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: '50%',
          border: `2px dashed ${accentMid}`,
          animation: `${isHome ? 'rotateLeft' : 'rotateRight'} 12s linear infinite`,
        }}
      />
      {/* Solid inner ring */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `3px solid ${accent}`,
          zIndex: 1,
        }}
      />
      {/* Avatar image / initials */}
      <div
        style={{
          position: 'absolute',
          inset: 3,
          borderRadius: '50%',
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        {url ? (
          <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%', height: '100%', background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em',
            }}
          >
            {getInitials(name)}
          </div>
        )}
      </div>
      {/* HOME / AWAY badge */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%)',
          background: accent,
          color: '#fff',
          fontSize: 8,
          fontWeight: 900,
          letterSpacing: '0.12em',
          padding: '2px 8px',
          borderRadius: 10,
          zIndex: 3,
          whiteSpace: 'nowrap',
        }}
      >
        {isHome ? 'HOME' : 'AWAY'}
      </div>
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
    W: { bg: 'rgba(16,185,129,0.2)', border: '#10b981', text: '#34d399' },
    D: { bg: 'rgba(245,158,11,0.15)', border: '#d97706', text: '#fbbf24' },
    L: { bg: 'rgba(239,68,68,0.15)', border: '#dc2626', text: '#f87171' },
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
      {/* Result badge */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 9,
          background: c.bg,
          border: `1.5px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 900, color: c.text, lineHeight: 1 }}>{result}</span>
      </div>
      {/* Score below the badge — never inside */}
      <span
        style={{
          fontSize: 9,
          color: '#475569',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {goalsFor}:{goalsAgainst}
      </span>
    </div>
  )
}

function StatBar({
  label,
  homeVal,
  awayVal,
  format,
  higher = 'better',
}: {
  label: string
  homeVal: number
  awayVal: number
  format?: (v: number) => string
  higher?: 'better' | 'worse'
}) {
  const fmt = format ?? ((v: number) => String(v))
  const max = Math.max(Math.abs(homeVal), Math.abs(awayVal), 0.01)
  const homePct = Math.round((Math.abs(homeVal) / max) * 100)
  const awayPct = Math.round((Math.abs(awayVal) / max) * 100)

  const homeLeads =
    higher === 'better' ? homeVal > awayVal : homeVal < awayVal
  const awayLeads =
    higher === 'better' ? awayVal > homeVal : awayVal < homeVal

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center' }}>
      {/* Home bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: homeLeads ? 800 : 500,
            color: homeLeads ? '#60a5fa' : '#64748b',
            minWidth: 36,
            textAlign: 'right',
          }}
        >
          {fmt(homeVal)}
        </span>
        <div style={{ position: 'relative', height: 6, width: 80, background: '#0f1a2e', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: `${homePct}%`,
              background: homeLeads
                ? 'linear-gradient(90deg, rgba(59,130,246,0.4), #3b82f6)'
                : 'rgba(59,130,246,0.25)',
              borderRadius: 3,
              animation: 'barFill 0.6s ease both',
            }}
          />
        </div>
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>

      {/* Away bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ position: 'relative', height: 6, width: 80, background: '#0f1a2e', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${awayPct}%`,
              background: awayLeads
                ? 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4))'
                : 'rgba(239,68,68,0.25)',
              borderRadius: 3,
              animation: 'barFill 0.6s ease both',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: awayLeads ? 800 : 500,
            color: awayLeads ? '#f87171' : '#64748b',
            minWidth: 36,
          }}
        >
          {fmt(awayVal)}
        </span>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: '#0a1220',
        border: '1px solid #1a2840',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: '#334155',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export function MatchPreviewModal({
  homePlayerId,
  awayPlayerId,
  homeName,
  awayName,
  homeAvatarUrl,
  awayAvatarUrl,
  onClose,
}: {
  homePlayerId: string
  awayPlayerId: string
  homeName: string
  awayName: string
  homeAvatarUrl: string | null | undefined
  awayAvatarUrl: string | null | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [data, setData] = useState<MatchPreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getMatchPreviewAction(homePlayerId, awayPlayerId)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Error'); setLoading(false) } })
    return () => { cancelled = true }
  }, [homePlayerId, awayPlayerId])

  const o = data?.odds
  const h2h = data?.h2h
  const hForm = data?.homeForm ?? []
  const aForm = data?.awayForm ?? []
  const hStats = data?.homeStats
  const aStats = data?.awayStats

  const homePct = o ? Math.round(o.homeWinPct) : 0
  const drawPct = o ? Math.round(o.drawPct) : 0
  const awayPct = o ? Math.round(o.awayWinPct) : 0

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_ANIMS }} />

      {/* Overlay — does NOT close on click */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3,7,18,0.92)',
          backdropFilter: 'blur(8px)',
          zIndex: 200,
          animation: 'previewOverlayIn 0.25s ease both',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Panel */}
        <div
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '16px 12px 32px',
            minHeight: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #0c1422 0%, #050911 100%)',
              border: '1px solid #1a2840',
              borderRadius: 16,
              overflow: 'hidden',
              animation: 'previewPanelIn 0.35s cubic-bezier(0.22,1,0.36,1) both',
              position: 'relative',
            }}
          >
            {/* Scan line decoration */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: '30%',
                  background: 'linear-gradient(180deg, transparent, rgba(59,130,246,0.04), transparent)',
                  animation: 'scanLine 4s linear infinite',
                }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px 0',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: '#334155',
                  textTransform: 'uppercase',
                }}
              >
                {t('champ.preview.title')}
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(15,26,46,0.9)',
                  border: '1px solid #1a2840',
                  borderRadius: 8,
                  color: '#94a3b8',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '5px 12px',
                  letterSpacing: '0.04em',
                }}
              >
                {t('champ.preview.close')}
              </button>
            </div>

            {/* Hero VS section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '28px 24px 20px',
                gap: 0,
                position: 'relative',
              }}
            >
              {/* Home side */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <PreviewAvatar url={homeAvatarUrl} name={homeName} side="home" />
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#f1f5f9',
                      letterSpacing: '-0.01em',
                      maxWidth: 130,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {homeName}
                  </div>
                  {hStats && (
                    <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, marginTop: 2 }}>
                      {Math.round(hStats.winRate * 100)}% {t('champ.preview.winRate')}
                    </div>
                  )}
                </div>
              </div>

              {/* VS */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  zIndex: 2,
                  padding: '0 8px',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#3b5580',
                    textTransform: 'uppercase',
                  }}
                >
                  {o && `${o.homeWinOdds.toFixed(2)}`}
                </div>
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 900,
                    color: '#fbbf24',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    textShadow: '0 0 28px rgba(251,191,36,0.7), 0 0 56px rgba(245,158,11,0.35), 0 0 80px rgba(245,158,11,0.15)',
                    animation: 'vsFlicker 5s ease-in-out infinite',
                    fontStyle: 'italic',
                  }}
                >
                  VS
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#3b5580',
                    textTransform: 'uppercase',
                  }}
                >
                  {o && `${o.awayWinOdds.toFixed(2)}`}
                </div>
              </div>

              {/* Away side */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <PreviewAvatar url={awayAvatarUrl} name={awayName} side="away" />
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#f1f5f9',
                      letterSpacing: '-0.01em',
                      maxWidth: 130,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {awayName}
                  </div>
                  {aStats && (
                    <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, marginTop: 2 }}>
                      {Math.round(aStats.winRate * 100)}% {t('champ.preview.winRate')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div
              style={{
                padding: '0 14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {loading && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 0',
                    color: '#475569',
                    fontSize: 13,
                    background: 'linear-gradient(90deg, #475569 0%, #94a3b8 50%, #475569 100%)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'shimmer 1.8s linear infinite',
                  }}
                >
                  {t('champ.preview.loading')}
                </div>
              )}

              {error && (
                <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                  {error}
                </div>
              )}

              {data && (
                <>
                  {/* Odds */}
                  {o && (
                    <SectionCard title={t('champ.preview.odds')}>
                      {/* Probability bar */}
                      <div
                        style={{
                          display: 'flex',
                          height: 10,
                          borderRadius: 5,
                          overflow: 'hidden',
                          marginBottom: 10,
                          gap: 2,
                        }}
                      >
                        <div
                          style={{
                            flex: homePct,
                            background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)',
                            borderRadius: '5px 0 0 5px',
                            animation: 'barFill 0.7s ease both',
                          }}
                        />
                        <div
                          style={{
                            flex: drawPct,
                            background: 'linear-gradient(90deg, #92400e, #d97706)',
                            animation: 'barFill 0.7s ease 0.1s both',
                          }}
                        />
                        <div
                          style={{
                            flex: awayPct,
                            background: 'linear-gradient(90deg, #991b1b, #ef4444)',
                            borderRadius: '0 5px 5px 0',
                            animation: 'barFill 0.7s ease 0.2s both',
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        {/* Home */}
                        <div
                          style={{
                            background: 'rgba(59,130,246,0.08)',
                            border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: 8,
                            padding: '8px 4px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                            {t('champ.preview.win')}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: '#60a5fa', lineHeight: 1 }}>
                            {homePct}%
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginTop: 3 }}>
                            {o.homeWinOdds.toFixed(2)}
                          </div>
                        </div>

                        {/* Draw */}
                        <div
                          style={{
                            background: 'rgba(245,158,11,0.07)',
                            border: '1px solid rgba(245,158,11,0.18)',
                            borderRadius: 8,
                            padding: '8px 4px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#d97706', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                            {t('champ.preview.draw')}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>
                            {drawPct}%
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginTop: 3 }}>
                            {o.drawOdds.toFixed(2)}
                          </div>
                        </div>

                        {/* Away */}
                        <div
                          style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 8,
                            padding: '8px 4px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                            {t('champ.preview.win')}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: '#f87171', lineHeight: 1 }}>
                            {awayPct}%
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginTop: 3 }}>
                            {o.awayWinOdds.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* xG row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 10,
                          padding: '8px 10px',
                          background: '#050911',
                          borderRadius: 8,
                          border: '1px solid #0f1a2e',
                        }}
                      >
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>
                          {o.expectedHomeGoals.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#334155', letterSpacing: '0.1em' }}>
                          {t('champ.preview.xg')} ·{' '}
                          {o.homeHandicap !== 0
                            ? `${homeName.split(' ')[0]} ${o.homeHandicap > 0 ? '+' : ''}${o.homeHandicap}`
                            : t('champ.preview.handicap')}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#f87171' }}>
                          {o.expectedAwayGoals.toFixed(1)}
                        </span>
                      </div>
                    </SectionCard>
                  )}

                  {/* H2H */}
                  <SectionCard title={t('champ.preview.h2h')}>
                    {h2h && h2h.totalMatches > 0 ? (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: '#60a5fa', lineHeight: 1 }}>
                              {h2h.homeWins}
                            </div>
                            <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {t('common.wins')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>
                              {h2h.draws}
                            </div>
                            <div style={{ fontSize: 9, color: '#d97706', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {t('common.draws')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: '#f87171', lineHeight: 1 }}>
                              {h2h.awayWins}
                            </div>
                            <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {t('common.wins')}
                            </div>
                          </div>
                        </div>

                        {/* H2H dominance bar */}
                        <div
                          style={{
                            height: 8,
                            borderRadius: 4,
                            overflow: 'hidden',
                            display: 'flex',
                            gap: 1,
                            marginBottom: 8,
                          }}
                        >
                          {h2h.homeWins > 0 && (
                            <div
                              style={{
                                flex: h2h.homeWins,
                                background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)',
                                animation: 'barFill 0.8s ease both',
                              }}
                            />
                          )}
                          {h2h.draws > 0 && (
                            <div
                              style={{
                                flex: h2h.draws,
                                background: 'linear-gradient(90deg, #92400e, #d97706)',
                                animation: 'barFill 0.8s ease 0.1s both',
                              }}
                            />
                          )}
                          {h2h.awayWins > 0 && (
                            <div
                              style={{
                                flex: h2h.awayWins,
                                background: 'linear-gradient(90deg, #991b1b, #ef4444)',
                                animation: 'barFill 0.8s ease 0.2s both',
                              }}
                            />
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>
                            {h2h.homeGoals} {t('common.goals')}
                          </span>
                          <span style={{ fontSize: 10, color: '#334155', fontWeight: 600 }}>
                            {t('champ.preview.totalMeetings').replace('{n}', String(h2h.totalMatches))}
                          </span>
                          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                            {h2h.awayGoals} {t('common.goals')}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
                        {t('champ.preview.h2hNone')}
                      </div>
                    )}
                  </SectionCard>

                  {/* Recent Form */}
                  <SectionCard title={t('champ.preview.form')}>
                    {hForm.length === 0 && aForm.length === 0 ? (
                      <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
                        {t('champ.preview.formNone')}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Home form */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#3b82f6',
                              minWidth: 60,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: '38px',
                            }}
                          >
                            {homeName.split(' ')[0]}
                          </span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                            {hForm.length === 0 ? (
                              <span style={{ fontSize: 11, color: '#334155', lineHeight: '38px' }}>–</span>
                            ) : (
                              hForm.map((f, i) => (
                                <FormDot
                                  key={i}
                                  result={f.result}
                                  index={i}
                                  goalsFor={f.goalsFor}
                                  goalsAgainst={f.goalsAgainst}
                                />
                              ))
                            )}
                          </div>
                        </div>
                        {/* Away form */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#ef4444',
                              minWidth: 60,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: '38px',
                            }}
                          >
                            {awayName.split(' ')[0]}
                          </span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                            {aForm.length === 0 ? (
                              <span style={{ fontSize: 11, color: '#334155', lineHeight: '38px' }}>–</span>
                            ) : (
                              aForm.map((f, i) => (
                                <FormDot
                                  key={i}
                                  result={f.result}
                                  index={i}
                                  goalsFor={f.goalsFor}
                                  goalsAgainst={f.goalsAgainst}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </SectionCard>

                  {/* Stats comparison */}
                  {(hStats || aStats) && (
                    <SectionCard title={t('champ.preview.stats')}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <StatBar
                          label={t('champ.preview.winRate')}
                          homeVal={hStats ? Math.round(hStats.winRate * 100) : 0}
                          awayVal={aStats ? Math.round(aStats.winRate * 100) : 0}
                          format={(v) => `${v}%`}
                        />
                        <StatBar
                          label={t('champ.preview.goalsFor')}
                          homeVal={hStats?.goalsFor ?? 0}
                          awayVal={aStats?.goalsFor ?? 0}
                        />
                        <StatBar
                          label={t('champ.preview.goalsAgainst')}
                          homeVal={hStats?.goalsAgainst ?? 0}
                          awayVal={aStats?.goalsAgainst ?? 0}
                          higher="worse"
                        />
                        <StatBar
                          label={t('champ.preview.goalDiff')}
                          homeVal={hStats?.goalDiff ?? 0}
                          awayVal={aStats?.goalDiff ?? 0}
                          format={(v) => (v > 0 ? `+${v}` : String(v))}
                        />
                        <StatBar
                          label={t('champ.preview.matches')}
                          homeVal={hStats?.matchesPlayed ?? 0}
                          awayVal={aStats?.matchesPlayed ?? 0}
                        />
                      </div>
                    </SectionCard>
                  )}

                  {/* Key Factors */}
                  {o && (o.homeFactors.length > 0 || o.awayFactors.length > 0) && (
                    <SectionCard title={t('champ.preview.factors')}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {/* Home factors */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {o.homeFactors.slice(0, 3).map((f, i) => (
                            <div
                              key={i}
                              style={{
                                background: 'rgba(59,130,246,0.06)',
                                border: '1px solid rgba(59,130,246,0.15)',
                                borderRadius: 8,
                                padding: '7px 9px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  marginBottom: 3,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: f.impact === 'positive' ? '#10b981' : f.impact === 'negative' ? '#ef4444' : '#d97706',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                  }}
                                >
                                  {f.impact === 'positive' ? '▲' : f.impact === 'negative' ? '▼' : '●'}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>
                                  {f.label}
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.35 }}>
                                {f.description}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Away factors */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {o.awayFactors.slice(0, 3).map((f, i) => (
                            <div
                              key={i}
                              style={{
                                background: 'rgba(239,68,68,0.06)',
                                border: '1px solid rgba(239,68,68,0.15)',
                                borderRadius: 8,
                                padding: '7px 9px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  marginBottom: 3,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: f.impact === 'positive' ? '#10b981' : f.impact === 'negative' ? '#ef4444' : '#d97706',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                  }}
                                >
                                  {f.impact === 'positive' ? '▲' : f.impact === 'negative' ? '▼' : '●'}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>
                                  {f.label}
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.35 }}>
                                {f.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </SectionCard>
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
