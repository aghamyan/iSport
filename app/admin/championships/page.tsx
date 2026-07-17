import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { ChampAdminClient } from './ChampAdminClient'

export default async function AdminChampionshipsPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()

  const [champsRes, matchesRes, playersRes] = await Promise.all([
    supabase
      .from('championships')
      .select('id, name, is_active, created_at, youtube_url, prestige_weight')
      .order('created_at', { ascending: false }),
    supabase
      .from('championship_matches')
      .select(`
        id,
        championship_id,
        home_score,
        away_score,
        status,
        cycle,
        is_forfeit,
        home_player:players!home_player_id(display_name),
        away_player:players!away_player_id(display_name)
      `),
    supabase
      .from('championship_players')
      .select('championship_id'),
  ])

  const matchesByChamp: Record<string, ReturnType<typeof mapMatch>[]> = {}
  for (const m of matchesRes.data ?? []) {
    const item = mapMatch(m)
    if (!matchesByChamp[m.championship_id]) matchesByChamp[m.championship_id] = []
    matchesByChamp[m.championship_id].push(item)
  }

  const countByChamp: Record<string, number> = {}
  for (const row of playersRes.data ?? []) {
    countByChamp[row.championship_id] = (countByChamp[row.championship_id] ?? 0) + 1
  }

  const championships = (champsRes.data ?? []).map((c) => ({
    id:             c.id,
    name:           c.name,
    isActive:       c.is_active,
    createdAt:      c.created_at,
    youtubeUrl:     (c.youtube_url as string | null) ?? null,
    prestigeWeight: (c.prestige_weight as number | null) ?? 2,
    playerCount:    countByChamp[c.id] ?? 0,
    matches:        matchesByChamp[c.id] ?? [],
  }))

  return <ChampAdminClient championships={championships} />
}

function mapMatch(m: {
  id: string
  home_score: number | null
  away_score: number | null
  status: string
  cycle: number
  is_forfeit: boolean | null
  home_player: { display_name: string } | null | { display_name: string }[]
  away_player: { display_name: string } | null | { display_name: string }[]
}) {
  const homeName = Array.isArray(m.home_player)
    ? m.home_player[0]?.display_name
    : (m.home_player as unknown as { display_name: string } | null)?.display_name
  const awayName = Array.isArray(m.away_player)
    ? m.away_player[0]?.display_name
    : (m.away_player as unknown as { display_name: string } | null)?.display_name

  return {
    id:         m.id,
    homePlayer: homeName ?? 'Unknown',
    awayPlayer: awayName ?? 'Unknown',
    homeScore:  m.home_score,
    awayScore:  m.away_score,
    status:     m.status as 'pending' | 'confirmed' | 'final',
    cycle:      m.cycle,
    isForfeit:  m.is_forfeit ?? false,
  }
}
