'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthedClient, createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { calculateOdds, type PlayerStats, type OddsFormEntry, type H2HInput, type OddsResult } from '@/lib/odds'
import { STATS_CACHE_TAG } from '@/lib/stats/queries'

export type MatchDraft = {
  awayPlayerId: string
  homeScore: number | null
  awayScore: number | null
}

type RawPlayer = {
  id: string
  wins: number
  losses: number
  draws: number
  matches_played: number
  goal_diff: number
  goals_for: number
}

function toStats(p: RawPlayer): PlayerStats {
  return {
    wins:          p.wins,
    losses:        p.losses,
    draws:         p.draws,
    matchesPlayed: p.matches_played,
    goalDiff:      p.goal_diff,
    goalsFor:      p.goals_for,
  }
}

const defaultStats: PlayerStats = {
  wins: 0, losses: 0, draws: 0, matchesPlayed: 0, goalDiff: 0, goalsFor: 0,
}

// Converts the get_player_form RPC rows to the minimal FormEntry the algorithm needs
type FormRpcRow = {
  result: string
  goals_for: number
  goals_against: number
  [key: string]: unknown
}

function toOddsForm(rows: FormRpcRow[] | null): OddsFormEntry[] {
  if (!rows) return []
  return rows.map((r) => ({
    result:       r.result as 'W' | 'L' | 'D',
    goalsFor:     r.goals_for,
    goalsAgainst: r.goals_against,
  }))
}

type H2HRpcRow = {
  player1_wins: number | string
  player2_wins: number | string
  draws: number | string
  total_matches: number | string
  [key: string]: unknown
}

function toH2HInput(rows: H2HRpcRow[] | null, homeIsPlayer1: boolean): H2HInput | undefined {
  if (!rows || rows.length === 0) return undefined
  const row = rows[0]
  const total = Number(row.total_matches)
  if (total < 3) return undefined
  return homeIsPlayer1
    ? { homeWins: Number(row.player1_wins), awayWins: Number(row.player2_wins), draws: Number(row.draws), totalMatches: total }
    : { homeWins: Number(row.player2_wins), awayWins: Number(row.player1_wins), draws: Number(row.draws), totalMatches: total }
}

// ─── Pre-match odds preview (read-only, no auth required) ─────────────────────

/**
 * Returns calculated odds for a home/away pair without creating any records.
 * Used by the CreateMatchModal and AddMatchModal to show a live odds preview.
 */
export async function getPreMatchOddsAction(
  homeId: string,
  awayId: string,
  matchType: 'friendly' | 'championship' = 'friendly',
): Promise<OddsResult | null> {
  if (!homeId || !awayId || homeId === awayId) return null

  const supabase = createServiceClient()

  // All queries are independent — fire in parallel.
  const [statsResult, homeFormResult, awayFormResult, h2hResult] = await Promise.all([
    supabase
      .from('players')
      .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
      .in('id', [homeId, awayId]),
    supabase.rpc('get_player_form', { p_player_id: homeId, p_limit: 5 }),
    supabase.rpc('get_player_form', { p_player_id: awayId, p_limit: 5 }),
    supabase.rpc('get_h2h_stats',   { p_player1_id: homeId, p_player2_id: awayId }),
  ])

  if (statsResult.error || !statsResult.data) return null

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of statsResult.data as RawPlayer[]) {
    statsMap[p.id] = toStats(p)
  }

  const homeStats  = statsMap[homeId] ?? defaultStats
  const awayStats  = statsMap[awayId] ?? defaultStats
  const homeForm   = toOddsForm(homeFormResult.data as FormRpcRow[] | null)
  const awayForm   = toOddsForm(awayFormResult.data as FormRpcRow[] | null)

  // H2H was queried with homeId as player1, so player1_wins = home wins.
  const h2h = toH2HInput(h2hResult.data as H2HRpcRow[] | null, true)

  return calculateOdds(homeStats, awayStats, { homeForm, awayForm, h2h, matchType })
}

// ─── Batch-create friendly matches ────────────────────────────────────────────

/**
 * Batch-creates friendly matches where the calling user is always home player.
 * Fetches recent form + H2H in parallel to compute enhanced odds stored alongside
 * each match. Uses O(1) DB round-trips for the insert phase regardless of batch size.
 */
export async function createMatchesBatchAction(
  drafts: MatchDraft[]
): Promise<{ created: number }> {
  if (drafts.length === 0) throw new Error('No matches provided')

  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = await getAuthedClient()
  if (!supabase) throw new Error('Session expired')

  const homePlayerId = session.sub
  const awayIds = [...new Set(drafts.map((d) => d.awayPlayerId))]
  const allIds  = [homePlayerId, ...awayIds]

  // ── Parallel data fetches ──────────────────────────────────────────────────
  const [statsResult, homeFormResult, ...restResults] = await Promise.all([
    supabase
      .from('players')
      .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
      .in('id', allIds),
    supabase.rpc('get_player_form', { p_player_id: homePlayerId, p_limit: 5 }),
    // Away player form (one per unique away player)
    ...awayIds.map((id) =>
      supabase.rpc('get_player_form', { p_player_id: id, p_limit: 5 })
    ),
    // H2H for each draft pair
    ...drafts.map((d) =>
      supabase.rpc('get_h2h_stats', {
        p_player1_id: homePlayerId,
        p_player2_id: d.awayPlayerId,
      })
    ),
  ])

  if (statsResult.error) throw new Error(statsResult.error.message)

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (statsResult.data ?? []) as RawPlayer[]) {
    statsMap[p.id] = toStats(p)
  }

  // restResults = [awayForm_0, awayForm_1, ..., h2h_0, h2h_1, ...]
  const awayFormResults = restResults.slice(0, awayIds.length)
  const h2hResults      = restResults.slice(awayIds.length)

  const awayFormMap: Record<string, OddsFormEntry[]> = {}
  awayIds.forEach((id, i) => {
    awayFormMap[id] = toOddsForm(awayFormResults[i]?.data as FormRpcRow[] | null)
  })

  // Key H2H by awayPlayerId (not by position) so RETURNING order doesn't matter.
  // If the same away player appears in multiple drafts the H2H is identical — safe to overwrite.
  const h2hMap: Record<string, H2HInput | undefined> = {}
  drafts.forEach((d, i) => {
    h2hMap[d.awayPlayerId] = toH2HInput(h2hResults[i]?.data as H2HRpcRow[] | null, true)
  })

  const homeForm = toOddsForm(homeFormResult.data as FormRpcRow[] | null)
  const homeStats = statsMap[homePlayerId] ?? defaultStats

  // ── Batch insert: matches ──────────────────────────────────────────────────
  const matchRows = drafts.map((d) => ({
    home_player_id: homePlayerId,
    away_player_id: d.awayPlayerId,
    home_score:     d.homeScore ?? null,
    away_score:     d.awayScore ?? null,
    status:         'pending' as const,
    created_by:     homePlayerId,
  }))

  const { data: created, error: insertErr } = await supabase
    .from('friendly_matches')
    .insert(matchRows)
    .select('id, away_player_id')

  if (insertErr) throw new Error(insertErr.message)

  // ── Batch insert: odds ─────────────────────────────────────────────────────
  const oddsRows = (created ?? []).map((m) => {
    const awayStats  = statsMap[m.away_player_id] ?? defaultStats
    const awayForm   = awayFormMap[m.away_player_id] ?? []
    const h2h        = h2hMap[m.away_player_id]
    const o          = calculateOdds(homeStats, awayStats, { homeForm, awayForm, h2h, matchType: 'friendly' })

    return {
      odds_type:            'friendly' as const,
      friendly_match_id:    m.id,
      home_win_odds:        o.homeWinOdds,
      draw_odds:            o.drawOdds,
      away_win_odds:        o.awayWinOdds,
      home_handicap:        o.homeHandicap,
      away_handicap:        o.awayHandicap,
      home_stats_snapshot:  {
        stats:       homeStats,
        form:        homeForm,
        factors:     o.homeFactors,
        impliedProb: o.homeWinPct,
        overround:   o.overround,
      },
      away_stats_snapshot: {
        stats:       awayStats,
        form:        awayForm,
        factors:     o.awayFactors,
        impliedProb: o.awayWinPct,
        overround:   o.overround,
      },
    }
  })

  if (oddsRows.length > 0) {
    const { error: oddsErr } = await supabase.from('match_odds').insert(oddsRows)
    if (oddsErr) throw new Error(oddsErr.message)
  }

  revalidatePath('/matches')
  return { created: created?.length ?? 0 }
}

// ─── Confirm a pending match ───────────────────────────────────────────────────

/**
 * Away player confirms a pending match and supplies the final scores.
 * Sets confirmed_at (which activates the generated edit_deadline column).
 */
export async function confirmMatchAction(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = await getAuthedClient()
  if (!supabase) throw new Error('Session expired')

  const { error } = await supabase
    .from('friendly_matches')
    .update({
      status:       'confirmed',
      confirmed_at: new Date().toISOString(),
      home_score:   homeScore,
      away_score:   awayScore,
    })
    .eq('id', matchId)
    .eq('away_player_id', session.sub)
    .eq('status', 'pending')

  if (error) throw new Error(error.message)
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath('/matches')
}

// ─── Edit a confirmed match ────────────────────────────────────────────────────

/**
 * Updates scores and/or notes on a confirmed match within the 4-hour window.
 * The prevent_late_edit DB trigger enforces the deadline server-side.
 */
export async function updateMatchAction(
  matchId: string,
  updates: { homeScore?: number; awayScore?: number; notes?: string }
): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = await getAuthedClient()
  if (!supabase) throw new Error('Session expired')

  const payload: Record<string, unknown> = {}
  if (updates.homeScore !== undefined) payload.home_score = updates.homeScore
  if (updates.awayScore !== undefined) payload.away_score = updates.awayScore
  if (updates.notes     !== undefined) payload.notes      = updates.notes

  if (Object.keys(payload).length === 0) return

  const { error } = await supabase
    .from('friendly_matches')
    .update(payload)
    .eq('id', matchId)

  if (error) throw new Error(error.message)
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath('/matches')
}
