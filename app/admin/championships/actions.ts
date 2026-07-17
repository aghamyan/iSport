'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient, getAuthedClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'
import { STATS_CACHE_TAG } from '@/lib/stats/queries'
import { cancelMatchBets } from '@/lib/betting/settlement'
import { PRESTIGE_WEIGHT } from '@/lib/championships/prestige'

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
    .select('id, home_player_id, away_player_id')
    .eq('championship_id', championshipId)
    .in('status', ['confirmed', 'final'])

  const { data: allMatches } = await supabase
    .from('championship_matches')
    .select('id')
    .eq('championship_id', championshipId)

  const affectedPlayerIds = [
    ...new Set(
      (confirmedMatches ?? []).flatMap((m) => [m.home_player_id, m.away_player_id])
    ),
  ]

  await Promise.all(
    (allMatches ?? []).map((match) =>
      cancelMatchBets(match.id, 'championship', session!.sub, 'Championship deleted by admin')
    )
  )

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
  status: 'pending' | 'confirmed' | 'final',
  isForfeit = false
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const authed = await getAuthedClient()
  if (!authed) throw new Error('Session expired')

  const { data: current } = await supabase
    .from('championship_matches')
    .select('confirmed_at')
    .eq('id', matchId)
    .single()

  const payload: Record<string, unknown> = {
    home_score: homeScore,
    away_score: awayScore,
    status,
    is_forfeit: isForfeit,
  }
  if ((status === 'confirmed' || status === 'final') && !current?.confirmed_at) {
    payload.confirmed_at = new Date().toISOString()
  }

  const { error } = await authed
    .from('championship_matches')
    .update(payload)
    .eq('id', matchId)

  if (error) throw new Error(error.message)

  await logAdminAction('edit_championship_match', 'championship', matchId, { championshipId, homeScore, awayScore, status, isForfeit })
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath(`/championships/${championshipId}`)
  revalidatePath('/admin/championships')
}

export async function adminUpdateChampionshipNameAction(
  championshipId: string,
  name: string
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name cannot be empty')

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('championships')
    .update({ name: trimmed })
    .eq('id', championshipId)

  if (error) throw new Error(error.message)

  await logAdminAction('update_championship_name', 'championship', championshipId, { name: trimmed })
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath('/admin/championships')
  revalidatePath('/championships')
  revalidatePath(`/championships/${championshipId}`)
}

/**
 * Overrides a championship's P4P prestige weight. Normally auto-derived
 * from player count at creation (see lib/championships/prestige.ts) — this
 * lets an admin correct it by hand, e.g. before marking the championship
 * complete, so the right weight is already in place once titles start
 * counting toward P4P Legacy. Restricted to the three canonical tiers
 * (2/4/8) so the weight scale stays meaningful across all championships.
 */
export async function adminUpdateChampionshipPrestigeAction(
  championshipId: string,
  weight: number
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const validWeights = Object.values(PRESTIGE_WEIGHT) as number[]
  if (!validWeights.includes(weight)) {
    throw new Error(`Prestige weight must be one of: ${validWeights.join(', ')}`)
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('championships')
    .update({ prestige_weight: weight })
    .eq('id', championshipId)

  if (error) throw new Error(error.message)

  await logAdminAction('update_championship_prestige', 'championship', championshipId, { weight })
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath('/admin/championships')
  revalidatePath('/championships')
  revalidatePath('/leaderboard')
  revalidatePath('/')
}

export async function adminUpdateChampionshipYoutubeUrlAction(
  championshipId: string,
  youtubeUrl: string | null
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('championships')
    .update({ youtube_url: youtubeUrl })
    .eq('id', championshipId)

  if (error) throw new Error(error.message)

  await logAdminAction('update_championship_youtube_url', 'championship', championshipId, { youtubeUrl })
  revalidatePath('/admin/championships')
  revalidatePath(`/championships/${championshipId}`)
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

  await cancelMatchBets(matchId, 'championship', session!.sub, 'Championship match deleted by admin')

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
