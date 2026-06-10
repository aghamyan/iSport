import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { ChampionshipDetail } from './ChampionshipDetail'

export default async function ChampionshipPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServiceClient()

  const [champResult, playersResult, matchesResult] = await Promise.all([
    supabase
      .from('championships')
      .select('id, name, number_of_cycles, is_active, created_by, created_at, format')
      .eq('id', id)
      .single(),
    supabase
      .from('championship_players')
      .select('player_id, players!championship_players_player_id_fkey(id, display_name)')
      .eq('championship_id', id),
    supabase
      .from('championship_matches')
      .select(
        'id, home_player_id, away_player_id, home_score, away_score, cycle, status, confirmed_at, group_label, round, leg'
      )
      .eq('championship_id', id)
      .order('cycle', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  const playerIds = (playersResult.data ?? []).map((r) => r.player_id)
  const { data: usersData } = playerIds.length
    ? await supabase.from('users').select('id, avatar_url').in('id', playerIds)
    : { data: [] }
  const avatarMap: Record<string, string | null> = {}
  for (const u of usersData ?? []) avatarMap[u.id] = u.avatar_url

  if (champResult.error || !champResult.data) notFound()

  const champ = champResult.data

  const players = (playersResult.data ?? []).map((row) => {
    const p = row.players as { id: string; display_name: string | null } | null
    return {
      id: row.player_id,
      displayName: p?.display_name ?? 'Unknown',
      avatarUrl: avatarMap[row.player_id] ?? null,
    }
  })

  const matches = (matchesResult.data ?? []).map((m) => ({
    id: m.id,
    homePlayerId: m.home_player_id,
    awayPlayerId: m.away_player_id,
    homeScore: m.home_score as number | null,
    awayScore: m.away_score as number | null,
    cycle: m.cycle,
    status: m.status as 'pending' | 'confirmed' | 'final',
    confirmedAt: m.confirmed_at as string | null,
    editDeadline: m.confirmed_at
      ? new Date(new Date(m.confirmed_at as string).getTime() + 4 * 3600000).toISOString()
      : null,
    groupLabel: (m as Record<string, unknown>).group_label as string | null ?? null,
    round: (m as Record<string, unknown>).round as string | null ?? null,
    leg: (m as Record<string, unknown>).leg as number | null ?? null,
  }))

  return (
    <ChampionshipDetail
      championship={{
        id: champ.id,
        name: champ.name,
        numberOfCycles: champ.number_of_cycles,
        isActive: champ.is_active,
        createdBy: champ.created_by,
        format: (champ.format ?? 'round_robin') as 'round_robin' | 'group_knockout' | 'group_playoff',
      }}
      players={players}
      initialMatches={matches}
      currentUserId={session.sub}
      isAdmin={session.isAdmin}
    />
  )
}
