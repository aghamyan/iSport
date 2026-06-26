'use client'

import { useState, useTransition, useEffect } from 'react'
import { createMatchesBatchAction, getMatchPreviewDataAction } from './actions'
import type { MatchDraft, MatchPreviewData } from './actions'
import { useTranslation } from '@/lib/i18n/context'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivePlayer = {
  id: string
  displayName: string
  avatarUrl?: string | null
}

type Props = {
  currentUserId: string
  currentUserName: string
  currentUserAvatarUrl?: string | null
  players: ActivePlayer[]
  onClose: () => void
}

type Step = 'pick' | 'preview'

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG     = '#050911'
const CARD   = '#0c1422'
const CARD2  = '#111c30'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const GOLD   = '#f59e0b'
const TEXT   = '#f8fafc'
const TEXT2  = '#94a3b8'
const MUTED  = '#4b5a73'
const WIN    = '#10b981'
const LOSS   = '#ef4444'
const DRAW_C = '#f59e0b'

const COUNT_PRESETS = [1, 3, 5, 7] as const
const MAX_CUSTOM = 20

const MODAL_ANIMS = `
  @keyframes cmSlideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes factIn {
    from { opacity: 0; transform: translateX(-10px) scale(0.98); }
    to   { opacity: 1; transform: translateX(0)     scale(1); }
  }
  @keyframes factGlow {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1; }
  }
`

// ─── Avatar ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function gradForName(name: string): string {
  const GRADS = [
    'linear-gradient(135deg,#3b82f6,#7c3aed)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'linear-gradient(135deg,#06b6d4,#3b82f6)',
    'linear-gradient(135deg,#f97316,#ef4444)',
  ]
  return GRADS[(name.charCodeAt(0) ?? 65) % GRADS.length]
}

function AvatarBubble({
  name, url, size = 44, ring,
}: { name: string; url?: string | null; size?: number; ring?: string }) {
  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    border: ring ? `2.5px solid ${ring}` : 'none',
  }
  if (url) {
    return (
      <div style={{ ...base, background: 'var(--card)' }}>
        <img src={url} alt={name} width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  return (
    <div style={{
      ...base,
      background: gradForName(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 800, color: '#fff',
    }}>
      {initials(name)}
    </div>
  )
}

// ─── Odds helpers ─────────────────────────────────────────────────────────────

function handicapLabel(h: number) {
  return h === 0 ? '0' : h > 0 ? `+${h}` : `${h}`
}

function calcOULine(expectedHomeGoals: number, expectedAwayGoals: number): string {
  const total = expectedHomeGoals + expectedAwayGoals
  return `${Math.ceil(total * 2) / 2}`
}

// ─── Fact generation ──────────────────────────────────────────────────────────

type Fact = { icon: string; text: string; color: string }

function generateFacts(
  preview: MatchPreviewData,
  homeName: string,
  awayName: string,
): Fact[] {
  const facts: Fact[] = []
  const { odds, h2h, homeForm, awayForm, homeWinRate, awayWinRate, homeGoalsPerGame, awayGoalsPerGame } = preview

  // Favourite
  const diff = odds.homeWinPct - odds.awayWinPct
  if (diff > 20) {
    facts.push({ icon: '👑', text: `${homeName} is a clear favourite — ${odds.homeWinPct}% win probability`, color: WIN })
  } else if (diff > 8) {
    facts.push({ icon: '🌟', text: `${homeName} has the edge — ${odds.homeWinPct}% vs ${odds.awayWinPct}%`, color: ACCENT })
  } else if (diff < -20) {
    facts.push({ icon: '⚡', text: `${awayName} enters as favourite — ${odds.awayWinPct}% win chance`, color: LOSS })
  } else if (diff < -8) {
    facts.push({ icon: '⚡', text: `${awayName} is favoured — ${odds.awayWinPct}% vs ${odds.homeWinPct}%`, color: '#f97316' })
  } else {
    facts.push({ icon: '⚖️', text: `Coin-flip matchup! ${odds.homeWinPct}% vs ${odds.awayWinPct}%`, color: GOLD })
  }

  // Expected score
  const eH   = odds.expectedHomeGoals
  const eA   = odds.expectedAwayGoals
  const line = calcOULine(eH, eA)
  facts.push({ icon: '⚽', text: `Expected: ${Math.round(eH)}–${Math.round(eA)} · O/U line ${line} goals`, color: TEXT2 })

  // H2H
  if (h2h && h2h.total >= 2) {
    if (h2h.homeWins > h2h.awayWins) {
      facts.push({ icon: '🤝', text: `H2H: You lead ${h2h.homeWins}–${h2h.awayWins} (${h2h.draws} draws, ${h2h.total} meetings)`, color: WIN })
    } else if (h2h.awayWins > h2h.homeWins) {
      facts.push({ icon: '🤝', text: `H2H: ${awayName} leads ${h2h.awayWins}–${h2h.homeWins} (${h2h.draws} draws, ${h2h.total} meetings)`, color: LOSS })
    } else {
      facts.push({ icon: '🤝', text: `H2H is dead level — ${h2h.homeWins}–${h2h.awayWins} (${h2h.draws} draws, ${h2h.total} meetings)`, color: GOLD })
    }
  } else if (h2h && h2h.total === 1) {
    facts.push({ icon: '🤝', text: `Only 1 previous meeting — rivalry is just beginning!`, color: TEXT2 })
  } else {
    facts.push({ icon: '✨', text: `First ever meeting! No H2H history yet`, color: TEXT2 })
  }

  // Home form
  if (homeForm.length >= 3) {
    const wins = homeForm.filter((r) => r === 'W').length
    if (wins >= 3) {
      facts.push({ icon: '🔥', text: `You're in great form — ${wins}/${homeForm.length} recent wins!`, color: WIN })
    } else if (wins === 0) {
      facts.push({ icon: '❄️', text: `Tough run — ${homeForm.length} games without a win`, color: LOSS })
    }
  }

  // Away form
  if (awayForm.length >= 3) {
    const wins = awayForm.filter((r) => r === 'W').length
    if (wins >= 3) {
      facts.push({ icon: '🚨', text: `${awayName} is in hot form (${wins}/${awayForm.length} recent wins) — watch out!`, color: '#f97316' })
    } else if (wins === 0) {
      facts.push({ icon: '📉', text: `${awayName} is struggling — ${awayForm.length} games without a win`, color: TEXT2 })
    }
  }

  // Win rates
  if (Math.abs(homeWinRate - awayWinRate) > 15 && (homeWinRate > 0 || awayWinRate > 0)) {
    facts.push({ icon: '🏅', text: `Career win rates: You ${homeWinRate}% vs ${awayName} ${awayWinRate}%`, color: homeWinRate > awayWinRate ? WIN : TEXT2 })
  }

  // Scoring comparison
  if (homeGoalsPerGame > 0 || awayGoalsPerGame > 0) {
    if (homeGoalsPerGame > awayGoalsPerGame + 0.5) {
      facts.push({ icon: '🎯', text: `You outscore the opponent: ${homeGoalsPerGame} vs ${awayGoalsPerGame} goals/game`, color: WIN })
    } else if (awayGoalsPerGame > homeGoalsPerGame + 0.5) {
      facts.push({ icon: '🎯', text: `${awayName} scores more: ${awayGoalsPerGame} vs ${homeGoalsPerGame} goals/game`, color: TEXT2 })
    }
  }

  // Handicap note
  if (Math.abs(odds.homeHandicap) >= 1) {
    const fav = odds.homeHandicap < 0 ? homeName : awayName
    facts.push({ icon: '⚖️', text: `${fav} gives a ${Math.abs(odds.homeHandicap)}-goal head start on the handicap`, color: TEXT2 })
  }

  return facts.slice(0, 6)
}

// ─── Step 1: Pick opponent ────────────────────────────────────────────────────

function PickOpponentStep({
  players, currentUserName, onSelect, onClose,
}: {
  players: ActivePlayer[]
  currentUserName: string
  onSelect: (p: ActivePlayer) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const filtered = search
    ? players.filter((p) => p.displayName.toLowerCase().includes(search.toLowerCase()))
    : players

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{t('match.create.recordTitle')}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: MUTED, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: TEXT2 }}>
          {t('match.create.youVs', { name: currentUserName })}
        </p>
        {players.length > 6 && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('match.create.searchPlaceholder')}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px', borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: CARD2, color: TEXT, fontSize: 13,
              outline: 'none', marginBottom: 12,
            }}
          />
        )}
      </div>

      {/* Player grid */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 20px 24px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 13 }}>
            {t('match.create.noPlayersFound')}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {filtered.map((player) => (
            <button
              key={player.id}
              onClick={() => onSelect(player)}
              style={{
                background: CARD2, border: `1px solid ${BORDER}`,
                borderRadius: 14, padding: '14px 8px',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8,
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = ACCENT
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.08)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = BORDER
                ;(e.currentTarget as HTMLElement).style.background = CARD2
              }}
            >
              <AvatarBubble name={player.displayName} url={player.avatarUrl} size={44} ring={BORDER} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: TEXT, textAlign: 'center',
                width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {player.displayName}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Count + Preview ─────────────────────────────────────────────────

function PreviewStep({
  currentUserName, currentUserAvatarUrl, opponent,
  count, onCountChange, preview, loadingPreview,
  error, isPending, onBack, onClose, onSubmit,
}: {
  currentUserName: string
  currentUserAvatarUrl?: string | null
  opponent: ActivePlayer
  count: number
  onCountChange: (n: number) => void
  preview: MatchPreviewData | null
  loadingPreview: boolean
  error: string | null
  isPending: boolean
  onBack: () => void
  onClose: () => void
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  const [showCustom, setShowCustom] = useState(false)
  const [customVal,  setCustomVal]  = useState('')

  function handlePreset(n: number) {
    setShowCustom(false)
    setCustomVal('')
    onCountChange(n)
  }

  function handleCustom(val: string) {
    setCustomVal(val)
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 1 && n <= MAX_CUSTOM) onCountChange(n)
  }

  const facts   = preview ? generateFacts(preview, currentUserName, opponent.displayName) : []
  const ouLine  = preview ? calcOULine(preview.odds.expectedHomeGoals, preview.odds.expectedAwayGoals) : null
  const opp     = opponent.displayName
  const oppShort = opp.length > 10 ? opp.slice(0, 9) + '…' : opp
  const meShort  = currentUserName.length > 10 ? currentUserName.slice(0, 9) + '…' : currentUserName

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      {/* Fixed header */}
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: TEXT2, fontSize: 14, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {t('common.back')}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: MUTED, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* VS hero */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
            <AvatarBubble name={currentUserName} url={currentUserAvatarUrl} size={54} ring={ACCENT} />
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, textAlign: 'center' }}>{meShort}</span>
            <span style={{ fontSize: 10, color: TEXT2 }}>{t('rivalry.create.youLabel')}</span>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 900, color: '#fff',
            boxShadow: '0 0 20px rgba(59,130,246,0.45)',
          }}>
            VS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
            <AvatarBubble name={opp} url={opponent.avatarUrl} size={54} ring={BORDER} />
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, textAlign: 'center' }}>{oppShort}</span>
            <span style={{ fontSize: 10, color: TEXT2 }}>{t('rivalry.create.opponentLabel')}</span>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 4px' }}>

        {/* ── Count selector ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            {t('match.create.howMany')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {COUNT_PRESETS.map((n) => {
              const active = count === n && !showCustom
              return (
                <button
                  key={n}
                  onClick={() => handlePreset(n)}
                  style={{
                    flex: 1, padding: '11px 0',
                    background: active ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : CARD2,
                    border: `1px solid ${active ? ACCENT : BORDER}`,
                    borderRadius: 10, color: active ? '#fff' : TEXT2,
                    fontSize: 17, fontWeight: 800, cursor: 'pointer',
                    boxShadow: active ? '0 2px 14px rgba(59,130,246,0.35)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {n}
                </button>
              )
            })}
            <button
              onClick={() => { setShowCustom(true); setCustomVal(String(count)) }}
              style={{
                flex: 1, padding: '11px 0',
                background: showCustom ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : CARD2,
                border: `1px solid ${showCustom ? ACCENT : BORDER}`,
                borderRadius: 10, color: showCustom ? '#fff' : TEXT2,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t('match.create.custom')}
            </button>
          </div>
          {showCustom && (
            <input
              type="number" min={1} max={MAX_CUSTOM}
              value={customVal}
              onChange={(e) => handleCustom(e.target.value)}
              placeholder={`1–${MAX_CUSTOM}`}
              autoFocus
              style={{
                marginTop: 8, width: '100%', boxSizing: 'border-box',
                padding: '9px 12px', borderRadius: 10,
                border: `1px solid ${BORDER}`,
                background: CARD2, color: TEXT, fontSize: 17, fontWeight: 700,
                outline: 'none', textAlign: 'center',
              }}
            />
          )}
        </div>

        {/* ── Odds section ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            {t('odds.preMatch')}
          </div>

          {loadingPreview && (
            <div style={{ textAlign: 'center', padding: '18px 0', color: TEXT2, fontSize: 13 }}>
              {t('odds.calculating')}
            </div>
          )}

          {preview && (
            <>
              {/* Probability bar */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 26, marginBottom: 6 }}>
                <div style={{
                  width: `${preview.odds.homeWinPct}%`, background: '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: '#fff',
                }}>
                  {preview.odds.homeWinPct >= 18 ? `${preview.odds.homeWinPct}%` : ''}
                </div>
                <div style={{
                  width: `${preview.odds.drawPct}%`, background: '#334155',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: '#fff',
                }}>
                  {preview.odds.drawPct >= 14 ? `${preview.odds.drawPct}%` : ''}
                </div>
                <div style={{
                  width: `${preview.odds.awayWinPct}%`, background: '#dc2626',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: '#fff',
                }}>
                  {preview.odds.awayWinPct >= 18 ? `${preview.odds.awayWinPct}%` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 10 }}>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>{meShort}</span>
                <span style={{ color: TEXT2 }}>{t('odds.draw')}</span>
                <span style={{ color: '#f87171', fontWeight: 600 }}>{oppShort}</span>
              </div>

              {/* Chips */}
              <div style={{ display: 'flex', gap: 7 }}>
                {[
                  { label: '1',   value: preview.odds.homeWinOdds.toFixed(2), sub: `${preview.odds.homeWinPct}%`, c: '#60a5fa', bg: 'rgba(37,99,235,0.14)' },
                  { label: 'X',   value: preview.odds.drawOdds.toFixed(2),    sub: `${preview.odds.drawPct}%`,   c: TEXT2,     bg: 'rgba(71,85,105,0.25)' },
                  { label: '2',   value: preview.odds.awayWinOdds.toFixed(2), sub: `${preview.odds.awayWinPct}%`,c: '#f87171', bg: 'rgba(220,38,38,0.14)' },
                  { label: 'HDP', value: handicapLabel(preview.odds.homeHandicap), sub: t('match.create.handicap'), c: '#a78bfa', bg: 'rgba(139,92,246,0.14)' },
                  ...(ouLine ? [{ label: 'O/U', value: ouLine, sub: t('match.create.goalsLower'), c: GOLD, bg: 'rgba(245,158,11,0.12)' }] : []),
                ].map((chip) => (
                  <div key={chip.label} style={{
                    flex: 1, textAlign: 'center', padding: '8px 3px',
                    background: chip.bg, borderRadius: 10,
                    border: `1px solid ${chip.c}33`,
                  }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: chip.c, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{chip.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: chip.c }}>{chip.value}</div>
                    <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{chip.sub}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Match Facts ── */}
        {facts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>✨</span>
              <div style={{ fontSize: 10, fontWeight: 800, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.13em' }}>
                {t('match.create.matchFacts')}
              </div>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${BORDER}, transparent)` }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {facts.map((fact, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px 11px 0',
                  borderRadius: 14,
                  background: `linear-gradient(105deg, ${fact.color}14 0%, ${CARD2} 55%)`,
                  border: `1px solid ${fact.color}28`,
                  borderLeft: `3px solid ${fact.color}`,
                  boxShadow: `0 2px 16px ${fact.color}12, inset 0 1px 0 ${fact.color}10`,
                  overflow: 'hidden',
                  animation: 'factIn 0.38s cubic-bezier(0.22,1,0.36,1) both',
                  animationDelay: `${i * 0.07}s`,
                }}>
                  {/* Icon badge */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '0 10px 10px 0', flexShrink: 0,
                    background: `${fact.color}18`,
                    borderRight: `1px solid ${fact.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>
                    {fact.icon}
                  </div>
                  <span style={{
                    fontSize: 12.5,
                    color: '#e2e8f0',
                    lineHeight: 1.5,
                    fontWeight: 500,
                    flex: 1,
                  }}>
                    {fact.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent form ── */}
        {preview && (preview.homeForm.length > 0 || preview.awayForm.length > 0) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              {t('match.create.recentForm')}
            </div>
            {[
              { name: currentUserName, form: preview.homeForm, wr: preview.homeWinRate },
              { name: opp,             form: preview.awayForm, wr: preview.awayWinRate },
            ].map(({ name, form, wr }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: TEXT2, width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {name.length > 9 ? name.slice(0, 8) + '…' : name}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {form.length === 0
                    ? <span style={{ fontSize: 11, color: MUTED }}>{t('match.create.noData')}</span>
                    : form.map((r, i) => (
                      <div key={i} style={{
                        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                        background: r === 'W' ? WIN : r === 'L' ? LOSS : DRAW_C,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, color: '#fff',
                      }}>{r}</div>
                    ))
                  }
                </div>
                {wr > 0 && (
                  <span style={{ fontSize: 10, color: TEXT2, flexShrink: 0, marginLeft: 'auto' }}>
                    {wr}% WR
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: LOSS, fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <button
          onClick={onSubmit}
          disabled={isPending}
          style={{
            width: '100%', padding: '15px',
            background: isPending ? MUTED : 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 800, cursor: isPending ? 'not-allowed' : 'pointer',
            boxShadow: isPending ? 'none' : '0 4px 22px rgba(37,99,235,0.4)',
          }}
        >
          {isPending
            ? t('match.create.creating')
            : t(count > 1 ? 'match.create.createBtn.many' : 'match.create.createBtn.one', { n: count, name: opp.split(' ')[0] })}
        </button>
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function CreateMatchModal({
  currentUserId, currentUserName, currentUserAvatarUrl, players, onClose,
}: Props) {
  const { t } = useTranslation()
  const [step,           setStep]           = useState<Step>('pick')
  const [opponent,       setOpponent]       = useState<ActivePlayer | null>(null)
  const [count,          setCount]          = useState(1)
  const [preview,        setPreview]        = useState<MatchPreviewData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [isPending,      startTransition]   = useTransition()

  // Fetch preview data whenever opponent changes
  useEffect(() => {
    if (!opponent) return
    let cancelled = false
    setLoadingPreview(true)
    setPreview(null)
    getMatchPreviewDataAction(currentUserId, opponent.id)
      .then((data) => { if (!cancelled) { setPreview(data); setLoadingPreview(false) } })
      .catch(() => { if (!cancelled) setLoadingPreview(false) })
    return () => { cancelled = true }
  }, [opponent?.id, currentUserId])

  function handleSelectOpponent(player: ActivePlayer) {
    setOpponent(player)
    setStep('preview')
  }

  function handleBack() {
    setStep('pick')
  }

  function handleSubmit() {
    if (!opponent) return
    setError(null)
    const drafts: MatchDraft[] = Array.from({ length: count }, () => ({
      awayPlayerId: opponent.id,
      homeScore: null,
      awayScore: null,
    }))
    startTransition(async () => {
      try {
        await createMatchesBatchAction(drafts)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('match.create.errGeneral'))
      }
    })
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MODAL_ANIMS }} />
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end',
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: BG,
          borderTop: `1px solid ${BORDER}`,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          maxHeight: '92vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'cmSlideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}>
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: BORDER }} />
          </div>

          {step === 'pick' && (
            <PickOpponentStep
              players={players}
              currentUserName={currentUserName}
              onSelect={handleSelectOpponent}
              onClose={onClose}
            />
          )}

          {step === 'preview' && opponent && (
            <PreviewStep
              currentUserName={currentUserName}
              currentUserAvatarUrl={currentUserAvatarUrl}
              opponent={opponent}
              count={count}
              onCountChange={setCount}
              preview={preview}
              loadingPreview={loadingPreview}
              error={error}
              isPending={isPending}
              onBack={handleBack}
              onClose={onClose}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </>
  )
}
