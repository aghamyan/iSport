import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateStandings } from '@/lib/championships/standings'
import type {
  ChampionshipLeader,
  ChampionshipResult,
  CurrentChampion,
  FormEntry,
  FormResult,
  H2HRecord,
  NamedPlayerStats,
  PlayerStatsRow,
  RivalryWinner,
  SeasonStats,
} from './types'

// Cache tag used by revalidateTag('stats') in match/championship actions.
// All stat caches share one tag so any match confirmation invalidates the lot.
export const STATS_CACHE_TAG = 'stats'

// ─── Global player stats (O(1) read from denormalised players table) ──────────

export const getPlayerStats = unstable_cache(
  async (playerId: string): Promise<PlayerStatsRow | null> => {
    const { data, error } = await createServiceClient()
      .from('players')
      .select('id, wins, losses, draws, matches_played, goals_for, goals_against, goal_diff, updated_at')
      .eq('id', playerId)
      .single()

    if (error || !data) return null

    return {
      id:            data.id,
      wins:          data.wins,
      losses:        data.losses,
      draws:         data.draws,
      matchesPlayed: data.matches_played,
      goalsFor:      data.goals_for,
      goalsAgainst:  data.goals_against,
      goalDiff:      data.goal_diff,
      winRate:       data.matches_played > 0 ? data.wins / data.matches_played : 0,
      updatedAt:     data.updated_at,
    }
  },
  ['player-stats'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)

// ─── All players with names + stats (leaderboard) ─────────────────────────────
//
// Extended to include user display fields so the leaderboard page can render
// player names without a second round-trip. Default order is wins → GD → GF.

type PlayerWithUser = {
  id: string
  wins: number
  losses: number
  draws: number
  matches_played: number
  goals_for: number
  goals_against: number
  goal_diff: number
  updated_at: string
  users: { name: string; avatar_url: string | null } | null
}

export const getLeaderboard = unstable_cache(
  async (): Promise<NamedPlayerStats[]> => {
    const { data, error } = await createServiceClient()
      .from('players')
      .select(`
        id, wins, losses, draws, matches_played,
        goals_for, goals_against, goal_diff, updated_at,
        users(name, avatar_url)
      `)
      .order('wins',        { ascending: false })
      .order('goal_diff',   { ascending: false })
      .order('goals_for',   { ascending: false })

    if (error || !data) return []

    return (data as unknown as PlayerWithUser[]).map((p) => ({
      id:            p.id,
      wins:          p.wins,
      losses:        p.losses,
      draws:         p.draws,
      matchesPlayed: p.matches_played,
      goalsFor:      p.goals_for,
      goalsAgainst:  p.goals_against,
      goalDiff:      p.goal_diff,
      winRate:       p.matches_played > 0 ? p.wins / p.matches_played : 0,
      updatedAt:     p.updated_at,
      name:          p.users?.name ?? 'Unknown',
      avatarUrl:     p.users?.avatar_url ?? null,
    }))
  },
  ['leaderboard'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)

// ─── Last N match results for a player (form) ─────────────────────────────────
//
// Calls the get_player_form DB RPC which unions friendly + championship matches,
// orders by played_at DESC, and joins users for opponent names.

type FormRpcRow = {
  match_id:      string
  opponent_id:   string
  opponent_name: string
  result:        string
  goals_for:     number
  goals_against: number
  played_at:     string
  match_type:    string
}

export const getPlayerForm = unstable_cache(
  async (playerId: string, limit = 5): Promise<FormEntry[]> => {
    const { data, error } = await createServiceClient()
      .rpc('get_player_form', { p_player_id: playerId, p_limit: limit })

    if (error || !data) return []

    return (data as FormRpcRow[]).map((row) => ({
      matchId:      row.match_id,
      opponentId:   row.opponent_id,
      opponentName: row.opponent_name,
      result:       row.result as FormResult,
      goalsFor:     row.goals_for,
      goalsAgainst: row.goals_against,
      playedAt:     row.played_at,
      matchType:    row.match_type as FormEntry['matchType'],
    }))
  },
  ['player-form'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)

// ─── Head-to-head between two players ─────────────────────────────────────────
//
// Calls the get_h2h_stats DB RPC which unions friendly + championship matches.
// player1Id / player2Id are caller-assigned; the DB function is order-agnostic.

type H2HRpcRow = {
  player1_wins:  number | string
  player2_wins:  number | string
  draws:         number | string
  player1_goals: number | string
  player2_goals: number | string
  total_matches: number | string
}

export const getH2HStats = unstable_cache(
  async (player1Id: string, player2Id: string): Promise<H2HRecord | null> => {
    const { data, error } = await createServiceClient()
      .rpc('get_h2h_stats', { p_player1_id: player1Id, p_player2_id: player2Id })

    if (error || !data || (data as H2HRpcRow[]).length === 0) return null

    const row = (data as H2HRpcRow[])[0]
    return {
      player1Wins:  Number(row.player1_wins),
      player2Wins:  Number(row.player2_wins),
      draws:        Number(row.draws),
      player1Goals: Number(row.player1_goals),
      player2Goals: Number(row.player2_goals),
      totalMatches: Number(row.total_matches),
    }
  },
  ['h2h-stats'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)

// ─── Per-championship (seasonal) stats for a player ───────────────────────────
//
// Reads from the denormalised championship_standings table which is kept
// in sync by trg_championship_stats. Optionally filtered to one championship.

type StandingsRow = {
  championship_id: string
  played:          number
  wins:            number
  draws:           number
  losses:          number
  goals_for:       number
  goals_against:   number
  points:          number
  goal_diff:       number
  championships:   { name: string } | null
}

export const getSeasonalStats = unstable_cache(
  async (playerId: string, championshipId?: string): Promise<SeasonStats[]> => {
    let query = createServiceClient()
      .from('championship_standings')
      .select(`
        championship_id, played, wins, draws, losses,
        goals_for, goals_against, points, goal_diff,
        championships(name)
      `)
      .eq('player_id', playerId)
      .order('updated_at', { ascending: false })

    if (championshipId) {
      query = query.eq('championship_id', championshipId)
    }

    const { data, error } = await query
    if (error || !data) return []

    return (data as unknown as StandingsRow[]).map((row) => ({
      championshipId:   row.championship_id,
      championshipName: row.championships?.name ?? 'Unknown',
      played:           row.played,
      wins:             row.wins,
      draws:            row.draws,
      losses:           row.losses,
      goalsFor:         row.goals_for,
      goalsAgainst:     row.goals_against,
      points:           row.points,
      goalDiff:         row.goal_diff,
    }))
  },
  ['seasonal-stats'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)

// ─── Players who have won rivalries, sorted by win count ──────────────────────

export const getRivalryWinners = unstable_cache(
  async (): Promise<RivalryWinner[]> => {
    const supabase = createServiceClient()

    // Fetch all rivalry_won badges with the holder's player_id
    const { data: badgeRows, error } = await supabase
      .from('player_badges')
      .select('player_id, badges!inner(badge_type)')
      .eq('badges.badge_type', 'rivalry_won')

    if (error || !badgeRows || badgeRows.length === 0) return []

    // Aggregate count per player
    const countMap = new Map<string, number>()
    for (const row of badgeRows) {
      countMap.set(row.player_id, (countMap.get(row.player_id) ?? 0) + 1)
    }

    const playerIds = Array.from(countMap.keys())
    const { data: users } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', playerIds)

    const userMap = new Map((users ?? []).map((u) => [u.id, u]))

    return playerIds
      .map((pid) => {
        const u = userMap.get(pid)
        return {
          playerId:     pid,
          name:         u?.name ?? 'Unknown',
          avatarUrl:    u?.avatar_url ?? null,
          rivalriesWon: countMap.get(pid) ?? 0,
        }
      })
      .sort((a, b) => b.rivalriesWon - a.rivalriesWon)
  },
  ['rivalry-winners'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)

// ─── Current leader per championship (accurate H2H tiebreaker) ────────────────
//
// Uses calculateStandings (same algorithm as ChampionshipDetail) so the leader
// shown here always matches what the championship page displays.

type ChampRow = { id: string; name: string; is_active: boolean }
type CpRow    = { championship_id: string; player_id: string }
type CmRow    = {
  id: string
  championship_id: string
  home_player_id: string
  away_player_id: string
  home_score: number | null
  away_score: number | null
}

export const getChampionshipLeaders = unstable_cache(
  async (): Promise<ChampionshipLeader[]> => {
    const supabase = createServiceClient()

    // Batch: 3 queries regardless of how many championships exist (was 3N + 1).
    // calculateStandings is still used per-championship to preserve the H2H
    // tiebreaker so results stay consistent with the championship detail page.
    const [champsRes, cpRes, cmRes] = await Promise.all([
      supabase
        .from('championships')
        .select('id, name, is_active')
        .order('created_at', { ascending: false }),
      supabase
        .from('championship_players')
        .select('championship_id, player_id'),
      supabase
        .from('championship_matches')
        .select('id, championship_id, home_player_id, away_player_id, home_score, away_score')
        .in('status', ['confirmed', 'final']),
    ])

    if (champsRes.error || !champsRes.data?.length) return []

    // Collect all player IDs referenced across any championship, then fetch names once.
    const allPlayerIds = [...new Set((cpRes.data ?? []).map((p) => p.player_id))]
    const { data: users } = allPlayerIds.length
      ? await supabase.from('users').select('id, name, avatar_url').in('id', allPlayerIds)
      : { data: [] }
    const userMap = new Map((users ?? []).map((u) => [u.id, u]))

    // Group players and matches by championship for O(1) lookup below.
    const playersByChamp = new Map<string, string[]>()
    for (const p of (cpRes.data ?? []) as CpRow[]) {
      const arr = playersByChamp.get(p.championship_id) ?? []
      arr.push(p.player_id)
      playersByChamp.set(p.championship_id, arr)
    }

    const matchesByChamp = new Map<string, CmRow[]>()
    for (const m of (cmRes.data ?? []) as CmRow[]) {
      const arr = matchesByChamp.get(m.championship_id) ?? []
      arr.push(m)
      matchesByChamp.set(m.championship_id, arr)
    }

    const results = (champsRes.data as ChampRow[]).map((champ) => {
      const playerIds = playersByChamp.get(champ.id) ?? []
      if (!playerIds.length) return null

      const matchRows = (matchesByChamp.get(champ.id) ?? []).map((m) => ({
        id:           m.id,
        homePlayerId: m.home_player_id,
        awayPlayerId: m.away_player_id,
        homeScore:    m.home_score,
        awayScore:    m.away_score,
      }))

      const standings = calculateStandings(matchRows, playerIds)
      if (!standings.length) return null

      const leader     = standings[0]
      const leaderUser = userMap.get(leader.playerId)

      return {
        championshipId:   champ.id,
        championshipName: champ.name,
        isActive:         champ.is_active,
        playerId:         leader.playerId,
        playerName:       leaderUser?.name ?? 'Unknown',
        avatarUrl:        leaderUser?.avatar_url ?? null,
        played:           leader.played,
        wins:             leader.wins,
        draws:            leader.draws,
        losses:           leader.losses,
        points:           leader.points,
        goalDiff:         leader.goalDiff,
      } satisfies ChampionshipLeader
    })

    return results.filter((r): r is ChampionshipLeader => r !== null)
  },
  ['championship-leaders'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)

// ─── A specific player's rank in each championship they participated in ────────

export const getPlayerChampionshipPlacements = unstable_cache(
  async (playerId: string): Promise<ChampionshipResult[]> => {
    const supabase = createServiceClient()

    // Find all championships this player is rostered in
    const { data: cpRows, error: ce } = await supabase
      .from('championship_players')
      .select('championship_id, championships!inner(name, is_active)')
      .eq('player_id', playerId)

    if (ce || !cpRows?.length) return []

    const champIds = cpRows.map((cp) => cp.championship_id)

    // Batch: 2 queries for all championships instead of 2N (was one pair per champ).
    const [allPlayersRes, allMatchesRes] = await Promise.all([
      supabase
        .from('championship_players')
        .select('championship_id, player_id')
        .in('championship_id', champIds),
      supabase
        .from('championship_matches')
        .select('id, championship_id, home_player_id, away_player_id, home_score, away_score')
        .in('championship_id', champIds)
        .in('status', ['confirmed', 'final']),
    ])

    const playersByChamp = new Map<string, string[]>()
    for (const p of (allPlayersRes.data ?? []) as CpRow[]) {
      const arr = playersByChamp.get(p.championship_id) ?? []
      arr.push(p.player_id)
      playersByChamp.set(p.championship_id, arr)
    }

    const matchesByChamp = new Map<string, CmRow[]>()
    for (const m of (allMatchesRes.data ?? []) as CmRow[]) {
      const arr = matchesByChamp.get(m.championship_id) ?? []
      arr.push(m)
      matchesByChamp.set(m.championship_id, arr)
    }

    const placements = cpRows.map((cp) => {
      const champ    = cp.championships as unknown as { name: string; is_active: boolean }
      const champId  = cp.championship_id
      const playerIds = playersByChamp.get(champId) ?? []
      const matchRows = (matchesByChamp.get(champId) ?? []).map((m) => ({
        id:           m.id,
        homePlayerId: m.home_player_id,
        awayPlayerId: m.away_player_id,
        homeScore:    m.home_score,
        awayScore:    m.away_score,
      }))

      const standings = calculateStandings(matchRows, playerIds)
      const rank = standings.findIndex((r) => r.playerId === playerId)
      if (rank === -1) return null

      const row = standings[rank]
      return {
        championshipId:   champId,
        championshipName: champ.name,
        isActive:         champ.is_active,
        rank:             rank + 1,
        totalPlayers:     playerIds.length,
        played:           row.played,
        wins:             row.wins,
        draws:            row.draws,
        losses:           row.losses,
        points:           row.points,
        goalDiff:         row.goalDiff,
        goalsFor:         row.goalsFor,
        goalsAgainst:     row.goalsAgainst,
      } satisfies ChampionshipResult
    })

    return placements
      .filter((r): r is ChampionshipResult => r !== null)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive))
  },
  ['player-championship-placements'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)

// ─── Winner of the most recent completed championship ─────────────────────────

export const getLastChampionshipWinner = unstable_cache(
  async (): Promise<CurrentChampion | null> => {
    const supabase = createServiceClient()

    const { data: champ } = await supabase
      .from('championships')
      .select('id, name')
      .eq('is_active', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!champ) return null

    const champId = champ.id

    const [matchesRes, playersRes] = await Promise.all([
      supabase
        .from('championship_matches')
        .select('id, home_player_id, away_player_id, home_score, away_score, round')
        .eq('championship_id', champId)
        .in('status', ['confirmed', 'final']),
      supabase
        .from('championship_players')
        .select('player_id')
        .eq('championship_id', champId),
    ])

    const matches = matchesRes.data ?? []
    const playerIds = (playersRes.data ?? []).map((p: { player_id: string }) => p.player_id)

    if (playerIds.length === 0 || matches.length === 0) return null

    // Knockout/playoff formats: winner comes from the final match
    const finalPenaltyMatch = matches.find((m) => m.round === 'final_penalty')
    const finalMatch = matches.find((m) => m.round === 'final')

    let winnerId: string | null = null

    if (finalPenaltyMatch && finalPenaltyMatch.home_score !== null && finalPenaltyMatch.away_score !== null) {
      winnerId = finalPenaltyMatch.home_score > finalPenaltyMatch.away_score
        ? finalPenaltyMatch.home_player_id
        : finalPenaltyMatch.away_player_id
    } else if (finalMatch && finalMatch.home_score !== null && finalMatch.away_score !== null) {
      if (finalMatch.home_score !== finalMatch.away_score) {
        winnerId = finalMatch.home_score > finalMatch.away_score
          ? finalMatch.home_player_id
          : finalMatch.away_player_id
      }
    }

    // Round-robin format: winner is rank 1 in standings
    if (!winnerId) {
      const rows = matches.map((m) => ({
        id: m.id,
        homePlayerId: m.home_player_id,
        awayPlayerId: m.away_player_id,
        homeScore: m.home_score,
        awayScore: m.away_score,
      }))
      const standings = calculateStandings(rows, playerIds)
      if (standings.length > 0) winnerId = standings[0].playerId
    }

    if (!winnerId) return null

    const { data: userRow } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', winnerId)
      .maybeSingle()

    if (!userRow) return null

    // Group-stage stats only (exclude knockout rounds)
    const groupRows = matches
      .filter((m) => !['semi', 'final', 'penalty', 'final_penalty'].includes(m.round ?? ''))
      .map((m) => ({
        id: m.id,
        homePlayerId: m.home_player_id,
        awayPlayerId: m.away_player_id,
        homeScore: m.home_score,
        awayScore: m.away_score,
      }))

    const standings = calculateStandings(groupRows, playerIds)
    const winnerRow = standings.find((r) => r.playerId === winnerId)

    return {
      playerId: winnerId,
      playerName: userRow.name,
      avatarUrl: (userRow.avatar_url as string | null) ?? null,
      championshipId: champId,
      championshipName: champ.name,
      points: winnerRow?.points ?? 0,
      wins: winnerRow?.wins ?? 0,
      draws: winnerRow?.draws ?? 0,
      losses: winnerRow?.losses ?? 0,
      goalDiff: winnerRow?.goalDiff ?? 0,
    }
  },
  ['last-championship-winner'],
  { tags: [STATS_CACHE_TAG], revalidate: 60 }
)
