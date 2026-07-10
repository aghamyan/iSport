import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { isReservedAdminName } from '@/lib/players'
import {
  getPlayerStats,
  getLeaderboard,
  getPlayerForm,
  getPlayerChampionshipPlacements,
  getChampionshipLeaders,
  getLastChampionshipWinner,
  getChampionshipOnlyStats,
  getChampionshipMatchHistory,
  buildTitleRecords,
} from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { HomeLoggedIn } from './HomeLoggedIn'
import type { GlobalStats, HomeMatchItem } from './HomeLoggedIn'
import type { CurrentChampion } from '@/lib/stats/types'
import { HomeLoggedOut } from './HomeLoggedOut'

export default async function HomePage() {
  const session  = await getSession()
  const supabase = createServiceClient()

  // ── Logged-out public view ─────────────────────────────────────────────────
  if (!session) {
    const [players, champLeaders] = await Promise.all([
      getLeaderboard(),
      getChampionshipLeaders(),
    ])

    const { data: rivRaw } = await supabase
      .from('rivalries')
      .select('id, best_of, player1_id, player2_id, player1_wins, player2_wins, winner_id, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8)

    const allIds = [...new Set((rivRaw ?? []).flatMap((r) => [r.player1_id, r.player2_id]))]
    const { data: uData } = allIds.length
      ? await supabase.from('users').select('id, name').in('id', allIds)
      : { data: [] }
    const nm: Record<string, string> = Object.fromEntries((uData ?? []).map((u) => [u.id, u.name]))

    const rivalries = (rivRaw ?? []).map((r) => ({
      id:          r.id,
      bestOf:      r.best_of,
      player1Id:   r.player1_id,
      player2Id:   r.player2_id,
      player1Name: nm[r.player1_id] ?? 'Unknown',
      player2Name: nm[r.player2_id] ?? 'Unknown',
      player1Wins: r.player1_wins,
      player2Wins: r.player2_wins,
      winnerId:    r.winner_id as string | null,
      status:      r.status as 'active' | 'completed',
    }))

    return <HomeLoggedOut players={players} champLeaders={champLeaders} rivalries={rivalries} />
  }

  // ── Logged-in dashboard ────────────────────────────────────────────────────
  const [
    myStats, leaderboard, recentForm, champPlacements, champLeaders,
    currentChampion, pRes, rRes, champOnlyStats, matchHistory, myUserRes, allPendingRes,
    heroBannerRes,
  ] = await Promise.all([
    getPlayerStats(session.sub),
    getLeaderboard(),
    getPlayerForm(session.sub, 8),
    getPlayerChampionshipPlacements(session.sub),
    getChampionshipLeaders(),
    getLastChampionshipWinner(),
    supabase.from('users').select('id, name, avatar_url').eq('is_active', true).neq('id', session.sub).order('name'),
    supabase
      .from('rivalries')
      .select('id, best_of, player1_id, player2_id, player1_wins, player2_wins, winner_id, status')
      .or(`player1_id.eq.${session.sub},player2_id.eq.${session.sub}`)
      .order('created_at', { ascending: false }),
    getChampionshipOnlyStats(),
    getChampionshipMatchHistory(),
    supabase.from('users').select('avatar_url').eq('id', session.sub).single(),
    supabase
      .from('friendly_matches')
      .select('id, status, created_at, home_player_id, away_player_id')
      .or(`home_player_id.eq.${session.sub},away_player_id.eq.${session.sub}`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('system_settings').select('key, value').in('key', ['homepage_hero_url', 'homepage_hero_position']),
  ])

  const rank   = leaderboard.findIndex((p) => p.id === session.sub) + 1
  const myName = leaderboard.find((p) => p.id === session.sub)?.name ?? 'Player'

  // P4P uses championship-only stats so friendly match results don't inflate rankings
  const titlesByPlayer = buildTitleRecords(champLeaders)
  const p4pRanked = rankByP4P(champOnlyStats, titlesByPlayer, matchHistory)
  const p4pRank   = p4pRanked.findIndex((p) => p.id === session.sub) + 1

  const myAvatarUrl = (myUserRes.data?.avatar_url as string | null) ?? null

  const rivIds = [...new Set((rRes.data ?? []).flatMap((r) => [r.player1_id, r.player2_id]))]
  const { data: rUsers } = rivIds.length
    ? await supabase.from('users').select('id, name').in('id', rivIds)
    : { data: [] }
  const rnm: Record<string, string> = Object.fromEntries((rUsers ?? []).map((u) => [u.id, u.name]))

  const rivalries = (rRes.data ?? []).map((r) => ({
    id:          r.id,
    bestOf:      r.best_of,
    player1Id:   r.player1_id,
    player2Id:   r.player2_id,
    player1Name: rnm[r.player1_id] ?? 'Unknown',
    player2Name: rnm[r.player2_id] ?? 'Unknown',
    player1Wins: r.player1_wins,
    player2Wins: r.player2_wins,
    winnerId:    r.winner_id as string | null,
    status:      r.status as 'active' | 'completed',
  }))

  const nonAdminPlayers = (pRes.data ?? []).filter((p) => !isReservedAdminName(p.name))

  const players = nonAdminPlayers.map((p) => ({
    id: p.id,
    displayName: p.name,
    avatarUrl: (p.avatar_url as string | null) ?? null,
  }))

  // Player lookup for pending match names (excludes current user — handled separately)
  const playerLookup: Record<string, { name: string; avatar_url: string | null }> = {}
  for (const p of nonAdminPlayers) {
    playerLookup[p.id] = { name: p.name, avatar_url: (p.avatar_url as string | null) ?? null }
  }

  // ── Pending friendly matches for this user (as home OR away) ──────────────
  const pendingMatchIds = (allPendingRes.data ?? []).map((m) => m.id as string)

  const { data: pendingOddsRaw } = pendingMatchIds.length
    ? await supabase
        .from('match_odds')
        .select('friendly_match_id, home_win_odds, draw_odds, away_win_odds, home_handicap, home_stats_snapshot, away_stats_snapshot')
        .in('friendly_match_id', pendingMatchIds)
    : { data: [] }

  type OddsRow = {
    friendly_match_id: string
    home_win_odds: number
    draw_odds: number
    away_win_odds: number
    home_handicap: number
    home_stats_snapshot: { impliedProb?: number; expectedGoals?: number } | null
    away_stats_snapshot: { impliedProb?: number; expectedGoals?: number } | null
  }
  const oddsMap: Record<string, OddsRow> = {}
  for (const o of (pendingOddsRaw ?? []) as OddsRow[]) {
    oddsMap[o.friendly_match_id] = o
  }

  const userId = session.sub
  function playerName(id: string) {
    if (id === userId) return myName
    return playerLookup[id]?.name ?? 'Unknown'
  }
  function playerAvatar(id: string): string | null {
    if (id === userId) return myAvatarUrl
    return playerLookup[id]?.avatar_url ?? null
  }

  const pendingMatches: HomeMatchItem[] = (allPendingRes.data ?? []).map((match) => {
    const homeId = match.home_player_id as string
    const awayId = match.away_player_id as string
    const odds   = oddsMap[match.id as string]

    const homeSnap   = odds?.home_stats_snapshot
    const awaySnap   = odds?.away_stats_snapshot
    const homeWinPct = homeSnap?.impliedProb ?? 50
    const awayWinPct = awaySnap?.impliedProb ?? 50
    const drawPct    = Math.max(0, 100 - homeWinPct - awayWinPct)
    const homeGoals  = homeSnap?.expectedGoals
    const awayGoals  = awaySnap?.expectedGoals
    const ouLine     = homeGoals != null && awayGoals != null
      ? `${Math.ceil((homeGoals + awayGoals) * 2) / 2}`
      : null

    return {
      id:                 match.id as string,
      status:             match.status as string,
      createdAt:          match.created_at as string,
      homePlayerId:       homeId,
      homePlayerName:     playerName(homeId),
      homePlayerAvatarUrl: playerAvatar(homeId),
      awayPlayerId:       awayId,
      awayPlayerName:     playerName(awayId),
      awayPlayerAvatarUrl: playerAvatar(awayId),
      homeWinOdds:        odds?.home_win_odds  ?? 2.0,
      drawOdds:           odds?.draw_odds      ?? 3.5,
      awayWinOdds:        odds?.away_win_odds  ?? 2.0,
      homeHandicap:       odds?.home_handicap  ?? 0,
      homeWinPct,
      drawPct,
      awayWinPct,
      ouLine,
    }
  })

  // Global stats derived from leaderboard
  const topScorer = leaderboard.length > 0
    ? leaderboard.reduce((best, p) => (p.goalsFor > best.goalsFor ? p : best))
    : null
  const globalStats: GlobalStats = {
    totalMatches:        Math.floor(leaderboard.reduce((s, p) => s + p.matchesPlayed, 0) / 2),
    totalGoals:          leaderboard.reduce((s, p) => s + p.goalsFor, 0),
    topScorerName:       topScorer?.name ?? null,
    topScorerGoals:      topScorer?.goalsFor ?? 0,
    topScorerAvatarUrl:  topScorer?.avatarUrl ?? null,
  }

  const heroSettings = new Map((heroBannerRes.data ?? []).map((r) => [r.key as string, r.value]))
  const heroBannerRaw      = heroSettings.get('homepage_hero_url')
  const heroBannerPosRaw   = heroSettings.get('homepage_hero_position')
  const heroBannerUrl = typeof heroBannerRaw === 'string'
    ? heroBannerRaw.replace(/^"|"$/g, '')
    : null
  const heroBannerPosition = typeof heroBannerPosRaw === 'string'
    ? heroBannerPosRaw.replace(/^"|"$/g, '')
    : null

  return (
    <HomeLoggedIn
      userId={session.sub}
      isAdmin={session.isAdmin}
      myName={myName}
      myAvatarUrl={myAvatarUrl}
      myStats={myStats}
      rank={rank}
      p4pRank={p4pRank}
      totalPlayers={leaderboard.length}
      recentForm={recentForm}
      champPlacements={champPlacements}
      champLeaders={champLeaders}
      currentChampion={currentChampion}
      rivalries={rivalries}
      players={players}
      pendingMatches={pendingMatches}
      globalStats={globalStats}
      heroBannerUrl={heroBannerUrl || null}
      heroBannerPosition={heroBannerPosition || null}
    />
  )
}
