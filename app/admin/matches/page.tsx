import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { isReservedAdminName } from '@/lib/players'
import { MatchesAdminClient } from './MatchesAdminClient'

export default async function AdminMatchesPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()

  // Step 1: fetch raw match rows — no PostgREST join to avoid silent FK-ambiguity errors
  const [{ data: rawMatches }, { data: allUsers }] = await Promise.all([
    supabase
      .from('friendly_matches')
      .select('id, home_player_id, away_player_id, home_score, away_score, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name')
      .order('name'),
  ])

  // Step 2: build a name lookup from users (users.id == players.id)
  const nameMap: Record<string, string> = {}
  for (const u of allUsers ?? []) nameMap[u.id] = u.name

  const matches = (rawMatches ?? []).map((m) => ({
    id:         m.id as string,
    homePlayer: nameMap[m.home_player_id as string] ?? 'Unknown',
    awayPlayer: nameMap[m.away_player_id as string] ?? 'Unknown',
    homeScore:  m.home_score as number | null,
    awayScore:  m.away_score as number | null,
    status:     m.status as 'pending' | 'confirmed' | 'final',
    createdAt:  m.created_at as string,
  }))

  // Active users for the "Add Match" player pickers
  const players = (allUsers ?? [])
    .filter((u) => u.name && !isReservedAdminName(u.name))
    .map((u) => ({ id: u.id as string, name: u.name as string }))

  return <MatchesAdminClient matches={matches} players={players} />
}
