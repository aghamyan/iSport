'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient, getAuthedClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'
import { STATS_CACHE_TAG } from '@/lib/stats/queries'
import { cancelMatchBets } from '@/lib/betting/settlement'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

/**
 * Admin edit: updates scores on any friendly match regardless of edit-window.
 * Uses the authenticated admin client for the write so settlement triggers can
 * attribute FINAL transitions to the admin.
 */
export async function adminUpdateFriendlyMatchAction(
  matchId: string,
  homeScore: number,
  awayScore: number,
  status: 'pending' | 'confirmed' | 'final'
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const authed = await getAuthedClient()
  if (!authed) throw new Error('Session expired')

  const { data: current } = await supabase
    .from('friendly_matches')
    .select('confirmed_at')
    .eq('id', matchId)
    .single()

  const payload: Record<string, unknown> = { home_score: homeScore, away_score: awayScore, status }
  if ((status === 'confirmed' || status === 'final') && !current?.confirmed_at) {
    payload.confirmed_at = new Date().toISOString()
  }

  const { error } = await authed
    .from('friendly_matches')
    .update(payload)
    .eq('id', matchId)

  if (error) throw new Error(error.message)

  await logAdminAction('edit_match_score', 'match', matchId, { homeScore, awayScore, status })
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath('/admin/matches')
  revalidatePath('/matches')
}

/**
 * Admin delete: removes a friendly match and recomputes stats for both players.
 * The stats triggers only cover INSERT/UPDATE — delete is not handled — so we
 * must call recompute_player_stats manually after the row is gone.
 */
export async function adminDeleteFriendlyMatchAction(matchId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  // Capture participants before deletion so we can recompute stats
  const { data: match } = await supabase
    .from('friendly_matches')
    .select('home_player_id, away_player_id, status')
    .eq('id', matchId)
    .single()

  await cancelMatchBets(matchId, 'friendly', session!.sub, 'Match deleted by admin')

  const { error } = await supabase
    .from('friendly_matches')
    .delete()
    .eq('id', matchId)

  if (error) throw new Error(error.message)

  // Recompute stats only if the match contributed to them
  if (match && match.status !== 'pending') {
    await Promise.all([
      supabase.rpc('recompute_player_stats', { p_player_id: match.home_player_id }),
      supabase.rpc('recompute_player_stats', { p_player_id: match.away_player_id }),
    ])
  }

  await logAdminAction('delete_match', 'match', matchId, {
    homePid: match?.home_player_id,
    awayPid: match?.away_player_id,
  })
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath('/admin/matches')
  revalidatePath('/matches')
}
