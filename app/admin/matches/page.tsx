import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { MatchesAdminClient } from './MatchesAdminClient'

export default async function AdminMatchesPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('friendly_matches')
    .select(`
      id,
      home_score,
      away_score,
      status,
      created_at,
      home_player:players!home_player_id(id, display_name),
      away_player:players!away_player_id(id, display_name)
    `)
    .order('created_at', { ascending: false })

  const matches = (data ?? []).map((m) => ({
    id:         m.id,
    homePlayer: (m.home_player as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
    awayPlayer: (m.away_player as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
    homeScore:  m.home_score,
    awayScore:  m.away_score,
    status:     m.status as 'pending' | 'confirmed' | 'final',
    createdAt:  m.created_at,
  }))

  return <MatchesAdminClient matches={matches} />
}
