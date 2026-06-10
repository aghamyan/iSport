import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { ChampionshipsListClient } from './ChampionshipsListClient'

export default async function ChampionshipsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServiceClient()

  const [champsResult, playersResult] = await Promise.all([
    supabase
      .from('championships')
      .select('id, name, number_of_cycles, is_active, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  // Fetch player counts per championship
  const champIds = (champsResult.data ?? []).map((c) => c.id)
  const { data: playerCounts } = champIds.length
    ? await supabase
        .from('championship_players')
        .select('championship_id')
        .in('championship_id', champIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const row of playerCounts ?? []) {
    countMap[row.championship_id] = (countMap[row.championship_id] ?? 0) + 1
  }

  const championships = (champsResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    numberOfCycles: c.number_of_cycles,
    isActive: c.is_active,
    createdAt: c.created_at,
    playerCount: countMap[c.id] ?? 0,
  }))

  const players = (playersResult.data ?? []).map((p) => ({
    id: p.id,
    displayName: p.name,
  }))

  return (
    <ChampionshipsListClient
      championships={championships}
      players={players}
      isAdmin={session.isAdmin}
    />
  )
}
