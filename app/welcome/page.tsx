import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import {
  getLeaderboard,
  getChampionshipLeaders,
  getChampionshipOnlyStats,
  getChampionshipMatchHistory,
  buildTitleRecords,
} from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { createServiceClient } from '@/lib/supabase/server'
import { WelcomeReveal, type CurrentPlayerInfo } from './WelcomeReveal'

export default async function WelcomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // leaderboard is fetched only to decide whether anyone has played yet —
  // P4P itself uses championship-only stats, same source as the leaderboard
  // and home pages, so a player's rank doesn't disagree across screens.
  const [leaderboard, champLeaders, champOnlyStats, matchHistory] = await Promise.all([
    getLeaderboard(),
    getChampionshipLeaders(),
    getChampionshipOnlyStats(),
    getChampionshipMatchHistory(),
  ])

  if (leaderboard.length === 0) redirect('/')

  const titlesByPlayer = buildTitleRecords(champLeaders)
  const ranked = rankByP4P(champOnlyStats, titlesByPlayer, matchHistory)
  const top5   = ranked.slice(0, 5).map((p) => ({
    id:            p.id,
    name:          p.name,
    avatarUrl:     p.avatarUrl,
    wins:          p.wins,
    matchesPlayed: p.matchesPlayed,
    p4p:           p.p4p,
  }))

  // Determine current user's rank and avatar
  const currentIdx = ranked.findIndex((p) => p.id === session.sub)
  let currentPlayer: CurrentPlayerInfo | null = null

  if (currentIdx >= 0) {
    const p = ranked[currentIdx]
    currentPlayer = {
      name:      p.name,
      avatarUrl: p.avatarUrl,
      p4pRank:   currentIdx + 1,
    }
  } else {
    // Not on the leaderboard yet — fetch basic info directly from users table
    const supabase = createServiceClient()
    const { data: userRow } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', session.sub)
      .single()
    if (userRow) {
      currentPlayer = {
        name:      userRow.name as string,
        avatarUrl: (userRow.avatar_url as string | null) ?? null,
        p4pRank:   0,
      }
    }
  }

  return <WelcomeReveal top5={top5} currentPlayer={currentPlayer} />
}
