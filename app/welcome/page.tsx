import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getLeaderboard, getChampionshipLeaders } from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { createServiceClient } from '@/lib/supabase/server'
import { WelcomeReveal, type CurrentPlayerInfo } from './WelcomeReveal'

export default async function WelcomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [leaderboard, champLeaders] = await Promise.all([
    getLeaderboard(),
    getChampionshipLeaders(),
  ])

  if (leaderboard.length === 0) redirect('/')

  const titlesByPlayer = new Map<string, number>()
  for (const cl of champLeaders) {
    if (!cl.isActive) {
      titlesByPlayer.set(cl.playerId, (titlesByPlayer.get(cl.playerId) ?? 0) + 1)
    }
  }

  const ranked = rankByP4P(leaderboard, titlesByPlayer)
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
