'use client'

import type { ReactNode } from 'react'
import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import { Trophy, Crown, Medal, Flame, Zap, TrendingUp, Swords, Target, BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabase/client'
import { CreateMatchModal } from '@/app/matches/CreateMatchModal'
import type { ActivePlayer } from '@/app/matches/CreateMatchModal'
import type { PlayerStatsRow, FormEntry, ChampionshipResult, ChampionshipLeader, CurrentChampion } from '@/lib/stats/types'
import { BottomNav } from '@/app/components/BottomNav'
import { BetNotificationCenter } from '@/app/components/BetNotificationCenter'
import { logoutAction } from '@/lib/auth/actions'
import { confirmMatchAction, deleteMatchAction } from '@/app/matches/actions'
import { useTranslation } from '@/lib/i18n/context'
import { OddsMarketModal } from '@/app/betting/OddsMarketModal'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RivalryItem = {
  id: string
  bestOf: number
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
  player1Wins: number
  player2Wins: number
  winnerId: string | null
  status: 'active' | 'completed'
}

export type GlobalStats = {
  totalMatches: number
  totalGoals: number
  topScorerName: string | null
  topScorerGoals: number
  topScorerAvatarUrl: string | null
}

export type HomeMatchItem = {
  id: string
  status: string
  createdAt: string
  homePlayerId: string
  homePlayerName: string
  homePlayerAvatarUrl: string | null
  awayPlayerId: string
  awayPlayerName: string
  awayPlayerAvatarUrl: string | null
  homeWinOdds: number
  drawOdds: number
  awayWinOdds: number
  homeHandicap: number
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  ouLine: string | null
}

type Props = {
  userId: string
  isAdmin: boolean
  myName: string
  myAvatarUrl: string | null
  myStats: PlayerStatsRow | null
  rank: number
  p4pRank: number
  totalPlayers: number
  recentForm: FormEntry[]
  champPlacements: ChampionshipResult[]
  champLeaders: ChampionshipLeader[]
  currentChampion: CurrentChampion | null
  rivalries: RivalryItem[]
  players: ActivePlayer[]
  pendingMatches: HomeMatchItem[]
  globalStats: GlobalStats
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG     = '#050911'
const CARD   = '#0c1422'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const GOLD   = '#f59e0b'
const TEXT   = '#f8fafc'
const TEXT2  = '#94a3b8'
const MUTED  = '#4b5a73'
const WIN    = '#10b981'
const LOSS   = '#ef4444'
const DRAW   = '#f59e0b'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStreak(form: FormEntry[]): { type: 'W' | 'L' | 'D' | null; count: number } {
  if (!form.length) return { type: null, count: 0 }
  const latest = form[0].result as 'W' | 'L' | 'D'
  let count = 0
  for (const f of form) {
    if (f.result === latest) count++
    else break
  }
  return { type: latest, count }
}

function getTierKey(rank: number, total: number): { labelKey: string; color: string; icon: ReactNode } | null {
  if (rank <= 0 || total <= 0) return null
  if (rank === 1) return { labelKey: 'home.tier.p4pNo1', color: GOLD, icon: <Crown size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
  if (rank === 2) return { labelKey: 'home.tier.runnerUp', color: '#94a3b8', icon: <Medal size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
  if (rank === 3) return { labelKey: 'home.tier.thirdPlace', color: '#cd7c3a', icon: <Medal size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
  if (rank <= Math.max(4, Math.ceil(total * 0.4))) return { labelKey: 'home.tier.elite', color: '#60a5fa', icon: <Zap size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
  return { labelKey: 'home.tier.contender', color: MUTED, icon: <Target size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
}

// ─── Root component ───────────────────────────────────────────────────────────

export function HomeLoggedIn({
  userId, isAdmin, myName, myAvatarUrl, myStats, rank, p4pRank, totalPlayers,
  recentForm, champPlacements, champLeaders, currentChampion, rivalries, players,
  pendingMatches, globalStats,
}: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const [showAddMatch,    setShowAddMatch]    = useState(false)
  const [toast,           setToast]           = useState<string | null>(null)
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)

  const stats = myStats ?? {
    wins: 0, losses: 0, draws: 0, matchesPlayed: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0, winRate: 0,
  }

  const activeChamps    = champPlacements.filter((c) =>  c.isActive)
  const completedChamps = champPlacements.filter((c) => !c.isActive)
  const activeRivalries = rivalries.filter((r) => r.status === 'active')
  const winRate         = stats.matchesPlayed > 0
    ? Math.round((stats.wins / stats.matchesPlayed) * 100)
    : 0

  const streak   = computeStreak(recentForm)
  const hotStreak = streak.type === 'W' && streak.count >= 3
  const tier     = getTierKey(p4pRank, totalPlayers)

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function notify(msg: string) {
      setToast(msg)
      setTimeout(() => setToast(null), 4000)
    }

    const ch1 = supabase.channel('home-rt-home')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friendly_matches',
        filter: `home_player_id=eq.${userId}`,
      }, (payload) => {
        router.refresh()
        const n = payload.new as Record<string, unknown>
        if (payload.eventType === 'UPDATE' && n.status === 'confirmed') notify(t('home.toast.confirmed'))
      })
      .subscribe()

    const ch2 = supabase.channel('home-rt-away')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friendly_matches',
        filter: `away_player_id=eq.${userId}`,
      }, (payload) => {
        router.refresh()
        const n = payload.new as Record<string, unknown>
        if (payload.eventType === 'INSERT') notify(t('home.toast.newMatch'))
        if (payload.eventType === 'UPDATE' && n.status === 'confirmed') notify(t('home.toast.scoreConfirmed'))
      })
      .subscribe()

    const ch3 = supabase.channel('home-rt-rivalries')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rivalries',
      }, (payload) => {
        const n = payload.new as Record<string, unknown>
        if (n.player1_id === userId || n.player2_id === userId) {
          router.refresh()
          if (n.status === 'completed') notify(t('home.toast.rivalryCompleted'))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
      supabase.removeChannel(ch3)
    }
  }, [userId, router])

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: 'system-ui, sans-serif', color: TEXT, paddingBottom: 80 }}>

      {/* ── CSS animations ──────────────────────────────────────────── */}
      <style>{`
        @keyframes hero-shift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes ring-blue {
          0%,100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.45), 0 0 22px rgba(59,130,246,0.2); }
          50%      { box-shadow: 0 0 0 3px rgba(59,130,246,0.85), 0 0 32px rgba(59,130,246,0.45); }
        }
        @keyframes ring-gold {
          0%,100% { box-shadow: 0 0 0 3px rgba(245,158,11,0.55), 0 0 22px rgba(245,158,11,0.25); }
          50%      { box-shadow: 0 0 0 3px rgba(245,158,11,0.95), 0 0 38px rgba(245,158,11,0.5); }
        }
        @keyframes fire-bounce {
          0%,100% { transform: scale(1); }
          40%      { transform: scale(1.18) rotate(-6deg); }
          60%      { transform: scale(1.18) rotate(6deg); }
        }
        @keyframes slide-up {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes live-dot {
          0%,100% { opacity:1; }
          50%      { opacity:0.35; }
        }
        .stat-tile { transition: transform .15s ease, box-shadow .15s ease; }
        .stat-tile:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
        .champ-card { animation: slide-up .4s ease both; }
        .champ-card:nth-child(2) { animation-delay:.06s; }
        .champ-card:nth-child(3) { animation-delay:.12s; }
        .rival-card { animation: slide-up .4s ease both; }
        .rival-card:nth-child(2) { animation-delay:.06s; }
        .rival-card:nth-child(3) { animation-delay:.12s; }
      `}</style>

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,9,17,0.88)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em' }}>
          <span style={{ color: TEXT }}>i</span>
          <span style={{
            background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Sport</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <BetNotificationCenter />
          {isAdmin && (
            <button
              onClick={() => setShowAdminPrompt(true)}
              style={{
                fontSize: 11, color: MUTED, background: 'rgba(255,255,255,0.05)',
                padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer',
              }}
            >
              {t('common.admin')}
            </button>
          )}
          <form action={logoutAction}>
            <button type="submit" style={{
              fontSize: 11, color: MUTED, background: 'none',
              border: `1px solid ${BORDER}`, borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer',
            }}>
              {t('common.signOut')}
            </button>
          </form>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 66, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg,#1e3a5f,#1a1a3e)',
          border: `1px solid ${ACCENT}`,
          borderRadius: 12, padding: '10px 20px',
          fontSize: 13, fontWeight: 700, color: TEXT,
          boxShadow: `0 4px 24px rgba(59,130,246,0.35)`,
          zIndex: 100, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '28px 20px 24px',
        background: 'linear-gradient(135deg,#0d2348 0%,#1a0a3e 45%,#0a1e3c 75%,#071830 100%)',
        backgroundSize: '300% 300%',
        animation: 'hero-shift 9s ease infinite',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>

          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
            <div style={{
              borderRadius: '50%',
              animation: p4pRank === 1 ? 'ring-gold 2.8s ease-in-out infinite' : 'ring-blue 2.8s ease-in-out infinite',
              flexShrink: 0,
            }}>
              <PlayerAvatar name={myName} avatarUrl={myAvatarUrl} size={62} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em',
                lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {myName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                {tier && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px',
                    background: `${tier.color}18`, color: tier.color,
                    borderRadius: 6, border: `1px solid ${tier.color}40`,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    {tier.icon} {t(tier.labelKey)}
                  </span>
                )}
                {p4pRank > 0 && (
                  <span style={{ fontSize: 11, color: TEXT2, fontWeight: 600 }}>
                    #{p4pRank} {t('lb.ofPlayers', { n: totalPlayers })}
                  </span>
                )}
                {hotStreak && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px',
                    background: 'rgba(249,115,22,0.15)', color: '#fb923c',
                    borderRadius: 6, border: '1px solid rgba(249,115,22,0.3)',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    animation: 'fire-bounce 1.6s ease infinite',
                  }}>
                    <Flame size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> {t('home.streak.inARow', { n: streak.count })}
                  </span>
                )}
                {!hotStreak && streak.type === 'W' && streak.count >= 2 && (
                  <span style={{ fontSize: 11, color: WIN, fontWeight: 600 }}>{t('home.streak.wStreak', { n: streak.count })}</span>
                )}
                {streak.type === 'L' && streak.count >= 2 && (
                  <span style={{ fontSize: 11, color: LOSS, fontWeight: 600 }}>{t('home.streak.lStreak', { n: streak.count })}</span>
                )}
              </div>
            </div>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
            {([
              { label: t('common.wins'),   value: stats.wins,     color: WIN,       bg: 'rgba(16,185,129,0.1)',  bd: 'rgba(16,185,129,0.25)' },
              { label: t('common.losses'), value: stats.losses,   color: LOSS,      bg: 'rgba(239,68,68,0.1)',   bd: 'rgba(239,68,68,0.25)'  },
              { label: t('common.draws'),  value: stats.draws,    color: DRAW,      bg: 'rgba(245,158,11,0.1)',  bd: 'rgba(245,158,11,0.25)' },
              { label: t('common.goals'),  value: stats.goalsFor, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', bd: 'rgba(96,165,250,0.25)' },
            ]).map(({ label, value, color, bg, bd }) => (
              <div key={label} className="stat-tile" style={{
                background: bg, border: `1px solid ${bd}`,
                borderRadius: 12, padding: '12px 4px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 5 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Win-rate bar + goal diff */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10,
              padding: '10px 14px', border: `1px solid ${BORDER}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {t('common.winRate')}
                </span>
                <span style={{ fontSize: 14, fontWeight: 900, color: winRate >= 60 ? WIN : winRate >= 40 ? DRAW : TEXT2 }}>
                  {winRate}%
                </span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, width: `${winRate}%`,
                  background: winRate >= 60
                    ? `linear-gradient(90deg,${WIN},#34d399)`
                    : winRate >= 40
                      ? `linear-gradient(90deg,${DRAW},#fbbf24)`
                      : 'linear-gradient(90deg,#6b7280,#9ca3af)',
                }} />
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 10,
              padding: '10px 14px', border: `1px solid ${BORDER}`,
              textAlign: 'center', minWidth: 72,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                GD
              </div>
              <div style={{
                fontSize: 20, fontWeight: 900,
                color: stats.goalDiff > 0 ? WIN : stats.goalDiff < 0 ? LOSS : TEXT2,
              }}>
                {stats.goalDiff > 0 ? `+${stats.goalDiff}` : stats.goalDiff}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px' }}>

        {/* ── Community pulse ─────────────────────────────────────── */}
        {(globalStats.totalMatches > 0 || globalStats.totalGoals > 0) && (
          <div style={{
            background: 'linear-gradient(135deg,rgba(59,130,246,0.07),rgba(139,92,246,0.07))',
            border: `1px solid rgba(59,130,246,0.18)`,
            borderRadius: 12, padding: '11px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Zap size={15} style={{ color: '#60a5fa', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12, color: TEXT2, flexWrap: 'wrap', flex: 1 }}>
              <span>
                <strong style={{ color: TEXT, fontWeight: 800 }}>{globalStats.totalMatches}</strong> {t('home.community.matches')}
              </span>
              <span style={{ color: BORDER }}>·</span>
              <span>
                <strong style={{ color: TEXT, fontWeight: 800 }}>{globalStats.totalGoals}</strong> {t('home.community.goals')}
              </span>
              {globalStats.topScorerName && globalStats.topScorerGoals > 0 && (
                <>
                  <span style={{ color: BORDER }}>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {globalStats.topScorerAvatarUrl
                      ? (
                        <img
                          src={globalStats.topScorerAvatarUrl}
                          alt={globalStats.topScorerName}
                          width={18} height={18}
                          style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      )
                      : <Trophy size={16} style={{ color: GOLD }} />
                    }
                    <strong style={{ color: GOLD, fontWeight: 700 }}>{globalStats.topScorerName}</strong>
                    <span style={{ color: MUTED }}>{t('home.community.topScorer', { n: globalStats.topScorerGoals })}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Pending matches — set score ───────────────────────── */}
        {pendingMatches.length > 0 && (
          <HomeMatchesList
            matches={pendingMatches}
            userId={userId}
          />
        )}

        {/* ── Add match CTA ─────────────────────────────────────── */}
        <button
          onClick={() => setShowAddMatch(true)}
          style={{
            width: '100%', padding: '16px',
            background: 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)',
            color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer',
            fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
            boxShadow: '0 4px 30px rgba(37,99,235,0.45)',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
          {t('home.recordMatch')}
        </button>

        {/* ── Quick nav ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 30 }}>
          {([
            { label: t('home.quickNav.leaderboard'),   href: '/leaderboard',   icon: <BarChart3 size={22} style={{ color: ACCENT }} /> },
            { label: t('home.quickNav.championships'), href: '/championships', icon: <Trophy    size={22} style={{ color: GOLD  }} /> },
            { label: t('home.quickNav.rivalries'),     href: '/rivalries',     icon: <Swords   size={22} style={{ color: '#a78bfa' }} /> },
          ] as { label: string; href: string; icon: ReactNode }[]).map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: CARD, border: `1px solid ${BORDER}`,
                borderRadius: 12, padding: '14px 8px', textAlign: 'center',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 5, height: 26 }}>{item.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.label}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Current Champion ──────────────────────────────────── */}
        {currentChampion && (
          <Section title={t('home.section.currentChampion')} icon={<Trophy size={13} style={{ color: GOLD }} />}>
            <Link href={`/championships/${currentChampion.championshipId}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(251,191,36,0.06))',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: 14,
                padding: '16px',
                boxShadow: '0 4px 24px rgba(245,158,11,0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <PlayerAvatar name={currentChampion.playerName} avatarUrl={currentChampion.avatarUrl} size={52} />
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 22, height: 22,
                    background: GOLD,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12,
                    boxShadow: '0 0 10px rgba(245,158,11,0.7)',
                  }}><Trophy size={12} style={{ color: '#fff' }} /></div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                    {currentChampion.championshipName}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentChampion.playerName}
                  </div>
                  <div style={{ fontSize: 12, color: TEXT2, marginTop: 3 }}>
                    {currentChampion.wins}W {currentChampion.draws}D {currentChampion.losses}L
                    {' · '}
                    {currentChampion.goalDiff >= 0 ? '+' : ''}{currentChampion.goalDiff} GD
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{t('common.pts').toUpperCase()}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{currentChampion.points}</div>
                </div>
              </div>
            </Link>
          </Section>
        )}

        {/* ── Recent form ───────────────────────────────────────── */}
        {recentForm.length > 0 && (
          <Section
            title={t('home.section.recentForm')}
            icon={<TrendingUp size={13} style={{ color: '#22c55e' }} />}
            action={<Link href={`/players/${userId}`} style={{ fontSize: 12, color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>{t('common.viewAll')}</Link>}
          >
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {recentForm.slice(0, 7).map((entry) => (
                <ResultPill key={entry.matchId} entry={entry} />
              ))}
            </div>
          </Section>
        )}

        {/* ── Active championships ──────────────────────────────── */}
        {activeChamps.length > 0 && (
          <Section
            title={t('home.section.myChampionships')}
            icon={<Trophy size={13} style={{ color: GOLD }} />}
            action={<Link href="/championships" style={{ fontSize: 12, color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>{t('common.viewAll')}</Link>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeChamps.map((c) => {
                const leader = champLeaders.find((l) => l.championshipId === c.championshipId) ?? null
                return (
                  <Link key={c.championshipId} href={`/championships/${c.championshipId}`} style={{ textDecoration: 'none' }} className="champ-card">
                    <ChampCard placement={c} leader={leader} userId={userId} />
                  </Link>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Active rivalries ──────────────────────────────────── */}
        {activeRivalries.length > 0 && (
          <Section
            title={t('home.section.myRivalries')}
            icon={<Swords size={13} style={{ color: '#a78bfa' }} />}
            action={<Link href="/rivalries" style={{ fontSize: 12, color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>{t('common.viewAll')}</Link>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeRivalries.map((r) => (
                <Link key={r.id} href={`/rivalries/${r.id}`} style={{ textDecoration: 'none' }} className="rival-card">
                  <RivalryCard rivalry={r} userId={userId} />
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── Past championships ────────────────────────────────── */}
        {completedChamps.length > 0 && (
          <Section
            title={t('home.section.pastChampionships')}
            action={<Link href="/championships" style={{ fontSize: 12, color: MUTED, textDecoration: 'none' }}>{t('common.viewAll')}</Link>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {completedChamps.slice(0, 3).map((c) => (
                <Link key={c.championshipId} href={`/championships/${c.championshipId}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: CARD, border: `1px solid ${BORDER}`,
                    borderRadius: 10, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: c.rank === 1 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${c.rank === 1 ? 'rgba(245,158,11,0.35)' : BORDER}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: c.rank <= 3 ? 16 : 12, fontWeight: 900,
                      color: c.rank === 1 ? GOLD : c.rank === 2 ? '#94a3b8' : c.rank === 3 ? '#cd7c3a' : MUTED,
                    }}>
                      {c.rank === 1 ? <Trophy size={16} /> : c.rank === 2 ? <Medal size={15} /> : c.rank === 3 ? <Medal size={14} /> : `#${c.rank}`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.championshipName}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        {c.played} played · {c.wins}W {c.draws}D {c.losses}L
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: c.rank === 1 ? GOLD : c.rank <= 3 ? TEXT : MUTED }}>
                        {c.points} {t('common.pts')}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── Empty state ───────────────────────────────────────── */}
        {stats.matchesPlayed === 0 && (
          <div style={{
            background: 'linear-gradient(135deg,#0c1422 0%,#0d1b30 100%)',
            border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: '40px 24px', textAlign: 'center',
            marginTop: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Trophy size={52} style={{ color: ACCENT, opacity: 0.6 }} /></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 8 }}>{t('home.readyToCompete')}</div>
            <div style={{ fontSize: 14, color: TEXT2, marginBottom: 24, lineHeight: 1.6 }}>
              {t('home.readyToCompeteDesc').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </div>
            <button
              onClick={() => setShowAddMatch(true)}
              style={{
                padding: '12px 32px',
                background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                fontSize: 15, fontWeight: 800,
                boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
              }}
            >
              {t('home.recordFirstMatch')}
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom nav ────────────────────────────────────────────── */}
      <BottomNav userId={userId} />

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showAddMatch && (
        <CreateMatchModal
          currentUserId={userId}
          currentUserName={myName}
          currentUserAvatarUrl={myAvatarUrl}
          players={players}
          onClose={() => setShowAddMatch(false)}
        />
      )}
      {showAdminPrompt && (
        <AdminPasswordModal
          onSuccess={() => { setShowAdminPrompt(false); router.push('/admin') }}
          onClose={() => setShowAdminPrompt(false)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function AdminPasswordModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value === '23') {
      onSuccess()
    } else {
      setError(true)
      setValue('')
      inputRef.current?.focus()
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, width: 320, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: TEXT }}>{t('home.admin.title')}</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: MUTED }}>{t('home.admin.desc')}</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false) }}
            placeholder={t('home.admin.password')}
            style={{
              width: '100%', padding: '10px 14px', boxSizing: 'border-box',
              background: BG, border: `1px solid ${error ? LOSS : BORDER}`,
              borderRadius: 8, fontSize: 15, color: TEXT, outline: 'none', marginBottom: 6,
            }}
          />
          {error && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#f87171' }}>{t('home.admin.incorrectPassword')}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '9px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              style={{ flex: 2, padding: '9px', background: ACCENT, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {t('auth.enter')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children, action, icon }: { title: string; children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5 }}>
          {icon}
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

function PlayerAvatar({ name, avatarUrl, size }: { name: string; avatarUrl?: string | null; size: number }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 900, color: '#fff',
      border: '2px solid rgba(255,255,255,0.1)',
    }}>
      {initials}
    </div>
  )
}

// ─── Pending matches section — home page inline score entry ───────────────────

function HomeMatchesList({ matches, userId }: {
  matches: HomeMatchItem[]
  userId: string
}) {
  const { t } = useTranslation()
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        {t('home.matchesLabel', { n: matches.length })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {matches.map((match) => (
          <HomeMatchCard key={match.id} match={match} userId={userId} />
        ))}
      </div>
    </div>
  )
}

function HomeMatchCard({ match, userId }: { match: HomeMatchItem; userId: string }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showBetModal, setShowBetModal] = useState(false)

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteMatchAction(match.id)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('home.err.failedDelete'))
        setShowDeleteConfirm(false)
      }
    })
  }

  function hdpLabel(h: number) { return h === 0 ? '±0' : h > 0 ? `+${h}` : `${h}` }

  function handleConfirm() {
    const h = parseInt(homeScore, 10)
    const a = parseInt(awayScore, 10)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError(t('home.err.invalidScores'))
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await confirmMatchAction(match.id, h, a)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('home.err.failedScore'))
      }
    })
  }

  const isHome    = match.homePlayerId === userId
  const myPlayer  = isHome ? match.homePlayerName : match.awayPlayerName
  const oppPlayer = isHome ? match.awayPlayerName : match.homePlayerName
  const myShort   = myPlayer.length  > 10 ? myPlayer.slice(0, 9)  + '…' : myPlayer
  const oppShort  = oppPlayer.length > 10 ? oppPlayer.slice(0, 9) + '…' : oppPlayer

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>

      {/* VS row */}
      <div style={{ padding: '13px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <PlayerAvatar name={match.homePlayerName} avatarUrl={match.homePlayerAvatarUrl} size={28} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: match.homePlayerId === userId ? ACCENT : TEXT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90,
          }}>
            {match.homePlayerId === userId ? t('common.you') : match.homePlayerName.split(' ')[0]}
          </span>
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, flexShrink: 0 }}>vs</span>
          <PlayerAvatar name={match.awayPlayerName} avatarUrl={match.awayPlayerAvatarUrl} size={28} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: match.awayPlayerId === userId ? ACCENT : TEXT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90,
          }}>
            {match.awayPlayerId === userId ? t('common.you') : match.awayPlayerName.split(' ')[0]}
          </span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 7px',
          background: 'rgba(245,158,11,0.1)', color: GOLD,
          border: '1px solid rgba(245,158,11,0.25)', borderRadius: 5,
          textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
        }}>{t('home.friendly')}</span>
      </div>

      {/* Probability bar */}
      <div style={{ display: 'flex', height: 3, margin: '0 14px', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${match.homeWinPct}%`, background: ACCENT }} />
        <div style={{ width: `${match.drawPct}%`, background: '#334155' }} />
        <div style={{ width: `${match.awayWinPct}%`, background: LOSS }} />
      </div>

      {/* Odds chips */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
        {[
          { label: '1',   value: match.homeWinOdds.toFixed(2), c: '#60a5fa', bg: 'rgba(37,99,235,0.12)' },
          { label: 'X',   value: match.drawOdds.toFixed(2),    c: TEXT2,     bg: 'rgba(71,85,105,0.2)'  },
          { label: '2',   value: match.awayWinOdds.toFixed(2), c: '#f87171', bg: 'rgba(220,38,38,0.12)' },
          { label: 'HDP', value: hdpLabel(match.homeHandicap), c: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
          ...(match.ouLine ? [{ label: 'O/U', value: match.ouLine, c: GOLD, bg: 'rgba(245,158,11,0.1)' }] : []),
        ].map((chip) => (
          <div key={chip.label} style={{
            flex: 1, textAlign: 'center', padding: '6px 3px',
            background: chip.bg, borderRadius: 8, border: `1px solid ${chip.c}33`,
          }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: chip.c, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{chip.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: chip.c }}>{chip.value}</div>
          </div>
        ))}
      </div>

      {/* Footer: Set Score + Bet + Delete buttons */}
      {!showForm && !showDeleteConfirm && (
        <div style={{ padding: '0 14px 12px', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              flex: 1, padding: '9px',
              background: 'linear-gradient(135deg,#059669,#10b981)',
              color: '#fff', border: 'none', borderRadius: 9,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(16,185,129,0.3)',
            }}
          >
            {t('home.setScore')}
          </button>
          <button
            onClick={() => setShowBetModal(true)}
            style={{
              padding: '9px 14px',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.35)',
              borderRadius: 9, color: '#60a5fa',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Bet
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: '9px 14px',
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
              borderRadius: 9, color: '#f87171',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {t('common.delete')}
          </button>
        </div>
      )}

      {showBetModal && (
        <OddsMarketModal
          matchId={match.id}
          matchType="friendly"
          homeName={match.homePlayerName}
          awayName={match.awayPlayerName}
          matchDateTime={match.createdAt}
          matchStatus={match.status}
          onClose={() => setShowBetModal(false)}
        />
      )}

      {/* Inline delete confirmation */}
      {showDeleteConfirm && (
        <div style={{ borderTop: `1px solid rgba(220,38,38,0.25)`, padding: '12px 14px 14px', background: 'rgba(220,38,38,0.06)' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: TEXT, textAlign: 'center' }}>
            {t('home.removeMatchTitle')}
          </p>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: TEXT2, textAlign: 'center', lineHeight: 1.5 }}>
            {t('home.removeMatchDesc')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              style={{
                flex: 1, padding: '9px',
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`,
                borderRadius: 8, color: TEXT2, fontSize: 13, fontWeight: 600,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                flex: 1, padding: '9px',
                background: isDeleting ? 'rgba(220,38,38,0.3)' : 'linear-gradient(135deg,#b91c1c,#ef4444)',
                border: 'none', borderRadius: 8, color: '#fff',
                fontSize: 13, fontWeight: 700,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                boxShadow: isDeleting ? 'none' : '0 2px 12px rgba(239,68,68,0.35)',
              }}
            >
              {isDeleting ? t('common.deleting') : t('home.yesDelete')}
            </button>
          </div>
        </div>
      )}

      {/* Inline score form */}
      {showForm && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 14px', background: '#07101e' }}>
          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, marginBottom: 10, textAlign: 'center' }}>
            {t('home.enterFinalScore')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: MUTED, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                {myShort}
              </div>
              <input
                type="number" min={0} max={99}
                value={isHome ? homeScore : awayScore}
                onChange={(e) => isHome ? setHomeScore(e.target.value) : setAwayScore(e.target.value)}
                style={{
                  width: 52, textAlign: 'center', padding: '8px 4px',
                  background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORDER}`,
                  borderRadius: 8, fontSize: 22, fontWeight: 900, color: ACCENT, outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: 18, color: MUTED, fontWeight: 700, marginTop: 16 }}>:</span>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: MUTED, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                {oppShort}
              </div>
              <input
                type="number" min={0} max={99}
                value={isHome ? awayScore : homeScore}
                onChange={(e) => isHome ? setAwayScore(e.target.value) : setHomeScore(e.target.value)}
                style={{
                  width: 52, textAlign: 'center', padding: '8px 4px',
                  background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORDER}`,
                  borderRadius: 8, fontSize: 22, fontWeight: 900, color: '#f87171', outline: 'none',
                }}
              />
            </div>
          </div>
          {error && (
            <p style={{ margin: '0 0 8px', fontSize: 11, color: LOSS, textAlign: 'center' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowForm(false); setError(null); setHomeScore(''); setAwayScore('') }}
              style={{
                flex: 1, padding: '9px',
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`,
                borderRadius: 8, color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              style={{
                flex: 2, padding: '9px',
                background: isPending ? MUTED : 'linear-gradient(135deg,#059669,#10b981)',
                border: 'none', borderRadius: 8, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? t('common.saving') : t('home.confirmScore')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultPill({ entry }: { entry: FormEntry }) {
  const isW = entry.result === 'W'
  const isL = entry.result === 'L'
  const color  = isW ? WIN  : isL ? LOSS : DRAW
  const bg     = isW ? 'rgba(16,185,129,0.12)' : isL ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'
  const border = isW ? 'rgba(16,185,129,0.35)'  : isL ? 'rgba(239,68,68,0.35)'  : 'rgba(245,158,11,0.35)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52, flexShrink: 0 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: bg, border: `1.5px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 900, color,
        boxShadow: isW ? '0 0 10px rgba(16,185,129,0.3)' : 'none',
      }}>
        {entry.result}
      </div>
      <div style={{ fontSize: 10, color: TEXT2, fontWeight: 700 }}>
        {entry.goalsFor}–{entry.goalsAgainst}
      </div>
      <div style={{ fontSize: 9, color: MUTED, maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {entry.opponentName.split(' ')[0]}
      </div>
      {entry.matchType === 'championship' && (
        <Trophy size={10} style={{ color: GOLD }} />
      )}
    </div>
  )
}

function ChampCard({
  placement, leader, userId,
}: {
  placement: ChampionshipResult
  leader: ChampionshipLeader | null
  userId: string
}) {
  const { t } = useTranslation()
  const isLeading  = leader?.playerId === userId
  const ptsBehind  = !isLeading && leader ? leader.points - placement.points : 0
  const rankColor  =
    placement.rank === 1 ? GOLD
    : placement.rank === 2 ? '#94a3b8'
    : placement.rank === 3 ? '#cd7c3a'
    : TEXT2

  // Rough progress: matches played vs theoretical max (n-1 opponents × cycles assumed 2 at min)
  const estTotal = Math.max(placement.totalPlayers - 1, 1) * 2
  const progressPct = Math.min(100, Math.round((placement.played / estTotal) * 100))

  return (
    <div style={{
      background: placement.rank === 1
        ? 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(234,88,12,0.05))'
        : CARD,
      border: `1px solid ${placement.rank === 1 ? 'rgba(245,158,11,0.3)' : BORDER}`,
      borderRadius: 14, padding: '16px',
      boxShadow: placement.rank === 1 ? '0 4px 24px rgba(245,158,11,0.1)' : 'none',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: TEXT,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%',
        }}>
          {placement.championshipName}
        </div>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '2px 7px',
          background: 'rgba(16,185,129,0.12)', color: WIN,
          borderRadius: 5, border: '1px solid rgba(16,185,129,0.25)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: WIN, display: 'inline-block', animation: 'live-dot 1.5s ease infinite' }} />
          {t('home.champCard.live')}
        </span>
      </div>

      {/* Leader's avatar + stats — the "champi picture" */}
      {leader ? (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid rgba(255,255,255,0.07)`,
          borderRadius: 10, padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: isLeading ? GOLD : MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 9 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {isLeading ? <Crown size={9} /> : <Trophy size={9} />}
              {isLeading ? t('home.champCard.youreLeading') : t('home.champCard.currentLeader')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <PlayerAvatar name={leader.playerName} avatarUrl={leader.avatarUrl} size={44} />
              {isLeading && (
                <div style={{
                  position: 'absolute', top: -5, right: -5,
                  width: 18, height: 18, background: GOLD,
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 10,
                  boxShadow: '0 0 8px rgba(245,158,11,0.6)',
                }}><Crown size={10} style={{ color: '#fff' }} /></div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: isLeading ? GOLD : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isLeading ? t('common.you') : leader.playerName}
              </div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 3 }}>
                {leader.wins}W {leader.draws}D {leader.losses}L
                {' · '}GD {leader.goalDiff > 0 ? `+${leader.goalDiff}` : leader.goalDiff}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: isLeading ? GOLD : TEXT, lineHeight: 1 }}>
                {leader.points}
              </div>
              <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.pts')}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* User's position (when not leading or no leader data) */}
      {(!isLeading || !leader) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: progressPct > 0 ? 12 : 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: placement.rank <= 3 ? `${rankColor}18` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${placement.rank <= 3 ? `${rankColor}40` : BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: placement.rank <= 3 ? 16 : 13, fontWeight: 900, color: rankColor,
          }}>
            {placement.rank === 1 ? <Trophy size={16} /> : placement.rank === 2 ? <Medal size={15} /> : placement.rank === 3 ? <Medal size={14} /> : `#${placement.rank}`}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: TEXT2 }}>{t('home.champCard.yourPosition', { n: placement.rank })}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
              {placement.points} {t('common.pts')} · {placement.played} {t('common.played')}
              {ptsBehind > 0 && (
                <span style={{ color: LOSS }}> · {t('home.champCard.ptsBehind', { n: ptsBehind })}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: rankColor }}>{placement.points}</div>
            <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.pts')}</div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {progressPct > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>{placement.played} {t('common.played')}</span>
            <span style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>{t('home.champCard.complete', { n: progressPct })}</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2, width: `${progressPct}%`,
              background: placement.rank === 1
                ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                : `linear-gradient(90deg,${ACCENT},#8b5cf6)`,
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

function RivalryCard({ rivalry, userId }: { rivalry: RivalryItem; userId: string }) {
  const { t } = useTranslation()
  const isP1     = rivalry.player1Id === userId
  const myWins   = isP1 ? rivalry.player1Wins : rivalry.player2Wins
  const oppWins  = isP1 ? rivalry.player2Wins : rivalry.player1Wins
  const myName   = isP1 ? rivalry.player1Name : rivalry.player2Name
  const oppName  = isP1 ? rivalry.player2Name : rivalry.player1Name
  const isAhead  = myWins > oppWins
  const isTied   = myWins === oppWins
  const total    = myWins + oppWins
  const myBarPct = total > 0 ? (myWins / total) * 100 : 50

  const statusColor  = isAhead ? WIN : isTied ? DRAW : LOSS
  const borderTint   = isAhead ? 'rgba(16,185,129,0.2)' : isTied ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'
  const barColor     = isAhead
    ? `linear-gradient(90deg,${WIN},#34d399)`
    : isTied
      ? `linear-gradient(90deg,${DRAW},#fbbf24)`
      : LOSS

  return (
    <div style={{
      background: CARD, border: `1px solid ${borderTint}`,
      borderRadius: 14, padding: '14px 16px',
    }}>
      {/* Names row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {myName.split(' ')[0]}
          </div>
          <div style={{ fontSize: 10, color: TEXT2 }}>{t('home.rivalryCard.you')}</div>
        </div>
        <div style={{
          padding: '4px 10px', background: 'rgba(255,255,255,0.06)',
          borderRadius: 8, fontSize: 10, fontWeight: 800, color: MUTED,
          textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
        }}>
          VS
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {oppName.split(' ')[0]}
          </div>
          <div style={{ fontSize: 10, color: TEXT2 }}>{t('home.rivalryCard.opponent')}</div>
        </div>
      </div>

      {/* Score + bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: isAhead ? WIN : TEXT, minWidth: 28, textAlign: 'right', lineHeight: 1 }}>
          {myWins}
        </span>
        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: total > 0 ? `${myBarPct}%` : '50%',
            background: barColor,
          }} />
        </div>
        <span style={{ fontSize: 30, fontWeight: 900, color: !isAhead && !isTied ? LOSS : TEXT, minWidth: 28, lineHeight: 1 }}>
          {oppWins}
        </span>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>
          {isAhead ? t('home.rivalryCard.youreLeading') : isTied ? t('home.rivalryCard.tiedSeries') : t('home.rivalryCard.opponentAhead')}
        </span>
        <span style={{ fontSize: 10, color: MUTED }}>
          BO{rivalry.bestOf} · {total} played
        </span>
      </div>
    </div>
  )
}
