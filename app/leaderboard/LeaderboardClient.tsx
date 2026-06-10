'use client'

import { useState, useMemo, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { Trophy, Crown, Medal, Flame, Zap, TrendingUp, Shield, Target, BarChart3, Award, Activity, Sparkles, Waves, Users, Building2, Star, Gamepad2, Calculator } from 'lucide-react'
import type { NamedPlayerStats, RivalryWinner, ChampionshipLeader, LastChampionshipPodiumEntry, H2HRecord } from '@/lib/stats/types'
import type { P4PRankedPlayer } from '@/lib/stats/p4p'
import { BottomNav } from '@/app/components/BottomNav'
import { fetchH2HAction } from '@/app/players/actions'

type Tab = 'overall' | 'scorers' | 'active' | 'rivalry' | 'championships' | 'insights' | 'p4p' | 'compare'
type SortKey = 'wins' | 'goalDiff' | 'winRate' | 'goalsFor' | 'goalsAgainst' | 'matchesPlayed' | 'avgGoals' | 'avgGoalDiff'

type Props = {
  players: NamedPlayerStats[]
  rivalryWinners: RivalryWinner[]
  championshipLeaders: ChampionshipLeader[]
  p4pRanked: P4PRankedPlayer[]
  lastChampionshipPodium: LastChampionshipPodiumEntry[]
  currentUserId: string
}

const PAGE_SIZE = 10

// ─── Design tokens (match app theme) ──────────────────────────────────────────
const BG     = '#050911'
const CARD   = '#0c1422'
const CARD2  = '#0f1a2e'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const GOLD   = '#f59e0b'
const SILVER = '#94a3b8'
const BRONZE = '#cd7f32'
const TEXT   = '#f8fafc'
const MUTED  = '#6b7280'
const GREEN  = '#22c55e'
const RED    = '#ef4444'
const PURPLE = '#a78bfa'

function rankMedal(rank: number, size = 18): ReactNode {
  const color = rank === 1 ? GOLD : rank === 2 ? SILVER : BRONZE
  return <Medal size={size} style={{ color, filter: `drop-shadow(0 0 4px ${color}66)` }} />
}
const RANK_COLORS  = [GOLD, SILVER, BRONZE]
const RANK_RGBS    = ['245,158,11', '148,163,184', '205,127,50']

// ─── CSS animations ────────────────────────────────────────────────────────────
const ANIMS = `
  @keyframes pulseGold {
    0%,100% { box-shadow: 0 0 0 3px #f59e0b, 0 0 18px rgba(245,158,11,0.55), 0 0 36px rgba(245,158,11,0.22); }
    50%      { box-shadow: 0 0 0 3px #f59e0b, 0 0 28px rgba(245,158,11,0.75), 0 0 56px rgba(245,158,11,0.4); }
  }
  @keyframes pulseSilver {
    0%,100% { box-shadow: 0 0 0 3px #94a3b8, 0 0 14px rgba(148,163,184,0.45); }
    50%      { box-shadow: 0 0 0 3px #94a3b8, 0 0 22px rgba(148,163,184,0.7); }
  }
  @keyframes pulseBronze {
    0%,100% { box-shadow: 0 0 0 3px #cd7f32, 0 0 14px rgba(205,127,50,0.45); }
    50%      { box-shadow: 0 0 0 3px #cd7f32, 0 0 22px rgba(205,127,50,0.7); }
  }
  @keyframes pulseBlue {
    0%,100% { box-shadow: 0 0 0 2px #3b82f6, 0 0 12px rgba(59,130,246,0.45); }
    50%      { box-shadow: 0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.7); }
  }
  @keyframes floatUp {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-7px); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmerBg {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .lb-row:hover { background: rgba(59,130,246,0.06) !important; }
  @keyframes cmpSlideLeft {
    from { opacity: 0; transform: translateX(-24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes cmpSlideRight {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes cmpGlowA {
    0%,100% { box-shadow: 0 0 0 3px #3b82f6, 0 0 22px rgba(59,130,246,0.45); }
    50%     { box-shadow: 0 0 0 3px #3b82f6, 0 0 36px rgba(59,130,246,0.7); }
  }
  @keyframes cmpGlowB {
    0%,100% { box-shadow: 0 0 0 3px #ef4444, 0 0 22px rgba(239,68,68,0.45); }
    50%     { box-shadow: 0 0 0 3px #ef4444, 0 0 36px rgba(239,68,68,0.7); }
  }
  @keyframes cmpBarGrow {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
`

// ─── Rank helpers ──────────────────────────────────────────────────────────────

function rankRing(rank: number, isMe: boolean): string {
  if (rank === 1) return GOLD
  if (rank === 2) return SILVER
  if (rank === 3) return BRONZE
  if (isMe) return ACCENT
  return BORDER
}

function rankAnim(rank: number, isMe: boolean): string {
  if (rank === 1) return 'pulseGold 2s ease-in-out infinite'
  if (rank === 2) return 'pulseSilver 3s ease-in-out infinite'
  if (rank === 3) return 'pulseBronze 3s ease-in-out infinite'
  if (isMe) return 'pulseBlue 2s ease-in-out infinite'
  return 'none'
}

function rankGrad(rank: number, isMe: boolean): string {
  if (rank === 1) return `linear-gradient(135deg, ${GOLD} 0%, #ef4444 100%)`
  if (rank === 2) return `linear-gradient(135deg, ${SILVER} 0%, #64748b 100%)`
  if (rank === 3) return `linear-gradient(135deg, ${BRONZE} 0%, #b45309 100%)`
  if (isMe) return `linear-gradient(135deg, ${ACCENT} 0%, #7c3aed 100%)`
  return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  url, name, size = 32, rank, isMe, pulse = false,
}: {
  url: string | null
  name: string
  size?: number
  rank?: number
  isMe?: boolean
  pulse?: boolean
}) {
  const r = rank ?? 99
  const ring = rankRing(r, !!isMe)
  const anim = pulse ? rankAnim(r, !!isMe) : 'none'
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const base: React.CSSProperties = {
    borderRadius: '50%', flexShrink: 0,
    border: `2.5px solid ${ring}`,
    animation: anim,
  }
  if (url) {
    return <img src={url} alt={name} width={size} height={size} style={{ ...base, objectFit: 'cover' }} />
  }
  return (
    <div style={{
      ...base, width: size, height: size,
      background: rankGrad(r, !!isMe),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 800, color: '#fff',
    }}>
      {initials}
    </div>
  )
}

// ─── Win rate bar ──────────────────────────────────────────────────────────────

function WinBar({ rate, width = 90 }: { rate: number; width?: number }) {
  const pct = Math.round(rate * 100)
  const color = pct >= 60 ? GREEN : pct >= 40 ? GOLD : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, width }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ─── Podium ────────────────────────────────────────────────────────────────────

function PodiumSection({ entries, currentUserId }: { entries: LastChampionshipPodiumEntry[]; currentUserId: string }) {
  if (entries.length < 2) return null
  // Visual order: 2nd left, 1st center, 3rd right
  const ordered = [entries[1], entries[0], entries[2]] as Array<LastChampionshipPodiumEntry | undefined>
  const slots = ordered
    .map((e, vi) => ({ entry: e, rank: [2, 1, 3][vi] }))
    .filter((s): s is { entry: LastChampionshipPodiumEntry; rank: number } => !!s.entry)

  const championshipName = entries[0]?.championshipName

  return (
    <div style={{ marginBottom: 28, animation: 'fadeInUp 0.5s ease' }}>
      {championshipName && (
        <div style={{ textAlign: 'center', fontSize: 11, color: MUTED, marginBottom: 12, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Last championship · <span style={{ color: GOLD }}>{championshipName}</span>
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        gap: 10, padding: '4px 0 0',
      }}>
        {slots.map(({ entry, rank }) => {
          const isMe    = entry.playerId === currentUserId
          const isFirst = rank === 1
          const ri      = rank - 1
          const cardW   = isFirst ? 160 : 132
          const stepH   = isFirst ? 80 : rank === 2 ? 58 : 42
          const avSize  = isFirst ? 72 : 56
          const rgb     = RANK_RGBS[ri]
          const winRate = entry.played > 0 ? entry.wins / entry.played : 0

          return (
            <div key={entry.playerId} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              width: cardW, animation: isFirst ? 'floatUp 3.5s ease-in-out infinite' : 'none',
            }}>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Avatar url={entry.avatarUrl} name={entry.playerName} size={avSize} rank={rank} isMe={isMe} pulse />
                <span style={{
                  position: 'absolute', bottom: -4, right: -6,
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
                }}>
                  {rankMedal(rank, isFirst ? 22 : 17)}
                </span>
              </div>

              <Link href={`/players/${entry.playerId}`} style={{
                fontSize: isFirst ? 14 : 12, fontWeight: 700,
                color: RANK_COLORS[ri], textDecoration: 'none',
                textAlign: 'center', maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 2,
              }}>
                {entry.playerName}
                {isMe && <span style={{ marginLeft: 4, fontSize: 9, color: MUTED, fontWeight: 400 }}>you</span>}
              </Link>

              <div style={{ fontSize: isFirst ? 28 : 20, fontWeight: 900, color: RANK_COLORS[ri], lineHeight: 1 }}>
                {entry.points}
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 8 }}>pts</div>

              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: MUTED, marginBottom: 10 }}>
                <span style={{ color: GREEN }}>{Math.round(winRate * 100)}%</span>
                <span style={{ color: BORDER }}>·</span>
                <span style={{ color: entry.goalDiff > 0 ? GREEN : entry.goalDiff < 0 ? RED : MUTED }}>
                  {entry.goalDiff > 0 ? '+' : ''}{entry.goalDiff} GD
                </span>
              </div>

              <div style={{
                width: '100%', height: stepH,
                background: `linear-gradient(180deg, rgba(${rgb},0.13), transparent)`,
                border: `1px solid rgba(${rgb},0.25)`, borderBottom: 'none',
                borderRadius: '6px 6px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ opacity: 0.2 }}>{rankMedal(rank, isFirst ? 30 : 22)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Personal stats card ───────────────────────────────────────────────────────

function MyStatsCard({ player, rank, total, players }: {
  player: NamedPlayerStats
  rank: number
  total: number
  players: NamedPlayerStats[]
}) {
  const active3 = players.filter((p) => p.matchesPlayed >= 3)
  const leagueAvgWR = players.reduce((s, p) => s + p.winRate, 0) / Math.max(players.length, 1)
  const myGPG       = player.matchesPlayed > 0 ? player.goalsFor / player.matchesPlayed : 0
  const myAvgGA     = player.matchesPlayed > 0 ? player.goalsAgainst / player.matchesPlayed : 0
  const myHCP       = player.matchesPlayed > 0 ? player.goalDiff / player.matchesPlayed : 0

  const scorerRank = active3.length
    ? [...active3].sort((a, b) => (b.goalsFor / b.matchesPlayed) - (a.goalsFor / a.matchesPlayed))
        .findIndex((p) => p.id === player.id) + 1
    : 0
  const defRank = active3.length
    ? [...active3].sort((a, b) => (a.goalsAgainst / a.matchesPlayed) - (b.goalsAgainst / b.matchesPlayed))
        .findIndex((p) => p.id === player.id) + 1
    : 0

  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08))',
      border: `1px solid rgba(59,130,246,0.28)`,
      borderRadius: 14, padding: '16px 18px', marginBottom: 24,
      animation: 'fadeInUp 0.4s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Avatar url={player.avatarUrl} name={player.name} size={50} isMe pulse />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{player.name}</div>
          <div style={{ fontSize: 12, color: MUTED }}>
            <span style={{ color: rank <= 3 ? RANK_COLORS[rank - 1] : ACCENT, fontWeight: 700 }}>
              #{rank}
            </span>
            {' '}of {total} players
          </div>
        </div>
        <span style={{ display: 'inline-flex' }}>
          {rank <= 3 ? rankMedal(rank, 30) : rank <= 5 ? <Award size={28} style={{ color: ACCENT }} /> : <Gamepad2 size={28} style={{ color: MUTED }} />}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
        gap: 8,
      }}>
        {[
          {
            label: 'Win Rate',
            value: `${Math.round(player.winRate * 100)}%`,
            sub: player.winRate > leagueAvgWR
              ? `+${((player.winRate - leagueAvgWR) * 100).toFixed(1)}% above avg`
              : `${((leagueAvgWR - player.winRate) * 100).toFixed(1)}% below avg`,
            color: player.winRate >= 0.6 ? GREEN : player.winRate >= 0.4 ? GOLD : RED,
          },
          {
            label: 'Goals/Game',
            value: myGPG.toFixed(2),
            sub: scorerRank > 0 ? `#${scorerRank} scorer/game` : 'scoring rate',
            color: GOLD,
          },
          {
            label: 'GA/Game',
            value: myAvgGA.toFixed(2),
            sub: defRank > 0 ? `#${defRank} defensive` : 'conceding rate',
            color: myAvgGA <= 1.5 ? GREEN : myAvgGA <= 2.5 ? GOLD : RED,
          },
          {
            label: 'Handicap',
            value: myHCP > 0 ? `+${myHCP.toFixed(2)}` : myHCP.toFixed(2),
            sub: 'avg GD per game',
            color: myHCP > 0 ? GREEN : myHCP < 0 ? RED : MUTED,
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 10,
            padding: '10px 12px', border: `1px solid ${BORDER}`,
          }}>
            <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 11, color: TEXT, fontWeight: 600, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 10, color: MUTED }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Insights tab ──────────────────────────────────────────────────────────────

function InsightsTab({ players, currentUserId }: { players: NamedPlayerStats[]; currentUserId: string }) {
  const cards = useMemo(() => {
    const active3 = players.filter((p) => p.matchesPlayed >= 3)
    const active5 = players.filter((p) => p.matchesPlayed >= 5)
    const top = (arr: NamedPlayerStats[]) => arr[0] ?? null

    const byGoals    = [...players].sort((a, b) => b.goalsFor - a.goalsFor)
    const byGPG      = [...active3].sort((a, b) => (b.goalsFor / b.matchesPlayed) - (a.goalsFor / a.matchesPlayed))
    const byDef      = [...active3].sort((a, b) => (a.goalsAgainst / a.matchesPlayed) - (b.goalsAgainst / b.matchesPlayed))
    const byActive   = [...players].sort((a, b) => b.matchesPlayed - a.matchesPlayed)
    const byWR       = [...active5].sort((a, b) => b.winRate - a.winRate)
    const byDom      = [...active3].sort((a, b) => (b.goalDiff / b.matchesPlayed) - (a.goalDiff / a.matchesPlayed))
    const byDrama    = [...active3].sort((a, b) =>
      ((b.goalsFor + b.goalsAgainst) / b.matchesPlayed) - ((a.goalsFor + a.goalsAgainst) / a.matchesPlayed)
    )
    const byStruggle = [...active3].sort((a, b) => (a.goalDiff / a.matchesPlayed) - (b.goalDiff / b.matchesPlayed))

    const p1 = top(byGoals), p2 = top(byGPG), p3 = top(byDef)
    const p4 = top(byActive), p5 = top(byWR), p6 = top(byDom)
    const p7 = top(byDrama), p8 = top(byStruggle)

    return [
      {
        icon: <Award size={22} />, title: 'Golden Boot', sub: 'Most total goals scored',
        player: p1, value: p1 ? `${p1.goalsFor} goals` : '-',
        color: GOLD, faint: 'rgba(245,158,11,0.08)',
      },
      {
        icon: <Target size={22} />, title: 'Sharp Shooter', sub: 'Best goals per game (min 3)',
        player: p2, value: p2 ? `${(p2.goalsFor / p2.matchesPlayed).toFixed(2)}/game` : '-',
        color: '#f97316', faint: 'rgba(249,115,22,0.08)',
      },
      {
        icon: <Shield size={22} />, title: 'Iron Wall', sub: 'Fewest goals conceded/game (min 3)',
        player: p3, value: p3 ? `${(p3.goalsAgainst / p3.matchesPlayed).toFixed(2)} GA/g` : '-',
        color: ACCENT, faint: 'rgba(59,130,246,0.08)',
      },
      {
        icon: <Activity size={22} />, title: 'Workhorse', sub: 'Most matches played',
        player: p4, value: p4 ? `${p4.matchesPlayed} games` : '-',
        color: '#ec4899', faint: 'rgba(236,72,153,0.08)',
      },
      {
        icon: <BarChart3 size={22} />, title: 'Mr. Consistent', sub: 'Best win rate (min 5 games)',
        player: p5, value: p5 ? `${Math.round(p5.winRate * 100)}%` : '-',
        color: GREEN, faint: 'rgba(34,197,94,0.08)',
      },
      {
        icon: <Zap size={22} />, title: 'The Dominator', sub: 'Highest avg GD per game (min 3)',
        player: p6,
        value: p6
          ? `${p6.goalDiff >= 0 ? '+' : ''}${(p6.goalDiff / p6.matchesPlayed).toFixed(2)}/game`
          : '-',
        color: PURPLE, faint: 'rgba(167,139,250,0.08)',
      },
      {
        icon: <Sparkles size={22} />, title: 'High Drama', sub: 'Most total goals per game (min 3)',
        player: p7,
        value: p7 ? `${((p7.goalsFor + p7.goalsAgainst) / p7.matchesPlayed).toFixed(2)}/game` : '-',
        color: '#f43f5e', faint: 'rgba(244,63,94,0.08)',
      },
      {
        icon: <Waves size={22} />, title: 'The Underdog', sub: 'Worst avg GD (min 3 games)',
        player: p8,
        value: p8 ? `${(p8.goalDiff / p8.matchesPlayed).toFixed(2)}/game` : '-',
        color: MUTED, faint: 'rgba(107,114,128,0.08)',
      },
    ]
  }, [players])

  const totalGoals = useMemo(() => players.reduce((s, p) => s + p.goalsFor, 0), [players])

  const totalMatches = useMemo(
    () => Math.round(players.reduce((s, p) => s + p.matchesPlayed, 0) / 2),
    [players],
  )

  const avgGoalsPerMatch = useMemo(() => {
    return totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0'
  }, [totalGoals, totalMatches])

  if (!players.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>No data yet.</div>
  }

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease' }}>
      {/* Summary strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10, marginBottom: 22,
      }}>
        {([
          { icon: <Zap size={24} style={{ color: GOLD }} />,         label: 'Total Goals',      value: totalGoals.toString()      },
          { icon: <Building2 size={24} style={{ color: ACCENT }} />, label: 'Total Matches',    value: totalMatches.toString()    },
          { icon: <BarChart3 size={24} style={{ color: GREEN }} />,  label: 'Goals/Match avg',  value: avgGoalsPerMatch           },
          { icon: <Users size={24} style={{ color: PURPLE }} />,     label: 'Players',          value: players.length.toString()  },
        ] as { icon: ReactNode; label: string; value: string }[]).map(({ icon, label, value }) => (
          <div key={label} style={{
            background: CARD2, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: '14px', textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{value}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Award grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
        {cards.map((card) => (
          <div key={card.title} style={{
            background: card.faint,
            border: `1px solid ${card.player ? card.color + '44' : BORDER}`,
            borderRadius: 12, padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ display: 'inline-flex', color: card.color }}>{card.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: card.color }}>{card.title}</div>
                <div style={{ fontSize: 10, color: MUTED }}>{card.sub}</div>
              </div>
            </div>

            {card.player ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Avatar url={card.player.avatarUrl} name={card.player.name} size={36}
                    isMe={card.player.id === currentUserId} pulse />
                  <Link href={`/players/${card.player.id}`} style={{
                    fontWeight: 700, fontSize: 13, color: TEXT, textDecoration: 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {card.player.name}
                    {card.player.id === currentUserId && (
                      <span style={{ marginLeft: 4, fontSize: 10, color: ACCENT, fontWeight: 400 }}>you</span>
                    )}
                  </Link>
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 800, color: card.color,
                  background: 'rgba(255,255,255,0.05)', borderRadius: 6,
                  padding: '5px 10px', display: 'inline-block',
                }}>
                  {card.value}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: MUTED }}>Not enough data yet</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sorting helpers ───────────────────────────────────────────────────────────

function getVal(p: NamedPlayerStats, key: SortKey): number {
  switch (key) {
    case 'wins':           return p.wins
    case 'goalDiff':       return p.goalDiff
    case 'winRate':        return p.winRate
    case 'goalsFor':       return p.goalsFor
    case 'goalsAgainst':   return p.goalsAgainst
    case 'matchesPlayed':  return p.matchesPlayed
    case 'avgGoals':       return p.matchesPlayed > 0 ? p.goalsFor / p.matchesPlayed : 0
    case 'avgGoalDiff':    return p.matchesPlayed > 0 ? p.goalDiff / p.matchesPlayed : 0
    default: return 0
  }
}

function fmtVal(p: NamedPlayerStats, key: SortKey): string {
  switch (key) {
    case 'avgGoals':
      return p.matchesPlayed > 0 ? (p.goalsFor / p.matchesPlayed).toFixed(2) : '-'
    case 'avgGoalDiff': {
      if (!p.matchesPlayed) return '-'
      const v = (p.goalDiff / p.matchesPlayed).toFixed(2)
      return p.goalDiff > 0 ? `+${v}` : v
    }
    case 'winRate':   return `${Math.round(p.winRate * 100)}%`
    case 'goalDiff':  return p.goalDiff > 0 ? `+${p.goalDiff}` : `${p.goalDiff}`
    default: return String(Math.round(getVal(p, key)))
  }
}

// ─── Player table ──────────────────────────────────────────────────────────────

type TableMode = 'overall' | 'scorers' | 'active'

// Sort buttons per mode
const SORT_OPTS: Record<TableMode, Array<{ key: SortKey; label: string }>> = {
  overall: [
    { key: 'wins',         label: 'Wins'       },
    { key: 'goalDiff',     label: 'Goal Diff'   },
    { key: 'winRate',      label: 'Win Rate'    },
    { key: 'goalsFor',     label: 'Goals'       },
    { key: 'avgGoals',     label: 'Goals/Game'  },
  ],
  scorers: [
    { key: 'goalsFor',       label: 'Goals'      },
    { key: 'avgGoals',       label: 'Goals/Game' },
    { key: 'matchesPlayed',  label: 'Matches'    },
  ],
  active: [
    { key: 'matchesPlayed',  label: 'Matches'    },
    { key: 'wins',           label: 'Wins'       },
    { key: 'goalsFor',       label: 'Goals'      },
  ],
}

// Two always-visible extra columns per mode (rendered in the table body AND header)
const VIS_COLS: Record<TableMode, Array<{ key: SortKey; header: string }>> = {
  overall: [
    { key: 'goalsFor',    header: 'GF' },
    { key: 'goalsAgainst', header: 'GA' },
  ],
  scorers: [
    { key: 'goalsFor',    header: 'GF'       },
    { key: 'avgGoals',    header: 'GF/Game'  },
  ],
  active: [
    { key: 'matchesPlayed', header: 'Games'  },
    { key: 'goalsFor',      header: 'Goals'  },
  ],
}

function SortBtn({ label, active, asc, onClick }: { label: string; active: boolean; asc: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px',
      border: `1px solid ${active ? ACCENT : BORDER}`,
      borderRadius: 6,
      background: active ? 'rgba(59,130,246,0.12)' : CARD2,
      color: active ? ACCENT : MUTED,
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {label}{active && <span style={{ fontSize: 8 }}>{asc ? '▲' : '▼'}</span>}
    </button>
  )
}

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void
}) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
      <button disabled={page === 0} onClick={() => onChange(page - 1)} style={{
        padding: '6px 12px', border: `1px solid ${BORDER}`, borderRadius: 6,
        background: CARD2, cursor: page === 0 ? 'default' : 'pointer',
        color: page === 0 ? BORDER : TEXT, fontSize: 12, opacity: page === 0 ? 0.4 : 1,
      }}>← Prev</button>
      <span style={{ fontSize: 12, color: MUTED }}>Page {page + 1} / {pages}</span>
      <button disabled={page >= pages - 1} onClick={() => onChange(page + 1)} style={{
        padding: '6px 12px', border: `1px solid ${BORDER}`, borderRadius: 6,
        background: CARD2, cursor: page >= pages - 1 ? 'default' : 'pointer',
        color: page >= pages - 1 ? BORDER : TEXT, fontSize: 12, opacity: page >= pages - 1 ? 0.4 : 1,
      }}>Next →</button>
    </div>
  )
}

// grid: rank(32) | player(1fr) | MP(36) | W(36) | D(36) | L(36) | col1(50) | col2(50) | WinBar(80)
const GRID = '32px 1fr 36px 36px 36px 36px 50px 50px 80px'

function PlayerTable({
  rows, mode, sortKey, setSortKey, sortAsc, setSortAsc, currentUserId,
}: {
  rows: NamedPlayerStats[]
  mode: TableMode
  sortKey: SortKey
  setSortKey: (k: SortKey) => void
  sortAsc: boolean
  setSortAsc: (v: boolean) => void
  currentUserId: string
}) {
  const [page, setPage] = useState(0)
  const visCols = VIS_COLS[mode]

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => sortAsc ? getVal(a, sortKey) - getVal(b, sortKey) : getVal(b, sortKey) - getVal(a, sortKey))
    return copy
  }, [rows, sortKey, sortAsc])

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
    setPage(0)
  }

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: MUTED }}>Sort:</span>
        {SORT_OPTS[mode].map((opt) => (
          <SortBtn key={opt.key} label={opt.label}
            active={sortKey === opt.key} asc={sortAsc}
            onClick={() => handleSort(opt.key)} />
        ))}
      </div>

      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: GRID,
          padding: '9px 14px', background: CARD2,
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 10, fontWeight: 700, color: MUTED,
          textTransform: 'uppercase', letterSpacing: '0.07em', gap: 4,
        }}>
          <span>#</span>
          <span>Player</span>
          <span style={{ textAlign: 'center' }}>MP</span>
          <span style={{ textAlign: 'center', color: GREEN }}>W</span>
          <span style={{ textAlign: 'center' }}>D</span>
          <span style={{ textAlign: 'center', color: RED }}>L</span>
          {visCols.map((c) => (
            <span key={c.key} style={{ textAlign: 'center' }}>{c.header}</span>
          ))}
          <span>Win %</span>
        </div>

        {paged.map((row, i) => {
          const rank   = page * PAGE_SIZE + i + 1
          const isMe   = row.id === currentUserId
          const isTop3 = rank <= 3
          const ri     = rank - 1

          const rowBg = rank === 1
            ? `rgba(${RANK_RGBS[0]},0.07)`
            : rank === 2
            ? `rgba(${RANK_RGBS[1]},0.06)`
            : rank === 3
            ? `rgba(${RANK_RGBS[2]},0.06)`
            : isMe ? 'rgba(59,130,246,0.07)'
            : CARD

          return (
            <div key={row.id} className="lb-row" style={{
              display: 'grid', gridTemplateColumns: GRID,
              padding: '10px 14px',
              borderBottom: i < paged.length - 1 ? `1px solid ${BORDER}` : 'none',
              background: rowBg, fontSize: 13, gap: 4, alignItems: 'center',
              transition: 'background 0.15s',
            }}>
              {/* Rank */}
              <div>
                {isTop3
                  ? <span style={{ display: 'inline-flex' }}>{rankMedal(rank, 18)}</span>
                  : <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{rank}</span>
                }
              </div>

              {/* Player */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Avatar url={row.avatarUrl} name={row.name} size={32}
                  rank={isTop3 ? rank : undefined} isMe={isMe}
                  pulse={isTop3 || isMe} />
                <Link href={`/players/${row.id}`} style={{
                  fontWeight: isTop3 ? 700 : 500,
                  color: isTop3 ? RANK_COLORS[ri] : TEXT,
                  textDecoration: 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {row.name}
                  {isMe && <span style={{ marginLeft: 5, fontSize: 10, color: ACCENT, fontWeight: 400 }}>you</span>}
                </Link>
              </div>

              {/* MP W D L */}
              <div style={{ textAlign: 'center', color: MUTED, fontSize: 12 }}>{row.matchesPlayed}</div>
              <div style={{ textAlign: 'center', color: GREEN, fontWeight: 700 }}>{row.wins}</div>
              <div style={{ textAlign: 'center', color: MUTED }}>{row.draws}</div>
              <div style={{ textAlign: 'center', color: RED }}>{row.losses}</div>

              {/* Dynamic visible columns */}
              {visCols.map((col) => {
                const num = getVal(row, col.key)
                let color = TEXT
                if (col.key === 'avgGoals' || col.key === 'goalsFor') color = GOLD
                if (col.key === 'goalsAgainst') color = `${RED}99` as string
                if (col.key === 'avgGoalDiff' || col.key === 'goalDiff') {
                  color = num > 0 ? GREEN : num < 0 ? RED : MUTED
                }
                return (
                  <div key={col.key} style={{ textAlign: 'center', fontWeight: 700, color, fontSize: 12 }}>
                    {fmtVal(row, col.key)}
                  </div>
                )
              })}

              {/* Win rate bar */}
              <WinBar rate={row.winRate} width={90} />
            </div>
          )
        })}

        {paged.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: MUTED, fontSize: 13 }}>No data yet.</div>
        )}
      </div>

      <Pagination page={page} total={sorted.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  )
}

// ─── Rivalry Winners tab ───────────────────────────────────────────────────────

function RivalryWinnersTab({ winners, currentUserId }: { winners: RivalryWinner[]; currentUserId: string }) {
  const [page, setPage] = useState(0)
  const paged = winners.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (!winners.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>No rivalry badges yet.</div>
  }

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease' }}>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 110px',
          padding: '9px 14px', background: CARD2,
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 10, fontWeight: 700, color: MUTED,
          textTransform: 'uppercase', letterSpacing: '0.07em', gap: 8,
        }}>
          <span>#</span><span>Player</span>
          <span style={{ textAlign: 'center' }}>Rivalries Won</span>
        </div>

        {paged.map((w, i) => {
          const rank   = page * PAGE_SIZE + i + 1
          const isMe   = w.playerId === currentUserId
          const isTop3 = rank <= 3
          const ri     = rank - 1
          const rowBg  = rank === 1 ? `rgba(${RANK_RGBS[0]},0.07)` : isMe ? 'rgba(59,130,246,0.07)' : CARD
          return (
            <div key={w.playerId} className="lb-row" style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 110px',
              padding: '11px 14px',
              borderBottom: i < paged.length - 1 ? `1px solid ${BORDER}` : 'none',
              background: rowBg, fontSize: 13, gap: 8, alignItems: 'center',
              transition: 'background 0.15s',
            }}>
              <div>
                {isTop3
                  ? <span style={{ display: 'inline-flex' }}>{rankMedal(rank, 18)}</span>
                  : <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{rank}</span>
                }
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Avatar url={w.avatarUrl} name={w.name} size={30}
                  rank={isTop3 ? rank : undefined} isMe={isMe} pulse={isTop3 || isMe} />
                <Link href={`/players/${w.playerId}`} style={{
                  fontWeight: rank === 1 ? 700 : 500,
                  color: isTop3 ? RANK_COLORS[ri] : TEXT,
                  textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {w.name}
                  {isMe && <span style={{ marginLeft: 4, fontSize: 10, color: ACCENT, fontWeight: 400 }}>you</span>}
                </Link>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Trophy size={14} style={{ color: GOLD }} />
                <span style={{ fontWeight: 800, fontSize: 17, color: rank === 1 ? GOLD : TEXT }}>{w.rivalriesWon}</span>
              </div>
            </div>
          )
        })}
      </div>
      <Pagination page={page} total={winners.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  )
}

// ─── Championships tab ─────────────────────────────────────────────────────────

function ChampionshipsTab({ leaders }: { leaders: ChampionshipLeader[] }) {
  if (!leaders.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>No championships found.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeInUp 0.35s ease' }}>
      {leaders.map((cl) => (
        <div key={cl.championshipId} style={{
          border: `1px solid ${BORDER}`, borderRadius: 14,
          padding: '16px 18px', background: CARD,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href={`/championships/${cl.championshipId}`} style={{
                fontSize: 15, fontWeight: 700, color: TEXT, textDecoration: 'none',
              }}>
                {cl.championshipName}
              </Link>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                background: cl.isActive ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                color: cl.isActive ? ACCENT : MUTED,
                border: `1px solid ${cl.isActive ? ACCENT + '44' : BORDER}`,
              }}>
                {cl.isActive ? 'Active' : 'Completed'}
              </span>
            </div>
            <Link href={`/championships/${cl.championshipId}`} style={{ fontSize: 11, color: ACCENT, textDecoration: 'none' }}>
              View →
            </Link>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(245,158,11,0.07)', borderRadius: 10,
            padding: '11px 14px', border: `1px solid rgba(245,158,11,0.22)`,
          }}>
            <Trophy size={22} style={{ color: GOLD, flexShrink: 0 }} />
            <Avatar url={cl.avatarUrl} name={cl.playerName} size={40} rank={1} pulse />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/players/${cl.playerId}`} style={{
                fontSize: 14, fontWeight: 700, color: GOLD, textDecoration: 'none',
              }}>
                {cl.playerName}
              </Link>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                {cl.isActive ? 'Current leader' : 'Champion'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
              {[
                { label: 'Pts', value: cl.points,  color: GOLD  },
                { label: 'W',   value: cl.wins,    color: GREEN },
                { label: 'GD',  value: cl.goalDiff > 0 ? `+${cl.goalDiff}` : cl.goalDiff, color: cl.goalDiff > 0 ? GREEN : cl.goalDiff < 0 ? RED : MUTED },
                { label: 'Pld', value: cl.played,  color: TEXT  },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: String(color) }}>{value}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── P4P tab ───────────────────────────────────────────────────────────────────

const P4P_ANIMS = `
  @keyframes p4pBarFill {
    from { width: 0%; }
    to   { width: var(--bar-w); }
  }
  @keyframes p4pFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes p4pGoldGlow {
    0%,100% { box-shadow: 0 0 0 3px ${GOLD}, 0 0 28px 6px rgba(245,158,11,0.45); }
    50%     { box-shadow: 0 0 0 3px #fcd34d, 0 0 44px 14px rgba(245,158,11,0.7); }
  }
  @keyframes p4pSilverGlow {
    0%,100% { box-shadow: 0 0 0 2.5px #94a3b8, 0 0 20px 5px rgba(148,163,184,0.38); }
    50%     { box-shadow: 0 0 0 2.5px #cbd5e1, 0 0 32px 10px rgba(148,163,184,0.56); }
  }
  @keyframes p4pBronzeGlow {
    0%,100% { box-shadow: 0 0 0 2.5px #cd7f32, 0 0 20px 5px rgba(205,127,50,0.38); }
    50%     { box-shadow: 0 0 0 2.5px #e8a04a, 0 0 32px 10px rgba(205,127,50,0.56); }
  }
  @keyframes p4pFloat {
    0%,100% { transform: translateY(0px); }
    50%     { transform: translateY(-6px); }
  }
  @keyframes p4pShimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
`

type P4PPillarRow = { icon: ReactNode; label: string; value: number; max: number; color: string }

const P4P_PILLARS: P4PPillarRow[] = [
  { icon: <Zap size={11} />,        label: 'Clutch',     max: 35, color: GOLD,      value: 0 },
  { icon: <TrendingUp size={11} />, label: 'Form',       max: 20, color: '#22c55e', value: 0 },
  { icon: <Flame size={11} />,      label: 'Dominance',  max: 20, color: '#ef4444', value: 0 },
  { icon: <Trophy size={11} />,     label: 'Legacy',     max: 15, color: PURPLE,    value: 0 },
  { icon: <Target size={11} />,     label: 'Attack',     max: 6,  color: '#f97316', value: 0 },
  { icon: <Shield size={11} />,     label: 'Resilience', max: 4,  color: ACCENT,    value: 0 },
]

function P4PScoreDial({ score, rank, size = 68 }: { score: number; rank: number; size?: number }) {
  const pct   = score / 100
  const r     = (size / 2) - 6
  const circ  = 2 * Math.PI * r
  const color = rank === 1 ? GOLD : rank === 2 ? SILVER : rank === 3 ? BRONZE : ACCENT

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 900, color, lineHeight: 1 }}>{score.toFixed(1)}</div>
        <div style={{ fontSize: size * 0.1, color: `${color}99`, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>P4P</div>
      </div>
    </div>
  )
}

function P4PPillarBars({ p4p }: { p4p: P4PRankedPlayer['p4p'] }) {
  const rows: P4PPillarRow[] = [
    { ...P4P_PILLARS[0], value: p4p.clutch     },
    { ...P4P_PILLARS[1], value: p4p.form       },
    { ...P4P_PILLARS[2], value: p4p.dominance  },
    { ...P4P_PILLARS[3], value: p4p.legacy     },
    { ...P4P_PILLARS[4], value: p4p.attack     },
    { ...P4P_PILLARS[5], value: p4p.resilience },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {rows.map((row, i) => (
        <div key={row.label} style={{
          display: 'grid',
          gridTemplateColumns: '16px 76px 1fr 30px',
          alignItems: 'center', gap: 5,
        }}>
          <span style={{ display: 'inline-flex', color: row.color }}>{row.icon}</span>
          <span style={{
            fontSize: 8, color: MUTED, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.07em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{row.label}</span>
          <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, background: row.color,
              boxShadow: `0 0 5px ${row.color}66`,
              ['--bar-w' as string]: `${Math.min(100, (row.value / row.max) * 100)}%`,
              animation: `p4pBarFill 0.9s ${0.06 * i}s ease both`,
            }} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, color: row.color, textAlign: 'right' }}>
            {row.value.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  )
}

function P4PTopCard({ player, rank, currentUserId }: { player: P4PRankedPlayer; rank: number; currentUserId: string }) {
  const isMe     = player.id === currentUserId
  const color    = rank === 1 ? GOLD : rank === 2 ? SILVER : BRONZE
  const glowAnim = rank === 1 ? 'p4pGoldGlow 2.5s ease-in-out infinite' : rank === 2 ? 'p4pSilverGlow 3s ease-in-out infinite' : 'p4pBronzeGlow 3s ease-in-out infinite'
  const medalIcon = rank === 1
    ? <Crown size={rank === 1 ? 16 : 14} style={{ color, filter: `drop-shadow(0 0 8px ${color}88)` }} />
    : <Medal size={14} style={{ color, filter: `drop-shadow(0 0 8px ${color}88)` }} />
  const rgb      = rank === 1 ? '245,158,11' : rank === 2 ? '148,163,184' : '205,127,50'
  const avSize   = rank === 1 ? 52 : 44
  const initials = player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(${rgb},0.08), rgba(${rgb},0.03))`,
      border: `1px solid rgba(${rgb},0.28)`,
      borderRadius: 16, padding: '16px',
      animation: 'p4pFadeUp 0.5s ease both',
    }}>
      {/* ── Header: avatar · name · dial ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {/* Avatar */}
        <div style={{
          width: avSize, height: avSize, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          animation: `${glowAnim}${rank === 1 ? ', p4pFloat 4s ease-in-out infinite' : ''}`,
        }}>
          {player.avatarUrl
            ? <img src={player.avatarUrl} alt={player.name} width={avSize} height={avSize}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <div style={{
                width: '100%', height: '100%',
                background: rank === 1 ? `linear-gradient(135deg,${GOLD},#ef4444)` : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)' : 'linear-gradient(135deg,#cd7f32,#92400e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: avSize * 0.36, fontWeight: 900, color: '#fff',
              }}>{initials}</div>
            )
          }
        </div>

        {/* Name + stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span style={{ display: 'inline-flex' }}>{medalIcon}</span>
            <Link href={`/players/${player.id}`} style={{
              fontSize: rank === 1 ? 15 : 13, fontWeight: 800,
              textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              ...(rank === 1 ? {
                background: 'linear-gradient(90deg,#f59e0b,#fcd34d,#f97316,#f59e0b)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                animation: 'p4pShimmer 3s linear infinite',
              } : { color }),
            }}>{player.name}</Link>
            {isMe && <span style={{ fontSize: 9, color: ACCENT, fontWeight: 600, flexShrink: 0 }}>you</span>}
          </div>
          <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5 }}>
            {player.wins}W · {player.matchesPlayed}G · {Math.round(player.p4p.confidence * 100)}% conf.
            {player.p4p.titles > 0 && (
              <span style={{ marginLeft: 5, color: PURPLE, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Trophy size={10} /> {player.p4p.titles}×
              </span>
            )}
          </div>
        </div>

        {/* Score dial — right side of header, no longer competing with bars */}
        <P4PScoreDial score={player.p4p.score} rank={rank} size={64} />
      </div>

      {/* ── Full-width pillar bars ── */}
      <P4PPillarBars p4p={player.p4p} />
    </div>
  )
}

const FORMULA_ROWS = [
  {
    icon: '⚡', label: 'Clutch', max: 35, color: GOLD,
    simple: 'Win rate × 35',
    detail: 'The most important factor. Win 100% of your games and you max this out. Lose half and you score 17.5.',
  },
  {
    icon: '📈', label: 'Form', max: 20, color: '#22c55e',
    simple: 'Points per game ÷ 3 × 20',
    detail: 'A win = 3 pts, draw = 1 pt, loss = 0. Divides by 3 (max PPG) to get a 0–20 score. Rewards consistency including draws.',
  },
  {
    icon: '💥', label: 'Dominance', max: 20, color: '#ef4444',
    simple: 'Avg goal diff per game (capped at ±3)',
    detail: '+3 GD/game or more = full 20 pts. 0 GD/game = 10 pts. −3 or worse = 0 pts. Punishes and rewards margins.',
  },
  {
    icon: '🏆', label: 'Legacy', max: 15, color: PURPLE,
    simple: '1st title = 10 pts, each extra +2.5, cap 15',
    detail: 'Championship belts won. First title is the hardest to earn so it\'s worth the most. Two titles maxes this out.',
  },
  {
    icon: '⚽', label: 'Attack', max: 6, color: '#f97316',
    simple: 'Goals scored per game ÷ 3 × 6',
    detail: '3+ goals per game = full 6 pts. Rewards pure offensive output above everything.',
  },
  {
    icon: '🛡', label: 'Resilience', max: 4, color: ACCENT,
    simple: '(1 − goals conceded per game ÷ 4) × 4',
    detail: 'Concede 0 = full 4 pts. Concede 4+ per game = 0 pts. Smallest pillar but keeps defense from being ignored.',
  },
]

function FormulaPanel() {
  return (
    <div style={{
      marginTop: 12,
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid rgba(245,158,11,0.2)`,
      borderRadius: 12, padding: '16px',
      animation: 'p4pFadeUp 0.3s ease both',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, marginBottom: 14, letterSpacing: '0.04em' }}>
        How P4P is calculated
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FORMULA_ROWS.map((row) => (
          <div key={row.label} style={{
            display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, alignItems: 'start',
          }}>
            <span style={{ fontSize: 14, marginTop: 1 }}>{row.icon}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: row.color }}>{row.label}</span>
                <span style={{ fontSize: 9, color: `${row.color}88`, fontWeight: 700 }}>max {row.max} pts</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 2, fontFamily: 'monospace' }}>
                {row.simple}
              </div>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{row.detail}</div>
            </div>
          </div>
        ))}

        {/* Confidence */}
        <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, alignItems: 'start' }}>
          <span style={{ fontSize: 14, marginTop: 1 }}>🎯</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: TEXT }}>Confidence multiplier</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 2, fontFamily: 'monospace' }}>
              0.30 + 0.70 × min(1, games ÷ 5)
            </div>
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
              1 game = 44% of your score. 5+ games = 100%. Stops a new player from topping the chart on a lucky first result.
              The full raw score is multiplied by this before display.
            </div>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 14, padding: '10px 12px',
        background: 'rgba(245,158,11,0.07)', borderRadius: 8,
        fontSize: 11, color: MUTED, lineHeight: 1.5,
      }}>
        <span style={{ color: GOLD, fontWeight: 700 }}>Final score = </span>
        (Clutch + Form + Dominance + Legacy + Attack + Resilience) × Confidence
        <br />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>Max possible score: 100.0</span>
      </div>
    </div>
  )
}

function P4PTab({ ranked, currentUserId }: { ranked: P4PRankedPlayer[]; currentUserId: string }) {
  const [showFormula, setShowFormula] = useState(false)

  if (!ranked.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>No players yet.</div>
  }

  const top3   = ranked.slice(0, 3)
  const rest   = ranked.slice(3)
  const myRank = ranked.findIndex((p) => p.id === currentUserId) + 1

  return (
    <div style={{ animation: 'p4pFadeUp 0.35s ease' }}>
      <style dangerouslySetInnerHTML={{ __html: P4P_ANIMS }} />

      {/* Header */}
      <div style={{
        marginBottom: 20, padding: '14px 18px',
        background: 'rgba(245,158,11,0.05)', border: `1px solid rgba(245,158,11,0.18)`,
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>⚡ P4P Rankings</div>
          <button
            onClick={() => setShowFormula((v) => !v)}
            style={{
              padding: '5px 12px', border: `1px solid rgba(245,158,11,0.35)`,
              borderRadius: 20, background: showFormula ? 'rgba(245,158,11,0.15)' : 'transparent',
              color: showFormula ? GOLD : MUTED, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.03em',
            }}
          >
            {showFormula ? '✕ Close' : '🧮 How it\'s calculated'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          UFC-style Pound-for-Pound rating. Wins matter most, but so does
          how you win, championship titles you&apos;ve earned, goals scored and conceded.
          New players start at reduced confidence until they have 5+ games.
        </div>
        {myRank > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: ACCENT, fontWeight: 700 }}>
            Your rank: #{myRank} · {ranked[myRank - 1]?.p4p.score.toFixed(1)} P4P
          </div>
        )}
        {showFormula && <FormulaPanel />}
      </div>

      {/* Top 3 featured cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
        {top3.map((p, i) => (
          <P4PTopCard key={p.id} player={p} rank={i + 1} currentUserId={currentUserId} />
        ))}
      </div>

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '32px 1fr 80px 100px',
            padding: '9px 14px', background: CARD2, borderBottom: `1px solid ${BORDER}`,
            fontSize: 10, fontWeight: 700, color: MUTED,
            textTransform: 'uppercase', letterSpacing: '0.07em', gap: 8,
          }}>
            <span>#</span>
            <span>Player</span>
            <span style={{ textAlign: 'center' }}>P4P Score</span>
            <span>Pillar breakdown</span>
          </div>

          {rest.map((p, i) => {
            const rank   = i + 4
            const isMe   = p.id === currentUserId
            // Mini stacked bar: 6 colored segments proportional to raw pillar contribution
            const rawPillars = [
              { v: p.p4p.clutch,     color: GOLD      },
              { v: p.p4p.form,       color: '#22c55e' },
              { v: p.p4p.dominance,  color: '#ef4444' },
              { v: p.p4p.legacy,     color: PURPLE    },
              { v: p.p4p.attack,     color: '#f97316' },
              { v: p.p4p.resilience, color: ACCENT    },
            ]
            const rawTotal = rawPillars.reduce((s, x) => s + x.v, 0) || 1

            return (
              <div key={p.id} className="lb-row" style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 80px 100px',
                padding: '10px 14px', gap: 8, alignItems: 'center',
                borderBottom: i < rest.length - 1 ? `1px solid ${BORDER}` : 'none',
                background: isMe ? 'rgba(59,130,246,0.07)' : CARD,
                transition: 'background 0.15s',
              }}>
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{rank}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar url={p.avatarUrl} name={p.name} size={28} isMe={isMe} />
                  <Link href={`/players/${p.id}`} style={{
                    fontSize: 13, fontWeight: 500, color: TEXT, textDecoration: 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                    {isMe && <span style={{ marginLeft: 4, fontSize: 9, color: ACCENT, fontWeight: 400 }}>you</span>}
                  </Link>
                  {p.p4p.titles > 0 && (
                    <span style={{ fontSize: 9, color: PURPLE, fontWeight: 700, flexShrink: 0 }}>🏆{p.p4p.titles}</span>
                  )}
                </div>

                <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 900, color: ACCENT }}>
                  {p.p4p.score.toFixed(1)}
                </div>

                {/* Stacked mini bar */}
                <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
                  {rawPillars.map((seg, si) => (
                    <div key={si} style={{
                      height: '100%', flex: seg.v / rawTotal,
                      background: seg.color, borderRadius: 99,
                    }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pillar legend */}
      <div style={{
        marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
      }}>
        {P4P_PILLARS.map((p) => (
          <div key={p.label} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, color: MUTED,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: p.color, flexShrink: 0 }} />
            <span style={{ display: 'inline-flex', color: p.color }}>{p.icon}</span> {p.label} <span style={{ color: 'rgba(255,255,255,0.2)' }}>/{p.max}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Compare tab ───────────────────────────────────────────────────────────────

const CMP_A = '#3b82f6'
const CMP_B = '#ef4444'

function HeroAvatar({ player, accentColor, glowAnim }: {
  player: NamedPlayerStats
  accentColor: string
  glowAnim: string
}) {
  const initials = player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 76, height: 76, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      border: `3px solid ${accentColor}`,
      animation: glowAnim,
    }}>
      {player.avatarUrl
        ? <img src={player.avatarUrl} alt={player.name} width={76} height={76}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (
          <div style={{
            width: '100%', height: '100%',
            background: accentColor === CMP_A
              ? `linear-gradient(135deg, ${CMP_A}, #7c3aed)`
              : `linear-gradient(135deg, ${CMP_B}, #b91c1c)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 900, color: '#fff',
          }}>
            {initials}
          </div>
        )
      }
    </div>
  )
}

function PlayerSlot({ player, side, isActive, isMe, onClick }: {
  player: NamedPlayerStats | null
  side: 'A' | 'B'
  isActive: boolean
  isMe: boolean
  onClick: () => void
}) {
  const accent = side === 'A' ? CMP_A : CMP_B
  return (
    <button onClick={onClick} style={{
      background: isActive
        ? `rgba(${side === 'A' ? '59,130,246' : '239,68,68'},0.12)`
        : player
        ? `rgba(${side === 'A' ? '59,130,246' : '239,68,68'},0.06)`
        : CARD2,
      border: `1.5px solid ${isActive ? accent : player ? accent + '55' : BORDER}`,
      borderRadius: 14, padding: '14px 10px',
      cursor: 'pointer', textAlign: 'center',
      transition: 'all 0.15s',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      minHeight: 116, width: '100%',
    }}>
      {player ? (
        <>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', overflow: 'hidden',
            border: `2.5px solid ${accent}`,
            boxShadow: `0 0 16px ${accent}55`,
            flexShrink: 0,
          }}>
            {player.avatarUrl
              ? <img src={player.avatarUrl} alt={player.name} width={60} height={60}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (
                <div style={{
                  width: '100%', height: '100%',
                  background: accent === CMP_A
                    ? `linear-gradient(135deg, ${CMP_A}, #7c3aed)`
                    : `linear-gradient(135deg, ${CMP_B}, #b91c1c)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 19, fontWeight: 900, color: '#fff',
                }}>
                  {player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )
            }
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: accent,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '100%', padding: '0 4px',
          }}>
            {player.name}
            {isMe && <span style={{ marginLeft: 4, fontSize: 9, color: MUTED, fontWeight: 400 }}>you</span>}
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>
            {player.wins}W · {Math.round(player.winRate * 100)}%
          </div>
          <div style={{ fontSize: 9, color: accent + 'aa', fontWeight: 600, letterSpacing: '0.03em' }}>
            tap to change
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            border: `2px dashed ${isActive ? accent : BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, color: isActive ? accent : MUTED,
          }}>
            {side}
          </div>
          <div style={{ fontSize: 11, color: isActive ? accent : MUTED, fontWeight: 600 }}>
            {isActive ? 'Selecting…' : `Pick Player ${side}`}
          </div>
        </>
      )}
    </button>
  )
}

function H2HCompareDisplay({ playerA, playerB, h2h, accentA, accentB }: {
  playerA: NamedPlayerStats
  playerB: NamedPlayerStats
  h2h: H2HRecord
  accentA: string
  accentB: string
}) {
  const { player1Wins: aWins, player2Wins: bWins, draws, totalMatches, player1Goals: aGoals, player2Goals: bGoals } = h2h
  const aPct = totalMatches > 0 ? Math.round((aWins / totalMatches) * 100) : 0
  const bPct = totalMatches > 0 ? Math.round((bWins / totalMatches) * 100) : 0
  const dPct = 100 - aPct - bPct

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: accentA, minWidth: 24, textAlign: 'right' }}>{aWins}</span>
        <div style={{ flex: 1, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex' }}>
          {aWins > 0 && (
            <div style={{ width: `${aPct}%`, background: accentA, borderRadius: aWins === totalMatches ? 99 : '99px 0 0 99px',
              transformOrigin: 'left', animation: 'cmpBarGrow 0.6s ease both' }} />
          )}
          {draws > 0 && (
            <div style={{ width: `${dPct}%`, background: MUTED + '66' }} />
          )}
          {bWins > 0 && (
            <div style={{ width: `${bPct}%`, background: accentB, borderRadius: bWins === totalMatches ? 99 : '0 99px 99px 0',
              transformOrigin: 'right', animation: 'cmpBarGrow 0.6s 0.1s ease both' }} />
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: accentB, minWidth: 24 }}>{bWins}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: playerA.name.split(' ')[0], value: aWins, sub: 'wins', color: accentA },
          { label: 'Draws', value: draws, sub: 'draws', color: MUTED },
          { label: playerB.name.split(' ')[0], value: bWins, sub: 'wins', color: accentB },
        ].map((item) => (
          <div key={item.label} style={{
            textAlign: 'center', background: 'rgba(255,255,255,0.03)',
            borderRadius: 10, padding: '10px 6px',
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{item.sub}</div>
            <div style={{
              fontSize: 9, color: item.color + 'aa', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: MUTED }}>
        <span style={{ color: accentA, fontWeight: 700 }}>{aGoals}</span>
        <span style={{ color: BORDER, margin: '0 6px' }}>–</span>
        <span style={{ color: accentB, fontWeight: 700 }}>{bGoals}</span>
        {' '}goals · {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
      </div>
    </div>
  )
}

type CmpStat = {
  label: string
  icon: string
  valueA: number
  valueB: number
  fmtA: string
  fmtB: string
  higherIsBetter: boolean
  countsForLeads: boolean
}

function ComparisonView({ playerA, playerB, h2h, h2hLoading, currentUserId }: {
  playerA: NamedPlayerStats
  playerB: NamedPlayerStats
  h2h: H2HRecord | null
  h2hLoading: boolean
  currentUserId: string
}) {
  const gpgA = playerA.matchesPlayed > 0 ? playerA.goalsFor / playerA.matchesPlayed : 0
  const gpgB = playerB.matchesPlayed > 0 ? playerB.goalsFor / playerB.matchesPlayed : 0
  const gapgA = playerA.matchesPlayed > 0 ? playerA.goalsAgainst / playerA.matchesPlayed : 0
  const gapgB = playerB.matchesPlayed > 0 ? playerB.goalsAgainst / playerB.matchesPlayed : 0
  const gdpgA = playerA.matchesPlayed > 0 ? playerA.goalDiff / playerA.matchesPlayed : 0
  const gdpgB = playerB.matchesPlayed > 0 ? playerB.goalDiff / playerB.matchesPlayed : 0

  const stats: CmpStat[] = [
    {
      label: 'Win Rate', icon: '🏅',
      valueA: playerA.winRate, valueB: playerB.winRate,
      fmtA: `${Math.round(playerA.winRate * 100)}%`,
      fmtB: `${Math.round(playerB.winRate * 100)}%`,
      higherIsBetter: true, countsForLeads: true,
    },
    {
      label: 'Wins', icon: '🥇',
      valueA: playerA.wins, valueB: playerB.wins,
      fmtA: String(playerA.wins), fmtB: String(playerB.wins),
      higherIsBetter: true, countsForLeads: false,
    },
    {
      label: 'Draws', icon: '⚖️',
      valueA: playerA.draws, valueB: playerB.draws,
      fmtA: String(playerA.draws), fmtB: String(playerB.draws),
      higherIsBetter: true, countsForLeads: false,
    },
    {
      label: 'Losses', icon: '📉',
      valueA: playerA.losses, valueB: playerB.losses,
      fmtA: String(playerA.losses), fmtB: String(playerB.losses),
      higherIsBetter: false, countsForLeads: false,
    },
    {
      label: 'Goals Scored', icon: '⚽',
      valueA: playerA.goalsFor, valueB: playerB.goalsFor,
      fmtA: String(playerA.goalsFor), fmtB: String(playerB.goalsFor),
      higherIsBetter: true, countsForLeads: false,
    },
    {
      label: 'Goals/Game', icon: '🎯',
      valueA: gpgA, valueB: gpgB,
      fmtA: playerA.matchesPlayed > 0 ? gpgA.toFixed(2) : '-',
      fmtB: playerB.matchesPlayed > 0 ? gpgB.toFixed(2) : '-',
      higherIsBetter: true, countsForLeads: true,
    },
    {
      label: 'Conceded', icon: '🚫',
      valueA: playerA.goalsAgainst, valueB: playerB.goalsAgainst,
      fmtA: String(playerA.goalsAgainst), fmtB: String(playerB.goalsAgainst),
      higherIsBetter: false, countsForLeads: false,
    },
    {
      label: 'GA/Game', icon: '🛡️',
      valueA: gapgA, valueB: gapgB,
      fmtA: playerA.matchesPlayed > 0 ? gapgA.toFixed(2) : '-',
      fmtB: playerB.matchesPlayed > 0 ? gapgB.toFixed(2) : '-',
      higherIsBetter: false, countsForLeads: true,
    },
    {
      label: 'Goal Diff', icon: '↕️',
      valueA: playerA.goalDiff, valueB: playerB.goalDiff,
      fmtA: playerA.goalDiff > 0 ? `+${playerA.goalDiff}` : String(playerA.goalDiff),
      fmtB: playerB.goalDiff > 0 ? `+${playerB.goalDiff}` : String(playerB.goalDiff),
      higherIsBetter: true, countsForLeads: false,
    },
    {
      label: 'GD/Game', icon: '📊',
      valueA: gdpgA, valueB: gdpgB,
      fmtA: playerA.matchesPlayed > 0 ? (gdpgA > 0 ? `+${gdpgA.toFixed(2)}` : gdpgA.toFixed(2)) : '-',
      fmtB: playerB.matchesPlayed > 0 ? (gdpgB > 0 ? `+${gdpgB.toFixed(2)}` : gdpgB.toFixed(2)) : '-',
      higherIsBetter: true, countsForLeads: true,
    },
    {
      label: 'Matches', icon: '🗓️',
      valueA: playerA.matchesPlayed, valueB: playerB.matchesPlayed,
      fmtA: String(playerA.matchesPlayed), fmtB: String(playerB.matchesPlayed),
      higherIsBetter: true, countsForLeads: false,
    },
  ]

  let aLeads = 0, bLeads = 0
  for (const s of stats) {
    if (!s.countsForLeads) continue
    const aWins = s.higherIsBetter ? s.valueA > s.valueB : s.valueA < s.valueB
    const bWins = s.higherIsBetter ? s.valueB > s.valueA : s.valueB < s.valueA
    if (aWins) aLeads++
    else if (bWins) bLeads++
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      {/* Hero header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '20px 12px',
        background: `linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(12,20,34,0) 50%, rgba(239,68,68,0.1) 100%)`,
        border: `1px solid ${BORDER}`, borderRadius: 16,
        marginBottom: 16, gap: 8,
      }}>
        {/* Player A */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'cmpSlideLeft 0.5s ease both' }}>
          <HeroAvatar player={playerA} accentColor={CMP_A} glowAnim="cmpGlowA 2.5s ease-in-out infinite" />
          <div style={{ fontSize: 13, fontWeight: 800, color: CMP_A, textAlign: 'center', lineHeight: 1.2 }}>
            {playerA.name}
            {playerA.id === currentUserId && (
              <span style={{ display: 'block', fontSize: 9, color: MUTED, fontWeight: 400, marginTop: 2 }}>you</span>
            )}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: aLeads > bLeads ? CMP_A : MUTED,
            background: aLeads > bLeads ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${aLeads > bLeads ? CMP_A + '44' : BORDER}`,
            borderRadius: 99, padding: '3px 10px',
          }}>
            {aLeads} leads
          </div>
        </div>

        {/* VS */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 900, letterSpacing: '0.05em',
            background: `linear-gradient(135deg, ${CMP_A}, ${CMP_B})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            VS
          </div>
          <div style={{ width: 1, height: 36, background: `linear-gradient(180deg, ${CMP_A}88, ${CMP_B}88)` }} />
        </div>

        {/* Player B */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'cmpSlideRight 0.5s ease both' }}>
          <HeroAvatar player={playerB} accentColor={CMP_B} glowAnim="cmpGlowB 2.5s ease-in-out infinite" />
          <div style={{ fontSize: 13, fontWeight: 800, color: CMP_B, textAlign: 'center', lineHeight: 1.2 }}>
            {playerB.name}
            {playerB.id === currentUserId && (
              <span style={{ display: 'block', fontSize: 9, color: MUTED, fontWeight: 400, marginTop: 2 }}>you</span>
            )}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: bLeads > aLeads ? CMP_B : MUTED,
            background: bLeads > aLeads ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${bLeads > aLeads ? CMP_B + '44' : BORDER}`,
            borderRadius: 99, padding: '3px 10px',
          }}>
            {bLeads} leads
          </div>
        </div>
      </div>

      {/* Stat rows */}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        {stats.map((s, i) => {
          const aWins = s.higherIsBetter ? s.valueA > s.valueB : s.valueA < s.valueB
          const bWins = s.higherIsBetter ? s.valueB > s.valueA : s.valueB < s.valueA
          const tied  = s.valueA === s.valueB

          const maxAbs = Math.max(Math.abs(s.valueA), Math.abs(s.valueB), 0.001)
          const barPctA = Math.min(100, (Math.abs(s.valueA) / maxAbs) * 100)
          const barPctB = Math.min(100, (Math.abs(s.valueB) / maxAbs) * 100)

          return (
            <div key={s.label} style={{
              display: 'grid', gridTemplateColumns: '1fr 104px 1fr',
              padding: '10px 12px',
              background: aWins ? 'rgba(59,130,246,0.045)' : bWins ? 'rgba(239,68,68,0.045)' : CARD,
              borderBottom: i < stats.length - 1 ? `1px solid ${BORDER}` : 'none',
              alignItems: 'center', gap: 6,
            }}>
              {/* A value */}
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 0 }}>
                <span style={{
                  fontSize: 15, fontWeight: aWins ? 800 : 500,
                  color: aWins ? CMP_A : tied ? MUTED : TEXT,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.fmtA}
                </span>
                {aWins && <span style={{ fontSize: 9, color: CMP_A, flexShrink: 0 }}>▲</span>}
              </div>

              {/* Center label + bar */}
              <div style={{ textAlign: 'center', minWidth: 0 }}>
                <div style={{ fontSize: 13, marginBottom: 2, lineHeight: 1 }}>{s.icon}</div>
                <div style={{ fontSize: 8, color: MUTED, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, wordBreak: 'break-word' }}>
                  {s.label}
                </div>
                <div style={{ display: 'flex', height: 4, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  {!tied ? (
                    <>
                      <div style={{
                        width: `${barPctA / 2}%`, height: '100%',
                        background: aWins ? CMP_A : 'rgba(255,255,255,0.12)',
                        borderRadius: '99px 0 0 99px', marginLeft: 'auto',
                      }} />
                      <div style={{ width: 1, background: BORDER, flexShrink: 0 }} />
                      <div style={{
                        width: `${barPctB / 2}%`, height: '100%',
                        background: bWins ? CMP_B : 'rgba(255,255,255,0.12)',
                        borderRadius: '0 99px 99px 0',
                      }} />
                    </>
                  ) : (
                    <div style={{ flex: 1, background: GOLD + '44', borderRadius: 99 }} />
                  )}
                </div>
              </div>

              {/* B value */}
              <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {bWins && <span style={{ fontSize: 9, color: CMP_B, flexShrink: 0 }}>▲</span>}
                <span style={{
                  fontSize: 15, fontWeight: bWins ? 800 : 500,
                  color: bWins ? CMP_B : tied ? MUTED : TEXT,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.fmtB}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* H2H section */}
      <div style={{
        background: CARD2, border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: '14px 16px',
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ⚔️ Head-to-Head Record
        </div>
        {h2hLoading ? (
          <div style={{ textAlign: 'center', padding: '14px', color: MUTED, fontSize: 13 }}>Loading…</div>
        ) : h2h && h2h.totalMatches > 0 ? (
          <H2HCompareDisplay playerA={playerA} playerB={playerB} h2h={h2h} accentA={CMP_A} accentB={CMP_B} />
        ) : (
          <div style={{ textAlign: 'center', padding: '14px', color: MUTED, fontSize: 12 }}>
            No matches between these players yet.
          </div>
        )}
      </div>
    </div>
  )
}

function CompareTab({ players, currentUserId }: { players: NamedPlayerStats[]; currentUserId: string }) {
  const [playerA, setPlayerA] = useState<NamedPlayerStats | null>(null)
  const [playerB, setPlayerB] = useState<NamedPlayerStats | null>(null)
  const [pickingFor, setPickingFor] = useState<'A' | 'B' | null>('A')
  const [search, setSearch] = useState('')
  const [h2h, setH2H] = useState<H2HRecord | null>(null)
  const [h2hLoading, setH2HLoading] = useState(false)
  const [, startTransition] = useTransition()

  const filteredPlayers = useMemo(() => {
    const exclude = pickingFor === 'A' ? playerB?.id : playerA?.id
    return players
      .filter((p) => !exclude || p.id !== exclude)
      .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
  }, [players, search, pickingFor, playerA?.id, playerB?.id])

  function fetchH2H(a: NamedPlayerStats, b: NamedPlayerStats) {
    setH2HLoading(true)
    setH2H(null)
    startTransition(async () => {
      const data = await fetchH2HAction(a.id, b.id)
      setH2H(data)
      setH2HLoading(false)
    })
  }

  function pickPlayer(p: NamedPlayerStats) {
    if (pickingFor === 'A') {
      setPlayerA(p)
      if (playerB) fetchH2H(p, playerB)
      setPickingFor(playerB ? null : 'B')
    } else if (pickingFor === 'B') {
      setPlayerB(p)
      if (playerA) fetchH2H(playerA, p)
      setPickingFor(null)
    }
    setSearch('')
  }

  function openPicker(side: 'A' | 'B') {
    setPickingFor((prev) => prev === side ? null : side)
    setSearch('')
  }

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease' }}>
      {/* Selector row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 1fr', gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
        <PlayerSlot
          player={playerA} side="A" isActive={pickingFor === 'A'}
          isMe={playerA?.id === currentUserId} onClick={() => openPicker('A')}
        />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 900, letterSpacing: '0.05em',
          background: `linear-gradient(135deg, ${CMP_A}, ${CMP_B})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          VS
        </div>
        <PlayerSlot
          player={playerB} side="B" isActive={pickingFor === 'B'}
          isMe={playerB?.id === currentUserId} onClick={() => openPicker('B')}
        />
      </div>

      {/* Picker panel */}
      {pickingFor !== null && (
        <div style={{
          background: CARD2,
          border: `1px solid ${pickingFor === 'A' ? CMP_A + '55' : CMP_B + '55'}`,
          borderRadius: 12, overflow: 'hidden', marginBottom: 14,
          animation: 'fadeInUp 0.2s ease',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              color: pickingFor === 'A' ? CMP_A : CMP_B, marginBottom: 8,
            }}>
              Select Player {pickingFor}
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${BORDER}`,
                borderRadius: 8, color: TEXT, fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filteredPlayers.map((p) => {
              const isSelected = (pickingFor === 'A' ? playerA?.id : playerB?.id) === p.id
              const accent = pickingFor === 'A' ? CMP_A : CMP_B
              return (
                <button
                  key={p.id}
                  onClick={() => pickPlayer(p)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: isSelected ? `rgba(${pickingFor === 'A' ? '59,130,246' : '239,68,68'},0.12)` : 'transparent',
                    border: 'none', borderBottom: `1px solid ${BORDER}`,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                >
                  <Avatar url={p.avatarUrl} name={p.name} size={36} isMe={p.id === currentUserId} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: isSelected ? accent : TEXT,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                      {p.id === currentUserId && <span style={{ marginLeft: 5, fontSize: 10, color: ACCENT }}>you</span>}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED }}>
                      {p.wins}W · {p.draws}D · {p.losses}L · {Math.round(p.winRate * 100)}% WR
                    </div>
                  </div>
                  {isSelected && <span style={{ fontSize: 14, color: accent, flexShrink: 0 }}>✓</span>}
                </button>
              )
            })}
            {filteredPlayers.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 13 }}>No players found.</div>
            )}
          </div>
        </div>
      )}

      {/* Comparison view */}
      {playerA && playerB && pickingFor === null && (
        <ComparisonView
          playerA={playerA} playerB={playerB}
          h2h={h2h} h2hLoading={h2hLoading}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}

// ─── Tabs config ───────────────────────────────────────────────────────────────

function SI({ children }: { children: ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: '-2px', flexShrink: 0 }}>
      {children}
    </svg>
  )
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'overall',       label: 'Overall',     icon: <SI><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></SI> },
  { id: 'compare',       label: 'Compare',     icon: <SI><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/><line x1="12" y1="8" x2="12" y2="16"/></SI> },
  { id: 'p4p',           label: 'P4P',         icon: <SI><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></SI> },
  { id: 'scorers',       label: 'Scorers',     icon: <SI><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></SI> },
  { id: 'active',        label: 'Most Active', icon: <SI><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></SI> },
  { id: 'rivalry',       label: 'Rivalries',   icon: <SI><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="3" y2="21"/></SI> },
  { id: 'championships', label: 'Seasons',     icon: <SI><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></SI> },
  { id: 'insights',      label: 'Insights',    icon: <SI><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></SI> },
]

// ─── Root component ────────────────────────────────────────────────────────────

export function LeaderboardClient({ players, rivalryWinners, championshipLeaders, p4pRanked, lastChampionshipPodium, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>('overall')

  const [overallSort, setOverallSort] = useState<SortKey>('wins')
  const [overallAsc,  setOverallAsc]  = useState(false)
  const [scorersSort, setScorersSort] = useState<SortKey>('goalsFor')
  const [scorersAsc,  setScorersAsc]  = useState(false)
  const [activeSort,  setActiveSort]  = useState<SortKey>('matchesPlayed')
  const [activeAsc,   setActiveAsc]   = useState(false)

  const myPlayer = useMemo(() => players.find((p) => p.id === currentUserId) ?? null, [players, currentUserId])

  const myRank = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.wins - a.wins || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
    const idx = sorted.findIndex((p) => p.id === currentUserId)
    return idx >= 0 ? idx + 1 : 0
  }, [players, currentUserId])

  return (
    <div style={{
      minHeight: '100svh', background: BG,
      fontFamily: 'system-ui,-apple-system,sans-serif',
      color: TEXT, padding: '32px 16px 72px',
    }}>
      <style dangerouslySetInnerHTML={{ __html: ANIMS }} />

      <div style={{ maxWidth: 840, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            iSport FC
          </div>
          <h1 style={{
            margin: '0 0 6px', fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em',
            background: `linear-gradient(90deg, ${GOLD}, #f97316, ${GOLD})`,
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'shimmerBg 3s linear infinite',
          }}>
            🏆 Leaderboard
          </h1>
          <div style={{ fontSize: 13, color: MUTED }}>
            {players.length} player{players.length !== 1 ? 's' : ''} · all-time stats
          </div>
        </div>

        {/* ── Personal stats card ── */}
        {myPlayer && myRank > 0 && (
          <MyStatsCard player={myPlayer} rank={myRank} total={players.length} players={players} />
        )}

        {/* ── Podium (overall tab only) ── */}
        {tab === 'overall' && lastChampionshipPodium.length >= 2 && (
          <PodiumSection entries={lastChampionshipPodium} currentUserId={currentUserId} />
        )}

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 22,
          borderBottom: `1px solid ${BORDER}`, overflowX: 'auto',
        }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: tab === t.id ? ACCENT : MUTED,
              borderBottom: `2px solid ${tab === t.id ? ACCENT : 'transparent'}`,
              marginBottom: -1, flexShrink: 0, whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {tab === 'overall' && (
          <PlayerTable rows={players} mode="overall"
            sortKey={overallSort} setSortKey={setOverallSort}
            sortAsc={overallAsc} setSortAsc={setOverallAsc}
            currentUserId={currentUserId} />
        )}
        {tab === 'scorers' && (
          <PlayerTable rows={players} mode="scorers"
            sortKey={scorersSort} setSortKey={setScorersSort}
            sortAsc={scorersAsc} setSortAsc={setScorersAsc}
            currentUserId={currentUserId} />
        )}
        {tab === 'active' && (
          <PlayerTable rows={players} mode="active"
            sortKey={activeSort} setSortKey={setActiveSort}
            sortAsc={activeAsc} setSortAsc={setActiveAsc}
            currentUserId={currentUserId} />
        )}
        {tab === 'p4p' && (
          <P4PTab ranked={p4pRanked} currentUserId={currentUserId} />
        )}
        {tab === 'rivalry' && (
          <RivalryWinnersTab winners={rivalryWinners} currentUserId={currentUserId} />
        )}
        {tab === 'championships' && (
          <ChampionshipsTab leaders={championshipLeaders} />
        )}
        {tab === 'insights' && (
          <InsightsTab players={players} currentUserId={currentUserId} />
        )}
        {tab === 'compare' && (
          <CompareTab players={players} currentUserId={currentUserId} />
        )}

      </div>
      <BottomNav userId={currentUserId} />
    </div>
  )
}
