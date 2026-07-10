import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import {
  getLeaderboard,
  getRivalryWinners,
  getChampionshipLeaders,
  getLastChampionshipPodium,
  getChampionshipOnlyStats,
  getChampionshipMatchHistory,
  buildTitleRecords,
} from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { LeaderboardClient } from './LeaderboardClient'

export default async function LeaderboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [players, rivalryWinners, championshipLeaders, lastChampionshipPodium, champOnlyStats, matchHistory] = await Promise.all([
    getLeaderboard(),
    getRivalryWinners(),
    getChampionshipLeaders(),
    getLastChampionshipPodium(),
    getChampionshipOnlyStats(),
    getChampionshipMatchHistory(),
  ])

  const titlesByPlayer = buildTitleRecords(championshipLeaders)
  const p4pRanked = rankByP4P(champOnlyStats, titlesByPlayer, matchHistory)

  return (
    <LeaderboardClient
      players={players}
      rivalryWinners={rivalryWinners}
      championshipLeaders={championshipLeaders}
      p4pRanked={p4pRanked}
      lastChampionshipPodium={lastChampionshipPodium}
      currentUserId={session.sub}
    />
  )
}
