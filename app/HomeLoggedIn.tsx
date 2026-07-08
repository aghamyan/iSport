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
import { BetNotificationCenter } from '@/app/components/BetNotificationCenter'
import { BottomNav } from '@/app/components/BottomNav'
import { NumberTicker } from '@/app/components/magicui/number-ticker'
import { ShimmerButton } from '@/app/components/magicui/shimmer-button'
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
  heroBannerUrl?: string | null
  heroBannerPosition?: string | null
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG     = 'var(--bg)'
const CARD   = 'var(--card)'
const BORDER = 'var(--border)'
const ACCENT = 'var(--accent)'
const GOLD   = 'var(--gold)'
const TEXT   = 'var(--text)'
const TEXT2  = 'var(--text2)'
const MUTED  = 'var(--muted)'
const WIN    = 'var(--win)'
const LOSS   = 'var(--accent)'
const DRAW   = 'var(--draw)'

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
  if (rank === 2) return { labelKey: 'home.tier.runnerUp', color: '#64748B', icon: <Medal size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
  if (rank === 3) return { labelKey: 'home.tier.thirdPlace', color: '#cd7c3a', icon: <Medal size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
  if (rank <= Math.max(4, Math.ceil(total * 0.4))) return { labelKey: 'home.tier.elite', color: '#2563EB', icon: <Zap size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
  return { labelKey: 'home.tier.contender', color: MUTED, icon: <Target size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> }
}

// ─── Root component ───────────────────────────────────────────────────────────

export function HomeLoggedIn({
  userId, isAdmin, myName, myAvatarUrl, myStats, rank, p4pRank, totalPlayers,
  recentForm, champPlacements, champLeaders, currentChampion, rivalries, players,
  pendingMatches, globalStats, heroBannerUrl, heroBannerPosition,
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
    <div className="app-page" style={{ minHeight: '100svh', background: BG, fontFamily: 'system-ui, sans-serif', color: TEXT, paddingBottom: 'var(--nav-h)' }}>

      {/* ── CSS animations ──────────────────────────────────────────── */}
      <style>{`
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
        @keyframes mosaic-reveal {
          from { opacity:0; transform:scale(1.05); }
          to   { opacity:1; transform:scale(1); }
        }
        .mosaic-cell { animation: mosaic-reveal .55s ease both; overflow: hidden; }
        .mosaic-cell:nth-child(1) { animation-delay:.00s; }
        .mosaic-cell:nth-child(2) { animation-delay:.06s; }
        .mosaic-cell:nth-child(3) { animation-delay:.12s; }
        .mosaic-cell:nth-child(4) { animation-delay:.18s; }
        .mosaic-cell:nth-child(5) { animation-delay:.24s; }
        .mosaic-cell:nth-child(6) { animation-delay:.30s; }
        .mosaic-cell:nth-child(7) { animation-delay:.36s; }
        .champ-card { animation: slide-up .4s ease both; }
        .champ-card:nth-child(2) { animation-delay:.06s; }
        .champ-card:nth-child(3) { animation-delay:.12s; }
        .rival-card { animation: slide-up .4s ease both; }
        .rival-card:nth-child(2) { animation-delay:.06s; }
        .rival-card:nth-child(3) { animation-delay:.12s; }
        .nav-card { transition: opacity .15s ease; cursor: pointer; }
        .nav-card:hover { opacity: 0.82; }
        .nav-card:active { opacity: 0.65; }
        .nav-icon { transition: transform .2s ease; }
        .nav-card:hover .nav-icon { transform: scale(1.08); }
        .champ-past-row { transition: background .15s ease; }
        .champ-past-row:hover { background: rgba(var(--rgb-overlay),0.04) !important; }
        .champ-past-row:active { opacity: 0.8; }
        .rival-link-row { transition: filter .15s ease; }
        .rival-link-row:hover { filter: brightness(0.97); }
        .rival-link-row:active { filter: brightness(0.93); }
        .event-card-btn { transition: opacity .15s ease; }
        .event-card-btn:hover { opacity: 0.85; }
      `}</style>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card)',
          border: `1px solid ${BORDER}`,
          borderLeft: `3px solid ${ACCENT}`,
          borderRadius: 10, padding: '10px 20px',
          fontSize: 13, fontWeight: 700, color: TEXT,
          boxShadow: '0 4px 20px rgba(var(--rgb-overlay),0.12)',
          zIndex: 100, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* ── HERO BANNER / MOSAIC ──────────────────────────────────── */}
      <div>
        {heroBannerUrl
          ? <HeroBanner url={heroBannerUrl} position={heroBannerPosition ?? undefined} />
          : <PhotoMosaic myName={myName} myAvatarUrl={myAvatarUrl} players={players} userId={userId} />
        }

        {/* ── Editorial info ─────────────────────────────────────── */}
        <div style={{ background: '#0C0C0C', padding: '20px 20px 24px' }}>

          {/* Label row */}
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            {tier && (
              <span style={{ color: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {tier.icon} {t(tier.labelKey)}
              </span>
            )}
            {p4pRank > 0 && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.18)' }}>|</span>
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>#{p4pRank} {t('lb.ofPlayers', { n: totalPlayers })}</span>
              </>
            )}
            {hotStreak && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.18)' }}>|</span>
                <span style={{ color: '#fb923c', animation: 'fire-bounce 1.6s ease infinite', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Flame size={10} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                  {t('home.streak.inARow', { n: streak.count })}
                </span>
              </>
            )}
            {!hotStreak && streak.type === 'W' && streak.count >= 2 && (
              <span style={{ color: '#22c55e' }}>{t('home.streak.wStreak', { n: streak.count })}</span>
            )}
            {streak.type === 'L' && streak.count >= 2 && (
              <span style={{ color: '#f87171' }}>{t('home.streak.lStreak', { n: streak.count })}</span>
            )}
          </div>

          {/* Player name — editorial large */}
          <h1 style={{
            fontSize: 34, fontWeight: 900, color: '#FFFFFF',
            letterSpacing: '-0.02em', textTransform: 'uppercase',
            lineHeight: 1, margin: '0 0 18px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {myName}
          </h1>

          {/* Stats row */}
          <div style={{ display: 'flex', marginBottom: 18 }}>
            {([
              { label: t('common.wins'),   value: stats.wins,     color: '#22C55E' },
              { label: t('common.losses'), value: stats.losses,   color: '#f87171' },
              { label: t('common.draws'),  value: stats.draws,    color: '#FBBF24' },
              { label: t('common.goals'),  value: stats.goalsFor, color: '#60a5fa' },
            ] as { label: string; value: number; color: string }[]).map(({ label, value, color }, i, arr) => (
              <div key={label} style={{
                flex: 1, textAlign: 'center',
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}>
                <NumberTicker value={value} style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1, display: 'block' }} />
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Win rate bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('common.winRate')}
              </span>
              <span style={{ fontSize: 14, fontWeight: 900, color: winRate >= 60 ? '#22c55e' : winRate >= 40 ? '#FBBF24' : 'rgba(255,255,255,0.35)' }}>
                {winRate}%
              </span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2, width: `${winRate}%`,
                background: winRate >= 60
                  ? 'linear-gradient(90deg,#16A34A,#22c55e)'
                  : winRate >= 40
                    ? 'linear-gradient(90deg,#D97706,#FBBF24)'
                    : '#4B5563',
              }} />
            </div>
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <ShimmerButton
              onClick={() => setShowAddMatch(true)}
              background="linear-gradient(135deg,#DC2626 0%,#B91C1C 100%)"
              style={{
                flex: 1, padding: '13px',
                color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '0.07em',
                textTransform: 'uppercase',
                boxShadow: '0 4px 24px rgba(220,38,38,0.4)',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
              {t('home.recordMatch')}
            </ShimmerButton>
            <Link href={`/players/${userId}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
              <div style={{
                padding: '13px 18px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: 100, color: 'rgba(255,255,255,0.8)',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {t('common.viewAll')}
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="page-content" style={{ padding: '0 20px 20px' }}>

        {/* ── Community pulse ─────────────────────────────────────── */}
        {(globalStats.totalMatches > 0 || globalStats.totalGoals > 0) && (
          <div style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 16, marginBottom: 18,
            overflow: 'hidden', position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: ACCENT }} />
            <div style={{ padding: '14px 18px 15px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap size={11} style={{ color: ACCENT }} />
                Community
              </div>
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, textAlign: 'center', borderRight: `1px solid ${BORDER}`, paddingRight: 12 }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: TEXT, lineHeight: 1 }}>{globalStats.totalMatches}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, marginTop: 3 }}>{t('home.community.matches')}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', paddingLeft: 12, ...(globalStats.topScorerName && globalStats.topScorerGoals > 0 ? { borderRight: `1px solid ${BORDER}`, paddingRight: 12 } : {}) }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: TEXT, lineHeight: 1 }}>{globalStats.totalGoals}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, marginTop: 3 }}>{t('home.community.goals')}</div>
                </div>
                {globalStats.topScorerName && globalStats.topScorerGoals > 0 && (
                  <div style={{ flex: 1.4, textAlign: 'center', paddingLeft: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 2 }}>
                      {globalStats.topScorerAvatarUrl
                        ? <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--card)', border: '1px solid rgba(var(--rgb-overlay),0.1)', overflow: 'hidden', flexShrink: 0 }}><img src={globalStats.topScorerAvatarUrl} alt={globalStats.topScorerName} width={20} height={20} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>
                        : <Trophy size={14} style={{ color: GOLD }} />
                      }
                      <span style={{ fontSize: 14, fontWeight: 800, color: GOLD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72 }}>
                        {globalStats.topScorerName.split(' ')[0]}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{t('home.community.topScorer', { n: globalStats.topScorerGoals })}</div>
                  </div>
                )}
              </div>
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

        {/* ── Quick nav (UFC card style) ─────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 28, overflow: 'hidden', borderRadius: 16, border: `1px solid ${BORDER}` }}>
          {([
            { label: t('home.quickNav.leaderboard'),   href: '/leaderboard',   icon: <BarChart3 size={22} style={{ color: ACCENT }} />,   accentColor: ACCENT   },
            { label: t('home.quickNav.championships'), href: '/championships', icon: <Trophy    size={22} style={{ color: GOLD   }} />,   accentColor: GOLD     },
            { label: t('home.quickNav.rivalries'),     href: '/rivalries',     icon: <Swords   size={22} style={{ color: '#a78bfa' }} />, accentColor: '#a78bfa' },
          ] as { label: string; href: string; icon: ReactNode; accentColor: string }[]).map((item, i) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className="nav-card" style={{
                background: CARD,
                borderRight: i < 2 ? `1px solid ${BORDER}` : 'none',
                padding: '18px 8px 16px', textAlign: 'center',
              }}>
                <div style={{
                  width: 3, height: 3, borderRadius: '50%',
                  background: item.accentColor,
                  margin: '0 auto 10px',
                  boxShadow: `0 0 8px ${item.accentColor}`,
                }} />
                <div className="nav-icon" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                <Link key={r.id} href={`/rivalries/${r.id}`} style={{ textDecoration: 'none' }} className="rival-card rival-link-row">
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
                  <div className="champ-past-row" style={{
                    background: CARD, border: `1px solid ${BORDER}`,
                    borderRadius: 10, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: c.rank === 1 ? 'rgba(245,158,11,0.15)' : 'rgba(var(--rgb-overlay),0.025)',
                      border: `1px solid ${c.rank === 1 ? 'rgba(245,158,11,0.35)' : BORDER}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: c.rank <= 3 ? 16 : 12, fontWeight: 900,
                      color: c.rank === 1 ? GOLD : c.rank === 2 ? '#64748B' : c.rank === 3 ? '#cd7c3a' : MUTED,
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
            background: 'var(--card)',
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
            <ShimmerButton
              onClick={() => setShowAddMatch(true)}
              background="linear-gradient(135deg,#DC2626 0%,#B91C1C 100%)"
              borderRadius="10px"
              style={{
                padding: '12px 32px',
                color: '#fff',
                fontSize: 15, fontWeight: 800,
                boxShadow: '0 4px 20px rgba(220,38,38,0.3)',
              }}
            >
              {t('home.recordFirstMatch')}
            </ShimmerButton>
          </div>
        )}
      </div>

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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, paddingBottom: 10,
        borderBottom: `2px solid ${ACCENT}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: TEXT, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
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
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--card)',
        border: '2px solid rgba(var(--rgb-overlay),0.08)',
        overflow: 'hidden',
      }}>
        <img
          src={avatarUrl}
          alt={name}
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 900, color: '#fff',
      border: '2px solid rgba(var(--rgb-overlay),0.05)',
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
    <div style={{
      marginBottom: 20,
      background: '#0C0C0C',
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid rgba(255,255,255,0.06)`,
    }}>
      {/* Header row */}
      <div style={{
        padding: '12px 16px 10px',
        display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: ACCENT, animation: 'live-dot 1.5s ease infinite',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          {t('home.matchesLabel', { n: matches.length })}
        </span>
      </div>
      {/* Card grid — 2 columns for 2+ matches, 1 col for single */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: matches.length === 1 ? '1fr' : 'repeat(2,1fr)',
      }}>
        {matches.map((match, i) => (
          <HomeMatchCard key={match.id} match={match} userId={userId} colIndex={i} totalCount={matches.length} />
        ))}
      </div>
    </div>
  )
}

function HomeMatchCard({ match, userId, colIndex, totalCount }: { match: HomeMatchItem; userId: string; colIndex: number; totalCount: number }) {
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

  const isRightCol = totalCount > 1 && colIndex % 2 === 1
  const hasMoreBelow = totalCount > 2 && colIndex < totalCount - 2

  return (
    <div style={{
      borderRight: !isRightCol && totalCount > 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
      borderBottom: hasMoreBelow ? '1px solid rgba(255,255,255,0.07)' : 'none',
      overflow: 'hidden',
    }}>

      {/* Player avatars — UFC promo style */}
      <div style={{ padding: '14px 14px 0', display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <PlayerAvatar name={match.homePlayerName} avatarUrl={match.homePlayerAvatarUrl} size={40} />
          <span style={{
            fontSize: 9, fontWeight: 700, color: match.homePlayerId === userId ? ACCENT : 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
            maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {match.homePlayerId === userId ? t('common.you') : match.homePlayerName.split(' ')[0]}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.05em', flexShrink: 0, paddingBottom: 18,
        }}>VS</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <PlayerAvatar name={match.awayPlayerName} avatarUrl={match.awayPlayerAvatarUrl} size={40} />
          <span style={{
            fontSize: 9, fontWeight: 700, color: match.awayPlayerId === userId ? ACCENT : 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
            maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {match.awayPlayerId === userId ? t('common.you') : match.awayPlayerName.split(' ')[0]}
          </span>
        </div>
      </div>

      {/* Event label + match title */}
      <div style={{ padding: '0 14px 4px' }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 3 }}>
          {t('home.friendly')} · {t('home.matchesLabel', { n: 1 }).split(' ')[0]}
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', textTransform: 'uppercase', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
          {match.homePlayerName.split(' ')[0]} VS {match.awayPlayerName.split(' ')[0]}
        </div>
      </div>

      {/* Probability bar */}
      <div style={{ display: 'flex', height: 2, margin: '10px 14px 0' }}>
        <div style={{ width: `${match.homeWinPct}%`, background: '#2563EB' }} />
        <div style={{ width: `${match.drawPct}%`, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ width: `${match.awayWinPct}%`, background: ACCENT }} />
      </div>

      {/* Odds chips */}
      <div style={{ padding: '8px 14px 0', display: 'flex', gap: 4 }}>
        {[
          { label: '1',   value: match.homeWinOdds.toFixed(2), c: '#60a5fa' },
          { label: 'X',   value: match.drawOdds.toFixed(2),    c: 'rgba(255,255,255,0.4)' },
          { label: '2',   value: match.awayWinOdds.toFixed(2), c: '#f87171' },
          { label: 'HDP', value: hdpLabel(match.homeHandicap), c: '#a78bfa' },
          ...(match.ouLine ? [{ label: 'O/U', value: match.ouLine, c: GOLD }] : []),
        ].map((chip) => (
          <div key={chip.label} style={{
            flex: 1, textAlign: 'center', padding: '5px 2px',
            background: 'rgba(255,255,255,0.04)', borderRadius: 5,
          }}>
            <div style={{ fontSize: 6, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>{chip.label}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: chip.c }}>{chip.value}</div>
          </div>
        ))}
      </div>

      {/* Footer: action buttons */}
      {!showForm && !showDeleteConfirm && (
        <div style={{ padding: '10px 14px 14px', display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShowForm(true)}
            className="event-card-btn"
            style={{
              flex: 1, padding: '10px 6px', minHeight: 44,
              background: 'linear-gradient(135deg,#059669,#10b981)',
              color: '#fff', border: 'none', borderRadius: 7,
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            {t('home.setScore')}
          </button>
          <button
            onClick={() => setShowBetModal(true)}
            className="event-card-btn"
            style={{
              padding: '10px 12px', minHeight: 44, minWidth: 44,
              background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
              borderRadius: 7, color: '#60a5fa',
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Bet
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="event-card-btn"
            style={{
              padding: '10px 10px', minHeight: 44, minWidth: 44,
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 7, color: '#f87171',
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕
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
        <div style={{ borderTop: '1px solid rgba(220,38,38,0.2)', padding: '12px 14px 14px', background: 'rgba(220,38,38,0.06)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
            {t('home.removeMatchTitle')}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.5 }}>
            {t('home.removeMatchDesc')}
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              style={{
                flex: 1, padding: '8px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                flex: 1, padding: '8px',
                background: isDeleting ? 'rgba(220,38,38,0.3)' : 'linear-gradient(135deg,#b91c1c,#ef4444)',
                border: 'none', borderRadius: 7, color: '#fff',
                fontSize: 12, fontWeight: 700,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
              }}
            >
              {isDeleting ? t('common.deleting') : t('home.yesDelete')}
            </button>
          </div>
        </div>
      )}

      {/* Inline score form */}
      {showForm && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px 14px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('home.enterFinalScore')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                {myShort}
              </div>
              <input
                type="number" min={0} max={99}
                value={isHome ? homeScore : awayScore}
                onChange={(e) => isHome ? setHomeScore(e.target.value) : setAwayScore(e.target.value)}
                style={{
                  width: 52, textAlign: 'center', padding: '8px 4px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, fontSize: 22, fontWeight: 900, color: ACCENT, outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)', fontWeight: 700, marginTop: 16 }}>:</span>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                {oppShort}
              </div>
              <input
                type="number" min={0} max={99}
                value={isHome ? awayScore : homeScore}
                onChange={(e) => isHome ? setAwayScore(e.target.value) : setHomeScore(e.target.value)}
                style={{
                  width: 52, textAlign: 'center', padding: '8px 4px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, fontSize: 22, fontWeight: 900, color: '#f87171', outline: 'none',
                }}
              />
            </div>
          </div>
          {error && (
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#f87171', textAlign: 'center' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setShowForm(false); setError(null); setHomeScore(''); setAwayScore('') }}
              style={{
                flex: 1, padding: '8px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              style={{
                flex: 2, padding: '8px',
                background: isPending ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#059669,#10b981)',
                border: 'none', borderRadius: 7, color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer',
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
    : placement.rank === 2 ? '#64748B'
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
          background: 'rgba(var(--rgb-overlay),0.025)',
          border: `1px solid rgba(var(--rgb-overlay),0.04)`,
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
            background: placement.rank <= 3 ? `${rankColor}18` : 'rgba(var(--rgb-overlay),0.025)',
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
          <div style={{ height: 3, background: 'rgba(var(--rgb-overlay),0.035)', borderRadius: 2 }}>
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
          padding: '4px 10px', background: 'rgba(var(--rgb-overlay),0.035)',
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
        <div style={{ flex: 1, height: 6, background: 'rgba(var(--rgb-overlay),0.04)', borderRadius: 3, overflow: 'hidden' }}>
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

// ─── Hero Banner ──────────────────────────────────────────────────────────────

function HeroBanner({ url, position }: { url: string; position?: string }) {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 216,
      background: '#0C0C0C',
      overflow: 'hidden',
    }}>
      {/* Full-bleed photo */}
      <img
        src={url}
        alt="Hero banner"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: position || 'center top',
          display: 'block',
        }}
      />

      {/* Cinematic gradient overlay — dark at bottom, subtle at top */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.18) 40%, rgba(12,12,12,0.78) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Subtle left-edge vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to right, rgba(0,0,0,0.22) 0%, transparent 40%)',
        pointerEvents: 'none',
      }} />

      {/* Red accent bar at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: '#DC2626',
      }} />
    </div>
  )
}

// ─── Photo Mosaic ─────────────────────────────────────────────────────────────

const CELL_GRADIENTS = [
  'linear-gradient(160deg,#1a0a2e 0%,#0e0618 100%)',
  'linear-gradient(160deg,#0a1e2e 0%,#060e18 100%)',
  'linear-gradient(160deg,#1a0a0a 0%,#0e0606 100%)',
  'linear-gradient(160deg,#0a1a0a 0%,#060e06 100%)',
  'linear-gradient(160deg,#1a1a0a 0%,#0e0e06 100%)',
  'linear-gradient(160deg,#0a1a1a 0%,#060e0e 100%)',
  'linear-gradient(160deg,#1a0e18 0%,#0a060e 100%)',
]

function MosaicCell({ name, avatarUrl, isMe, size }: {
  name: string
  avatarUrl?: string | null
  isMe?: boolean
  size: 'large' | 'small'
}) {
  const hash     = name ? (name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % CELL_GRADIENTS.length : 0
  const gradient = CELL_GRADIENTS[hash]
  const initials = name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : ''

  return (
    <div style={{
      width: '100%', height: '100%',
      background: gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      {avatarUrl ? (
        <img
          src={avatarUrl} alt={name || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
        />
      ) : initials ? (
        <span style={{
          fontSize: size === 'large' ? 42 : 20,
          fontWeight: 900, color: 'rgba(255,255,255,0.35)',
          letterSpacing: '-0.03em', userSelect: 'none',
        }}>
          {initials}
        </span>
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#111' }} />
      )}
      {/* Subtle vignette on every cell */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.22) 100%)',
        pointerEvents: 'none',
      }} />
      {isMe && (
        <div style={{
          position: 'absolute', bottom: 5, left: 5,
          background: 'rgba(220,38,38,0.9)',
          color: '#fff', fontSize: 8, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '2px 6px', borderRadius: 3,
        }}>
          YOU
        </div>
      )}
    </div>
  )
}

function PhotoMosaic({ myName, myAvatarUrl, players, userId }: {
  myName: string
  myAvatarUrl: string | null
  players: ActivePlayer[]
  userId: string
}) {
  const others = players.filter((p) => p.id !== userId).slice(0, 6)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gridTemplateRows: '128px 88px',
      gap: 2,
      background: '#0C0C0C',
    }}>
      {/* Large cell — me */}
      <div className="mosaic-cell" style={{ gridColumn: '1/3', gridRow: '1/2', position: 'relative' }}>
        <MosaicCell name={myName} avatarUrl={myAvatarUrl} isMe size="large" />
      </div>

      {/* Row 1 — 2 small cells */}
      {[0, 1].map((i) => (
        <div key={`r1-${i}`} className="mosaic-cell" style={{ position: 'relative' }}>
          <MosaicCell
            name={others[i]?.displayName ?? ''}
            avatarUrl={others[i]?.avatarUrl}
            size="small"
          />
        </div>
      ))}

      {/* Row 2 — 4 small cells */}
      {[2, 3, 4, 5].map((i) => (
        <div key={`r2-${i}`} className="mosaic-cell" style={{ position: 'relative' }}>
          <MosaicCell
            name={others[i]?.displayName ?? ''}
            avatarUrl={others[i]?.avatarUrl}
            size="small"
          />
        </div>
      ))}

      {/* Red accent bar at bottom */}
      <div style={{
        gridColumn: '1/-1',
        height: 3,
        background: '#DC2626',
      }} />
    </div>
  )
}
