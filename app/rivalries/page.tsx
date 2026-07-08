import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { RivalriesListClient } from './RivalriesListClient'

export default async function RivalriesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServiceClient()

  const [rivalriesResult, playersResult] = await Promise.all([
    supabase
      .from('rivalries')
      .select(
        'id, best_of, player1_id, player2_id, player1_wins, player2_wins, draws, winner_id, status, created_at, completed_at'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name')
      .eq('is_active', true)
      .eq('is_admin', false)
      .order('name'),
  ])

  const playerMap: Record<string, string> = {}
  for (const u of playersResult.data ?? []) {
    playerMap[u.id] = u.name
  }

  const rivalries = (rivalriesResult.data ?? []).map((r) => ({
    id:          r.id,
    bestOf:      r.best_of,
    player1Id:   r.player1_id,
    player2Id:   r.player2_id,
    player1Name: playerMap[r.player1_id] ?? 'Unknown',
    player2Name: playerMap[r.player2_id] ?? 'Unknown',
    player1Wins: r.player1_wins,
    player2Wins: r.player2_wins,
    draws:       (r as unknown as { draws: number }).draws ?? 0,
    winnerId:    r.winner_id as string | null,
    winnerName:  r.winner_id ? (playerMap[r.winner_id] ?? 'Unknown') : null,
    status:      r.status as 'active' | 'completed',
    createdAt:   r.created_at,
    completedAt: r.completed_at as string | null,
  }))

  const players = (playersResult.data ?? [])
    .filter((p) => p.id !== session.sub)
    .map((p) => ({ id: p.id, name: p.name }))

  return (
    <RivalriesListClient
      rivalries={rivalries}
      players={players}
      currentUserId={session.sub}
      isAdmin={session.isAdmin}
    />
  )
}
