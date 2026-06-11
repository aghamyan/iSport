'use client'

import { useState, useEffect, useTransition } from 'react'
import { Trophy } from 'lucide-react'

const CHAMP_ANIMS = `
  @keyframes goldPulse {
    0%, 100% { box-shadow: 0 0 14px rgba(245,158,11,0.5), 0 0 28px rgba(245,158,11,0.2); }
    50%       { box-shadow: 0 0 24px rgba(245,158,11,0.8), 0 0 48px rgba(245,158,11,0.35); }
  }
  @keyframes matchFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`


import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabase/client'
import { calculateStandings } from '@/lib/championships/standings'
import { resolveSemiTie } from '@/lib/championships/groupKnockout'
import { resolvePlayoffSemi } from '@/lib/championships/groupPlayoff'
import {
  deleteChampionshipAction,
  generateSemiFinalsAction,
  generateFinalAction,
  generatePenaltyDeciderAction,
  generateFinalPenaltyDeciderAction,
  getMatchOddsAction,
  regenerateMatchesAction,
  generateNextCycleAction,
  updateChampionshipDateAction,
} from '../actions'
import { ScoreModal } from '../ScoreModal'
import { MatchPreviewModal } from '../MatchPreviewModal'
import { ChampionshipWinnerOdds } from '../ChampionshipWinnerOdds'
import { AddMatchModal } from '../AddMatchModal'
import { BottomNav } from '@/app/components/BottomNav'
import { useTranslation } from '@/lib/i18n/context'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Championship = {
  id: string
  name: string
  numberOfCycles: number
  isActive: boolean
  createdBy: string
  format: 'round_robin' | 'group_knockout' | 'group_playoff'
  playedAt: string | null
  createdAt: string
}

export type ChampionshipPlayer = {
  id: string
  displayName: string
  avatarUrl?: string | null
}

export type ChampionshipMatch = {
  id: string
  homePlayerId: string
  awayPlayerId: string
  homeScore: number | null
  awayScore: number | null
  cycle: number
  status: 'pending' | 'confirmed' | 'final'
  confirmedAt: string | null
  editDeadline: string | null
  groupLabel: string | null
  round: string | null
  leg: number | null
}

type OddsData = {
  homeWinOdds: number
  drawOdds: number
  awayWinOdds: number
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  homeHandicap: number
  awayHandicap: number
  expectedHomeGoals: number
  expectedAwayGoals: number
  homeFactors: { label: string; description: string; impact: string; ratingDelta: number }[]
  awayFactors: { label: string; description: string; impact: string; ratingDelta: number }[]
}

type Props = {
  championship: Championship
  players: ChampionshipPlayer[]
  initialMatches: ChampionshipMatch[]
  currentUserId: string
  isAdmin: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByCycle(matches: ChampionshipMatch[]): Map<number, ChampionshipMatch[]> {
  const map = new Map<number, ChampionshipMatch[]>()
  for (const m of matches) {
    if (!map.has(m.cycle)) map.set(m.cycle, [])
    map.get(m.cycle)!.push(m)
  }
  return map
}

function currentCycleNumber(matches: ChampionshipMatch[], totalCycles: number): number {
  const pendingCycles = matches.filter((m) => m.status === 'pending').map((m) => m.cycle)
  if (pendingCycles.length === 0) return totalCycles
  return Math.min(...pendingCycles)
}

function completedCyclesCount(matches: ChampionshipMatch[], totalCycles: number): number {
  const byGroup = groupByCycle(matches)
  let count = 0
  for (let c = 1; c <= totalCycles; c++) {
    const group = byGroup.get(c) ?? []
    if (group.length > 0 && group.every((m) => m.status !== 'pending')) count++
  }
  return count
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#84cc16',
]

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  url, name, size = 32, rank,
}: {
  url?: string | null
  name: string
  size?: number
  rank?: number
}) {
  const initials = getInitials(name)
  const bg = nameToColor(name)
  const fontSize = Math.round(size * 0.38)

  const ringColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : null
  const ringGlow = rank === 1
    ? 'goldPulse 2.5s ease-in-out infinite'
    : undefined

  const sharedStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    outline: ringColor ? `2px solid ${ringColor}` : undefined,
    outlineOffset: 2,
    animation: ringGlow,
  }

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{
          ...sharedStyle,
          objectFit: 'cover',
          border: '2px solid rgba(255,255,255,0.15)',
        }}
      />
    )
  }
  return (
    <div
      style={{
        ...sharedStyle,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 800,
        color: '#fff',
        border: '2px solid rgba(255,255,255,0.1)',
        letterSpacing: '-0.5px',
      }}
    >
      {initials}
    </div>
  )
}

// ─── OddsPanel ────────────────────────────────────────────────────────────────

function OddsBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#1a2840', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, pct)}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.5s ease',
        }}
      />
    </div>
  )
}

function OddsPanel({
  odds,
  homeName,
  awayName,
}: {
  odds: OddsData
  homeName: string
  awayName: string
}) {
  const { t } = useTranslation()
  const cells = [
    { label: homeName, odds: odds.homeWinOdds, pct: odds.homeWinPct, color: '#22c55e' },
    { label: t('champ.draw'), odds: odds.drawOdds, pct: odds.drawPct, color: '#f59e0b' },
    { label: awayName, odds: odds.awayWinOdds, pct: odds.awayWinPct, color: '#3b82f6' },
  ]

  return (
    <div
      style={{
        padding: '14px 16px 12px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '0 0 10px 10px',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {cells.map(({ label, odds: o, pct, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color,
                lineHeight: 1,
                marginBottom: 2,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {o.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{pct}%</div>
            <OddsBar pct={pct} color={color} />
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11,
          color: '#475569',
        }}
      >
        <span>
          xG: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{odds.expectedHomeGoals}</span>
          {' — '}
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{odds.expectedAwayGoals}</span>
        </span>
        {(odds.homeHandicap !== 0 || odds.awayHandicap !== 0) && (
          <span>
            AH:{' '}
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>
              {odds.homeHandicap > 0 ? '+' : ''}{odds.homeHandicap}
            </span>
          </span>
        )}
        <span style={{ color: '#334155' }}>{t('champ.liveOdds')}</span>
      </div>
    </div>
  )
}

// ─── MatchCard (replaces MatchRow) ────────────────────────────────────────────

function MatchCard({
  match,
  playerMap,
  avatarMap,
  currentUserId,
  isAdmin,
  championshipId,
  championshipIsActive,
  badge,
}: {
  match: ChampionshipMatch
  playerMap: Map<string, string>
  avatarMap: Map<string, string | null | undefined>
  currentUserId: string
  isAdmin: boolean
  championshipId: string
  championshipIsActive: boolean
  badge?: React.ReactNode
}) {
  const [showScore, setShowScore] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { t } = useTranslation()
  const homeName = playerMap.get(match.homePlayerId) ?? '?'
  const awayName = playerMap.get(match.awayPlayerId) ?? '?'
  const homeAvatar = avatarMap.get(match.homePlayerId)
  const awayAvatar = avatarMap.get(match.awayPlayerId)

  const isParticipant =
    match.homePlayerId === currentUserId || match.awayPlayerId === currentUserId
  const canRecord = match.status === 'pending' && (isParticipant || isAdmin)
  const canEdit =
    championshipIsActive && match.status === 'confirmed' && (isParticipant || isAdmin)
  const hasScore = match.homeScore !== null && match.awayScore !== null

  const homeWon = hasScore && match.homeScore! > match.awayScore!
  const awayWon = hasScore && match.awayScore! > match.homeScore!

  return (
    <>
      <div
        style={{
          borderRadius: 10,
          border: '1px solid #1a2840',
          background: '#0c1422',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.15s',
        }}
      >
        {/* Main match row — click the player/score area to open preview */}
        <div
          onClick={() => setShowPreview(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            gap: 8,
            background: match.status === 'pending' ? '#0a1220' : '#0c1422',
            cursor: 'pointer',
          }}
        >
          {badge && <div style={{ flexShrink: 0 }}>{badge}</div>}

          {/* Home player */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: homeWon ? 800 : 600,
                color: homeWon ? '#f8fafc' : awayWon ? '#4b5563' : '#e2e8f0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {homeName}
            </span>
            <Avatar url={homeAvatar} name={homeName} size={30} />
          </div>

          {/* Score bubble */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
              minWidth: 70,
              justifyContent: 'center',
            }}
          >
            {hasScore ? (
              <>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: homeWon ? '#f8fafc' : '#4b5563',
                    minWidth: 20,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {match.homeScore}
                </span>
                <span style={{ color: '#cbd5e1', fontWeight: 700, fontSize: 16, padding: '0 1px' }}>
                  :
                </span>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: awayWon ? '#f8fafc' : '#4b5563',
                    minWidth: 20,
                    textAlign: 'left',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {match.awayScore}
                </span>
              </>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  color: '#94a3b8',
                  fontWeight: 700,
                  background: '#0f1a2e',
                  padding: '4px 10px',
                  borderRadius: 20,
                  letterSpacing: '0.05em',
                  border: '1px solid #1a2840',
                }}
              >
                VS
              </span>
            )}
          </div>

          {/* Away player */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 8,
              minWidth: 0,
            }}
          >
            <Avatar url={awayAvatar} name={awayName} size={30} />
            <span
              style={{
                fontSize: 13,
                fontWeight: awayWon ? 800 : 600,
                color: awayWon ? '#f8fafc' : homeWon ? '#4b5563' : '#e2e8f0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {awayName}
            </span>
          </div>

          {/* Actions — stopPropagation so they don't trigger the preview */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {canRecord && (
              <button
                onClick={() => setShowScore(true)}
                style={{
                  padding: '4px 10px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                {t('champ.recordBtn')}
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setShowScore(true)}
                style={{
                  padding: '4px 10px',
                  background: '#0f1a2e',
                  color: '#94a3b8',
                  border: '1px solid #1a2840',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {t('champ.editBtn')}
              </button>
            )}
            {/* Odds toggle */}
            <button
              onClick={handleToggleOdds}
              disabled={oddsLoading}
              style={{
                padding: '4px 9px',
                background: showOdds ? '#0f172a' : '#0f1a2e',
                color: showOdds ? '#38bdf8' : '#64748b',
                border: showOdds ? '1px solid #1e3a5f' : '1px solid #1a2840',
                borderRadius: 6,
                cursor: oddsLoading ? 'wait' : 'pointer',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.02em',
                transition: 'all 0.15s',
              }}
            >
              {oddsLoading ? '…' : showOdds ? t('champ.oddsBtnShow') : t('champ.oddsBtnHide')}
            </button>
          </div>
        </div>

        {/* Odds error */}
        {oddsError && (
          <div
            style={{
              padding: '6px 14px',
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              fontSize: 12,
              borderTop: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            {oddsError}
          </div>
        )}

        {/* Odds panel */}
        {showOdds && odds && (
          <OddsPanel odds={odds} homeName={homeName} awayName={awayName} />
        )}
      </div>

      {showScore && (
        <ScoreModal
          championshipId={championshipId}
          matchId={match.id}
          homePlayerName={homeName}
          awayPlayerName={awayName}
          editDeadline={match.status === 'confirmed' ? match.editDeadline : null}
          isAdmin={isAdmin}
          onClose={() => setShowScore(false)}
        />
      )}

      {showPreview && (
        <MatchPreviewModal
          homePlayerId={match.homePlayerId}
          awayPlayerId={match.awayPlayerId}
          homeName={homeName}
          awayName={awayName}
          homeAvatarUrl={homeAvatar}
          awayAvatarUrl={awayAvatar}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}

// ─── Standings table ──────────────────────────────────────────────────────────

function StandingsTable({
  playerIds,
  matches,
  playerMap,
  avatarMap,
  highlightTop,
}: {
  playerIds: string[]
  matches: ChampionshipMatch[]
  playerMap: Map<string, string>
  avatarMap: Map<string, string | null | undefined>
  highlightTop?: number
}) {
  const { t } = useTranslation()
  const standings = calculateStandings(
    matches.map((m) => ({
      id: m.id,
      homePlayerId: m.homePlayerId,
      awayPlayerId: m.awayPlayerId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
    })),
    playerIds
  )

  const STANDING_COLS = '20px 1fr 26px 26px 26px 26px 26px 26px 30px 38px'

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          border: '1px solid #1a2840',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#0c1422',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          minWidth: 400,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: STANDING_COLS,
            padding: '8px 12px',
            background: '#0a1220',
            borderBottom: '1px solid #1a2840',
            fontSize: 10,
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <span>#</span>
          <span>{t('champ.table.player')}</span>
          <span style={{ textAlign: 'center' }}>MP</span>
          <span style={{ textAlign: 'center' }}>W</span>
          <span style={{ textAlign: 'center' }}>D</span>
          <span style={{ textAlign: 'center' }}>L</span>
          <span style={{ textAlign: 'center', color: '#f59e0b' }}>GF</span>
          <span style={{ textAlign: 'center', color: '#ef4444' }}>GA</span>
          <span style={{ textAlign: 'center' }}>GD</span>
          <span style={{ textAlign: 'center' }}>Pts</span>
        </div>

        {standings.map((row, idx) => {
          const name = playerMap.get(row.playerId) ?? '?'
          const avatar = avatarMap.get(row.playerId)
          const advances = highlightTop !== undefined && idx < highlightTop
          const isFirst = idx === 0 && !advances

          return (
            <div
              key={row.playerId}
              style={{
                display: 'grid',
                gridTemplateColumns: STANDING_COLS,
                padding: '8px 12px',
                borderBottom: idx < standings.length - 1 ? '1px solid #111e30' : 'none',
                borderLeft: advances
                  ? '3px solid #22c55e'
                  : isFirst
                  ? '3px solid #f59e0b'
                  : '3px solid transparent',
                background: advances ? 'rgba(34,197,94,0.06)' : isFirst ? 'rgba(245,158,11,0.07)' : '#0c1422',
                fontSize: 13,
                gap: 4,
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: advances ? '#22c55e' : isFirst ? '#f59e0b' : '#94a3b8',
                }}
              >
                {idx + 1}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <Avatar url={avatar} name={name} size={22} rank={idx + 1} />
                <span
                  style={{
                    fontWeight: advances || isFirst ? 700 : 500,
                    color: '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 12,
                  }}
                >
                  {name}
                </span>
              </div>
              <span style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>{row.played}</span>
              <span style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{row.wins}</span>
              <span style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{row.draws}</span>
              <span style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{row.losses}</span>
              <span style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600, fontSize: 12 }}>{row.goalsFor}</span>
              <span style={{ textAlign: 'center', color: '#ef444488', fontSize: 12 }}>{row.goalsAgainst}</span>
              <span
                style={{
                  textAlign: 'center',
                  color: row.goalDiff > 0 ? '#22c55e' : row.goalDiff < 0 ? '#ef4444' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
              </span>
              <span
                style={{
                  textAlign: 'center',
                  fontWeight: 800,
                  color: advances ? '#22c55e' : isFirst ? '#f59e0b' : '#f8fafc',
                  fontSize: 14,
                }}
              >
                {row.points}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Knockout section ─────────────────────────────────────────────────────────

function KnockoutSection({
  matches,
  playerMap,
  avatarMap,
  currentUserId,
  isAdmin,
  championshipId,
  championshipIsActive,
  groupStageDone,
  onGenerateSemis,
  onGenerateFinal,
  onGeneratePenalty,
  onGenerateFinalPenalty,
}: {
  matches: ChampionshipMatch[]
  playerMap: Map<string, string>
  avatarMap: Map<string, string | null | undefined>
  currentUserId: string
  isAdmin: boolean
  championshipId: string
  championshipIsActive: boolean
  groupStageDone: boolean
  onGenerateSemis: () => void
  onGenerateFinal: () => void
  onGeneratePenalty: (p1: string, p2: string) => void
  onGenerateFinalPenalty: () => void
}) {
  const { t } = useTranslation()
  const semiMatches = matches.filter((m) => m.round === 'semi')
  const penaltyMatches = matches.filter((m) => m.round === 'penalty')
  const finalMatch = matches.find((m) => m.round === 'final')
  const finalPenaltyMatch = matches.find((m) => m.round === 'final_penalty')

  const hasSemis = semiMatches.length > 0
  const hasFinal = !!finalMatch

  const ties = new Map<string, ChampionshipMatch[]>()
  for (const m of [...semiMatches, ...penaltyMatches]) {
    const key = [m.homePlayerId, m.awayPlayerId].sort().join('|')
    if (!ties.has(key)) ties.set(key, [])
    ties.get(key)!.push(m)
  }

  if (!hasSemis && !groupStageDone) {
    return (
      <div
        style={{
          padding: '28px 0',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: 13,
          fontStyle: 'italic',
        }}
      >
        {t('champ.knockoutUnlocks')}
      </div>
    )
  }

  return (
    <div>
      {/* Generate semis */}
      {!hasSemis && groupStageDone && isAdmin && (
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <button
            onClick={onGenerateSemis}
            style={{
              padding: '11px 28px',
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            }}
          >
            {t('champ.generateSemis')}
          </button>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            {t('champ.top2Advance')}
          </p>
        </div>
      )}

      {/* Semi-final ties */}
      {hasSemis && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>{t('champ.semiFinals')}</SectionLabel>

          {Array.from(ties.entries()).map(([key, tieMatches], tieIdx) => {
            const [p1, p2] = key.split('|')
            const semiLegs = tieMatches.filter((m) => m.round === 'semi')
            const leg1 = semiLegs.find((m) => m.leg === 1)
            const leg2 = semiLegs.find((m) => m.leg === 2)
            const allLegsPlayed =
              leg1 && leg2 && leg1.homeScore !== null && leg2.homeScore !== null

            const tieResult = allLegsPlayed
              ? resolveSemiTie(
                  p1,
                  p2,
                  tieMatches.map((m) => ({
                    homePlayerId: m.homePlayerId,
                    awayPlayerId: m.awayPlayerId,
                    homeScore: (m.homeScore ?? 0) as number,
                    awayScore: (m.awayScore ?? 0) as number,
                    round: m.round ?? '',
                    leg: m.leg,
                  }))
                )
              : null

            let p1Goals = 0, p2Goals = 0
            if (allLegsPlayed) {
              for (const leg of semiLegs) {
                if (leg.homePlayerId === p1) {
                  p1Goals += leg.homeScore!
                  p2Goals += leg.awayScore!
                } else {
                  p2Goals += leg.homeScore!
                  p1Goals += leg.awayScore!
                }
              }
            }

            const hasPenalty = tieMatches.some((m) => m.round === 'penalty')

            return (
              <div
                key={key}
                style={{
                  marginBottom: 16,
                  border: '1px solid #1a2840',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                }}
              >
                {/* Tie header */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#38bdf8',
                        background: 'rgba(56,189,248,0.1)',
                        border: '1px solid rgba(56,189,248,0.2)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {t('champ.semiN', { n: tieIdx + 1 })}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                      {playerMap.get(p1) ?? '?'} vs {playerMap.get(p2) ?? '?'}
                    </span>
                  </div>
                  {allLegsPlayed && (
                    <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>
                        {t('champ.aggregate')}{' '}
                        <strong style={{ color: '#e2e8f0' }}>
                          {p1Goals}–{p2Goals}
                        </strong>
                      </span>
                      {tieResult?.winner && (
                        <span
                          style={{
                            background: 'rgba(34,197,94,0.15)',
                            color: '#22c55e',
                            border: '1px solid rgba(34,197,94,0.3)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {t('champ.advances', { name: playerMap.get(tieResult.winner) ?? '?' })}
                        </span>
                      )}
                      {tieResult?.needsPenalty && !hasPenalty && (
                        <span
                          style={{
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {t('champ.penaltiesNeeded')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {semiLegs
                    .sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0))
                    .map((m, i) => (
                      <div
                        key={m.id}
                        style={{
                          borderBottom:
                            i < semiLegs.length - 1 || tieMatches.some((x) => x.round === 'penalty')
                              ? '1px solid #f1f5f9'
                              : 'none',
                        }}
                      >
                        <MatchCard
                          match={m}
                          playerMap={playerMap}
                          avatarMap={avatarMap}
                          currentUserId={currentUserId}
                          isAdmin={isAdmin}
                          championshipId={championshipId}
                          badge={
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: '#64748b',
                                background: '#0f1a2e',
                                border: '1px solid #1a2840',
                                padding: '2px 6px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                              }}
                            >
                              {t('champ.leg', { n: m.leg ?? 0 })}
                            </span>
                          }
                        />
                      </div>
                    ))}

                  {tieMatches
                    .filter((m) => m.round === 'penalty')
                    .map((m) => (
                      <div key={m.id}>
                        <MatchCard
                          match={m}
                          playerMap={playerMap}
                          avatarMap={avatarMap}
                          currentUserId={currentUserId}
                          isAdmin={isAdmin}
                          championshipId={championshipId}
                          badge={
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: '#a855f7',
                                background: 'rgba(168,85,247,0.08)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                              }}
                            >
                              {t('champ.pens')}
                            </span>
                          }
                        />
                      </div>
                    ))}
                </div>

                {tieResult?.needsPenalty && !hasPenalty && isAdmin && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.08)' }}>
                    <button
                      onClick={() => onGeneratePenalty(p1, p2)}
                      style={{
                        padding: '6px 16px',
                        background: '#9333ea',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 7,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {t('champ.recordPenalty')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {!hasFinal &&
            isAdmin &&
            (() => {
              const allTiesResolved = Array.from(ties.values()).every((tieMatches) => {
                const [p1, p2] = Array.from(
                  new Set(tieMatches.flatMap((m) => [m.homePlayerId, m.awayPlayerId]))
                )
                const result = resolveSemiTie(
                  p1,
                  p2,
                  tieMatches.map((m) => ({
                    homePlayerId: m.homePlayerId,
                    awayPlayerId: m.awayPlayerId,
                    homeScore: (m.homeScore ?? 0) as number,
                    awayScore: (m.awayScore ?? 0) as number,
                    round: m.round ?? '',
                    leg: m.leg,
                  }))
                )
                return result.winner !== null
              })
              return allTiesResolved ? (
                <div style={{ marginTop: 14, textAlign: 'center' }}>
                  <button
                    onClick={onGenerateFinal}
                    style={{
                      padding: '11px 28px',
                      background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 9,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
                    }}
                  >
                    {t('champ.generateFinal')}
                  </button>
                </div>
              ) : null
            })()}
        </div>
      )}

      {/* Final */}
      {finalMatch && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel gold>{t('champ.final')}</SectionLabel>

          <div
            style={{
              border: '2px solid #fbbf24',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(251,191,36,0.15)',
            }}
          >
            <MatchCard
              match={finalMatch}
              playerMap={playerMap}
              avatarMap={avatarMap}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              championshipId={championshipId}
            />

            {finalPenaltyMatch && (
              <div style={{ borderTop: '1px solid rgba(245,158,11,0.2)' }}>
                <MatchCard
                  match={finalPenaltyMatch}
                  playerMap={playerMap}
                  avatarMap={avatarMap}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  championshipId={championshipId}
                  badge={
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#a855f7',
                        background: 'rgba(168,85,247,0.08)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {t('champ.pens')}
                    </span>
                  }
                />
              </div>
            )}
          </div>

          {finalMatch.homeScore !== null &&
            finalMatch.awayScore !== null &&
            finalMatch.homeScore === finalMatch.awayScore &&
            !finalPenaltyMatch &&
            isAdmin && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={onGenerateFinalPenalty}
                  style={{
                    padding: '7px 16px',
                    background: '#9333ea',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Record Penalty Shootout
                </button>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {t('champ.finalLevel')}
                </span>
              </div>
            )}

          {/* Champion banner */}
          {(() => {
            const finalDraw =
              finalMatch.homeScore !== null &&
              finalMatch.awayScore !== null &&
              finalMatch.homeScore === finalMatch.awayScore

            if (finalDraw && !finalPenaltyMatch) return null
            if (finalDraw && finalPenaltyMatch) {
              if (finalPenaltyMatch.homeScore === null) return null
              const champId =
                (finalPenaltyMatch.homeScore ?? 0) > (finalPenaltyMatch.awayScore ?? 0)
                  ? finalPenaltyMatch.homePlayerId
                  : finalPenaltyMatch.awayPlayerId
              return <ChampionBanner name={playerMap.get(champId) ?? '?'} penalty />
            }
            if (finalMatch.homeScore === null) return null
            const champId =
              (finalMatch.homeScore ?? 0) > (finalMatch.awayScore ?? 0)
                ? finalMatch.homePlayerId
                : finalMatch.awayPlayerId
            return <ChampionBanner name={playerMap.get(champId) ?? '?'} />
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Playoff knockout section (single-leg semis) ─────────────────────────────

function PlayoffKnockoutSection({
  matches,
  playerMap,
  avatarMap,
  currentUserId,
  isAdmin,
  championshipId,
  championshipIsActive,
  groupStageDone,
  onGenerateSemis,
  onGenerateFinal,
  onGeneratePenalty,
  onGenerateFinalPenalty,
}: {
  matches: ChampionshipMatch[]
  playerMap: Map<string, string>
  avatarMap: Map<string, string | null | undefined>
  currentUserId: string
  isAdmin: boolean
  championshipId: string
  championshipIsActive: boolean
  groupStageDone: boolean
  onGenerateSemis: () => void
  onGenerateFinal: () => void
  onGeneratePenalty: (p1: string, p2: string) => void
  onGenerateFinalPenalty: () => void
}) {
  const { t } = useTranslation()
  const semiMatches = matches.filter((m) => m.round === 'semi')
  const penaltyMatches = matches.filter((m) => m.round === 'penalty')
  const finalMatch = matches.find((m) => m.round === 'final')
  const finalPenaltyMatch = matches.find((m) => m.round === 'final_penalty')

  const hasSemis = semiMatches.length > 0
  const hasFinal = !!finalMatch

  const ties = new Map<string, ChampionshipMatch[]>()
  for (const m of [...semiMatches, ...penaltyMatches]) {
    const key = [m.homePlayerId, m.awayPlayerId].sort().join('|')
    if (!ties.has(key)) ties.set(key, [])
    ties.get(key)!.push(m)
  }

  if (!hasSemis && !groupStageDone) {
    return (
      <div style={{ padding: '28px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
        {t('champ.playoffUnlocks')}
      </div>
    )
  }

  const allSemisResolved = hasSemis && Array.from(ties.values()).every((tieMatches) => {
    const players = Array.from(new Set(tieMatches.flatMap((m) => [m.homePlayerId, m.awayPlayerId])))
    const [tp1, tp2] = players
    return resolvePlayoffSemi(tp1, tp2, tieMatches.map((m) => ({
      homePlayerId: m.homePlayerId,
      awayPlayerId: m.awayPlayerId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      round: m.round ?? '',
      leg: m.leg,
    }))).winner !== null
  })

  return (
    <div>
      {!hasSemis && groupStageDone && isAdmin && (
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <button
            onClick={onGenerateSemis}
            style={{
              padding: '11px 28px',
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            }}
          >
            {t('champ.generatePlayoffs')}
          </button>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{t('champ.top4Advance')}</p>
        </div>
      )}

      {hasSemis && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>{t('champ.semiFinals')}</SectionLabel>

          {Array.from(ties.entries()).map(([key, tieMatches], tieIdx) => {
            const [p1, p2] = key.split('|')
            const semiMatch = tieMatches.find((m) => m.round === 'semi')
            const penaltyMatch = tieMatches.find((m) => m.round === 'penalty')
            const isPlayed = semiMatch?.homeScore !== null

            const tieResult = isPlayed
              ? resolvePlayoffSemi(p1, p2, tieMatches.map((m) => ({
                  homePlayerId: m.homePlayerId,
                  awayPlayerId: m.awayPlayerId,
                  homeScore: m.homeScore,
                  awayScore: m.awayScore,
                  round: m.round ?? '',
                  leg: m.leg,
                })))
              : null

            const hasPenalty = !!penaltyMatch

            return (
              <div
                key={key}
                style={{
                  marginBottom: 16,
                  border: '1px solid #1a2840',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#38bdf8',
                        background: 'rgba(56,189,248,0.1)',
                        border: '1px solid rgba(56,189,248,0.2)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      SF {tieIdx + 1}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                      {playerMap.get(p1) ?? '?'} vs {playerMap.get(p2) ?? '?'}
                    </span>
                  </div>
                  {isPlayed && (
                    <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'center' }}>
                      {tieResult?.winner && (
                        <span
                          style={{
                            background: 'rgba(34,197,94,0.15)',
                            color: '#22c55e',
                            border: '1px solid rgba(34,197,94,0.3)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {t('champ.advances', { name: playerMap.get(tieResult.winner) ?? '?' })}
                        </span>
                      )}
                      {tieResult?.needsPenalty && !hasPenalty && (
                        <span
                          style={{
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {t('champ.penaltiesNeeded')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {semiMatch && (
                  <MatchCard
                    match={semiMatch}
                    playerMap={playerMap}
                    avatarMap={avatarMap}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    championshipId={championshipId}
                  />
                )}

                {penaltyMatch && (
                  <div style={{ borderTop: '1px solid #1a2840' }}>
                    <MatchCard
                      match={penaltyMatch}
                      playerMap={playerMap}
                      avatarMap={avatarMap}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      championshipId={championshipId}
                      badge={
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#a855f7',
                            background: 'rgba(168,85,247,0.08)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          Pens
                        </span>
                      }
                    />
                  </div>
                )}

                {tieResult?.needsPenalty && !hasPenalty && isAdmin && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.08)' }}>
                    <button
                      onClick={() => onGeneratePenalty(p1, p2)}
                      style={{
                        padding: '6px 16px',
                        background: '#9333ea',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 7,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {t('champ.recordPenalty')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {!hasFinal && isAdmin && allSemisResolved && (
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button
                onClick={onGenerateFinal}
                style={{
                  padding: '11px 28px',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 9,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
                }}
              >
                {t('champ.generateFinal')}
              </button>
            </div>
          )}
        </div>
      )}

      {finalMatch && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel gold>{t('champ.final')}</SectionLabel>
          <div
            style={{
              border: '2px solid #fbbf24',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(251,191,36,0.15)',
            }}
          >
            <MatchCard
              match={finalMatch}
              playerMap={playerMap}
              avatarMap={avatarMap}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              championshipId={championshipId}
            />

            {finalPenaltyMatch && (
              <div style={{ borderTop: '1px solid rgba(245,158,11,0.2)' }}>
                <MatchCard
                  match={finalPenaltyMatch}
                  playerMap={playerMap}
                  avatarMap={avatarMap}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  championshipId={championshipId}
                  badge={
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#a855f7',
                        background: 'rgba(168,85,247,0.08)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {t('champ.pens')}
                    </span>
                  }
                />
              </div>
            )}
          </div>

          {finalMatch.homeScore !== null &&
            finalMatch.awayScore !== null &&
            finalMatch.homeScore === finalMatch.awayScore &&
            !finalPenaltyMatch &&
            isAdmin && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={onGenerateFinalPenalty}
                  style={{
                    padding: '7px 16px',
                    background: '#9333ea',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Record Penalty Shootout
                </button>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {t('champ.finalLevel')}
                </span>
              </div>
            )}

          {(() => {
            const finalDraw =
              finalMatch.homeScore !== null &&
              finalMatch.awayScore !== null &&
              finalMatch.homeScore === finalMatch.awayScore

            if (finalDraw && !finalPenaltyMatch) return null
            if (finalDraw && finalPenaltyMatch) {
              if (finalPenaltyMatch.homeScore === null) return null
              const champId =
                (finalPenaltyMatch.homeScore ?? 0) > (finalPenaltyMatch.awayScore ?? 0)
                  ? finalPenaltyMatch.homePlayerId
                  : finalPenaltyMatch.awayPlayerId
              return <ChampionBanner name={playerMap.get(champId) ?? '?'} penalty />
            }
            if (finalMatch.homeScore === null) return null
            const champId =
              (finalMatch.homeScore ?? 0) > (finalMatch.awayScore ?? 0)
                ? finalMatch.homePlayerId
                : finalMatch.awayPlayerId
            return <ChampionBanner name={playerMap.get(champId) ?? '?'} />
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          height: 3,
          width: 3,
          borderRadius: '50%',
          background: gold ? '#f59e0b' : '#3b82f6',
        }}
      />
      <h3
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          color: gold ? '#f59e0b' : '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {children}
      </h3>
      <div style={{ flex: 1, height: 1, background: gold ? 'rgba(245,158,11,0.3)' : '#1a2840' }} />
    </div>
  )
}

function ChampionBanner({ name, penalty }: { name: string; penalty?: boolean }) {
  const { t } = useTranslation()
  return (
    <div
      style={{
        marginTop: 12,
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #92400e, #d97706, #fbbf24)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 4px 16px rgba(251,191,36,0.25)',
      }}
    >
      <Trophy size={28} style={{ color: '#fbbf24', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
          {penalty ? t('champ.championPens') : t('champ.champion')}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{name}</div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChampionshipDetail({
  championship,
  players,
  initialMatches,
  currentUserId,
  isAdmin,
}: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [matches, setMatches] = useState<ChampionshipMatch[]>(initialMatches)
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [knockoutError, setKnockoutError] = useState<string | null>(null)
  const [regenError, setRegenError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isKnockoutPending, startKnockoutTransition] = useTransition()
  const [isRegenerating, startRegenTransition] = useTransition()
  const [nextCycleError, setNextCycleError] = useState<string | null>(null)
  const [isGeneratingCycle, startCycleTransition] = useTransition()
  const [mobileTab, setMobileTab] = useState<'schedule' | 'standings'>('schedule')
  const [isMobile, setIsMobile] = useState(false)
  const effectiveDate = championship.playedAt ?? championship.createdAt
  const [dateValue, setDateValue] = useState(effectiveDate.split('T')[0])
  const [isSavingDate, startDateTransition] = useTransition()
  const [dateError, setDateError] = useState<string | null>(null)

  const playerMap = new Map(players.map((p) => [p.id, p.displayName]))
  const avatarMap = new Map(players.map((p) => [p.id, p.avatarUrl]))
  const playerIds = players.map((p) => p.id)
  const isGroupKnockout = championship.format === 'group_knockout'
  const isGroupPlayoff = championship.format === 'group_playoff'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`champ-${championship.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'championship_matches',
          filter: `championship_id=eq.${championship.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const r = payload.new as Record<string, unknown>
            setMatches((prev) => [
              ...prev,
              {
                id: r.id as string,
                homePlayerId: r.home_player_id as string,
                awayPlayerId: r.away_player_id as string,
                homeScore: r.home_score as number | null,
                awayScore: r.away_score as number | null,
                cycle: r.cycle as number,
                status: r.status as ChampionshipMatch['status'],
                confirmedAt: r.confirmed_at as string | null,
                editDeadline: (r.confirmed_at as string | null)
                  ? new Date(new Date(r.confirmed_at as string).getTime() + 4 * 3600000).toISOString()
                  : null,
                groupLabel: (r.group_label as string | null) ?? null,
                round: (r.round as string | null) ?? null,
                leg: (r.leg as number | null) ?? null,
              },
            ])
          } else if (payload.eventType === 'UPDATE') {
            const r = payload.new as Record<string, unknown>
            setMatches((prev) =>
              prev.map((m) =>
                m.id === (r.id as string)
                  ? {
                      ...m,
                      homeScore: r.home_score as number | null,
                      awayScore: r.away_score as number | null,
                      status: r.status as ChampionshipMatch['status'],
                      confirmedAt: r.confirmed_at as string | null,
                      editDeadline: (r.confirmed_at as string | null)
                        ? new Date(new Date(r.confirmed_at as string).getTime() + 4 * 3600000).toISOString()
                        : null,
                    }
                  : m
              )
            )
          } else if (payload.eventType === 'DELETE') {
            const r = payload.old as Record<string, unknown>
            setMatches((prev) => prev.filter((m) => m.id !== (r.id as string)))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [championship.id])

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteChampionshipAction(championship.id)
        router.push('/championships')
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : 'Failed to delete.')
      }
    })
  }

  function handleGenerateSemis() {
    setKnockoutError(null)
    startKnockoutTransition(async () => {
      try {
        await generateSemiFinalsAction(championship.id)
      } catch (e) {
        setKnockoutError(e instanceof Error ? e.message : 'Failed to generate semi-finals.')
      }
    })
  }

  function handleGenerateFinal() {
    setKnockoutError(null)
    startKnockoutTransition(async () => {
      try {
        await generateFinalAction(championship.id)
      } catch (e) {
        setKnockoutError(e instanceof Error ? e.message : 'Failed to generate final.')
      }
    })
  }

  function handleGeneratePenalty(p1: string, p2: string) {
    setKnockoutError(null)
    startKnockoutTransition(async () => {
      try {
        await generatePenaltyDeciderAction(championship.id, p1, p2)
      } catch (e) {
        setKnockoutError(e instanceof Error ? e.message : 'Failed to create penalty decider.')
      }
    })
  }

  function handleGenerateFinalPenalty() {
    setKnockoutError(null)
    startKnockoutTransition(async () => {
      try {
        await generateFinalPenaltyDeciderAction(championship.id)
      } catch (e) {
        setKnockoutError(e instanceof Error ? e.message : 'Failed to create final penalty decider.')
      }
    })
  }

  function handleRegenerate() {
    setRegenError(null)
    startRegenTransition(async () => {
      try {
        await regenerateMatchesAction(championship.id)
      } catch (e) {
        setRegenError(e instanceof Error ? e.message : 'Failed to generate matches.')
      }
    })
  }

  function handleGenerateNextCycle() {
    setNextCycleError(null)
    startCycleTransition(async () => {
      try {
        await generateNextCycleAction(championship.id)
      } catch (e) {
        setNextCycleError(e instanceof Error ? e.message : 'Failed to generate next cycle.')
      }
    })
  }

  function handleSaveDate(newDate: string | null) {
    setDateError(null)
    startDateTransition(async () => {
      try {
        await updateChampionshipDateAction(championship.id, newDate)
      } catch (e) {
        setDateError(e instanceof Error ? e.message : 'Failed to update date.')
      }
    })
  }

  // ── Group knockout view ──

  if (isGroupKnockout) {
    const groupAMatches = matches.filter((m) => m.round === 'group' && m.groupLabel === 'A')
    const groupBMatches = matches.filter((m) => m.round === 'group' && m.groupLabel === 'B')
    const knockoutMatches = matches.filter(
      (m) =>
        m.round === 'semi' ||
        m.round === 'final' ||
        m.round === 'penalty' ||
        m.round === 'final_penalty'
    )

    const groupAIds = [
      ...new Set(groupAMatches.flatMap((m) => [m.homePlayerId, m.awayPlayerId])),
    ]
    const groupBIds = [
      ...new Set(groupBMatches.flatMap((m) => [m.homePlayerId, m.awayPlayerId])),
    ]

    const allGroupMatches = [...groupAMatches, ...groupBMatches]
    const groupStageDone =
      allGroupMatches.length > 0 && allGroupMatches.every((m) => m.homeScore !== null)

    const totalCycles = championship.numberOfCycles
    const byCycleA = groupByCycle(groupAMatches)
    const byCycleB = groupByCycle(groupBMatches)
    const curCycleA = currentCycleNumber(groupAMatches, totalCycles)
    const curCycleB = currentCycleNumber(groupBMatches, totalCycles)

    return (
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '0 0 40px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#050911',
          minHeight: '100svh',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: CHAMP_ANIMS }} />
        {/* Hero header */}
        <PageHeader
          name={championship.name}
          badge={t('champ.formatGroupKnockout')}
          badgeColor="#3b82f6"
          meta={`${t('champ.playerCount', { n: players.length })} · ${t(totalCycles !== 1 ? 'champ.groupCycles' : 'champ.groupCycle', { n: totalCycles })}`}
          extraBadge={
            groupStageDone ? { label: t('champ.groupStageDone'), color: '#22c55e' } : undefined
          }
          isAdmin={isAdmin}
          onAddMatch={() => setShowAddMatch(true)}
          onDelete={() => setShowDeleteConfirm(true)}
          dateValue={dateValue}
          onDateChange={setDateValue}
          onSaveDate={handleSaveDate}
          isSavingDate={isSavingDate}
          dateError={dateError}
        />

        <div style={{ padding: '20px 20px 0' }}>
          {knockoutError && (
            <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#f87171', fontSize: 13, border: '1px solid rgba(239,68,68,0.3)' }}>
              {knockoutError}
            </div>
          )}

          {regenError && (
            <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#f87171', fontSize: 13, border: '1px solid rgba(239,68,68,0.3)' }}>
              {regenError}
            </div>
          )}

          {allGroupMatches.length === 0 && isAdmin && (
            <div style={{ padding: '28px 20px', textAlign: 'center', border: '2px dashed #1a2840', borderRadius: 12, background: '#0a1220', marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>{t('champ.noMatchesYet')}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{t('champ.matchesNotGenerated')}</div>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                style={{ padding: '9px 22px', background: isRegenerating ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', border: 'none', borderRadius: 8, cursor: isRegenerating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                {isRegenerating ? t('champ.generating') : t('champ.generateMatches')}
              </button>
            </div>
          )}

          {/* Group stage */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 20,
              marginBottom: 32,
            }}
          >
            {[
              { label: 'A', cycleMap: byCycleA, curCycle: curCycleA, groupMatches: groupAMatches, groupIds: groupAIds },
              { label: 'B', cycleMap: byCycleB, curCycle: curCycleB, groupMatches: groupBMatches, groupIds: groupBIds },
            ].map(({ label, cycleMap, curCycle, groupMatches, groupIds }) => (
              <div key={label}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#fff',
                    }}
                  >
                    {label}
                  </div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#e2e8f0',
                    }}
                  >
                    {t('champ.group', { label })}
                  </h2>
                </div>

                {/* Schedule */}
                <div style={{ marginBottom: 14 }}>
                  {Array.from(cycleMap.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([cycle, cycleMatches]) => (
                      <div key={cycle} style={{ marginBottom: 14 }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: cycle === curCycle ? '#2563eb' : '#94a3b8',
                            marginBottom: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {t('champ.round', { n: cycle })}
                          {cycle === curCycle && (
                            <span
                              style={{
                                fontSize: 9,
                                background: 'rgba(59,130,246,0.15)',
                                color: '#60a5fa',
                                padding: '1px 5px',
                                borderRadius: 8,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                              }}
                            >
                              Live
                            </span>
                          )}
                          {cycle < curCycle && (
                            <span
                              style={{
                                fontSize: 9,
                                background: 'rgba(34,197,94,0.12)',
                                color: '#4ade80',
                                padding: '1px 5px',
                                borderRadius: 8,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                              }}
                            >
                              Done
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {cycleMatches.map((m) => (
                            <MatchCard
                              key={m.id}
                              match={m}
                              playerMap={playerMap}
                              avatarMap={avatarMap}
                              currentUserId={currentUserId}
                              isAdmin={isAdmin}
                              championshipId={championship.id}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Standings */}
                {groupIds.length > 0 && (
                  <>
                    <StandingsTable
                      playerIds={groupIds}
                      matches={groupMatches}
                      playerMap={playerMap}
                      avatarMap={avatarMap}
                      highlightTop={2}
                    />
                    <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                      {t('champ.greenAdvances')}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Knockout */}
          <div
            style={{
              background: '#0c1422',
              borderRadius: 14,
              border: '1px solid #1a2840',
              padding: '20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}
          >
            <SectionLabel>{t('champ.knockoutStage')}</SectionLabel>
            {isKnockoutPending ? (
              <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                {t('champ.updating')}
              </div>
            ) : (
              <KnockoutSection
                matches={knockoutMatches}
                playerMap={playerMap}
                avatarMap={avatarMap}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                championshipId={championship.id}
                groupStageDone={groupStageDone}
                onGenerateSemis={handleGenerateSemis}
                onGenerateFinal={handleGenerateFinal}
                onGeneratePenalty={handleGeneratePenalty}
                onGenerateFinalPenalty={handleGenerateFinalPenalty}
              />
            )}
          </div>
        </div>

        {showAddMatch && (
          <AddMatchModal
            championshipId={championship.id}
            players={players}
            onClose={() => setShowAddMatch(false)}
          />
        )}
        {showDeleteConfirm && (
          <DeleteConfirmModal
            championship={championship}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            deleteError={deleteError}
            onClose={() => setShowDeleteConfirm(false)}
          />
        )}
        <BottomNav userId={currentUserId} />
      </div>
    )
  }

  // ── Group playoff view ──

  if (isGroupPlayoff) {
    const groupMatches = matches.filter((m) => m.round === 'group')
    const playoffMatches = matches.filter(
      (m) => m.round === 'semi' || m.round === 'final' || m.round === 'penalty' || m.round === 'final_penalty'
    )

    const groupStageDone =
      groupMatches.length > 0 && groupMatches.every((m) => m.homeScore !== null)

    const totalCycles = championship.numberOfCycles
    const byCycle = groupByCycle(groupMatches)
    const curCycle = currentCycleNumber(groupMatches, totalCycles)

    return (
      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '0 0 40px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#050911',
          minHeight: '100svh',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: CHAMP_ANIMS }} />
        <PageHeader
          name={championship.name}
          badge={t('champ.formatGroupPlayoff')}
          badgeColor="#10b981"
          meta={`${t('champ.playerCount', { n: players.length })} · ${t(totalCycles !== 1 ? 'champ.groupCycles' : 'champ.groupCycle', { n: totalCycles })}`}
          extraBadge={groupStageDone ? { label: t('champ.groupStageDone'), color: '#22c55e' } : undefined}
          isAdmin={isAdmin}
          onAddMatch={() => setShowAddMatch(true)}
          onDelete={() => setShowDeleteConfirm(true)}
          dateValue={dateValue}
          onDateChange={setDateValue}
          onSaveDate={handleSaveDate}
          isSavingDate={isSavingDate}
          dateError={dateError}
        />

        {isMobile && (
          <div style={{ display: 'flex', borderBottom: '1px solid #1a2840', background: '#050911', position: 'sticky', top: 0, zIndex: 10 }}>
            {(['schedule', 'standings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                style={{ flex: 1, padding: '12px', fontSize: 12, fontWeight: 700, color: mobileTab === tab ? '#60a5fa' : '#64748b', background: 'none', border: 'none', borderBottom: mobileTab === tab ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
        <div
          style={{
            padding: '20px',
            display: isMobile ? 'block' : 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 320px)',
            gap: 20,
            alignItems: 'start',
          }}
        >
          {/* Left: schedule + playoffs */}
          <div style={{ display: isMobile && mobileTab !== 'schedule' ? 'none' : undefined }}>
            {knockoutError && (
              <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#f87171', fontSize: 13, border: '1px solid rgba(239,68,68,0.3)' }}>
                {knockoutError}
              </div>
            )}

            {regenError && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                {regenError}
              </div>
            )}

            <SectionLabel>{t('champ.groupStage')}</SectionLabel>

            {groupMatches.length === 0 && isAdmin ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', border: '2px dashed #1a2840', borderRadius: 12, background: '#0a1220', marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>{t('champ.noMatchesYet')}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{t('champ.matchesNotGenerated')}</div>
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  style={{ padding: '9px 22px', background: isRegenerating ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', border: 'none', borderRadius: 8, cursor: isRegenerating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  {isRegenerating ? t('champ.generating') : t('champ.generateMatches')}
                </button>
              </div>
            ) : (
              Array.from(byCycle.entries())
                .sort(([a], [b]) => a - b)
                .map(([cycle, cycleMatches]) => (
                  <div key={cycle} style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: cycle === curCycle ? '#2563eb' : '#94a3b8',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Round {cycle}
                      {cycle === curCycle && (
                        <span style={{ fontSize: 9, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                          Live
                        </span>
                      )}
                      {cycle < curCycle && (
                        <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.12)', color: '#4ade80', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                          Done
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {cycleMatches.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          playerMap={playerMap}
                          avatarMap={avatarMap}
                          currentUserId={currentUserId}
                          isAdmin={isAdmin}
                          championshipId={championship.id}
                        />
                      ))}
                    </div>
                  </div>
                ))
            )}

            {/* Playoff section */}
            <div
              style={{
                background: '#0c1422',
                borderRadius: 14,
                border: '1px solid #1a2840',
                padding: '20px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                marginTop: 8,
              }}
            >
              <SectionLabel>{t('champ.playoffs')}</SectionLabel>
              {isKnockoutPending ? (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>{t('champ.updating')}</div>
              ) : (
                <PlayoffKnockoutSection
                  matches={playoffMatches}
                  playerMap={playerMap}
                  avatarMap={avatarMap}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  championshipId={championship.id}
                  groupStageDone={groupStageDone}
                  onGenerateSemis={handleGenerateSemis}
                  onGenerateFinal={handleGenerateFinal}
                  onGeneratePenalty={handleGeneratePenalty}
                  onGenerateFinalPenalty={handleGenerateFinalPenalty}
                />
              )}
            </div>
          </div>

          {/* Right: standings (sticky) */}
          <div style={{ position: isMobile ? undefined : 'sticky', top: 20, display: isMobile && mobileTab !== 'standings' ? 'none' : undefined }}>
            <SectionLabel>{t('champ.standings')}</SectionLabel>
            <StandingsTable
              playerIds={playerIds}
              matches={groupMatches}
              playerMap={playerMap}
              avatarMap={avatarMap}
              highlightTop={4}
            />
            <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
              {t('champ.greenAdvancesPlay')}
            </div>
            <ChampionshipWinnerOdds
              championshipId={championship.id}
              playerIds={playerIds}
              playerMap={playerMap}
              avatarMap={avatarMap}
              completedMatchCount={matches.filter((m) => m.homeScore !== null && m.awayScore !== null).length}
            />
          </div>
        </div>

        {showAddMatch && (
          <AddMatchModal
            championshipId={championship.id}
            players={players}
            onClose={() => setShowAddMatch(false)}
          />
        )}
        {showDeleteConfirm && (
          <DeleteConfirmModal
            championship={championship}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            deleteError={deleteError}
            onClose={() => setShowDeleteConfirm(false)}
          />
        )}
        <BottomNav userId={currentUserId} />
      </div>
    )
  }

  // ── Round-robin view ──

  const standings = calculateStandings(
    matches.map((m) => ({
      id: m.id,
      homePlayerId: m.homePlayerId,
      awayPlayerId: m.awayPlayerId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
    })),
    playerIds
  )

  const byGroup = groupByCycle(matches)
  const totalCycles = championship.numberOfCycles
  const curCycle = currentCycleNumber(matches, totalCycles)
  const completedCycles = completedCyclesCount(matches, totalCycles)
  const remainingCycles = totalCycles - completedCycles
  const completedMatchCount = matches.filter(
    (m) => m.homeScore !== null && m.awayScore !== null
  ).length
  const maxGeneratedCycle = matches.length > 0 ? Math.max(...matches.map((m) => m.cycle)) : 0
  const nextCycleNum = maxGeneratedCycle + 1
  const canGenerateNextCycle = isAdmin && nextCycleNum <= totalCycles

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '0 0 40px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#050911',
        minHeight: '100svh',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: CHAMP_ANIMS }} />
      {/* Hero header */}
      <PageHeader
        name={championship.name}
        badge={t('champ.formatRoundRobin')}
        badgeColor="#8b5cf6"
        meta={`Cycle ${curCycle} / ${totalCycles} · ${remainingCycles} remaining · ${players.length} players`}
        isAdmin={isAdmin}
        onAddMatch={() => setShowAddMatch(true)}
        onDelete={() => setShowDeleteConfirm(true)}
        dateValue={dateValue}
        onDateChange={setDateValue}
        onSaveDate={handleSaveDate}
        isSavingDate={isSavingDate}
        dateError={dateError}
      />

      {isMobile && (
        <div style={{ display: 'flex', borderBottom: '1px solid #1a2840', background: '#050911', position: 'sticky', top: 0, zIndex: 10 }}>
          {(['schedule', 'standings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              style={{ flex: 1, padding: '12px', fontSize: 12, fontWeight: 700, color: mobileTab === tab ? '#60a5fa' : '#64748b', background: 'none', border: 'none', borderBottom: mobileTab === tab ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', letterSpacing: '0.08em' }}
            >
              {tab === 'schedule' ? t('champ.schedule') : t('champ.standings')}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          padding: '20px',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 320px)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Schedule */}
        <div style={{ display: isMobile && mobileTab !== 'schedule' ? 'none' : undefined }}>
          <SectionLabel>{t('champ.schedule')}</SectionLabel>

          {regenError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
              {regenError}
            </div>
          )}

          {nextCycleError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
              {nextCycleError}
            </div>
          )}

          {matches.length === 0 ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                border: '2px dashed #1a2840',
                borderRadius: 12,
                background: '#0a1220',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                {t('champ.noMatchesYet')}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: isAdmin ? 16 : 0 }}>
                {t('champ.matchesNotGenerated')}
              </div>
              {isAdmin && (
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  style={{
                    padding: '9px 22px',
                    background: isRegenerating ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: isRegenerating ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  }}
                >
                  {isRegenerating ? t('champ.generating') : t('champ.generateMatches')}
                </button>
              )}
            </div>
          ) : (
            <>
              {Array.from(byGroup.entries())
                .sort(([a], [b]) => a - b)
                .map(([cycle, cycleMatches]) => (
                  <div key={cycle} style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: cycle === curCycle ? '#2563eb' : '#94a3b8',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Round {cycle}
                      {cycle === curCycle && (
                        <span style={{ fontSize: 9, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                          Live
                        </span>
                      )}
                      {cycle < curCycle && (
                        <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.12)', color: '#4ade80', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                          Done
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {cycleMatches.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          playerMap={playerMap}
                          avatarMap={avatarMap}
                          currentUserId={currentUserId}
                          isAdmin={isAdmin}
                          championshipId={championship.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}

              {canGenerateNextCycle && (
                <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px dashed #1a2840', textAlign: 'center' }}>
                  <button
                    onClick={handleGenerateNextCycle}
                    disabled={isGeneratingCycle}
                    style={{
                      padding: '9px 22px',
                      background: isGeneratingCycle ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: isGeneratingCycle ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                    }}
                  >
                    {isGeneratingCycle ? t('champ.generating') : t('champ.generateNextCycle', { n: nextCycleNum })}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Standings */}
        <div style={{ position: isMobile ? undefined : 'sticky', top: 20, display: isMobile && mobileTab !== 'standings' ? 'none' : undefined }}>
          <SectionLabel>Standings</SectionLabel>
          <StandingsTable
            playerIds={playerIds}
            matches={matches}
            playerMap={playerMap}
            avatarMap={avatarMap}
          />
          <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
            {t('champ.sortedBy')}
          </div>

          {/* Top player highlight */}
          {standings.length > 0 && standings[0].points > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.08))',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Avatar
                url={avatarMap.get(standings[0].playerId)}
                name={playerMap.get(standings[0].playerId) ?? '?'}
                size={36}
              />
              <div>
                <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {t('champ.leading')}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                  {playerMap.get(standings[0].playerId)}
                </div>
                <div style={{ fontSize: 11, color: '#f59e0b' }}>
                  {standings[0].points} pts ·{' '}
                  {standings[0].goalDiff >= 0 ? '+' : ''}
                  {standings[0].goalDiff} GD
                </div>
              </div>
            </div>
          )}

          {/* Championship winner forecast */}
          <ChampionshipWinnerOdds
            championshipId={championship.id}
            playerIds={playerIds}
            playerMap={playerMap}
            avatarMap={avatarMap}
            completedMatchCount={completedMatchCount}
          />
        </div>
      </div>

      {showAddMatch && (
        <AddMatchModal
          championshipId={championship.id}
          players={players}
          onClose={() => setShowAddMatch(false)}
        />
      )}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          championship={championship}
          onDelete={handleDelete}
          isDeleting={isDeleting}
          deleteError={deleteError}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
      <BottomNav userId={currentUserId} />
    </div>
  )
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

function PageHeader({
  name,
  badge,
  badgeColor,
  meta,
  extraBadge,
  isAdmin,
  onAddMatch,
  onDelete,
  dateValue,
  onDateChange,
  onSaveDate,
  isSavingDate,
  dateError,
}: {
  name: string
  badge: string
  badgeColor: string
  meta: string
  extraBadge?: { label: string; color: string }
  isAdmin: boolean
  onAddMatch: () => void
  onDelete: () => void
  dateValue: string
  onDateChange: (v: string) => void
  onSaveDate: (v: string | null) => void
  isSavingDate: boolean
  dateError: string | null
}) {
  const { t } = useTranslation()
  const [editingDate, setEditingDate] = useState(false)
  const [localDate, setLocalDate] = useState(dateValue)

  function handleSave() {
    onDateChange(localDate)
    onSaveDate(localDate || null)
    setEditingDate(false)
  }

  function handleCancel() {
    setLocalDate(dateValue)
    setEditingDate(false)
  }

  const displayDate = new Date(dateValue + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e293b 100%)',
        padding: '24px 24px 22px',
        marginBottom: 0,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <a
          href="/championships"
          style={{
            fontSize: 11,
            color: 'rgba(148,163,184,0.7)',
            textDecoration: 'none',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          {t('champ.back')}
        </a>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 26,
              fontWeight: 900,
              color: '#f8fafc',
              letterSpacing: '-0.5px',
            }}
          >
            {name}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 20,
                background: `${badgeColor}25`,
                color: badgeColor,
                border: `1px solid ${badgeColor}40`,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              {badge}
            </span>
            {extraBadge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 20,
                  background: `${extraBadge.color}20`,
                  color: extraBadge.color,
                  border: `1px solid ${extraBadge.color}40`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                }}
              >
                {extraBadge.label}
              </span>
            )}
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{meta}</span>
          </div>

          {/* Date row */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {editingDate ? (
              <>
                <input
                  type="date"
                  value={localDate}
                  onChange={(e) => setLocalDate(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    background: '#0f1a2e',
                    border: '1px solid #2563eb',
                    borderRadius: 6,
                    color: '#e2e8f0',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={isSavingDate}
                  style={{
                    padding: '4px 10px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: isSavingDate ? 'wait' : 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {isSavingDate ? '…' : t('champ.saveDate')}
                </button>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '4px 10px',
                    background: 'transparent',
                    color: '#94a3b8',
                    border: '1px solid #1a2840',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {t('common.cancel')}
                </button>
                {dateError && (
                  <span style={{ fontSize: 11, color: '#f87171' }}>{dateError}</span>
                )}
              </>
            ) : (
              <>
                <span style={{ fontSize: 12, color: '#64748b' }}>{displayDate}</span>
                {isAdmin && (
                  <button
                    onClick={() => setEditingDate(true)}
                    style={{
                      padding: '2px 8px',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#64748b',
                      border: '1px solid #1a2840',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {t('champ.editDate')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onAddMatch}
              style={{
                padding: '7px 14px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 7,
                background: 'rgba(255,255,255,0.08)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: '#cbd5e1',
                backdropFilter: 'blur(4px)',
              }}
            >
              {t('champ.addMatch')}
            </button>
            <button
              onClick={onDelete}
              style={{
                padding: '7px 14px',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 7,
                background: 'rgba(239,68,68,0.08)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: '#f87171',
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────

function DeleteConfirmModal({
  championship,
  onDelete,
  isDeleting,
  deleteError,
  onClose,
}: {
  championship: Championship
  onDelete: () => void
  isDeleting: boolean
  deleteError: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#0c1422',
          borderRadius: 14,
          padding: 28,
          width: 380,
          maxWidth: '95vw',
          border: '1px solid #1a2840',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
          {t('champ.deleteTitle')}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#94a3b8' }}>
          {t('champ.deleteDesc', { name: championship.name })}
        </p>
        {deleteError && (
          <p style={{ color: '#f87171', fontSize: 13, margin: '0 0 12px' }}>{deleteError}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={isDeleting}
            style={{
              padding: '8px 18px',
              border: '1px solid #1a2840',
              borderRadius: 8,
              background: '#0f1a2e',
              cursor: 'pointer',
              fontSize: 14,
              color: '#94a3b8',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            style={{
              padding: '8px 22px',
              background: isDeleting ? 'rgba(239,68,68,0.4)' : '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {isDeleting ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
