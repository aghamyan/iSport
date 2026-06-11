'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'
import { STATS_CACHE_TAG } from '@/lib/stats/queries'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

export async function adminDeleteChampionshipAction(championshipId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  // Capture all players who had confirmed/final matches — their career stats need recomputing
  const { data: confirmedMatches } = await supabase
    .from('championship_matches')
    .select('home_player_id, away_player_id')
    .eq('championship_id', championshipId)
    .in('status', ['confirmed', 'final'])

  const affectedPlayerIds = [
    ...new Set(
      (confirmedMatches ?? []).flatMap((m) => [m.home_player_id, m.away_player_id])
    ),
  ]

  const { error } = await supabase
    .from('championships')
    .delete()
    .eq('id', championshipId)

  if (error) throw new Error(error.message)

  // Recompute career stats for all affected players (cascade deleted their matches)
  if (affectedPlayerIds.length > 0) {
    await Promise.all(
      affectedPlayerIds.map((pid) =>
        supabase.rpc('recompute_player_stats', { p_player_id: pid })
      )
    )
  }

  await logAdminAction('delete_championship', 'championship', championshipId)
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath('/admin/championships')
  revalidatePath('/championships')
}

export async function adminSetChampionshipActiveAction(
  championshipId: string,
  isActive: boolean
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const updates: Record<string, unknown> = { is_active: isActive }
  if (!isActive) updates.completed_at = new Date().toISOString()
  else           updates.completed_at = null

  const { error } = await supabase
    .from('championships')
    .update(updates)
    .eq('id', championshipId)

  if (error) throw new Error(error.message)

  await logAdminAction(
    isActive ? 'reactivate_championship' : 'complete_championship',
    'championship',
    championshipId
  )
  revalidatePath('/admin/championships')
  revalidatePath('/championships')
}

export async function adminUpdateChampionshipMatchAction(
  championshipId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
  status: 'pending' | 'confirmed' | 'final'
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: current } = await supabase
    .from('championship_matches')
    .select('confirmed_at')
    .eq('id', matchId)
    .single()

  const payload: Record<string, unknown> = { home_score: homeScore, away_score: awayScore, status }
  if ((status === 'confirmed' || status === 'final') && !current?.confirmed_at) {
    payload.confirmed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('championship_matches')
    .update(payload)
    .eq('id', matchId)

  if (error) throw new Error(error.message)

  await logAdminAction('edit_championship_match', 'championship', matchId, { championshipId, homeScore, awayScore, status })
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath(`/championships/${championshipId}`)
  revalidatePath('/admin/championships')
}

export async function adminDeleteChampionshipMatchAction(
  championshipId: string,
  matchId: string
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: match } = await supabase
    .from('championship_matches')
    .select('home_player_id, away_player_id, status')
    .eq('id', matchId)
    .single()

  const { error } = await supabase
    .from('championship_matches')
    .delete()
    .eq('id', matchId)

  if (error) throw new Error(error.message)

  if (match && match.status !== 'pending') {
    await Promise.all([
      supabase.rpc('recompute_player_stats', { p_player_id: match.home_player_id }),
      supabase.rpc('recompute_player_stats', { p_player_id: match.away_player_id }),
      supabase.rpc('recompute_championship_standings', {
        p_championship_id: championshipId,
        p_player_id: match.home_player_id,
      }),
      supabase.rpc('recompute_championship_standings', {
        p_championship_id: championshipId,
        p_player_id: match.away_player_id,
      }),
    ])
  }

  await logAdminAction('delete_championship_match', 'championship', matchId, { championshipId })
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath(`/championships/${championshipId}`)
  revalidatePath('/admin/championships')
}
