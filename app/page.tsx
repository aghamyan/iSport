import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getPlayerStats,
  getLeaderboard,
  getPlayerForm,
  getPlayerChampionshipPlacements,
  getChampionshipLeaders,
} from '@/lib/stats/queries'
import { HomeLoggedIn } from './HomeLoggedIn'
import type { GlobalStats } from './HomeLoggedIn'
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
  const [myStats, leaderboard, recentForm, champPlacements, champLeaders, pRes, rRes, pendingRes] =
    await Promise.all([
      getPlayerStats(session.sub),
      getLeaderboard(),
      getPlayerForm(session.sub, 8),
      getPlayerChampionshipPlacements(session.sub),
      getChampionshipLeaders(),
      supabase.from('users').select('id, name, avatar_url').eq('is_active', true).neq('id', session.sub).order('name'),
      supabase
        .from('rivalries')
        .select('id, best_of, player1_id, player2_id, player1_wins, player2_wins, winner_id, status')
        .or(`player1_id.eq.${session.sub},player2_id.eq.${session.sub}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('friendly_matches')
        .select('id')
        .eq('away_player_id', session.sub)
        .eq('status', 'pending'),
    ])

  const rank   = leaderboard.findIndex((p) => p.id === session.sub) + 1
  const myName = leaderboard.find((p) => p.id === session.sub)?.name ?? 'Player'

  const { data: myUser } = await supabase
    .from('users')
    .select('avatar_url')
    .eq('id', session.sub)
    .single()
  const myAvatarUrl = (myUser?.avatar_url as string | null) ?? null

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

  const players = (pRes.data ?? []).map((p) => ({ id: p.id, displayName: p.name }))

  // Global stats derived from leaderboard (use reduce to avoid mutating cached array)
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

  return (
    <HomeLoggedIn
      userId={session.sub}
      isAdmin={session.isAdmin}
      myName={myName}
      myAvatarUrl={myAvatarUrl}
      myStats={myStats}
      rank={rank}
      totalPlayers={leaderboard.length}
      recentForm={recentForm}
      champPlacements={champPlacements}
      champLeaders={champLeaders}
      rivalries={rivalries}
      players={players}
      pendingMatchCount={pendingRes.data?.length ?? 0}
      globalStats={globalStats}
    />
  )
}
