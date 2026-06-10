import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getLeaderboard, getChampionshipLeaders } from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { WelcomeReveal } from './WelcomeReveal'

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

  return <WelcomeReveal top5={top5} />
}
