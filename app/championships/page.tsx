import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { isReservedAdminName } from '@/lib/players'
import { ChampionshipsListClient } from './ChampionshipsListClient'

export default async function ChampionshipsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServiceClient()

  const [champsResult, playersResult] = await Promise.all([
    supabase
      .from('championships')
      .select('id, name, number_of_cycles, is_active, created_at, played_at'),
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

  const championships = (champsResult.data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      numberOfCycles: c.number_of_cycles,
      isActive: c.is_active,
      createdAt: c.created_at,
      playedAt: (c.played_at as string | null) ?? null,
      playerCount: countMap[c.id] ?? 0,
    }))
    .sort((a, b) => {
      const aDate = new Date(a.playedAt ?? a.createdAt).getTime()
      const bDate = new Date(b.playedAt ?? b.createdAt).getTime()
      return bDate - aDate
    })

  const players = (playersResult.data ?? [])
    .filter((p) => !isReservedAdminName(p.name))
    .map((p) => ({
      id: p.id,
      displayName: p.name,
    }))

  return (
    <ChampionshipsListClient
      championships={championships}
      players={players}
      isAdmin={session.isAdmin}
      userId={session.sub}
    />
  )
}
