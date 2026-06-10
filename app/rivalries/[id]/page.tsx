import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { RivalryDetail } from './RivalryDetail'

export default async function RivalryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServiceClient()

  const [rivalryResult, badgesResult] = await Promise.all([
    supabase
      .from('rivalries')
      .select(
        'id, best_of, player1_id, player2_id, player1_wins, player2_wins, winner_id, status, created_at, completed_at'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('player_badges')
      .select('player_id, badge_id, earned_at, badges(name, description, badge_type)')
      .eq('source_rivalry_id', id),
  ])

  if (rivalryResult.error || !rivalryResult.data) notFound()
  const r = rivalryResult.data

  // Fetch both player names
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .in('id', [r.player1_id, r.player2_id])

  const userMap: Record<string, string> = {}
  for (const u of users ?? []) userMap[u.id] = u.name

  // Match history: linked via rivalry_matches → friendly_matches
  const { data: matchLinks } = await supabase
    .from('rivalry_matches')
    .select('match_id')
    .eq('rivalry_id', id)

  const matchIds = (matchLinks ?? []).map((l) => l.match_id)

  const { data: matchRows } = matchIds.length
    ? await supabase
        .from('friendly_matches')
        .select('id, home_player_id, away_player_id, home_score, away_score, confirmed_at')
        .in('id', matchIds)
        .order('confirmed_at', { ascending: true })
    : { data: [] }

  const matches = (matchRows ?? []).map((m) => ({
    id:             m.id,
    homePlayerId:   m.home_player_id,
    awayPlayerId:   m.away_player_id,
    homeScore:      m.home_score as number,
    awayScore:      m.away_score as number,
    confirmedAt:    m.confirmed_at as string,
  }))

  const winnerBadge = (badgesResult.data ?? []).find((b) => {
    const badge = b.badges as { badge_type: string } | null
    return badge?.badge_type === 'rivalry_won'
  })

  return (
    <RivalryDetail
      rivalry={{
        id:          r.id,
        bestOf:      r.best_of,
        player1Id:   r.player1_id,
        player2Id:   r.player2_id,
        player1Name: userMap[r.player1_id] ?? 'Unknown',
        player2Name: userMap[r.player2_id] ?? 'Unknown',
        player1Wins: r.player1_wins,
        player2Wins: r.player2_wins,
        winnerId:    r.winner_id as string | null,
        status:      r.status as 'active' | 'completed',
        createdAt:   r.created_at,
        completedAt: r.completed_at as string | null,
      }}
      initialMatches={matches}
      currentUserId={session.sub}
      isAdmin={session.isAdmin}
      badgeEarnedAt={winnerBadge ? (winnerBadge.earned_at as string) : null}
    />
  )
}
