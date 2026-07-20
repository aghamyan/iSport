'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trophy, TrendingUp, Swords } from 'lucide-react'
import supabase from '@/lib/supabase/client'
import { CreateMatchModal } from '@/app/matches/CreateMatchModal'
import type { ActivePlayer } from '@/app/matches/CreateMatchModal'
import type {
  PlayerStatsRow, FormEntry, ChampionshipResult, ChampionshipLeader, CurrentChampion, NamedPlayerStats,
} from '@/lib/stats/types'
import { BottomNav } from '@/app/components/BottomNav'
import { useTranslation } from '@/lib/i18n/context'
import { Toaster } from '@/components/ui/sonner'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { homeHeadingFont, homeBodyFont } from './home/fonts'
import { HeroIdentity } from './home/HeroIdentity'
import { PendingMatches } from './home/PendingMatches'
import { StandingsTable } from './home/StandingsTable'
import { FormTrendChart } from './home/FormTrendChart'
import { computeStreak } from './home/homeHelpers'
import {
  SectionHeader, SectionAction, FormStrip, CommunityPulse, QuickNav,
  CurrentChampionBanner, ChampionshipRow, RivalryRow, PastChampionshipRow,
} from './home/CompactSections'

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
  myName: string
  myAvatarUrl: string | null
  myStats: PlayerStatsRow | null
  p4pRank: number
  totalPlayers: number
  recentForm: FormEntry[]
  champPlacements: ChampionshipResult[]
  champLeaders: ChampionshipLeader[]
  currentChampion: CurrentChampion | null
  rivalries: RivalryItem[]
  players: ActivePlayer[]
  leaderboard: NamedPlayerStats[]
  pendingMatches: HomeMatchItem[]
  globalStats: GlobalStats
  heroBannerUrl?: string | null
  heroBannerPosition?: string | null
}

// ─── Root component ───────────────────────────────────────────────────────────

export function HomeLoggedIn({
  userId, myName, myAvatarUrl, myStats, p4pRank, totalPlayers,
  recentForm, champPlacements, champLeaders, currentChampion, rivalries, players,
  leaderboard, pendingMatches, globalStats, heroBannerUrl, heroBannerPosition,
}: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const [showAddMatch, setShowAddMatch] = useState(false)

  const stats = myStats ?? {
    wins: 0, losses: 0, draws: 0, matchesPlayed: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0, winRate: 0,
  }

  const activeChamps = champPlacements.filter((c) => c.isActive)
  const completedChamps = champPlacements.filter((c) => !c.isActive)
  const activeRivalries = rivalries.filter((r) => r.status === 'active')
  const winRate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0
  const streak = computeStreak(recentForm)

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch1 = supabase.channel('home-rt-home')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friendly_matches',
        filter: `home_player_id=eq.${userId}`,
      }, (payload) => {
        router.refresh()
        const n = payload.new as Record<string, unknown>
        if (payload.eventType === 'UPDATE' && n.status === 'confirmed') toast(t('home.toast.confirmed'))
      })
      .subscribe()

    const ch2 = supabase.channel('home-rt-away')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friendly_matches',
        filter: `away_player_id=eq.${userId}`,
      }, (payload) => {
        router.refresh()
        const n = payload.new as Record<string, unknown>
        if (payload.eventType === 'INSERT') toast(t('home.toast.newMatch'))
        if (payload.eventType === 'UPDATE' && n.status === 'confirmed') toast(t('home.toast.scoreConfirmed'))
      })
      .subscribe()

    const ch3 = supabase.channel('home-rt-rivalries')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rivalries',
      }, (payload) => {
        const n = payload.new as Record<string, unknown>
        if (n.player1_id === userId || n.player2_id === userId) {
          router.refresh()
          if (n.status === 'completed') toast(t('home.toast.rivalryCompleted'))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
      supabase.removeChannel(ch3)
    }
  }, [userId, router, t])

  return (
    <div className={`${homeHeadingFont.variable} ${homeBodyFont.variable} app-page min-h-[100svh] bg-background font-sans text-foreground`} style={{ paddingBottom: 'var(--nav-h)' }}>
      <Toaster position="top-center" />

      <HeroIdentity
        myName={myName}
        myAvatarUrl={myAvatarUrl}
        userId={userId}
        players={players}
        heroBannerUrl={heroBannerUrl}
        heroBannerPosition={heroBannerPosition}
        stats={stats}
        winRate={winRate}
        p4pRank={p4pRank}
        totalPlayers={totalPlayers}
        streak={streak}
        onRecordMatch={() => setShowAddMatch(true)}
      />

      <div className="page-content px-4 pt-4 pb-6 sm:px-6">
        <CommunityPulse
          stats={globalStats}
          label={{
            matches: t('home.community.matches'),
            goals: t('home.community.goals'),
            topScorer: (n) => t('home.community.topScorer', { n }),
          }}
        />

        <PendingMatches matches={pendingMatches} userId={userId} />

        <QuickNav
          labels={{
            leaderboard: t('home.quickNav.leaderboard'),
            championships: t('home.quickNav.championships'),
            rivalries: t('home.quickNav.rivalries'),
          }}
        />

        {currentChampion && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.currentChampion')} icon={<Trophy className="size-3.5 text-gold" />} />
            <CurrentChampionBanner champion={currentChampion} ptsLabel={t('common.pts').toUpperCase()} />
          </section>
        )}

        {recentForm.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              title={t('home.section.recentForm')}
              icon={<TrendingUp className="size-3.5 text-win" />}
              action={<SectionAction href={`/players/${userId}`}>{t('common.viewAll')}</SectionAction>}
            />
            <FormStrip form={recentForm} />
            <FormTrendChart form={recentForm} />
          </section>
        )}

        {leaderboard.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              title={t('lb.title')}
              icon={<Trophy className="size-3.5 text-primary" />}
              action={<SectionAction href="/leaderboard">{t('common.viewAll')}</SectionAction>}
            />
            <StandingsTable players={leaderboard.slice(0, 8)} currentUserId={userId} />
          </section>
        )}

        {activeChamps.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              title={t('home.section.myChampionships')}
              icon={<Trophy className="size-3.5 text-gold" />}
              action={<SectionAction href="/championships">{t('common.viewAll')}</SectionAction>}
            />
            <div className="flex flex-col gap-2.5">
              {activeChamps.map((c) => (
                <ChampionshipRow
                  key={c.championshipId}
                  placement={c}
                  leader={champLeaders.find((l) => l.championshipId === c.championshipId) ?? null}
                  userId={userId}
                  ptsLabel={t('common.pts')}
                  playedLabel={t('common.played')}
                  leadingLabel={t('home.champCard.youreLeading')}
                  currentLeaderLabel={t('home.champCard.currentLeader')}
                  positionLabel={(n) => t('home.champCard.yourPosition', { n })}
                />
              ))}
            </div>
          </section>
        )}

        {activeRivalries.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              title={t('home.section.myRivalries')}
              icon={<Swords className="size-3.5 text-disputed" />}
              action={<SectionAction href="/rivalries">{t('common.viewAll')}</SectionAction>}
            />
            <div className="flex flex-col gap-2.5">
              {activeRivalries.map((r) => (
                <RivalryRow
                  key={r.id}
                  rivalry={r}
                  userId={userId}
                  youLabel={t('home.rivalryCard.you')}
                  opponentLabel={t('home.rivalryCard.opponent')}
                  leadingLabel={t('home.rivalryCard.youreLeading')}
                  tiedLabel={t('home.rivalryCard.tiedSeries')}
                  aheadLabel={t('home.rivalryCard.opponentAhead')}
                />
              ))}
            </div>
          </section>
        )}

        {completedChamps.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              title={t('home.section.pastChampionships')}
              action={<SectionAction href="/championships" muted>{t('common.viewAll')}</SectionAction>}
            />
            <div className="flex flex-col gap-2">
              {completedChamps.slice(0, 3).map((c) => (
                <PastChampionshipRow key={c.championshipId} result={c} ptsLabel={t('common.pts')} />
              ))}
            </div>
          </section>
        )}

        {stats.matchesPlayed === 0 && (
          <Empty className="mt-2 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>{t('home.readyToCompete')}</EmptyTitle>
              <EmptyDescription>
                {t('home.readyToCompeteDesc').split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i === 0 && <br />}
                  </span>
                ))}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setShowAddMatch(true)}>{t('home.recordFirstMatch')}</Button>
            </EmptyContent>
          </Empty>
        )}
      </div>

      <BottomNav userId={userId} />

      {showAddMatch && (
        <CreateMatchModal
          currentUserId={userId}
          currentUserName={myName}
          currentUserAvatarUrl={myAvatarUrl}
          players={players}
          onClose={() => setShowAddMatch(false)}
        />
      )}
    </div>
  )
}
