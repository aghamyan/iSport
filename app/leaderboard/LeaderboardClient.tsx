'use client'

import { useState, useMemo, useTransition, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { Trophy, Medal, Flame, Zap, TrendingUp, Shield, Target, BarChart3, Award, Activity, Sparkles, Waves, Users, Building2, Star, Gamepad2, Calculator, ChevronDown } from 'lucide-react'
import type { NamedPlayerStats, RivalryWinner, ChampionshipLeader, LastChampionshipPodiumEntry, H2HRecord } from '@/lib/stats/types'
import type { P4PRankedPlayer } from '@/lib/stats/p4p'
import { fetchH2HAction } from '@/app/players/actions'
import { useTranslation } from '@/lib/i18n/context'

type Tab = 'overall' | 'scorers' | 'active' | 'rivalry' | 'championships' | 'insights' | 'p4p' | 'compare' | 'roster'
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
const BG     = 'var(--bg)'
const CARD   = 'var(--card)'
const CARD2  = 'var(--card2)'
const BORDER = 'var(--border)'
const ACCENT = 'var(--accent)'
const GOLD   = 'var(--gold)'
const SILVER = '#64748B'
const BRONZE = '#92400E'
const TEXT   = 'var(--text)'
const MUTED  = 'var(--muted)'
const GREEN  = 'var(--win)'
const RED    = '#DC2626'
const PURPLE = '#7C3AED'

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
    0%,100% { box-shadow: 0 0 0 2px #DC2626, 0 0 12px rgba(220,38,38,0.35); }
    50%      { box-shadow: 0 0 0 2px #DC2626, 0 0 20px rgba(220,38,38,0.55); }
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
  .lb-row:hover { background: rgba(220,38,38,0.05) !important; }
  @media (max-width: 520px) {
    .lb-table-header, .lb-row {
      grid-template-columns: 28px 1fr 30px 30px 30px 46px 62px !important;
    }
    .lb-cell-d, .lb-cell-viscol2 { display: none !important; }
  }
  @keyframes cmpSlideLeft {
    from { opacity: 0; transform: translateX(-24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes cmpSlideRight {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes cmpGlowA {
    0%,100% { box-shadow: 0 0 0 3px #DC2626, 0 0 22px rgba(220,38,38,0.35); }
    50%     { box-shadow: 0 0 0 3px #DC2626, 0 0 36px rgba(220,38,38,0.55); }
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
    return (
      <div style={{ ...base, width: size, height: size, background: 'var(--card)', overflow: 'hidden' }}>
        <img src={url} alt={name} width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
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

function WinBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const color = pct >= 60 ? GREEN : pct >= 40 ? GOLD : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(var(--rgb-overlay),0.04)', borderRadius: 99, overflow: 'hidden', minWidth: 16 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 26, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ─── Podium ────────────────────────────────────────────────────────────────────

function PodiumSection({ entries, currentUserId }: { entries: LastChampionshipPodiumEntry[]; currentUserId: string }) {
  const { t } = useTranslation()
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
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
          {t('lb.podium.lastChamp')} <span style={{ color: GOLD }}>{championshipName}</span>
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
          const cardW   = isMobile ? (isFirst ? 108 : 88) : (isFirst ? 160 : 132)
          const stepH   = isFirst ? (isMobile ? 50 : 80) : rank === 2 ? (isMobile ? 36 : 58) : (isMobile ? 26 : 42)
          const avSize  = isMobile ? (isFirst ? 52 : 40) : (isFirst ? 72 : 56)
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
                fontSize: isMobile ? (isFirst ? 11 : 10) : (isFirst ? 14 : 12), fontWeight: 700,
                color: RANK_COLORS[ri], textDecoration: 'none',
                textAlign: 'center', maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 2,
              }}>
                {entry.playerName}
                {isMe && <span style={{ marginLeft: 4, fontSize: 9, color: MUTED, fontWeight: 400 }}>{t('common.youSmall')}</span>}
              </Link>

              <div style={{ fontSize: isMobile ? (isFirst ? 20 : 16) : (isFirst ? 28 : 20), fontWeight: 900, color: RANK_COLORS[ri], lineHeight: 1 }}>
                {entry.points}
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 8 }}>{t('common.pts')}</div>

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
  const { t } = useTranslation()
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
      background: 'linear-gradient(135deg,rgba(220,38,38,0.06),rgba(139,92,246,0.08))',
      border: `1px solid rgba(220,38,38,0.2)`,
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
            {' '}{t('lb.ofPlayers', { n: total })}
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
            label: t('lb.myStats.winRate'),
            value: `${Math.round(player.winRate * 100)}%`,
            sub: player.winRate > leagueAvgWR
              ? t('lb.myStats.aboveAvg', { n: ((player.winRate - leagueAvgWR) * 100).toFixed(1) })
              : t('lb.myStats.belowAvg', { n: ((leagueAvgWR - player.winRate) * 100).toFixed(1) }),
            color: player.winRate >= 0.6 ? GREEN : player.winRate >= 0.4 ? GOLD : RED,
          },
          {
            label: t('lb.myStats.goalsPerGame'),
            value: myGPG.toFixed(2),
            sub: scorerRank > 0 ? t('lb.myStats.scorerRank', { n: scorerRank }) : t('lb.myStats.scoringRate'),
            color: GOLD,
          },
          {
            label: t('lb.myStats.gaPerGame'),
            value: myAvgGA.toFixed(2),
            sub: defRank > 0 ? t('lb.myStats.defRank', { n: defRank }) : t('lb.myStats.concedingRate'),
            color: myAvgGA <= 1.5 ? GREEN : myAvgGA <= 2.5 ? GOLD : RED,
          },
          {
            label: t('lb.myStats.handicap'),
            value: myHCP > 0 ? `+${myHCP.toFixed(2)}` : myHCP.toFixed(2),
            sub: t('lb.myStats.avgGdPerGame'),
            color: myHCP > 0 ? GREEN : myHCP < 0 ? RED : MUTED,
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{
            background: 'rgba(var(--rgb-overlay),0.025)', borderRadius: 10,
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
  const { t } = useTranslation()
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
        icon: <Award size={22} />, title: t('lb.insights.goldenBoot'), sub: t('lb.insights.goldenBootSub'),
        player: p1, value: p1 ? `${p1.goalsFor} goals` : '-',
        color: GOLD, faint: 'rgba(245,158,11,0.08)',
      },
      {
        icon: <Target size={22} />, title: t('lb.insights.sharpShooter'), sub: t('lb.insights.sharpShooterSub'),
        player: p2, value: p2 ? `${(p2.goalsFor / p2.matchesPlayed).toFixed(2)}/game` : '-',
        color: '#f97316', faint: 'rgba(249,115,22,0.08)',
      },
      {
        icon: <Shield size={22} />, title: t('lb.insights.ironWall'), sub: t('lb.insights.ironWallSub'),
        player: p3, value: p3 ? `${(p3.goalsAgainst / p3.matchesPlayed).toFixed(2)} GA/g` : '-',
        color: ACCENT, faint: 'rgba(220,38,38,0.06)',
      },
      {
        icon: <Activity size={22} />, title: t('lb.insights.workhorse'), sub: t('lb.insights.workhorseSub'),
        player: p4, value: p4 ? `${p4.matchesPlayed} games` : '-',
        color: '#ec4899', faint: 'rgba(236,72,153,0.08)',
      },
      {
        icon: <BarChart3 size={22} />, title: t('lb.insights.mrConsistent'), sub: t('lb.insights.mrConsistentSub'),
        player: p5, value: p5 ? `${Math.round(p5.winRate * 100)}%` : '-',
        color: GREEN, faint: 'rgba(34,197,94,0.08)',
      },
      {
        icon: <Zap size={22} />, title: t('lb.insights.dominator'), sub: t('lb.insights.dominatorSub'),
        player: p6,
        value: p6
          ? `${p6.goalDiff >= 0 ? '+' : ''}${(p6.goalDiff / p6.matchesPlayed).toFixed(2)}/game`
          : '-',
        color: PURPLE, faint: 'rgba(167,139,250,0.08)',
      },
      {
        icon: <Sparkles size={22} />, title: t('lb.insights.highDrama'), sub: t('lb.insights.highDramaSub'),
        player: p7,
        value: p7 ? `${((p7.goalsFor + p7.goalsAgainst) / p7.matchesPlayed).toFixed(2)}/game` : '-',
        color: '#f43f5e', faint: 'rgba(244,63,94,0.08)',
      },
      {
        icon: <Waves size={22} />, title: t('lb.insights.underdog'), sub: t('lb.insights.underdogSub'),
        player: p8,
        value: p8 ? `${(p8.goalDiff / p8.matchesPlayed).toFixed(2)}/game` : '-',
        color: MUTED, faint: 'rgba(107,114,128,0.08)',
      },
    ]
  }, [players, t])

  const totalGoals = useMemo(() => players.reduce((s, p) => s + p.goalsFor, 0), [players])

  const totalMatches = useMemo(
    () => Math.round(players.reduce((s, p) => s + p.matchesPlayed, 0) / 2),
    [players],
  )

  const avgGoalsPerMatch = useMemo(() => {
    return totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0'
  }, [totalGoals, totalMatches])

  if (!players.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>{t('lb.noData')}</div>
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
          { icon: <Zap size={24} style={{ color: GOLD }} />,         label: t('lb.insights.totalGoals'),    value: totalGoals.toString()      },
          { icon: <Building2 size={24} style={{ color: ACCENT }} />, label: t('lb.insights.totalMatches'),  value: totalMatches.toString()    },
          { icon: <BarChart3 size={24} style={{ color: GREEN }} />,  label: t('lb.insights.goalsPerMatch'), value: avgGoalsPerMatch           },
          { icon: <Users size={24} style={{ color: PURPLE }} />,     label: t('lb.insights.players'),       value: players.length.toString()  },
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
                      <span style={{ marginLeft: 4, fontSize: 10, color: ACCENT, fontWeight: 400 }}>{t('common.youSmall')}</span>
                    )}
                  </Link>
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 800, color: card.color,
                  background: 'rgba(var(--rgb-overlay),0.03)', borderRadius: 6,
                  padding: '5px 10px', display: 'inline-block',
                }}>
                  {card.value}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: MUTED }}>{t('common.noData')}</div>
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
      background: active ? 'rgba(220,38,38,0.08)' : CARD2,
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
  const { t } = useTranslation()
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
      <button disabled={page === 0} onClick={() => onChange(page - 1)} style={{
        padding: '6px 12px', border: `1px solid ${BORDER}`, borderRadius: 6,
        background: CARD2, cursor: page === 0 ? 'default' : 'pointer',
        color: page === 0 ? BORDER : TEXT, fontSize: 12, opacity: page === 0 ? 0.4 : 1,
      }}>{t('common.prev')}</button>
      <span style={{ fontSize: 12, color: MUTED }}>{t('common.page', { n: page + 1, total: pages })}</span>
      <button disabled={page >= pages - 1} onClick={() => onChange(page + 1)} style={{
        padding: '6px 12px', border: `1px solid ${BORDER}`, borderRadius: 6,
        background: CARD2, cursor: page >= pages - 1 ? 'default' : 'pointer',
        color: page >= pages - 1 ? BORDER : TEXT, fontSize: 12, opacity: page >= pages - 1 ? 0.4 : 1,
      }}>{t('common.next')}</button>
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
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const visCols = VIS_COLS[mode]

  const SORT_OPTS: Record<TableMode, Array<{ key: SortKey; label: string }>> = {
    overall: [
      { key: 'wins',        label: t('lb.sort.wins')        },
      { key: 'goalDiff',    label: t('lb.sort.goalDiff')    },
      { key: 'winRate',     label: t('lb.sort.winRate')     },
      { key: 'goalsFor',    label: t('lb.sort.goals')       },
      { key: 'avgGoals',    label: t('lb.sort.goalsPerGame') },
    ],
    scorers: [
      { key: 'goalsFor',      label: t('lb.sort.goals')       },
      { key: 'avgGoals',      label: t('lb.sort.goalsPerGame') },
      { key: 'matchesPlayed', label: t('lb.sort.matches')     },
    ],
    active: [
      { key: 'matchesPlayed', label: t('lb.sort.matches')     },
      { key: 'wins',          label: t('lb.sort.wins')        },
      { key: 'goalsFor',      label: t('lb.sort.goals')       },
    ],
  }

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
        <span style={{ fontSize: 11, color: MUTED }}>{t('lb.sort.label')}</span>
        {SORT_OPTS[mode].map((opt) => (
          <SortBtn key={opt.key} label={opt.label}
            active={sortKey === opt.key} asc={sortAsc}
            onClick={() => handleSort(opt.key)} />
        ))}
      </div>

      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div className="lb-table-header" style={{
          display: 'grid', gridTemplateColumns: GRID,
          padding: '9px 14px', background: CARD2,
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 10, fontWeight: 700, color: MUTED,
          textTransform: 'uppercase', letterSpacing: '0.07em', gap: 4,
        }}>
          <span>#</span>
          <span>{t('lb.table.player')}</span>
          <span style={{ textAlign: 'center' }}>MP</span>
          <span style={{ textAlign: 'center', color: GREEN }}>W</span>
          <span className="lb-cell-d" style={{ textAlign: 'center' }}>D</span>
          <span style={{ textAlign: 'center', color: RED }}>L</span>
          {visCols.map((c, idx) => (
            <span key={c.key} className={idx === 1 ? 'lb-cell-viscol2' : undefined} style={{ textAlign: 'center' }}>{c.header}</span>
          ))}
          <span>{t('lb.table.winPct')}</span>
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
            : isMe ? 'rgba(220,38,38,0.05)'
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
                  {isMe && <span style={{ marginLeft: 5, fontSize: 10, color: ACCENT, fontWeight: 400 }}>{t('common.youSmall')}</span>}
                </Link>
              </div>

              {/* MP W D L */}
              <div style={{ textAlign: 'center', color: MUTED, fontSize: 12 }}>{row.matchesPlayed}</div>
              <div style={{ textAlign: 'center', color: GREEN, fontWeight: 700 }}>{row.wins}</div>
              <div className="lb-cell-d" style={{ textAlign: 'center', color: MUTED }}>{row.draws}</div>
              <div style={{ textAlign: 'center', color: RED }}>{row.losses}</div>

              {/* Dynamic visible columns */}
              {visCols.map((col, idx) => {
                const num = getVal(row, col.key)
                let color = TEXT
                if (col.key === 'avgGoals' || col.key === 'goalsFor') color = GOLD
                if (col.key === 'goalsAgainst') color = `${RED}99` as string
                if (col.key === 'avgGoalDiff' || col.key === 'goalDiff') {
                  color = num > 0 ? GREEN : num < 0 ? RED : MUTED
                }
                return (
                  <div key={col.key} className={idx === 1 ? 'lb-cell-viscol2' : undefined} style={{ textAlign: 'center', fontWeight: 700, color, fontSize: 12 }}>
                    {fmtVal(row, col.key)}
                  </div>
                )
              })}

              {/* Win rate bar */}
              <WinBar rate={row.winRate} />
            </div>
          )
        })}

        {paged.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: MUTED, fontSize: 13 }}>{t('lb.noData')}</div>
        )}
      </div>

      <Pagination page={page} total={sorted.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  )
}

// ─── Rivalry Winners tab ───────────────────────────────────────────────────────

function RivalryWinnersTab({ winners, currentUserId }: { winners: RivalryWinner[]; currentUserId: string }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const paged = winners.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (!winners.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>{t('lb.noRivalryBadges')}</div>
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
          <span>#</span><span>{t('lb.table.player')}</span>
          <span style={{ textAlign: 'center' }}>{t('lb.table.rivalriesWon')}</span>
        </div>

        {paged.map((w, i) => {
          const rank   = page * PAGE_SIZE + i + 1
          const isMe   = w.playerId === currentUserId
          const isTop3 = rank <= 3
          const ri     = rank - 1
          const rowBg  = rank === 1 ? `rgba(${RANK_RGBS[0]},0.07)` : isMe ? 'rgba(220,38,38,0.05)' : CARD
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
                  {isMe && <span style={{ marginLeft: 4, fontSize: 10, color: ACCENT, fontWeight: 400 }}>{t('common.youSmall')}</span>}
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
  const { t } = useTranslation()
  if (!leaders.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>{t('lb.noChampionships')}</div>
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
                background: cl.isActive ? 'rgba(220,38,38,0.1)' : 'rgba(var(--rgb-overlay),0.03)',
                color: cl.isActive ? ACCENT : MUTED,
                border: `1px solid ${cl.isActive ? ACCENT + '44' : BORDER}`,
              }}>
                {cl.isActive ? t('common.active') : t('common.completed')}
              </span>
            </div>
            <Link href={`/championships/${cl.championshipId}`} style={{ fontSize: 11, color: ACCENT, textDecoration: 'none' }}>
              {t('lb.champTab.view')}
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
                {cl.isActive ? t('lb.champTab.currentLeader') : t('lb.champTab.champion')}
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
//
// Design: a validated 8-color categorical palette (checked with the data-viz
// skill's CVD/contrast/chroma validator against both theme surfaces) identifies
// each pillar consistently everywhere it appears. The per-row/per-card default
// is a single calm accent meter + key numbers; the full 8-pillar rainbow only
// appears in the expandable detail, where there's room and every segment is
// labeled — never as ambient decoration. No infinite pulse/glow/shimmer.

const P4P_ANIMS = `
  @keyframes p4pBarFill {
    from { width: 0%; }
    to   { width: var(--bar-w); }
  }
  @keyframes p4pFadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes p4pDetailOpen {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .p4p-expand-btn:hover { border-color: ${ACCENT} !important; color: ${ACCENT} !important; }
  .p4p-row:hover { background: rgba(var(--rgb-overlay),0.02); }
`

// Fixed categorical palette, one hex per pillar, ordered by pillar weight
// (winQuality highest -> defense lowest). Validated with the data-viz skill's
// validate_palette.js against this app's light (#FFFFFF) and dark (#111827)
// card surfaces: lightness band, chroma floor, adjacent-pair CVD separation
// (worst case ΔE 16.0) and contrast all PASS in both themes with these exact
// hex values — no separate light/dark variants needed. Legacy reuses the
// app's --gold brand token (trophy semantics already mean "legacy" everywhere
// else in the UI); Dominance reuses the app's --win green for the same reason.
const PILLAR_COLOR = {
  winQuality:         '#2563EB',
  legacy:             '#D97706',
  experience:         '#0D9488',
  strengthOfSchedule: '#7C3AED',
  recentForm:         '#DB2777',
  goalDominance:       '#16A34A',
  attack:             '#EA580C',
  defense:            '#0891B2',
} as const

// All bars share one 0–30 scale (winQuality's max) so a bar's length is
// directly comparable across pillars — how much of the final score each
// pillar actually contributed — rather than 8 independently-scaled "fullness"
// bars that look equally full regardless of point value.
const PILLAR_COMMON_SCALE = 30

type PillarKey = keyof typeof PILLAR_COLOR

function usePillarMeta(t: (k: string) => string): Array<{ key: PillarKey; label: string; max: number; color: string; icon: ReactNode }> {
  return [
    { key: 'winQuality',         label: t('lb.p4p.pillar.winQuality'), max: 30, color: PILLAR_COLOR.winQuality,         icon: <Zap size={12} /> },
    { key: 'legacy',             label: t('lb.p4p.pillar.legacy'),     max: 20, color: PILLAR_COLOR.legacy,             icon: <Trophy size={12} /> },
    { key: 'experience',         label: t('lb.p4p.pillar.experience'), max: 10, color: PILLAR_COLOR.experience,         icon: <Activity size={12} /> },
    { key: 'strengthOfSchedule', label: t('lb.p4p.pillar.sos'),        max: 10, color: PILLAR_COLOR.strengthOfSchedule, icon: <Star size={12} /> },
    { key: 'recentForm',         label: t('lb.p4p.pillar.recentForm'), max: 10, color: PILLAR_COLOR.recentForm,         icon: <TrendingUp size={12} /> },
    { key: 'goalDominance',      label: t('lb.p4p.pillar.dominance'),  max: 10, color: PILLAR_COLOR.goalDominance,      icon: <Flame size={12} /> },
    { key: 'attack',             label: t('lb.p4p.pillar.attack'),     max: 5,  color: PILLAR_COLOR.attack,             icon: <Target size={12} /> },
    { key: 'defense',            label: t('lb.p4p.pillar.defense'),    max: 5,  color: PILLAR_COLOR.defense,            icon: <Shield size={12} /> },
  ]
}

// ── Score meter — single calm hue, the default "how good" signal everywhere ──

function ScoreMeter({ score, color, numSize = 20, barW = 64 }: { score: number; color: string; numSize?: number; barW?: number }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
      <span style={{ fontSize: numSize, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {score.toFixed(1)}
      </span>
      <div style={{ width: barW, height: 5, borderRadius: 99, background: 'rgba(var(--rgb-overlay),0.1)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, background: color,
          ['--bar-w' as string]: `${pct}%`, width: `${pct}%`,
          animation: 'p4pBarFill 0.6s ease both',
        }} />
      </div>
    </div>
  )
}

// ── One pillar row: icon, label, shared-scale bar, value/max ────────────────

function PillarBar({ meta, value }: { meta: { key: PillarKey; label: string; max: number; color: string; icon: ReactNode }; value: number }) {
  const pct = Math.min(100, (value / PILLAR_COMMON_SCALE) * 100)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '14px 100px 1fr 54px', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'inline-flex', color: meta.color, flexShrink: 0 }}>{meta.icon}</span>
      <span style={{
        fontSize: 11, color: MUTED, fontWeight: 600,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{meta.label}</span>
      <div style={{ height: 7, borderRadius: 4, background: `${meta.color}1F`, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, background: meta.color,
          ['--bar-w' as string]: `${pct}%`, width: `${pct}%`,
          animation: 'p4pBarFill 0.5s ease both',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: TEXT, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value.toFixed(1)}<span style={{ color: MUTED, fontWeight: 500 }}>/{meta.max}</span>
      </span>
    </div>
  )
}

// ── Full breakdown: all 8 pillars + confidence/record footer ────────────────
// This is the ONLY place all 8 colors appear together — every segment is
// labeled with an icon, a name, and an exact value, so it reads as data, not
// decoration.

function P4PBreakdown({ player, pillars }: { player: P4PRankedPlayer; pillars: ReturnType<typeof usePillarMeta> }) {
  const { t } = useTranslation()
  const p = player.p4p
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {pillars.map((m) => (
        <PillarBar key={m.key} meta={m} value={p[m.key]} />
      ))}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '5px 16px',
        marginTop: 3, paddingTop: 10, borderTop: `1px solid ${BORDER}`,
        fontSize: 11, color: MUTED,
      }}>
        <span>{t('lb.p4p.formula.confidence')} <b style={{ color: TEXT }}>{Math.round(p.confidence * 100)}%</b></span>
        <span>{t('common.matches')} <b style={{ color: TEXT }}>{player.matchesPlayed}</b></span>
        <span>{t('common.wins')} <b style={{ color: TEXT }}>{player.wins}</b></span>
        <span>{t('common.draws')} <b style={{ color: TEXT }}>{player.draws}</b></span>
        <span>{t('common.losses')} <b style={{ color: TEXT }}>{player.losses}</b></span>
        <span>{t('common.winRate')} <b style={{ color: TEXT }}>{Math.round(player.winRate * 100)}%</b></span>
        {p.titles > 0 && (
          <span style={{ color: PILLAR_COLOR.legacy, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Trophy size={11} />{p.titles}×
          </span>
        )}
      </div>
    </div>
  )
}

// ── Pillar legend — shown once, decodes every bar on the page ───────────────

function P4PLegend({ pillars }: { pillars: ReturnType<typeof usePillarMeta> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {pillars.map((m) => (
        <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUTED }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
          <span style={{ display: 'inline-flex', color: m.color }}>{m.icon}</span>
          {m.label} <span style={{ color: MUTED, opacity: 0.55 }}>/{m.max}</span>
        </div>
      ))}
    </div>
  )
}

// ── Formula / spec panel ─────────────────────────────────────────────────────

function FormulaPanel({ pillars }: { pillars: ReturnType<typeof usePillarMeta> }) {
  const { t } = useTranslation()
  const SIMPLE_KEY: Record<PillarKey, string> = {
    winQuality: 'winQualitySimple', legacy: 'legacySimple', experience: 'experienceSimple',
    strengthOfSchedule: 'sosSimple', recentForm: 'recentFormSimple', goalDominance: 'dominanceSimple',
    attack: 'attackSimple', defense: 'defenseSimple',
  }
  const DETAIL_KEY: Record<PillarKey, string> = {
    winQuality: 'winQualityDetail', legacy: 'legacyDetail', experience: 'experienceDetail',
    strengthOfSchedule: 'sosDetail', recentForm: 'recentFormDetail', goalDominance: 'dominanceDetail',
    attack: 'attackDetail', defense: 'defenseDetail',
  }

  return (
    <div style={{
      marginTop: 12, background: CARD2, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: '16px',
      animation: 'p4pDetailOpen 0.2s ease both',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: TEXT, marginBottom: 14 }}>
        {t('lb.p4p.formula.title')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pillars.map((m) => (
          <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 8, alignItems: 'start' }}>
            <span style={{ display: 'inline-flex', color: m.color, marginTop: 1 }}>{m.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>{m.label}</span>
                <span style={{ fontSize: 9, color: MUTED, fontWeight: 700 }}>max {m.max} pts</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 2, fontFamily: 'monospace' }}>
                {t(`lb.p4p.formula.${SIMPLE_KEY[m.key]}`)}
              </div>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{t(`lb.p4p.formula.${DETAIL_KEY[m.key]}`)}</div>
            </div>
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 8, alignItems: 'start' }}>
          <span style={{ display: 'inline-flex', color: ACCENT, marginTop: 1 }}><Target size={14} /></span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: TEXT, marginBottom: 2 }}>
              {t('lb.p4p.formula.confidence')}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 2, fontFamily: 'monospace' }}>
              {t('lb.p4p.formula.confidenceSimple')}
            </div>
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
              {t('lb.p4p.formula.confidenceDetail')}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 14, padding: '10px 12px',
        background: 'var(--card3)', borderRadius: 8, border: `1px solid ${BORDER}`,
        fontSize: 11, color: MUTED, lineHeight: 1.5,
      }}>
        <span style={{ color: TEXT, fontWeight: 700 }}>{t('lb.p4p.formula.finalScore')}</span>
        {t('lb.p4p.formula.finalScoreFormula')}
        <br />
        <span style={{ fontSize: 10 }}>{t('lb.p4p.formula.maxScore')}</span>
      </div>
    </div>
  )
}

// ── Top-3 featured card — hierarchy preserved, glow/shimmer/float removed ───

function P4PPlayerCard({ player, rank, currentUserId, pillars }: {
  player: P4PRankedPlayer
  rank: number
  currentUserId: string
  pillars: ReturnType<typeof usePillarMeta>
}) {
  const { t } = useTranslation()
  const isMe = player.id === currentUserId
  const tierColor = rank === 1 ? GOLD : rank === 2 ? SILVER : BRONZE

  return (
    <div style={{
      background: CARD, border: `1px solid rgba(${RANK_RGBS[rank - 1]},0.4)`,
      borderRadius: 14, padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 12,
      animation: 'p4pFadeUp 0.35s ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar url={player.avatarUrl} name={player.name} size={44} rank={rank} isMe={isMe} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-flex' }}>{rankMedal(rank, 13)}</span>
            <Link href={`/players/${player.id}`} style={{
              fontSize: 13, fontWeight: 700, color: tierColor, textDecoration: 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{player.name}</Link>
            {isMe && <span style={{ fontSize: 9, color: ACCENT, fontWeight: 600, flexShrink: 0 }}>{t('common.youSmall')}</span>}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {player.wins}W · {player.matchesPlayed}G
          </div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: tierColor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {player.p4p.score.toFixed(1)}
        </div>
      </div>

      <P4PBreakdown player={player} pillars={pillars} />
    </div>
  )
}

// ── Rest-of-list row — compact single-hue meter by default, expand for detail ──

function P4PRow({ player, rank, currentUserId, pillars, expanded, onToggle }: {
  player: P4PRankedPlayer
  rank: number
  currentUserId: string
  pillars: ReturnType<typeof usePillarMeta>
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const isMe = player.id === currentUserId

  return (
    <div className="p4p-row" style={{ background: isMe ? 'rgba(220,38,38,0.05)' : CARD }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '30px 1fr auto 28px',
        padding: '10px 14px', gap: 10, alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{rank}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar url={player.avatarUrl} name={player.name} size={28} isMe={isMe} />
          <Link href={`/players/${player.id}`} style={{
            fontSize: 13, fontWeight: 500, color: TEXT, textDecoration: 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {player.name}
            {isMe && <span style={{ marginLeft: 4, fontSize: 9, color: ACCENT, fontWeight: 400 }}>{t('common.youSmall')}</span>}
          </Link>
          {player.p4p.titles > 0 && (
            <span style={{ fontSize: 9, color: PILLAR_COLOR.legacy, fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <Trophy size={9} />{player.p4p.titles}
            </span>
          )}
        </div>

        <ScoreMeter score={player.p4p.score} color={ACCENT} numSize={15} barW={64} />

        <button
          onClick={onToggle}
          className="p4p-expand-btn"
          aria-label={t('lb.table.pillarBreakdown')}
          style={{
            width: 26, height: 26, borderRadius: 7,
            border: `1px solid ${expanded ? ACCENT : BORDER}`,
            background: expanded ? 'rgba(220,38,38,0.08)' : CARD2,
            color: expanded ? ACCENT : MUTED,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
      </div>

      {expanded && (
        <div style={{
          padding: '4px 16px 16px', borderTop: `1px solid ${BORDER}`,
          animation: 'p4pDetailOpen 0.2s ease both',
        }}>
          <div style={{ paddingTop: 12 }}>
            <P4PBreakdown player={player} pillars={pillars} />
          </div>
        </div>
      )}
    </div>
  )
}

function P4PTab({ ranked, currentUserId }: { ranked: P4PRankedPlayer[]; currentUserId: string }) {
  const [showFormula, setShowFormula] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { t } = useTranslation()
  const pillars = usePillarMeta(t)

  if (!ranked.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>{t('lb.noPlayers')}</div>
  }

  const top3   = ranked.slice(0, 3)
  const rest   = ranked.slice(3)
  const myRank = ranked.findIndex((p) => p.id === currentUserId) + 1

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ animation: 'p4pFadeUp 0.3s ease' }}>
      <style dangerouslySetInnerHTML={{ __html: P4P_ANIMS }} />

      {/* Header */}
      <div style={{
        marginBottom: 18, padding: '14px 18px',
        background: CARD2, border: `1px solid ${BORDER}`,
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} style={{ color: ACCENT }} />{t('lb.p4p.title')}
          </div>
          <button
            onClick={() => setShowFormula((v) => !v)}
            style={{
              padding: '5px 12px', border: `1px solid ${showFormula ? ACCENT : BORDER}`,
              borderRadius: 8, background: showFormula ? 'rgba(220,38,38,0.08)' : CARD,
              color: showFormula ? ACCENT : MUTED, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {showFormula ? t('common.close') : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Calculator size={11} />{t('lb.p4p.howCalculated')}</span>}
          </button>
        </div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          {t('lb.p4p.description')}
        </div>
        {myRank > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: ACCENT, fontWeight: 700 }}>
            {t('lb.p4p.yourRank', { n: myRank, score: ranked[myRank - 1]?.p4p.score.toFixed(1) ?? '0.0' })}
          </div>
        )}
        {showFormula && <FormulaPanel pillars={pillars} />}
      </div>

      {/* Legend — decodes every bar below */}
      <div style={{ marginBottom: 16, padding: '0 2px' }}>
        <P4PLegend pillars={pillars} />
      </div>

      {/* Top 3 featured cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        {top3.map((p, i) => (
          <P4PPlayerCard key={p.id} player={p} rank={i + 1} currentUserId={currentUserId} pillars={pillars} />
        ))}
      </div>

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '30px 1fr auto 28px',
            padding: '9px 14px', background: CARD2, borderBottom: `1px solid ${BORDER}`,
            fontSize: 10, fontWeight: 700, color: MUTED,
            textTransform: 'uppercase', letterSpacing: '0.07em', gap: 10,
          }}>
            <span>#</span>
            <span>{t('common.player')}</span>
            <span style={{ textAlign: 'right' }}>{t('lb.table.p4pScore')}</span>
            <span />
          </div>

          {rest.map((p, i) => (
            <div key={p.id} style={{ borderBottom: i < rest.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
              <P4PRow
                player={p} rank={i + 4} currentUserId={currentUserId} pillars={pillars}
                expanded={expanded.has(p.id)} onToggle={() => toggleRow(p.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Compare tab ───────────────────────────────────────────────────────────────

const CMP_A = '#DC2626'
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
      background: 'var(--card)',
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
  const { t } = useTranslation()
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
            background: 'var(--card)',
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
            {isMe && <span style={{ marginLeft: 4, fontSize: 9, color: MUTED, fontWeight: 400 }}>{t('common.youSmall')}</span>}
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>
            {player.wins}W · {Math.round(player.winRate * 100)}%
          </div>
          <div style={{ fontSize: 9, color: accent + 'aa', fontWeight: 600, letterSpacing: '0.03em' }}>
            {t('lb.cmp.tapToChange')}
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
            {isActive ? t('lb.cmp.picking') : t('lb.cmp.pickPlayer', { side })}
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
  const { t } = useTranslation()
  const { player1Wins: aWins, player2Wins: bWins, draws, totalMatches, player1Goals: aGoals, player2Goals: bGoals } = h2h
  const aPct = totalMatches > 0 ? Math.round((aWins / totalMatches) * 100) : 0
  const bPct = totalMatches > 0 ? Math.round((bWins / totalMatches) * 100) : 0
  const dPct = 100 - aPct - bPct

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: accentA, minWidth: 24, textAlign: 'right' }}>{aWins}</span>
        <div style={{ flex: 1, height: 10, borderRadius: 99, background: 'rgba(var(--rgb-overlay),0.04)', overflow: 'hidden', display: 'flex' }}>
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
          { label: playerA.name.split(' ')[0], value: aWins, sub: t('lb.cmp.wins'), color: accentA },
          { label: t('lb.cmp.stat.draws'), value: draws, sub: t('lb.cmp.draws'), color: MUTED },
          { label: playerB.name.split(' ')[0], value: bWins, sub: t('lb.cmp.wins'), color: accentB },
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
        {' '}{t('home.community.goals')} · {totalMatches} {t(totalMatches !== 1 ? 'lb.cmp.match.many' : 'lb.cmp.match.one')}
      </div>
    </div>
  )
}

type CmpStat = {
  label: string
  icon: ReactNode
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
  const { t } = useTranslation()
  const gpgA = playerA.matchesPlayed > 0 ? playerA.goalsFor / playerA.matchesPlayed : 0
  const gpgB = playerB.matchesPlayed > 0 ? playerB.goalsFor / playerB.matchesPlayed : 0
  const gapgA = playerA.matchesPlayed > 0 ? playerA.goalsAgainst / playerA.matchesPlayed : 0
  const gapgB = playerB.matchesPlayed > 0 ? playerB.goalsAgainst / playerB.matchesPlayed : 0
  const gdpgA = playerA.matchesPlayed > 0 ? playerA.goalDiff / playerA.matchesPlayed : 0
  const gdpgB = playerB.matchesPlayed > 0 ? playerB.goalDiff / playerB.matchesPlayed : 0

  const stats: CmpStat[] = [
    {
      label: t('lb.cmp.stat.winRate'), icon: <Award size={13} style={{ color: GOLD }} />,
      valueA: playerA.winRate, valueB: playerB.winRate,
      fmtA: `${Math.round(playerA.winRate * 100)}%`,
      fmtB: `${Math.round(playerB.winRate * 100)}%`,
      higherIsBetter: true, countsForLeads: true,
    },
    {
      label: t('lb.cmp.stat.wins'), icon: <Trophy size={13} style={{ color: GOLD }} />,
      valueA: playerA.wins, valueB: playerB.wins,
      fmtA: String(playerA.wins), fmtB: String(playerB.wins),
      higherIsBetter: true, countsForLeads: false,
    },
    {
      label: t('lb.cmp.stat.draws'), icon: <Star size={13} style={{ color: GOLD }} />,
      valueA: playerA.draws, valueB: playerB.draws,
      fmtA: String(playerA.draws), fmtB: String(playerB.draws),
      higherIsBetter: true, countsForLeads: false,
    },
    {
      label: t('lb.cmp.stat.losses'), icon: <TrendingUp size={13} style={{ color: RED, transform: 'rotate(180deg)' }} />,
      valueA: playerA.losses, valueB: playerB.losses,
      fmtA: String(playerA.losses), fmtB: String(playerB.losses),
      higherIsBetter: false, countsForLeads: false,
    },
    {
      label: t('lb.cmp.stat.goalsScored'), icon: <Zap size={13} style={{ color: GOLD }} />,
      valueA: playerA.goalsFor, valueB: playerB.goalsFor,
      fmtA: String(playerA.goalsFor), fmtB: String(playerB.goalsFor),
      higherIsBetter: true, countsForLeads: false,
    },
    {
      label: t('lb.cmp.stat.goalsPerGame'), icon: <Target size={13} style={{ color: '#f97316' }} />,
      valueA: gpgA, valueB: gpgB,
      fmtA: playerA.matchesPlayed > 0 ? gpgA.toFixed(2) : '-',
      fmtB: playerB.matchesPlayed > 0 ? gpgB.toFixed(2) : '-',
      higherIsBetter: true, countsForLeads: true,
    },
    {
      label: t('lb.cmp.stat.conceded'), icon: <Shield size={13} style={{ color: RED }} />,
      valueA: playerA.goalsAgainst, valueB: playerB.goalsAgainst,
      fmtA: String(playerA.goalsAgainst), fmtB: String(playerB.goalsAgainst),
      higherIsBetter: false, countsForLeads: false,
    },
    {
      label: t('lb.cmp.stat.gaPerGame'), icon: <Shield size={13} style={{ color: ACCENT }} />,
      valueA: gapgA, valueB: gapgB,
      fmtA: playerA.matchesPlayed > 0 ? gapgA.toFixed(2) : '-',
      fmtB: playerB.matchesPlayed > 0 ? gapgB.toFixed(2) : '-',
      higherIsBetter: false, countsForLeads: true,
    },
    {
      label: t('lb.cmp.stat.goalDiff'), icon: <Activity size={13} style={{ color: GREEN }} />,
      valueA: playerA.goalDiff, valueB: playerB.goalDiff,
      fmtA: playerA.goalDiff > 0 ? `+${playerA.goalDiff}` : String(playerA.goalDiff),
      fmtB: playerB.goalDiff > 0 ? `+${playerB.goalDiff}` : String(playerB.goalDiff),
      higherIsBetter: true, countsForLeads: false,
    },
    {
      label: t('lb.cmp.stat.gdPerGame'), icon: <BarChart3 size={13} style={{ color: GREEN }} />,
      valueA: gdpgA, valueB: gdpgB,
      fmtA: playerA.matchesPlayed > 0 ? (gdpgA > 0 ? `+${gdpgA.toFixed(2)}` : gdpgA.toFixed(2)) : '-',
      fmtB: playerB.matchesPlayed > 0 ? (gdpgB > 0 ? `+${gdpgB.toFixed(2)}` : gdpgB.toFixed(2)) : '-',
      higherIsBetter: true, countsForLeads: true,
    },
    {
      label: t('lb.cmp.stat.matches'), icon: <Activity size={13} style={{ color: MUTED }} />,
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
        background: `linear-gradient(135deg, rgba(220,38,38,0.07) 0%, rgba(241,245,249,0) 50%, rgba(239,68,68,0.1) 100%)`,
        border: `1px solid ${BORDER}`, borderRadius: 16,
        marginBottom: 16, gap: 8,
      }}>
        {/* Player A */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'cmpSlideLeft 0.5s ease both' }}>
          <HeroAvatar player={playerA} accentColor={CMP_A} glowAnim="cmpGlowA 2.5s ease-in-out infinite" />
          <div style={{ fontSize: 13, fontWeight: 800, color: CMP_A, textAlign: 'center', lineHeight: 1.2 }}>
            {playerA.name}
            {playerA.id === currentUserId && (
              <span style={{ display: 'block', fontSize: 9, color: MUTED, fontWeight: 400, marginTop: 2 }}>{t('common.youSmall')}</span>
            )}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: aLeads > bLeads ? CMP_A : MUTED,
            background: aLeads > bLeads ? 'rgba(220,38,38,0.1)' : 'rgba(var(--rgb-overlay),0.025)',
            border: `1px solid ${aLeads > bLeads ? CMP_A + '44' : BORDER}`,
            borderRadius: 99, padding: '3px 10px',
          }}>
            {t('lb.cmp.leads', { n: aLeads })}
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
              <span style={{ display: 'block', fontSize: 9, color: MUTED, fontWeight: 400, marginTop: 2 }}>{t('common.youSmall')}</span>
            )}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: bLeads > aLeads ? CMP_B : MUTED,
            background: bLeads > aLeads ? 'rgba(239,68,68,0.15)' : 'rgba(var(--rgb-overlay),0.025)',
            border: `1px solid ${bLeads > aLeads ? CMP_B + '44' : BORDER}`,
            borderRadius: 99, padding: '3px 10px',
          }}>
            {t('lb.cmp.leads', { n: bLeads })}
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
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>{s.icon}</div>
                <div style={{ fontSize: 8, color: MUTED, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, wordBreak: 'break-word' }}>
                  {s.label}
                </div>
                <div style={{ display: 'flex', height: 4, borderRadius: 99, overflow: 'hidden', background: 'rgba(var(--rgb-overlay),0.03)' }}>
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
          {t('lb.cmp.h2h')}
        </div>
        {h2hLoading ? (
          <div style={{ textAlign: 'center', padding: '14px', color: MUTED, fontSize: 13 }}>{t('common.loading')}</div>
        ) : h2h && h2h.totalMatches > 0 ? (
          <H2HCompareDisplay playerA={playerA} playerB={playerB} h2h={h2h} accentA={CMP_A} accentB={CMP_B} />
        ) : (
          <div style={{ textAlign: 'center', padding: '14px', color: MUTED, fontSize: 12 }}>
            {t('lb.cmp.noH2H')}
          </div>
        )}
      </div>
    </div>
  )
}

function CompareTab({ players, currentUserId }: { players: NamedPlayerStats[]; currentUserId: string }) {
  const { t } = useTranslation()
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
              {t('lb.cmp.selectPlayer', { side: pickingFor })}
            </div>
            <input
              autoFocus
              type="text"
              placeholder={t('lb.cmp.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px',
                background: 'rgba(var(--rgb-overlay),0.035)',
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
                      {p.id === currentUserId && <span style={{ marginLeft: 5, fontSize: 10, color: ACCENT }}>{t('common.youSmall')}</span>}
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
              <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 13 }}>{t('lb.cmp.noPlayersFound')}</div>
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

// ─── Roster tab (UFC-style athlete grid) ──────────────────────────────────────

const ROSTER_ANIMS = `
  @keyframes rosterCardIn {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes rosterShimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .roster-card:hover .roster-photo-overlay { opacity: 1 !important; }
  .roster-card:hover .roster-photo-img     { transform: scale(1.04); }
  .roster-card:hover                       { border-color: rgba(255,255,255,0.18) !important; }
`

function RosterCard({ player, rank, currentUserId, delay }: {
  player: NamedPlayerStats
  rank: number
  currentUserId: string
  delay: number
}) {
  const isMe     = player.id === currentUserId
  const isTop3   = rank <= 3
  const photoUrl = player.avatarUrl ?? player.heroPhotoUrl
  const initials = player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const rankColor = rank === 1 ? GOLD : rank === 2 ? SILVER : rank === 3 ? BRONZE : null

  return (
    <div
      className="roster-card"
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        overflow: 'hidden',
        animation: `rosterCardIn 0.45s ${delay}s ease both`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.2s',
      }}
    >
      {/* ── Photo area (clickable → profile) ── */}
      <Link
        href={`/players/${player.id}`}
        style={{ display: 'block', position: 'relative', textDecoration: 'none', flexShrink: 0 }}
      >
        {/* Photo / fallback */}
        <div style={{ position: 'relative', paddingBottom: '130%', overflow: 'hidden', background: '#080e1a' }}>
          {photoUrl ? (
            <img
              className="roster-photo-img"
              src={photoUrl}
              alt={player.name}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'top center', display: 'block',
                transition: 'transform 0.4s ease',
              }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(160deg, #0d1626 0%, #111e35 100%)`,
            }}>
              {/* Silhouette placeholder */}
              <div style={{
                width: '55%', aspectRatio: '1/1.4',
                background: 'linear-gradient(180deg, #1a2840 0%, #0d1626 100%)',
                borderRadius: '50% 50% 0 0 / 40% 40% 0 0',
                opacity: 0.6,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
                  width: '42%', aspectRatio: '1/1', borderRadius: '50%',
                  background: '#1a2840',
                }} />
              </div>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  fontSize: 48, fontWeight: 900, color: 'rgba(var(--rgb-overlay),0.04)',
                  fontFamily: 'system-ui',
                }}>
                  {initials}
                </div>
              </div>
            </div>
          )}

          {/* Bottom gradient fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%',
            background: `linear-gradient(to top, ${CARD} 0%, rgba(12,20,34,0.3) 60%, transparent 100%)`,
            pointerEvents: 'none',
          }} />

          {/* Rank badge */}
          {isTop3 && (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              width: 30, height: 30, borderRadius: '50%',
              background: `radial-gradient(circle, ${rankColor}33, transparent)`,
              border: `1.5px solid ${rankColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {rankMedal(rank, 16)}
            </div>
          )}

          {/* "ME" badge */}
          {isMe && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: ACCENT, color: '#fff',
              fontSize: 8, fontWeight: 800, padding: '2px 7px', borderRadius: 99,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              YOU
            </div>
          )}

          {/* Hover overlay */}
          <div
            className="roster-photo-overlay"
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(220,38,38,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s',
            }}
          >
            <div style={{
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 20, padding: '6px 14px',
              fontSize: 11, fontWeight: 700, color: '#fff',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              VIEW PROFILE
            </div>
          </div>
        </div>
      </Link>

      {/* ── Info section ── */}
      <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Rank number for non-top3 */}
        {!isTop3 && (
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: '0.06em' }}>
            #{rank}
          </div>
        )}

        {/* Name */}
        <Link href={`/players/${player.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            fontSize: 15, fontWeight: 900, color: isTop3 ? (rankColor ?? TEXT) : TEXT,
            textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.15,
            ...(isTop3 && rank === 1 ? {
              background: 'linear-gradient(90deg,#f59e0b,#fcd34d,#f97316,#f59e0b)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: 'rosterShimmer 3s linear infinite',
            } : {}),
          }}>
            {player.name}
          </div>
        </Link>

        {/* Record */}
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginTop: 2 }}>
          <span style={{ color: GREEN }}>{player.wins}</span>
          <span style={{ color: BORDER, margin: '0 3px' }}>-</span>
          <span style={{ color: RED }}>{player.losses}</span>
          <span style={{ color: BORDER, margin: '0 3px' }}>-</span>
          <span style={{ color: MUTED }}>{player.draws}</span>
          <span style={{ color: BORDER, marginLeft: 5, fontSize: 9 }}>(W-L-D)</span>
        </div>

        {/* Win rate */}
        <div style={{ marginTop: 4 }}>
          <WinBar rate={player.winRate} />
        </div>
      </div>
    </div>
  )
}

function RosterTab({ players, currentUserId }: { players: NamedPlayerStats[]; currentUserId: string }) {
  const [search, setSearch] = useState('')

  const sorted = useMemo(
    () => [...players].sort((a, b) => b.wins - a.wins || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor),
    [players],
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter((p) => p.name.toLowerCase().includes(q))
  }, [sorted, search])

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease' }}>
      <style dangerouslySetInnerHTML={{ __html: ROSTER_ANIMS }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: TEXT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {filtered.length} <span style={{ color: MUTED }}>ATHLETES</span>
        </div>
        <input
          type="text"
          placeholder="Search athletes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '7px 12px',
            background: CARD2, border: `1px solid ${BORDER}`,
            borderRadius: 8, color: TEXT, fontSize: 13,
            outline: 'none', minWidth: 180,
          }}
        />
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12,
      }}>
        {filtered.map((player, i) => (
          <RosterCard
            key={player.id}
            player={player}
            rank={sorted.indexOf(player) + 1}
            currentUserId={currentUserId}
            delay={Math.min(i * 0.03, 0.3)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: MUTED, fontSize: 14 }}>
          No athletes found
        </div>
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

// ─── Root component ────────────────────────────────────────────────────────────

export function LeaderboardClient({ players, rivalryWinners, championshipLeaders, p4pRanked, lastChampionshipPodium, currentUserId }: Props) {
  const { t } = useTranslation()
  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'roster',        label: 'Roster',                icon: <SI><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></SI> },
    { id: 'overall',       label: t('lb.tab.overall'),     icon: <SI><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></SI> },
    { id: 'compare',       label: t('lb.tab.compare'),     icon: <SI><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/><line x1="12" y1="8" x2="12" y2="16"/></SI> },
    { id: 'p4p',           label: t('lb.tab.p4p'),         icon: <SI><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></SI> },
    { id: 'scorers',       label: t('lb.tab.scorers'),     icon: <SI><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></SI> },
    { id: 'active',        label: t('lb.tab.active'),      icon: <SI><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></SI> },
    { id: 'rivalry',       label: t('lb.tab.rivalry'),     icon: <SI><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="3" y2="21"/></SI> },
    { id: 'championships', label: t('lb.tab.championships'), icon: <SI><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></SI> },
    { id: 'insights',      label: t('lb.tab.insights'),    icon: <SI><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></SI> },
  ]
  const [tab, setTab] = useState<Tab>('roster')

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
    <div className="app-page" style={{
      minHeight: '100svh', background: BG,
      fontFamily: 'system-ui,-apple-system,sans-serif',
      color: TEXT, padding: '32px 16px', paddingBottom: 'var(--nav-h)',
    }}>
      <style dangerouslySetInnerHTML={{ __html: ANIMS }} />

      <div className="page-content-wide" style={{ margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <span style={{
              fontSize: 48,
              fontWeight: 900,
              color: GOLD,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              filter: `drop-shadow(0 0 12px ${GOLD}66)`,
              fontFamily: 'var(--font-heading, sans-serif)',
              userSelect: 'none',
            }}>
              FC26
            </span>
          </div>
          <div style={{ fontSize: 13, color: MUTED }}>
            {t('lb.subtitle', { n: players.length, players: t(players.length !== 1 ? 'lb.subtitlePlayers.many' : 'lb.subtitlePlayers.one') })}
          </div>
        </div>

        {/* ── Personal stats card ── */}
        {tab !== 'roster' && myPlayer && myRank > 0 && (
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
          {TABS.map((tabItem) => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: tab === tabItem.id ? ACCENT : MUTED,
              borderBottom: `2px solid ${tab === tabItem.id ? ACCENT : 'transparent'}`,
              marginBottom: -1, flexShrink: 0, whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}>
              {tabItem.icon}{tabItem.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {tab === 'roster' && (
          <RosterTab players={players} currentUserId={currentUserId} />
        )}
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
    </div>
  )
}
