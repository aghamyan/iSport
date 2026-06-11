'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient, getAuthedClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { generateRoundRobin, generateRoundRobinCycle } from '@/lib/championships/roundRobin'
import {
  splitIntoGroups,
  generateGroupStageSlots,
  generateSemiSlots,
  generateFinalSlot,
  generatePenaltySlot,
  generateFinalPenaltySlot,
  getKnockoutQualifiers,
  resolveSemiTie,
  type KnockoutQualifiers,
} from '@/lib/championships/groupKnockout'
import {
  generateGroupPlayoffStageSlots,
  getPlayoffQualifiers,
  generatePlayoffSemiSlots,
  resolvePlayoffSemi,
} from '@/lib/championships/groupPlayoff'
import { STATS_CACHE_TAG } from '@/lib/stats/queries'
import { calculateOdds, type PlayerStats, type OddsFormEntry, type H2HInput } from '@/lib/odds'
import { logAdminAction } from '@/lib/admin/activityLog'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

type FormRpcRow = { result: string; goals_for: number; goals_against: number; [k: string]: unknown }
type H2HRpcRow  = { player1_wins: number|string; player2_wins: number|string; draws: number|string; total_matches: number|string; [k: string]: unknown }

function toOddsForm(rows: FormRpcRow[] | null): OddsFormEntry[] {
  if (!rows) return []
  return rows.map((r) => ({
    result:       r.result as 'W' | 'L' | 'D',
    goalsFor:     r.goals_for,
    goalsAgainst: r.goals_against,
  }))
}

function toH2H(rows: H2HRpcRow[] | null, homeIsP1: boolean): H2HInput | undefined {
  if (!rows || rows.length === 0) return undefined
  const row = rows[0]
  const total = Number(row.total_matches)
  if (total < 3) return undefined
  return homeIsP1
    ? { homeWins: Number(row.player1_wins), awayWins: Number(row.player2_wins), draws: Number(row.draws), totalMatches: total }
    : { homeWins: Number(row.player2_wins), awayWins: Number(row.player1_wins), draws: Number(row.draws), totalMatches: total }
}

/** Inserts match rows and attaches odds. Returns the created match IDs. */
async function insertMatchesWithOdds(
  supabase: ReturnType<typeof createServiceClient>,
  championshipId: string,
  slots: Array<{
    homePlayerId: string
    awayPlayerId: string
    cycle: number
    groupLabel?: string | null
    round?: string | null
    leg?: number | null
  }>,
  statsMap: Record<string, PlayerStats>,
  playedAt?: string | null
) {
  if (slots.length === 0) return []

  // If championship has a historical date, stamp it on the matches as a fallback.
  // get_player_form orders by coalesce(confirmed_at, played_at) so confirmed_at takes priority.
  const matchPlayedAt = playedAt ? new Date(playedAt + 'T12:00:00Z').toISOString() : undefined

  const { data: createdMatches, error: matchesErr } = await supabase
    .from('championship_matches')
    .insert(
      slots.map((s) => ({
        championship_id: championshipId,
        home_player_id:  s.homePlayerId,
        away_player_id:  s.awayPlayerId,
        cycle:           s.cycle,
        group_label:     s.groupLabel ?? null,
        round:           s.round ?? null,
        leg:             s.leg ?? null,
        status:          'pending' as const,
        ...(matchPlayedAt ? { played_at: matchPlayedAt } : {}),
      }))
    )
    .select('id, home_player_id, away_player_id')

  if (matchesErr) throw new Error(matchesErr.message)

  if (createdMatches && createdMatches.length > 0) {
    const oddsRows = createdMatches.map((m) => {
      const homeStats = statsMap[m.home_player_id] ?? defaultStats
      const awayStats = statsMap[m.away_player_id] ?? defaultStats
      const o = calculateOdds(homeStats, awayStats, { matchType: 'championship' })
      return {
        odds_type:             'championship' as const,
        championship_match_id: m.id,
        home_win_odds:         o.homeWinOdds,
        draw_odds:             o.drawOdds,
        away_win_odds:         o.awayWinOdds,
        home_handicap:         o.homeHandicap,
        away_handicap:         o.awayHandicap,
        home_stats_snapshot: {
          stats: homeStats, factors: o.homeFactors, impliedProb: o.homeWinPct, overround: o.overround,
        },
        away_stats_snapshot: {
          stats: awayStats, factors: o.awayFactors, impliedProb: o.awayWinPct, overround: o.overround,
        },
      }
    })
    await supabase.from('match_odds').insert(oddsRows)
  }

  return createdMatches ?? []
}

// ─── Admin actions (service-role, bypass RLS) ─────────────────────────────────

/**
 * Creates a championship with a full round-robin (or group-stage) schedule.
 * For group_knockout, generates only the group stage — knockout matches are
 * created separately once the group phase is complete.
 */
export async function createChampionshipAction(
  name: string,
  numberOfCycles: number,
  playerIds: string[],
  format: 'round_robin' | 'group_knockout' | 'group_playoff' = 'round_robin',
  playedAt?: string | null
): Promise<{ id: string }> {
  const session = await getSession()
  requireAdmin(session)

  if (!name.trim()) throw new Error('Name is required')
  if (numberOfCycles < 1 || numberOfCycles > 10) throw new Error('Cycles must be 1–10')
  if (format === 'round_robin' && playerIds.length < 2) throw new Error('At least 2 players required')
  if (format === 'group_knockout' && playerIds.length < 4) throw new Error('Group Knockout requires at least 4 players')
  if (format === 'group_playoff' && playerIds.length < 4) throw new Error('Group Playoff requires at least 4 players')

  const supabase = createServiceClient()

  const { data: playersData } = await supabase
    .from('players')
    .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
    .in('id', playerIds)

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (playersData ?? []) as RawPlayer[]) {
    statsMap[p.id] = toStats(p)
  }

  const { data: champ, error: champErr } = await supabase
    .from('championships')
    .insert({
      name:             name.trim(),
      number_of_cycles: numberOfCycles,
      format,
      created_by:       session!.sub,
      ...(playedAt ? { played_at: playedAt } : {}),
    })
    .select('id')
    .single()

  if (champErr || !champ) throw new Error(champErr?.message ?? 'Failed to create championship')

  const { error: playersErr } = await supabase
    .from('championship_players')
    .insert(playerIds.map((pid) => ({ championship_id: champ.id, player_id: pid })))

  if (playersErr) throw new Error(playersErr.message)

  let slots
  if (format === 'group_knockout') {
    const { groupA, groupB } = splitIntoGroups(playerIds)
    slots = generateGroupStageSlots(groupA, groupB, numberOfCycles)
  } else if (format === 'group_playoff') {
    slots = generateGroupPlayoffStageSlots(playerIds, numberOfCycles)
  } else {
    // Only generate cycle 1; subsequent cycles are generated one-at-a-time
    // via generateNextCycleAction on the championship detail page.
    slots = generateRoundRobinCycle(playerIds, 1)
  }

  await insertMatchesWithOdds(supabase, champ.id, slots, statsMap, playedAt)

  await logAdminAction('create_championship', 'championship', champ.id, {
    name, numberOfCycles, playerCount: playerIds.length, format,
  })
  revalidatePath('/championships')
  return { id: champ.id }
}

/**
 * Generates semi-final matches (2 legs × 2 ties) after the group stage is complete.
 * Uses top-2 finishers from each group.
 */
export async function generateSemiFinalsAction(championshipId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: champ } = await supabase
    .from('championships')
    .select('format, played_at')
    .eq('id', championshipId)
    .single()
  if (champ?.format !== 'group_knockout' && champ?.format !== 'group_playoff') {
    throw new Error('Not a group knockout or group playoff championship')
  }

  // Check no semi matches already exist
  const { data: existing } = await supabase
    .from('championship_matches')
    .select('id')
    .eq('championship_id', championshipId)
    .eq('round', 'semi')
    .limit(1)
  if (existing && existing.length > 0) throw new Error('Semi-finals already generated')

  // Fetch all confirmed group matches + championship_players
  const [matchesResult, cpResult] = await Promise.all([
    supabase
      .from('championship_matches')
      .select('id, home_player_id, away_player_id, home_score, away_score, group_label, round')
      .eq('championship_id', championshipId)
      .eq('round', 'group'),
    supabase
      .from('championship_players')
      .select('player_id')
      .eq('championship_id', championshipId),
  ])

  const allGroupMatches = matchesResult.data ?? []
  const pendingGroups = allGroupMatches.filter((m) => m.home_score === null || m.away_score === null)
  if (pendingGroups.length > 0) throw new Error('Not all group matches have been played yet')

  const mappedMatches = allGroupMatches.map((m) => ({
    id: m.id,
    homePlayerId: m.home_player_id,
    awayPlayerId: m.away_player_id,
    homeScore: m.home_score as number | null,
    awayScore: m.away_score as number | null,
  }))

  let slots
  let qualifierPlayerIds: string[]

  if (champ.format === 'group_knockout') {
    const groupA = allGroupMatches.filter((m) => m.group_label === 'A').flatMap((m) => [m.home_player_id, m.away_player_id])
    const groupB = allGroupMatches.filter((m) => m.group_label === 'B').flatMap((m) => [m.home_player_id, m.away_player_id])
    const uniqueA = [...new Set(groupA)]
    const uniqueB = [...new Set(groupB)]
    if (uniqueA.length < 2 || uniqueB.length < 2) throw new Error('Cannot determine groups')
    const qualifiers = getKnockoutQualifiers(mappedMatches, uniqueA, uniqueB)
    slots = generateSemiSlots(qualifiers)
    qualifierPlayerIds = [qualifiers.a1, qualifiers.a2, qualifiers.b1, qualifiers.b2]
    await logAdminAction('generate_semis', 'championship', championshipId, { qualifiers })
  } else {
    // group_playoff: top 4 from single group → 2 single-leg semis (1v4, 2v3)
    const allPlayerIds = (cpResult.data ?? []).map((r) => r.player_id)
    const qualifiers = getPlayoffQualifiers(mappedMatches, allPlayerIds)
    slots = generatePlayoffSemiSlots(qualifiers)
    qualifierPlayerIds = [qualifiers.p1, qualifiers.p2, qualifiers.p3, qualifiers.p4]
    await logAdminAction('generate_semis', 'championship', championshipId, { qualifiers })
  }

  // Fetch stats for qualifier players
  const { data: playersData } = await supabase
    .from('players')
    .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
    .in('id', qualifierPlayerIds)

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (playersData ?? []) as RawPlayer[]) statsMap[p.id] = toStats(p)

  await insertMatchesWithOdds(supabase, championshipId, slots, statsMap, champ.played_at)
  revalidatePath(`/championships/${championshipId}`)
}

/**
 * Generates the single final match once both semi-final ties are resolved.
 * If a tie is level on aggregate, throws — admin must record a penalty decider first.
 */
export async function generateFinalAction(championshipId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: champ } = await supabase
    .from('championships')
    .select('format, played_at')
    .eq('id', championshipId)
    .single()
  const isGroupPlayoff = champ?.format === 'group_playoff'

  // Check no final already exists
  const { data: existingFinal } = await supabase
    .from('championship_matches')
    .select('id')
    .eq('championship_id', championshipId)
    .eq('round', 'final')
    .limit(1)
  if (existingFinal && existingFinal.length > 0) throw new Error('Final already generated')

  // Fetch all knockout matches (semi + penalty)
  const { data: knockoutMatches } = await supabase
    .from('championship_matches')
    .select('id, home_player_id, away_player_id, home_score, away_score, round, leg')
    .eq('championship_id', championshipId)
    .in('round', ['semi', 'penalty'])

  const km = knockoutMatches ?? []

  // Check all semi matches have scores
  const unplayed = km.filter((m) => m.round === 'semi' && (m.home_score === null || m.away_score === null))
  if (unplayed.length > 0) throw new Error('Not all semi-final matches have been played yet')

  // Find the two ties by grouping on player pair
  const semiMatches = km.filter((m) => m.round === 'semi')
  const minSemis = isGroupPlayoff ? 2 : 4
  if (semiMatches.length < minSemis) throw new Error('Semi-finals not yet generated or incomplete')

  // Identify tie pairs: {p1, p2} unordered
  const pairs = new Map<string, string[]>()
  for (const m of semiMatches) {
    const key = [m.home_player_id, m.away_player_id].sort().join('|')
    if (!pairs.has(key)) pairs.set(key, [m.home_player_id, m.away_player_id].sort())
  }

  if (pairs.size !== 2) throw new Error('Expected exactly 2 semi-final ties')

  const finalists: string[] = []
  for (const [key, [p1, p2]] of pairs.entries()) {
    const tieMatches = km
      .filter((m) => {
        const k = [m.home_player_id, m.away_player_id].sort().join('|')
        return k === key
      })
      .map((m) => ({
        homePlayerId: m.home_player_id,
        awayPlayerId: m.away_player_id,
        homeScore: (m.home_score ?? 0) as number,
        awayScore: (m.away_score ?? 0) as number,
        round: m.round as string,
        leg: m.leg as number | null,
      }))

    const result = isGroupPlayoff
      ? resolvePlayoffSemi(p1, p2, tieMatches)
      : resolveSemiTie(p1, p2, tieMatches)
    if (result.winner === null) {
      throw new Error(
        isGroupPlayoff
          ? `One semi-final is drawn — please record a penalty decider first.`
          : `One semi-final tie is level on aggregate — please record a penalty decider first.`
      )
    }
    finalists.push(result.winner)
  }

  if (finalists.length !== 2) throw new Error('Could not determine finalists')

  // Fetch stats for finalists
  const { data: playersData } = await supabase
    .from('players')
    .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
    .in('id', finalists)

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (playersData ?? []) as RawPlayer[]) statsMap[p.id] = toStats(p)

  const finalSlot = generateFinalSlot(finalists[0], finalists[1])
  await insertMatchesWithOdds(supabase, championshipId, [finalSlot], statsMap, champ?.played_at)

  await logAdminAction('generate_final', 'championship', championshipId, { finalists })
  revalidatePath(`/championships/${championshipId}`)
}

/**
 * Generates a penalty decider match for a tied semi-final tie.
 * p1 and p2 must be the two players in the tied tie.
 */
export async function generatePenaltyDeciderAction(
  championshipId: string,
  p1: string,
  p2: string
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: champ } = await supabase
    .from('championships')
    .select('format, played_at')
    .eq('id', championshipId)
    .single()
  const isGroupPlayoff = champ?.format === 'group_playoff'

  // Verify these two players have a tied semi tie
  const { data: km } = await supabase
    .from('championship_matches')
    .select('id, home_player_id, away_player_id, home_score, away_score, round, leg')
    .eq('championship_id', championshipId)
    .in('round', ['semi', 'penalty'])

  const matches = km ?? []
  const key = [p1, p2].sort().join('|')

  const tieMatches = matches
    .filter((m) => {
      const k = [m.home_player_id, m.away_player_id].sort().join('|')
      return k === key
    })
    .map((m) => ({
      homePlayerId: m.home_player_id,
      awayPlayerId: m.away_player_id,
      homeScore: (m.home_score ?? 0) as number,
      awayScore: (m.away_score ?? 0) as number,
      round: m.round as string,
      leg: m.leg as number | null,
    }))

  const result = isGroupPlayoff
    ? resolvePlayoffSemi(p1, p2, tieMatches)
    : resolveSemiTie(p1, p2, tieMatches)
  if (result.winner !== null) throw new Error('This semi-final already has a winner — no penalty decider needed')
  if (!result.needsPenalty) {
    throw new Error(isGroupPlayoff ? 'Semi-final has not been played yet' : 'Semi-final legs not complete yet')
  }

  // Check no penalty decider already exists for this pair
  const existingPenalty = tieMatches.find((m) => m.round === 'penalty')
  if (existingPenalty) throw new Error('Penalty decider already exists for this tie')

  const { data: playersData } = await supabase
    .from('players')
    .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
    .in('id', [p1, p2])

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (playersData ?? []) as RawPlayer[]) statsMap[p.id] = toStats(p)

  const slot = generatePenaltySlot(p1, p2)
  await insertMatchesWithOdds(supabase, championshipId, [slot], statsMap, champ?.played_at)

  revalidatePath(`/championships/${championshipId}`)
}

/**
 * Generates a penalty decider for a drawn final.
 */
export async function generateFinalPenaltyDeciderAction(championshipId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const [champResult, kmResult] = await Promise.all([
    supabase.from('championships').select('played_at').eq('id', championshipId).single(),
    supabase
      .from('championship_matches')
      .select('id, home_player_id, away_player_id, home_score, away_score, round')
      .eq('championship_id', championshipId)
      .in('round', ['final', 'final_penalty']),
  ])

  const matches = kmResult.data ?? []
  const finalMatch = matches.find((m) => m.round === 'final')
  if (!finalMatch) throw new Error('Final has not been played yet')
  if (finalMatch.home_score === null || finalMatch.away_score === null)
    throw new Error('Final result has not been recorded yet')
  if (finalMatch.home_score !== finalMatch.away_score)
    throw new Error('Final was not a draw — no penalty decider needed')

  const existing = matches.find((m) => m.round === 'final_penalty')
  if (existing) throw new Error('Penalty decider for the final already exists')

  const p1 = finalMatch.home_player_id
  const p2 = finalMatch.away_player_id

  const { data: playersData } = await supabase
    .from('players')
    .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
    .in('id', [p1, p2])

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (playersData ?? []) as RawPlayer[]) statsMap[p.id] = toStats(p)

  const slot = generateFinalPenaltySlot(p1, p2)
  await insertMatchesWithOdds(supabase, championshipId, [slot], statsMap, champResult.data?.played_at)

  revalidatePath(`/championships/${championshipId}`)
}

/**
 * Admin adds a single extra match to a championship.
 * Uses full enhanced odds (form + H2H) since it's just one pair.
 */
export async function addExtraMatchAction(
  championshipId: string,
  homePlayerId: string,
  awayPlayerId: string
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: last } = await supabase
    .from('championship_matches')
    .select('cycle')
    .eq('championship_id', championshipId)
    .order('cycle', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: match, error } = await supabase
    .from('championship_matches')
    .insert({
      championship_id: championshipId,
      home_player_id:  homePlayerId,
      away_player_id:  awayPlayerId,
      cycle:           last?.cycle ?? 1,
      status:          'pending' as const,
    })
    .select('id')
    .single()

  if (error || !match) throw new Error(error?.message ?? 'Failed to create match')

  // Full enhanced odds with form + H2H
  const [statsResult, homeFormResult, awayFormResult, h2hResult] = await Promise.all([
    supabase
      .from('players')
      .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
      .in('id', [homePlayerId, awayPlayerId]),
    supabase.rpc('get_player_form', { p_player_id: homePlayerId, p_limit: 5 }),
    supabase.rpc('get_player_form', { p_player_id: awayPlayerId, p_limit: 5 }),
    supabase.rpc('get_h2h_stats', { p_player1_id: homePlayerId, p_player2_id: awayPlayerId }),
  ])

  if (!statsResult.error && statsResult.data) {
    const statsMap: Record<string, PlayerStats> = {}
    for (const p of statsResult.data as RawPlayer[]) statsMap[p.id] = toStats(p)

    const homeStats = statsMap[homePlayerId] ?? defaultStats
    const awayStats = statsMap[awayPlayerId] ?? defaultStats
    const homeForm  = toOddsForm(homeFormResult.data as FormRpcRow[] | null)
    const awayForm  = toOddsForm(awayFormResult.data as FormRpcRow[] | null)
    const h2h       = toH2H(h2hResult.data as H2HRpcRow[] | null, true)

    const o = calculateOdds(homeStats, awayStats, { homeForm, awayForm, h2h, matchType: 'championship' })

    await supabase.from('match_odds').insert({
      odds_type:             'championship' as const,
      championship_match_id: match.id,
      home_win_odds:         o.homeWinOdds,
      draw_odds:             o.drawOdds,
      away_win_odds:         o.awayWinOdds,
      home_handicap:         o.homeHandicap,
      away_handicap:         o.awayHandicap,
      home_stats_snapshot: { stats: homeStats, form: homeForm, factors: o.homeFactors, impliedProb: o.homeWinPct, overround: o.overround },
      away_stats_snapshot: { stats: awayStats, form: awayForm, factors: o.awayFactors, impliedProb: o.awayWinPct, overround: o.overround },
    })
  }

  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath(`/championships/${championshipId}`)
}

/**
 * Generates all matches for a championship that has zero matches.
 * Safe to call on an existing championship where the initial insert failed.
 */
export async function regenerateMatchesAction(championshipId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: champ } = await supabase
    .from('championships')
    .select('format, number_of_cycles, played_at')
    .eq('id', championshipId)
    .single()
  if (!champ) throw new Error('Championship not found')

  // For group-based formats only check group-round matches (semi/final may already exist).
  // For round-robin check all matches.
  const isGroupFormat = champ.format === 'group_knockout' || champ.format === 'group_playoff'
  let existingQuery = supabase
    .from('championship_matches')
    .select('id')
    .eq('championship_id', championshipId)
    .limit(1)
  if (isGroupFormat) existingQuery = existingQuery.eq('round', 'group') as typeof existingQuery
  const { data: existing } = await existingQuery
  if (existing && existing.length > 0) throw new Error('Matches already exist for this championship')

  const { data: cpRows } = await supabase
    .from('championship_players')
    .select('player_id')
    .eq('championship_id', championshipId)
  const playerIds = (cpRows ?? []).map((r) => r.player_id)
  if (playerIds.length < 2) throw new Error('Not enough players')

  const { data: playersData } = await supabase
    .from('players')
    .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
    .in('id', playerIds)
  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (playersData ?? []) as RawPlayer[]) statsMap[p.id] = toStats(p)

  let slots
  if (champ.format === 'group_knockout') {
    const { groupA, groupB } = splitIntoGroups(playerIds)
    slots = generateGroupStageSlots(groupA, groupB, champ.number_of_cycles)
  } else if (champ.format === 'group_playoff') {
    slots = generateGroupPlayoffStageSlots(playerIds, champ.number_of_cycles)
  } else {
    // Only regenerate cycle 1; subsequent cycles use generateNextCycleAction.
    slots = generateRoundRobinCycle(playerIds, 1)
  }

  await insertMatchesWithOdds(supabase, championshipId, slots, statsMap, champ.played_at)
  revalidatePath(`/championships/${championshipId}`)
}

/**
 * Generates matches for the next cycle of a round-robin championship.
 * Cycles are generated one at a time so results can be registered before the
 * next set of matches is created.
 */
export async function generateNextCycleAction(championshipId: string): Promise<{ cycle: number }> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: champ } = await supabase
    .from('championships')
    .select('format, number_of_cycles, played_at')
    .eq('id', championshipId)
    .single()
  if (!champ) throw new Error('Championship not found')
  if (champ.format !== 'round_robin') throw new Error('Cycle-by-cycle generation is only available for round-robin championships')

  const { data: maxRow } = await supabase
    .from('championship_matches')
    .select('cycle')
    .eq('championship_id', championshipId)
    .order('cycle', { ascending: false })
    .limit(1)
    .maybeSingle()

  const maxCycle = maxRow?.cycle ?? 0
  const nextCycle = maxCycle + 1

  if (nextCycle > champ.number_of_cycles) {
    throw new Error('All cycles have already been generated')
  }

  const { data: cpRows } = await supabase
    .from('championship_players')
    .select('player_id')
    .eq('championship_id', championshipId)
  const playerIds = (cpRows ?? []).map((r) => r.player_id)
  if (playerIds.length < 2) throw new Error('Not enough players')

  const { data: playersData } = await supabase
    .from('players')
    .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
    .in('id', playerIds)
  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (playersData ?? []) as RawPlayer[]) statsMap[p.id] = toStats(p)

  const slots = generateRoundRobinCycle(playerIds, nextCycle)
  await insertMatchesWithOdds(supabase, championshipId, slots, statsMap, champ.played_at)

  await logAdminAction('generate_cycle', 'championship', championshipId, { cycle: nextCycle })
  revalidatePath(`/championships/${championshipId}`)
  return { cycle: nextCycle }
}

/**
 * Calculates fresh odds for a match pair using current stats + recent form + H2H.
 * Call any time — especially after results are recorded so stats have updated.
 */
export async function getMatchOddsAction(
  homePlayerId: string,
  awayPlayerId: string
): Promise<{
  homeWinOdds: number
  drawOdds: number
  awayWinOdds: number
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  homeHandicap: number
  awayHandicap: number
  expectedHomeGoals: number
  expectedAwayGoals: number
  homeFactors: { label: string; description: string; impact: string; ratingDelta: number }[]
  awayFactors: { label: string; description: string; impact: string; ratingDelta: number }[]
}> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = createServiceClient()

  const [statsResult, homeFormResult, awayFormResult, h2hResult] = await Promise.all([
    supabase
      .from('players')
      .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
      .in('id', [homePlayerId, awayPlayerId]),
    supabase.rpc('get_player_form', { p_player_id: homePlayerId, p_limit: 5 }),
    supabase.rpc('get_player_form', { p_player_id: awayPlayerId, p_limit: 5 }),
    supabase.rpc('get_h2h_stats', { p_player1_id: homePlayerId, p_player2_id: awayPlayerId }),
  ])

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (statsResult.data ?? []) as RawPlayer[]) statsMap[p.id] = toStats(p)

  const homeStats = statsMap[homePlayerId] ?? defaultStats
  const awayStats = statsMap[awayPlayerId] ?? defaultStats
  const homeForm  = toOddsForm(homeFormResult.data as FormRpcRow[] | null)
  const awayForm  = toOddsForm(awayFormResult.data as FormRpcRow[] | null)
  const h2h       = toH2H(h2hResult.data as H2HRpcRow[] | null, true)

  return calculateOdds(homeStats, awayStats, { homeForm, awayForm, h2h, matchType: 'championship' })
}

// ─── Championship winner odds action ─────────────────────────────────────────

export type ChampionshipWinnerEntry = {
  playerId: string
  currentPoints: number
  expectedFinalPoints: number
  winProbability: number      // 0–1
  impliedOdds: number         // decimal odds e.g. 2.50
  completedMatches: number
  pendingMatches: number
}

export async function getChampionshipWinnerOddsAction(
  championshipId: string,
  playerIds: string[]
): Promise<ChampionshipWinnerEntry[]> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (playerIds.length < 2) return []

  const supabase = createServiceClient()

  const [matchesResult, statsResult] = await Promise.all([
    supabase
      .from('championship_matches')
      .select('id, home_player_id, away_player_id, home_score, away_score, status')
      .eq('championship_id', championshipId),
    supabase
      .from('players')
      .select('id, wins, losses, draws, matches_played, goal_diff, goals_for')
      .in('id', playerIds),
  ])

  const allMatches = (matchesResult.data ?? []) as Array<{
    id: string
    home_player_id: string
    away_player_id: string
    home_score: number | null
    away_score: number | null
    status: string
  }>

  const statsMap: Record<string, PlayerStats> = {}
  for (const p of (statsResult.data ?? []) as RawPlayer[]) statsMap[p.id] = toStats(p)

  // Current standings from completed matches
  const currentPoints: Record<string, number> = {}
  const completedCount: Record<string, number> = {}
  const pendingCount: Record<string, number> = {}
  for (const pid of playerIds) {
    currentPoints[pid] = 0
    completedCount[pid] = 0
    pendingCount[pid] = 0
  }

  for (const m of allMatches) {
    if (m.home_score !== null && m.away_score !== null) {
      if (m.home_score > m.away_score) {
        currentPoints[m.home_player_id] = (currentPoints[m.home_player_id] ?? 0) + 3
      } else if (m.home_score < m.away_score) {
        currentPoints[m.away_player_id] = (currentPoints[m.away_player_id] ?? 0) + 3
      } else {
        currentPoints[m.home_player_id] = (currentPoints[m.home_player_id] ?? 0) + 1
        currentPoints[m.away_player_id] = (currentPoints[m.away_player_id] ?? 0) + 1
      }
      completedCount[m.home_player_id] = (completedCount[m.home_player_id] ?? 0) + 1
      completedCount[m.away_player_id] = (completedCount[m.away_player_id] ?? 0) + 1
    } else {
      pendingCount[m.home_player_id] = (pendingCount[m.home_player_id] ?? 0) + 1
      pendingCount[m.away_player_id] = (pendingCount[m.away_player_id] ?? 0) + 1
    }
  }

  // If no matches completed yet, return equal probabilities
  const totalCompleted = Object.values(completedCount).reduce((a, b) => a + b, 0)
  const expectedFinal: Record<string, number> = { ...currentPoints }

  if (totalCompleted > 0) {
    // Add expected points from pending matches using odds engine
    for (const m of allMatches) {
      if (m.home_score !== null && m.away_score !== null) continue
      const homeStats = statsMap[m.home_player_id] ?? defaultStats
      const awayStats = statsMap[m.away_player_id] ?? defaultStats
      const odds = calculateOdds(homeStats, awayStats, { matchType: 'championship' })
      // Expected points: win=3pts, draw=1pt, loss=0pts
      const homeExpected = (odds.homeWinPct / 100) * 3 + (odds.drawPct / 100) * 1
      const awayExpected = (odds.awayWinPct / 100) * 3 + (odds.drawPct / 100) * 1
      expectedFinal[m.home_player_id] = (expectedFinal[m.home_player_id] ?? 0) + homeExpected
      expectedFinal[m.away_player_id] = (expectedFinal[m.away_player_id] ?? 0) + awayExpected
    }
  }

  // Convert expected final points → win probabilities
  // Use power-3 softmax: amplifies the leader's advantage realistically
  const vals = playerIds.map((pid) => Math.max(expectedFinal[pid] ?? 0, 0))
  const powered = vals.map((v) => Math.pow(v + 0.01, 3))
  const total = powered.reduce((a, b) => a + b, 0)
  const probs = powered.map((p) => (total > 0 ? p / total : 1 / playerIds.length))

  return playerIds
    .map((pid, i) => ({
      playerId: pid,
      currentPoints: currentPoints[pid] ?? 0,
      expectedFinalPoints: Math.round((expectedFinal[pid] ?? 0) * 10) / 10,
      winProbability: probs[i],
      impliedOdds: probs[i] > 0 ? Math.round((1 / probs[i]) * 100) / 100 : 99,
      completedMatches: completedCount[pid] ?? 0,
      pendingMatches: pendingCount[pid] ?? 0,
    }))
    .sort((a, b) => b.winProbability - a.winProbability)
}

// ─── Match preview action ─────────────────────────────────────────────────────

export type MatchPreviewData = {
  homeStats: { wins: number; losses: number; draws: number; matchesPlayed: number; goalsFor: number; goalsAgainst: number; goalDiff: number; winRate: number } | null
  awayStats: { wins: number; losses: number; draws: number; matchesPlayed: number; goalsFor: number; goalsAgainst: number; goalDiff: number; winRate: number } | null
  homeForm: Array<{ result: 'W' | 'L' | 'D'; goalsFor: number; goalsAgainst: number; opponentName: string }>
  awayForm: Array<{ result: 'W' | 'L' | 'D'; goalsFor: number; goalsAgainst: number; opponentName: string }>
  h2h: { homeWins: number; awayWins: number; draws: number; homeGoals: number; awayGoals: number; totalMatches: number } | null
  odds: {
    homeWinOdds: number; drawOdds: number; awayWinOdds: number
    homeWinPct: number; drawPct: number; awayWinPct: number
    homeHandicap: number; awayHandicap: number
    expectedHomeGoals: number; expectedAwayGoals: number
    homeFactors: { label: string; description: string; impact: string; ratingDelta: number }[]
    awayFactors: { label: string; description: string; impact: string; ratingDelta: number }[]
  }
}

export async function getMatchPreviewAction(
  homePlayerId: string,
  awayPlayerId: string
): Promise<MatchPreviewData> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = createServiceClient()

  const [statsResult, homeFormResult, awayFormResult, h2hResult] = await Promise.all([
    supabase
      .from('players')
      .select('id, wins, losses, draws, matches_played, goal_diff, goals_for, goals_against')
      .in('id', [homePlayerId, awayPlayerId]),
    supabase.rpc('get_player_form', { p_player_id: homePlayerId, p_limit: 5 }),
    supabase.rpc('get_player_form', { p_player_id: awayPlayerId, p_limit: 5 }),
    supabase.rpc('get_h2h_stats', { p_player1_id: homePlayerId, p_player2_id: awayPlayerId }),
  ])

  type RawPlayerFull = RawPlayer & { goals_against?: number }
  const rawPlayers = (statsResult.data ?? []) as RawPlayerFull[]
  const rawMap: Record<string, RawPlayerFull> = {}
  for (const p of rawPlayers) rawMap[p.id] = p

  const toPreviewStats = (p: RawPlayerFull | undefined) => {
    if (!p) return null
    const mp = p.matches_played ?? 0
    return {
      wins: p.wins, losses: p.losses, draws: p.draws, matchesPlayed: mp,
      goalsFor: p.goals_for, goalsAgainst: p.goals_against ?? 0,
      goalDiff: p.goal_diff, winRate: mp > 0 ? p.wins / mp : 0,
    }
  }

  type FullFormRow = FormRpcRow & { opponent_name?: string }
  const parseDisplayForm = (rows: FullFormRow[] | null) => {
    if (!rows) return []
    return rows.map((r) => ({
      result: r.result as 'W' | 'L' | 'D',
      goalsFor: r.goals_for,
      goalsAgainst: r.goals_against,
      opponentName: (r.opponent_name as string | undefined) ?? '?',
    }))
  }

  const parseH2H = (rows: H2HRpcRow[] | null) => {
    if (!rows || rows.length === 0) return null
    const row = rows[0]
    const total = Number(row.total_matches)
    if (total === 0) return null
    return {
      homeWins: Number(row.player1_wins),
      awayWins: Number(row.player2_wins),
      draws: Number(row.draws),
      homeGoals: Number((row as Record<string, unknown>).player1_goals ?? 0),
      awayGoals: Number((row as Record<string, unknown>).player2_goals ?? 0),
      totalMatches: total,
    }
  }

  const homeRaw = rawMap[homePlayerId]
  const awayRaw = rawMap[awayPlayerId]
  const homeOddsStats = homeRaw ? toStats(homeRaw) : defaultStats
  const awayOddsStats = awayRaw ? toStats(awayRaw) : defaultStats
  const homeOddsForm = toOddsForm(homeFormResult.data as FormRpcRow[] | null)
  const awayOddsForm = toOddsForm(awayFormResult.data as FormRpcRow[] | null)
  const h2hForOdds = toH2H(h2hResult.data as H2HRpcRow[] | null, true)

  const odds = calculateOdds(homeOddsStats, awayOddsStats, { homeForm: homeOddsForm, awayForm: awayOddsForm, h2h: h2hForOdds, matchType: 'championship' })

  return {
    homeStats: toPreviewStats(homeRaw),
    awayStats: toPreviewStats(awayRaw),
    homeForm: parseDisplayForm(homeFormResult.data as FullFormRow[] | null),
    awayForm: parseDisplayForm(awayFormResult.data as FullFormRow[] | null),
    h2h: parseH2H(h2hResult.data as H2HRpcRow[] | null),
    odds,
  }
}

export async function updateChampionshipDateAction(
  championshipId: string,
  playedAt: string | null
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('championships')
    .update({ played_at: playedAt })
    .eq('id', championshipId)

  if (error) throw new Error(error.message)
  await logAdminAction('update_championship_date', 'championship', championshipId)
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath(`/championships/${championshipId}`)
  revalidatePath('/championships')
  revalidatePath('/')
}

export async function deleteChampionshipAction(championshipId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('championships')
    .delete()
    .eq('id', championshipId)

  if (error) throw new Error(error.message)
  await logAdminAction('delete_championship', 'championship', championshipId)
  revalidatePath('/championships')
}

// ─── Participant actions (user-context, RLS + trigger enforced) ───────────────

/**
 * Records the first score for a pending championship match.
 * Any participant (home or away) or admin may call this.
 */
export async function recordChampionshipScoreAction(
  championshipId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = await getAuthedClient()
  if (!supabase) throw new Error('Session expired')

  const { error } = await supabase
    .from('championship_matches')
    .update({
      home_score:   homeScore,
      away_score:   awayScore,
      status:       'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'pending')

  if (error) throw new Error(error.message)
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath(`/championships/${championshipId}`)
}

/**
 * Edits scores on a confirmed championship match within the 4-hour window.
 */
export async function updateChampionshipMatchAction(
  championshipId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = await getAuthedClient()
  if (!supabase) throw new Error('Session expired')

  const { error } = await supabase
    .from('championship_matches')
    .update({ home_score: homeScore, away_score: awayScore })
    .eq('id', matchId)

  if (error) throw new Error(error.message)
  revalidateTag(STATS_CACHE_TAG, 'max')
  revalidatePath(`/championships/${championshipId}`)
}
