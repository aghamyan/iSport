import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import {
  getLeaderboard,
  getRivalryWinners,
  getChampionshipLeaders,
} from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { LeaderboardClient } from './LeaderboardClient'

export default async function LeaderboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [players, rivalryWinners, championshipLeaders] = await Promise.all([
    getLeaderboard(),
    getRivalryWinners(),
    getChampionshipLeaders(),
  ])

  const titlesByPlayer = new Map<string, number>()
  for (const cl of championshipLeaders) {
    if (!cl.isActive) {
      titlesByPlayer.set(cl.playerId, (titlesByPlayer.get(cl.playerId) ?? 0) + 1)
    }
  }

  const p4pRanked = rankByP4P(players, titlesByPlayer)

  return (
    <LeaderboardClient
      players={players}
      rivalryWinners={rivalryWinners}
      championshipLeaders={championshipLeaders}
      p4pRanked={p4pRanked}
      currentUserId={session.sub}
    />
  )
}
