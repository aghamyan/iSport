'use client'

import type { ReactNode } from 'react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import supabase from '@/lib/supabase/client'
import { CreateMatchModal } from '@/app/matches/CreateMatchModal'
import type { ActivePlayer } from '@/app/matches/CreateMatchModal'
import type { PlayerStatsRow, FormEntry, ChampionshipResult, ChampionshipLeader, CurrentChampion } from '@/lib/stats/types'
import { logoutAction } from '@/lib/auth/actions'

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

type Props = {
  userId: string
  isAdmin: boolean
  myName: string
  myAvatarUrl: string | null
  myStats: PlayerStatsRow | null
  rank: number
  totalPlayers: number
  recentForm: FormEntry[]
  champPlacements: ChampionshipResult[]
  champLeaders: ChampionshipLeader[]
  currentChampion: CurrentChampion | null
  rivalries: RivalryItem[]
  players: ActivePlayer[]
  pendingMatchCount: number
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

function getTier(rank: number, total: number) {
  if (rank <= 0 || total <= 0) return null
  if (rank === 1) return { label: 'P4P #1', color: GOLD, icon: '👑' }
  if (rank === 2) return { label: 'Runner-up', color: '#94a3b8', icon: '🥈' }
  if (rank === 3) return { label: '3rd Place', color: '#cd7c3a', icon: '🥉' }
  if (rank <= Math.max(4, Math.ceil(total * 0.4))) return { label: 'Elite', color: '#60a5fa', icon: '⚡' }
  return { label: 'Contender', color: MUTED, icon: '🎯' }
}

// ─── Root component ───────────────────────────────────────────────────────────

export function HomeLoggedIn({
  userId, isAdmin, myName, myAvatarUrl, myStats, rank, totalPlayers,
  recentForm, champPlacements, champLeaders, currentChampion, rivalries, players,
  pendingMatchCount, globalStats,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
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
  const tier     = getTier(rank, totalPlayers)

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
        if (payload.eventType === 'UPDATE' && n.status === 'confirmed') notify('Match confirmed!')
      })
      .subscribe()

    const ch2 = supabase.channel('home-rt-away')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friendly_matches',
        filter: `away_player_id=eq.${userId}`,
      }, (payload) => {
        router.refresh()
        if (payload.eventType === 'INSERT') notify('New match challenge!')
        const n = payload.new as Record<string, unknown>
        if (payload.eventType === 'UPDATE' && n.status === 'confirmed') notify('Match confirmed!')
      })
      .subscribe()

    const ch3 = supabase.channel('home-rt-rivalries')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rivalries',
      }, (payload) => {
        const n = payload.new as Record<string, unknown>
        if (n.player1_id === userId || n.player2_id === userId) {
          router.refresh()
          if (n.status === 'completed') notify('Rivalry completed!')
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
          {isAdmin && (
            <button
              onClick={() => setShowAdminPrompt(true)}
              style={{
                fontSize: 11, color: MUTED, background: 'rgba(255,255,255,0.05)',
                padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer',
              }}
            >
              Admin
            </button>
          )}
          <Link href={`/players/${userId}`} style={{ fontSize: 13, color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>
            Profile →
          </Link>
          <form action={logoutAction}>
            <button type="submit" style={{
              fontSize: 11, color: MUTED, background: 'none',
              border: `1px solid ${BORDER}`, borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer',
            }}>
              Sign out
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
              animation: rank === 1 ? 'ring-gold 2.8s ease-in-out infinite' : 'ring-blue 2.8s ease-in-out infinite',
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
                    {tier.icon} {tier.label}
                  </span>
                )}
                {rank > 0 && (
                  <span style={{ fontSize: 11, color: TEXT2, fontWeight: 600 }}>
                    #{rank} of {totalPlayers}
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
                    🔥 {streak.count} in a row
                  </span>
                )}
                {!hotStreak && streak.type === 'W' && streak.count >= 2 && (
                  <span style={{ fontSize: 11, color: WIN, fontWeight: 600 }}>↑ {streak.count}W streak</span>
                )}
                {streak.type === 'L' && streak.count >= 2 && (
                  <span style={{ fontSize: 11, color: LOSS, fontWeight: 600 }}>↓ {streak.count}L streak</span>
                )}
              </div>
            </div>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
            {([
              { label: 'Wins',   value: stats.wins,     color: WIN,       bg: 'rgba(16,185,129,0.1)',  bd: 'rgba(16,185,129,0.25)' },
              { label: 'Losses', value: stats.losses,   color: LOSS,      bg: 'rgba(239,68,68,0.1)',   bd: 'rgba(239,68,68,0.25)'  },
              { label: 'Draws',  value: stats.draws,    color: DRAW,      bg: 'rgba(245,158,11,0.1)',  bd: 'rgba(245,158,11,0.25)' },
              { label: 'Goals',  value: stats.goalsFor, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', bd: 'rgba(96,165,250,0.25)' },
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
                  Win Rate
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
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12, color: TEXT2, flexWrap: 'wrap', flex: 1 }}>
              <span>
                <strong style={{ color: TEXT, fontWeight: 800 }}>{globalStats.totalMatches}</strong> matches
              </span>
              <span style={{ color: BORDER }}>·</span>
              <span>
                <strong style={{ color: TEXT, fontWeight: 800 }}>{globalStats.totalGoals}</strong> goals
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
                      : <span>⚽</span>
                    }
                    <strong style={{ color: GOLD, fontWeight: 700 }}>{globalStats.topScorerName}</strong>
                    <span style={{ color: MUTED }}>top scorer ({globalStats.topScorerGoals}g)</span>
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Pending match banner ─────────────────────────────── */}
        {pendingMatchCount > 0 && (
          <Link href="/leaderboard" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
            <div style={{
              background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,88,12,0.08))',
              border: `1px solid rgba(245,158,11,0.35)`,
              borderRadius: 12, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>⏳</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>
                {pendingMatchCount} match{pendingMatchCount > 1 ? 'es' : ''} awaiting your confirmation
              </span>
              <span style={{ fontSize: 13, color: MUTED }}>→</span>
            </div>
          </Link>
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
          Record a Match
        </button>

        {/* ── Quick nav ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 30 }}>
          {([
            { label: 'Leaderboard',   href: '/leaderboard',   icon: '📊' },
            { label: 'Championships', href: '/championships', icon: '🏆' },
            { label: 'Rivalries',     href: '/rivalries',     icon: '⚔️' },
          ] as const).map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: CARD, border: `1px solid ${BORDER}`,
                borderRadius: 12, padding: '14px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 22, marginBottom: 5 }}>{item.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.label}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Current Champion ──────────────────────────────────── */}
        {currentChampion && (
          <Section title="Current Champion" icon="🏆">
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
                  }}>🏆</div>
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
                  <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Pts</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{currentChampion.points}</div>
                </div>
              </div>
            </Link>
          </Section>
        )}

        {/* ── Recent form ───────────────────────────────────────── */}
        {recentForm.length > 0 && (
          <Section title="Recent Form" icon="📈">
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
            title="My Championships"
            icon="🏆"
            action={<Link href="/championships" style={{ fontSize: 12, color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>View all →</Link>}
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
            title="My Rivalries"
            icon="⚔️"
            action={<Link href="/rivalries" style={{ fontSize: 12, color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>View all →</Link>}
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
            title="Past Championships"
            action={<Link href="/championships" style={{ fontSize: 12, color: MUTED, textDecoration: 'none' }}>View all →</Link>}
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
                      {c.rank === 1 ? '🏆' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : `#${c.rank}`}
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
                        {c.points} pts
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
            <div style={{ fontSize: 52, marginBottom: 14 }}>⚽</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Ready to compete?</div>
            <div style={{ fontSize: 14, color: TEXT2, marginBottom: 24, lineHeight: 1.6 }}>
              Record your first match and start climbing<br />the leaderboard
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
              + Record First Match
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom nav ────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(12,20,34,0.96)', backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${BORDER}`,
        display: 'flex', zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {([
          { label: 'Home',    href: '/',                  icon: '🏠' },
          { label: 'Stats',   href: '/leaderboard',       icon: '📊' },
          { label: 'Champs',  href: '/championships',     icon: '🏆' },
          { label: 'Rivals',  href: '/rivalries',         icon: '⚔️' },
          { label: 'Profile', href: `/players/${userId}`, icon: '👤' },
        ] as const).map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 4px 8px', textDecoration: 'none', gap: 2,
              borderTop: `2px solid ${isActive ? ACCENT : 'transparent'}`,
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: isActive ? ACCENT : MUTED,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showAddMatch && (
        <CreateMatchModal
          currentUserId={userId}
          currentUserName={myName}
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
        <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: TEXT }}>Admin Access</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: MUTED }}>Enter the admin password to continue.</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false) }}
            placeholder="Password"
            style={{
              width: '100%', padding: '10px 14px', boxSizing: 'border-box',
              background: BG, border: `1px solid ${error ? LOSS : BORDER}`,
              borderRadius: 8, fontSize: 15, color: TEXT, outline: 'none', marginBottom: 6,
            }}
          />
          {error && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#f87171' }}>Incorrect password</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '9px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ flex: 2, padding: '9px', background: ACCENT, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Enter
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children, action, icon }: { title: string; children: ReactNode; action?: ReactNode; icon?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5 }}>
          {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
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
        <div style={{ fontSize: 8, color: GOLD, fontWeight: 700 }}>🏆</div>
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
          Live
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
            {isLeading ? '👑 You\'re Leading' : '🏆 Current Leader'}
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
                }}>👑</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: isLeading ? GOLD : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isLeading ? 'You' : leader.playerName}
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
              <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>pts</div>
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
            {placement.rank === 1 ? '🏆' : placement.rank === 2 ? '🥈' : placement.rank === 3 ? '🥉' : `#${placement.rank}`}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: TEXT2 }}>Your position #{placement.rank}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
              {placement.points} pts · {placement.played} played
              {ptsBehind > 0 && (
                <span style={{ color: LOSS }}> · {ptsBehind} pts behind</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: rankColor }}>{placement.points}</div>
            <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>pts</div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {progressPct > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>{placement.played} played</span>
            <span style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>{progressPct}% complete</span>
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
          <div style={{ fontSize: 10, color: TEXT2 }}>You</div>
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
          <div style={{ fontSize: 10, color: TEXT2 }}>Opponent</div>
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
          {isAhead ? '↑ You\'re leading' : isTied ? '= Tied series' : '↓ Opponent ahead'}
        </span>
        <span style={{ fontSize: 10, color: MUTED }}>
          BO{rivalry.bestOf} · {total} played
        </span>
      </div>
    </div>
  )
}
