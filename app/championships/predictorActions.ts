'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export type PredictionPick = 'home' | 'draw' | 'away'

const VALID_PICKS: PredictionPick[] = ['home', 'draw', 'away']

/** Returns the current user's saved picks for the given matches, keyed by match id. */
export async function getMyPredictionsAction(matchIds: string[]): Promise<Record<string, PredictionPick>> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (matchIds.length === 0) return {}

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('match_predictions')
    .select('championship_match_id, pick')
    .eq('player_id', session.sub)
    .in('championship_match_id', matchIds)

  if (error) throw new Error(error.message)

  const result: Record<string, PredictionPick> = {}
  for (const row of (data ?? []) as Array<{ championship_match_id: string; pick: PredictionPick }>) {
    result[row.championship_match_id] = row.pick
  }
  return result
}

export type PredictionSubmission = { matchId: string; pick: PredictionPick }

/**
 * Submits picks for one or more still-pending matches in a single batch, then locks them —
 * a match that already has a saved pick for this player is left untouched (ignoreDuplicates),
 * so once submitted a prediction can never be changed. All matches must still be 'pending' or
 * the whole batch is rejected (status is re-checked from the DB, never trusted from the client).
 */
export async function submitPredictionsAction(submissions: PredictionSubmission[]): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (submissions.length === 0) return
  for (const s of submissions) {
    if (!VALID_PICKS.includes(s.pick)) throw new Error('Invalid pick')
  }

  const supabase = createServiceClient()
  const matchIds = submissions.map((s) => s.matchId)
  const { data: matchRows, error: matchErr } = await supabase
    .from('championship_matches')
    .select('id, status')
    .in('id', matchIds)

  if (matchErr) throw new Error(matchErr.message)

  const statusById = new Map(
    ((matchRows ?? []) as Array<{ id: string; status: string }>).map((m) => [m.id, m.status])
  )
  for (const s of submissions) {
    if (statusById.get(s.matchId) !== 'pending') {
      throw new Error('Predictions are locked once a match result is recorded')
    }
  }

  const rows = submissions.map((s) => ({
    championship_match_id: s.matchId,
    player_id: session.sub,
    pick: s.pick,
  }))

  const { error } = await supabase
    .from('match_predictions')
    .upsert(rows, { onConflict: 'championship_match_id,player_id', ignoreDuplicates: true })

  if (error) throw new Error(error.message)
}
