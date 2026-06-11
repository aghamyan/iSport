'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient, getAuthedClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

function requireSession(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) throw new Error('Not authenticated')
  return session
}

// ─── Create rivalry ───────────────────────────────────────────────────────────

/**
 * Creates a "first to N wins" rivalry between the calling user and an opponent.
 * Canonical ordering (player1_id < player2_id) is enforced by the DB check constraint.
 * Only one rivalry per player pair is allowed — returns a friendly error on conflict.
 */
export async function createRivalryAction(
  opponentId: string,
  bestOf: number,
  history?: { myWins: number; opponentWins: number; draws: number }
): Promise<{ id: string }> {
  const session = requireSession(await getSession())

  if (opponentId === session.sub) throw new Error('You cannot start a rivalry with yourself')
  if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf > 999) {
    throw new Error('Score target must be between 1 and 999')
  }

  if (history) {
    const { myWins, opponentWins, draws } = history
    if (!Number.isInteger(myWins) || myWins < 0 ||
        !Number.isInteger(opponentWins) || opponentWins < 0 ||
        !Number.isInteger(draws) || draws < 0) {
      throw new Error('Initial scores must be non-negative integers')
    }
  }

  const userId = session.sub
  const player1Id = userId < opponentId ? userId : opponentId
  const player2Id = userId < opponentId ? opponentId : userId

  // Determine initial win counts (canonical ordering: player1 < player2 by uuid)
  const isPlayer1 = userId < opponentId
  const initialPlayer1Wins = history ? (isPlayer1 ? history.myWins : history.opponentWins) : 0
  const initialPlayer2Wins = history ? (isPlayer1 ? history.opponentWins : history.myWins) : 0
  const initialDraws = history?.draws ?? 0

  // Use authed client so the RLS insert policy (player1_id = auth.uid() OR player2_id = auth.uid()) applies
  const supabase = await getAuthedClient()
  if (!supabase) throw new Error('Session expired')

  const { data, error } = await supabase
    .from('rivalries')
    .insert({
      player1_id:   player1Id,
      player2_id:   player2Id,
      best_of:      bestOf,
      player1_wins: initialPlayer1Wins,
      player2_wins: initialPlayer2Wins,
      draws:        initialDraws,
      winner_id:    null,
      status:       'active',
    })
    .select('id')
    .single()

  if (error) {
    // Postgres unique violation: a rivalry already exists for this pair
    if (error.code === '23505') {
      throw new Error('A rivalry already exists between these two players')
    }
    throw new Error(error.message)
  }

  revalidatePath('/rivalries')
  return { id: data.id }
}

// ─── Record match result ──────────────────────────────────────────────────────

/**
 * Records a single match result within a rivalry series.
 * Calls the record_rivalry_match RPC which atomically:
 *   1. Creates a friendly_match record (player1 = home, player2 = away)
 *   2. Links it via rivalry_matches
 *   3. Increments the winner's win count (draws advance neither player)
 *   4. Detects series completion and sets winner_id / status
 * After the RPC, awards the 'Rivalry Champion' badge to the winner on completion.
 */
export async function recordRivalryMatchAction(
  rivalryId: string,
  player1Score: number,
  player2Score: number
): Promise<{ matchId: string }> {
  const session = requireSession(await getSession())

  const supabase = await getAuthedClient()
  if (!supabase) throw new Error('Session expired')

  const { data, error } = await supabase.rpc('record_rivalry_match', {
    p_rivalry_id:     rivalryId,
    p_player1_score:  player1Score,
    p_player2_score:  player2Score,
  })

  if (error) throw new Error(error.message)

  const result = data as {
    match_id: string
    player1_wins: number
    player2_wins: number
    completed: boolean
    winner_id: string | null
  }

  // Award badge to series winner on completion
  if (result.completed && result.winner_id) {
    const svc = createServiceClient()

    const { data: badge } = await svc
      .from('badges')
      .select('id')
      .eq('badge_type', 'rivalry_won')
      .single()

    if (badge) {
      await svc.from('player_badges').upsert(
        {
          player_id:         result.winner_id,
          badge_id:          badge.id,
          source_rivalry_id: rivalryId,
        },
        { onConflict: 'player_id,badge_id', ignoreDuplicates: true }
      )
    }
  }

  revalidatePath('/rivalries')
  revalidatePath(`/rivalries/${rivalryId}`)
  return { matchId: result.match_id }
}

// ─── Admin: set rivalry score ─────────────────────────────────────────────────

export async function setRivalryScoreAction(
  rivalryId: string,
  player1Wins: number,
  player2Wins: number,
  draws: number
): Promise<void> {
  const session = requireSession(await getSession())
  if (!session.isAdmin) throw new Error('Unauthorized')

  if (!Number.isInteger(player1Wins) || player1Wins < 0 ||
      !Number.isInteger(player2Wins) || player2Wins < 0 ||
      !Number.isInteger(draws) || draws < 0) {
    throw new Error('Scores must be non-negative integers')
  }

  const svc = createServiceClient()

  const { error } = await svc
    .from('rivalries')
    .update({
      player1_wins: player1Wins,
      player2_wins: player2Wins,
      draws,
    })
    .eq('id', rivalryId)

  if (error) throw new Error(error.message)

  revalidatePath('/rivalries')
  revalidatePath(`/rivalries/${rivalryId}`)
}

// ─── Participant: set prior history ──────────────────────────────────────────

/**
 * Allows a rivalry participant to import their existing head-to-head record
 * (e.g., "we're already 7–6 overall") before any matches have been recorded.
 * Once a match is recorded this window closes.
 */
export async function setRivalryHistoryAction(
  rivalryId: string,
  player1Wins: number,
  player2Wins: number,
  draws: number
): Promise<void> {
  const session = requireSession(await getSession())

  if (!Number.isInteger(player1Wins) || player1Wins < 0 ||
      !Number.isInteger(player2Wins) || player2Wins < 0 ||
      !Number.isInteger(draws) || draws < 0) {
    throw new Error('Scores must be non-negative integers')
  }

  const svc = createServiceClient()

  const { data: rivalry } = await svc
    .from('rivalries')
    .select('player1_id, player2_id')
    .eq('id', rivalryId)
    .single()

  if (!rivalry) throw new Error('Rivalry not found')

  const userId = session.sub
  if (rivalry.player1_id !== userId && rivalry.player2_id !== userId) {
    throw new Error('You are not a participant in this rivalry')
  }

  const { count } = await svc
    .from('rivalry_matches')
    .select('*', { count: 'exact', head: true })
    .eq('rivalry_id', rivalryId)

  if ((count ?? 0) > 0) {
    throw new Error('Prior history cannot be changed after matches have been recorded')
  }

  const { error } = await svc
    .from('rivalries')
    .update({ player1_wins: player1Wins, player2_wins: player2Wins, draws })
    .eq('id', rivalryId)

  if (error) throw new Error(error.message)

  revalidatePath('/rivalries')
  revalidatePath(`/rivalries/${rivalryId}`)
}

// ─── Admin: delete rivalry ────────────────────────────────────────────────────

export async function deleteRivalryAction(rivalryId: string): Promise<void> {
  const session = requireSession(await getSession())
  if (!session.isAdmin) throw new Error('Unauthorized')

  const supabase = createServiceClient()
  const { error } = await supabase.from('rivalries').delete().eq('id', rivalryId)
  if (error) throw new Error(error.message)

  revalidatePath('/rivalries')
}
