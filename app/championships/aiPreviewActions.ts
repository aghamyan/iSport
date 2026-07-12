'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import {
  generateMatchPreview,
  type MatchPreviewAiContext,
  type MatchPreviewAiResult,
} from '@/lib/ai/matchPreview'
import type { StandingLine, PastChampionshipLine, RecentMatchLine, P4PLine, ActivityLine } from '@/lib/ai/interview'
import {
  getPlayerChampionshipPlacements,
  getChampionshipOnlyStats,
  getChampionshipLeaders,
  getChampionshipMatchHistory,
  buildTitleRecords,
} from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { isReservedAdminName } from '@/lib/players'

export type MatchAiPreview = {
  headline: string
  summary: string
  insights: Array<{ title: string; detail: string }>
  generatedAt: string
}

type MatchRow = {
  id: string
  championship_id: string
  home_player_id: string
  away_player_id: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'confirmed' | 'final'
  round: string | null
  group_label: string | null
}

type FormRow = { result: 'W' | 'D' | 'L'; played_at: string }
type H2HRow = { player1_wins?: number | string; player2_wins?: number | string; draws?: number | string; total_matches?: number | string }
type OddsRow = { home_win_odds: number | string | null; draw_odds: number | string | null; away_win_odds: number | string | null }
type ChampMatchRow = { id: string; home_player_id: string; away_player_id: string; home_score: number; away_score: number }

function roundLabelFor(round: string | null, groupLabel: string | null): string | null {
  if (round === 'final') return 'GRAND FINAL'
  if (round === 'final_penalty') return 'FINAL · PENS'
  if (round === 'semi') return 'SEMI-FINAL'
  if (round === 'penalty') return 'PENALTIES'
  if (round === 'group' && groupLabel) return `GROUP ${groupLabel}`
  return null
}

function toStandingLine(placement: {
  rank: number
  totalPlayers: number
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalDiff: number
} | undefined): StandingLine | null {
  if (!placement) return null
  return {
    rank: placement.rank,
    totalPlayers: placement.totalPlayers,
    points: placement.points,
    played: placement.played,
    wins: placement.wins,
    draws: placement.draws,
    losses: placement.losses,
    goalDiff: placement.goalDiff,
  }
}

async function buildPreviewContext(supabase: SupabaseClient, match: MatchRow): Promise<MatchPreviewAiContext> {
  const homeId = match.home_player_id
  const awayId = match.away_player_id

  const [
    usersResult,
    playersResult,
    homeFormResult,
    awayFormResult,
    h2hResult,
    champResult,
    oddsResult,
    champMatchesResult,
    homePlacements,
    awayPlacements,
    p4pStats,
    p4pLeaders,
    p4pMatchHistory,
  ] = await Promise.all([
    supabase.from('users').select('id, name').in('id', [homeId, awayId]),
    supabase.from('players').select('id, wins, losses, draws').in('id', [homeId, awayId]),
    supabase.rpc('get_player_form', { p_player_id: homeId, p_limit: 5 }),
    supabase.rpc('get_player_form', { p_player_id: awayId, p_limit: 5 }),
    supabase.rpc('get_h2h_stats', { p_player1_id: homeId, p_player2_id: awayId }),
    supabase.from('championships').select('name').eq('id', match.championship_id).single(),
    supabase
      .from('match_odds')
      .select('home_win_odds, draw_odds, away_win_odds')
      .eq('championship_match_id', match.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('championship_matches')
      .select('id, home_player_id, away_player_id, home_score, away_score, confirmed_at')
      .eq('championship_id', match.championship_id)
      .in('status', ['confirmed', 'final'])
      .not('home_score', 'is', null)
      .neq('id', match.id)
      .order('confirmed_at', { ascending: false }),
    getPlayerChampionshipPlacements(homeId),
    getPlayerChampionshipPlacements(awayId),
    // Same inputs the leaderboard's P4P tab uses — cached, so this is an in-memory
    // recompute over already-fetched data, not an extra round of heavy queries.
    getChampionshipOnlyStats(),
    getChampionshipLeaders(),
    getChampionshipMatchHistory(),
  ])

  const nameMap = new Map<string, string>(
    ((usersResult.data ?? []) as Array<{ id: string; name: string }>).map((u) => [u.id, u.name])
  )
  const recordMap = new Map<string, { wins: number; losses: number; draws: number }>(
    ((playersResult.data ?? []) as Array<{ id: string; wins: number; losses: number; draws: number }>).map((p) => [
      p.id,
      { wins: p.wins, losses: p.losses, draws: p.draws },
    ])
  )

  const toForm = (rows: FormRow[] | null): Array<'W' | 'D' | 'L'> => (rows ?? []).map((r) => r.result)
  const lastPlayedAt = (rows: FormRow[] | null): string | null => (rows && rows.length > 0 ? rows[0].played_at : null)
  const daysSince = (iso: string | null): number | null =>
    iso === null ? null : Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)))

  const homeFormRows = homeFormResult.data as FormRow[] | null
  const awayFormRows = awayFormResult.data as FormRow[] | null

  const p4pRanked = rankByP4P(p4pStats, buildTitleRecords(p4pLeaders), p4pMatchHistory)
  const p4pIndex = new Map<string, P4PLine>(
    p4pRanked.map((p, i) => [p.id, { score: p.p4p.score, confidence: p.p4p.confidence, rank: i + 1, totalPlayers: p4pRanked.length }])
  )

  const h2hRows = (h2hResult.data ?? []) as H2HRow[]
  const h2hRow = h2hRows[0]
  const totalMatches = Number(h2hRow?.total_matches ?? 0)
  const h2h = h2hRow && totalMatches > 0
    ? {
        homeWins: Number(h2hRow.player1_wins ?? 0),
        awayWins: Number(h2hRow.player2_wins ?? 0),
        draws: Number(h2hRow.draws ?? 0),
        totalMatches,
      }
    : null

  const oddsRow = oddsResult.data as OddsRow | null
  const odds = oddsRow && oddsRow.home_win_odds !== null && oddsRow.draw_odds !== null && oddsRow.away_win_odds !== null
    ? {
        homeOdds: Number(oddsRow.home_win_odds),
        drawOdds: Number(oddsRow.draw_odds),
        awayOdds: Number(oddsRow.away_win_odds),
      }
    : null

  // Recent results within THIS championship only — distinct from homeForm/awayForm,
  // which blend in friendly matches and every other championship the player has been in.
  const champMatches = (champMatchesResult.data ?? []) as ChampMatchRow[]
  const otherParticipant = (m: ChampMatchRow, id: string) => (m.home_player_id === id ? m.away_player_id : m.home_player_id)
  const homeRawRows = champMatches.filter((m) => m.home_player_id === homeId || m.away_player_id === homeId).slice(0, 8)
  const awayRawRows = champMatches.filter((m) => m.home_player_id === awayId || m.away_player_id === awayId).slice(0, 8)

  const thirdPartyIds = new Set<string>()
  for (const m of homeRawRows) thirdPartyIds.add(otherParticipant(m, homeId))
  for (const m of awayRawRows) thirdPartyIds.add(otherParticipant(m, awayId))
  thirdPartyIds.delete(homeId)
  thirdPartyIds.delete(awayId)

  const [extraUsersResult, matchInterviewsResult] = await Promise.all([
    thirdPartyIds.size > 0
      ? supabase.from('users').select('id, name').in('id', Array.from(thirdPartyIds))
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    // Pre-match interview quotes from EACH player's own interview for THIS match, if they did one.
    supabase
      .from('match_interviews')
      .select('id, player_id')
      .eq('championship_match_id', match.id)
      .eq('phase', 'pre_match')
      .in('player_id', [homeId, awayId]),
  ])

  for (const u of (extraUsersResult.data ?? []) as Array<{ id: string; name: string }>) {
    if (!nameMap.has(u.id)) nameMap.set(u.id, u.name)
  }

  const interviews = (matchInterviewsResult.data ?? []) as Array<{ id: string; player_id: string }>
  const homeQuotes: string[] = []
  const awayQuotes: string[] = []
  if (interviews.length > 0) {
    const playerByInterview = new Map(interviews.map((i) => [i.id, i.player_id]))
    const { data: messages } = await supabase
      .from('match_interview_messages')
      .select('interview_id, content, created_at')
      .in('interview_id', interviews.map((i) => i.id))
      .eq('role', 'player')
      .order('created_at', { ascending: true })

    for (const m of (messages ?? []) as Array<{ interview_id: string; content: string }>) {
      const playerId = playerByInterview.get(m.interview_id)
      if (playerId === homeId) homeQuotes.push(m.content)
      else if (playerId === awayId) awayQuotes.push(m.content)
    }
  }

  const toRecentMatchLines = (rows: ChampMatchRow[], id: string): RecentMatchLine[] => {
    const lines: RecentMatchLine[] = []
    for (const m of rows) {
      if (lines.length >= 3) break
      const otherId = otherParticipant(m, id)
      const opponentName = nameMap.get(otherId)
      if (!opponentName || isReservedAdminName(opponentName)) continue
      const isHomeRow = m.home_player_id === id
      const mine = isHomeRow ? m.home_score : m.away_score
      const theirs = isHomeRow ? m.away_score : m.home_score
      lines.push({
        opponentName,
        myGoals: mine,
        theirGoals: theirs,
        result: mine === theirs ? 'D' : mine > theirs ? 'W' : 'L',
      })
    }
    return lines
  }

  const homeStanding = toStandingLine(homePlacements.find((p) => p.championshipId === match.championship_id))
  const awayStanding = toStandingLine(awayPlacements.find((p) => p.championshipId === match.championship_id))

  const toPastChampionships = (placements: typeof homePlacements): PastChampionshipLine[] =>
    placements
      .filter((p) => p.championshipId !== match.championship_id && !p.isActive)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 5)
      .map((p) => ({ name: p.championshipName, rank: p.rank, totalPlayers: p.totalPlayers }))

  const homeRecord = recordMap.get(homeId) ?? { wins: 0, losses: 0, draws: 0 }
  const awayRecord = recordMap.get(awayId) ?? { wins: 0, losses: 0, draws: 0 }
  const toActivity = (record: { wins: number; losses: number; draws: number }, formRows: FormRow[] | null): ActivityLine => ({
    matchesPlayed: record.wins + record.losses + record.draws,
    daysSinceLastMatch: daysSince(lastPlayedAt(formRows)),
  })

  const finalScore = match.home_score !== null && match.away_score !== null
    ? { homeGoals: match.home_score, awayGoals: match.away_score }
    : null

  return {
    championshipName: (champResult.data as { name?: string } | null)?.name ?? 'the championship',
    roundLabel: roundLabelFor(match.round, match.group_label),
    homeName: nameMap.get(homeId) ?? 'Home',
    awayName: nameMap.get(awayId) ?? 'Away',
    homeRecord,
    awayRecord,
    homeStanding,
    awayStanding,
    h2h,
    homeForm: toForm(homeFormRows),
    awayForm: toForm(awayFormRows),
    homeChampionshipForm: toRecentMatchLines(homeRawRows, homeId),
    awayChampionshipForm: toRecentMatchLines(awayRawRows, awayId),
    homePastChampionships: toPastChampionships(homePlacements),
    awayPastChampionships: toPastChampionships(awayPlacements),
    homeP4P: p4pIndex.get(homeId) ?? null,
    awayP4P: p4pIndex.get(awayId) ?? null,
    homeActivity: toActivity(homeRecord, homeFormRows),
    awayActivity: toActivity(awayRecord, awayFormRows),
    odds,
    finalScore,
    homeQuotes,
    awayQuotes,
  }
}

/** Fetches the cached AI preview for a match, generating and caching it on first request. */
export async function getOrCreateAiMatchPreviewAction(matchId: string): Promise<MatchAiPreview> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('match_ai_previews')
    .select('headline, summary, insights, generated_at')
    .eq('championship_match_id', matchId)
    .maybeSingle()

  if (existing) {
    const row = existing as { headline: string; summary: string; insights: MatchPreviewAiResult['insights']; generated_at: string }
    return { headline: row.headline, summary: row.summary, insights: row.insights, generatedAt: row.generated_at }
  }

  const { data: matchData, error: matchErr } = await supabase
    .from('championship_matches')
    .select('id, championship_id, home_player_id, away_player_id, home_score, away_score, status, round, group_label')
    .eq('id', matchId)
    .single()
  if (matchErr || !matchData) throw new Error('Match not found')
  const match = matchData as MatchRow

  const context = await buildPreviewContext(supabase, match)
  const generated = await generateMatchPreview(context)

  const { data: inserted, error: insertErr } = await supabase
    .from('match_ai_previews')
    .insert({
      championship_match_id: matchId,
      headline: generated.headline,
      summary: generated.summary,
      insights: generated.insights,
    })
    .select('headline, summary, insights, generated_at')
    .single()

  if (insertErr) {
    // 23505 = unique_violation on championship_match_id — a concurrent request already
    // generated and cached this preview. Fall back to it and discard our own generation.
    if (insertErr.code === '23505') {
      const { data: raceExisting, error: raceErr } = await supabase
        .from('match_ai_previews')
        .select('headline, summary, insights, generated_at')
        .eq('championship_match_id', matchId)
        .single()
      if (raceErr || !raceExisting) throw new Error('Could not load the generated preview')
      const row = raceExisting as { headline: string; summary: string; insights: MatchPreviewAiResult['insights']; generated_at: string }
      return { headline: row.headline, summary: row.summary, insights: row.insights, generatedAt: row.generated_at }
    }
    throw new Error(insertErr.message)
  }

  const row = inserted as { headline: string; summary: string; insights: MatchPreviewAiResult['insights']; generated_at: string }
  return { headline: row.headline, summary: row.summary, insights: row.insights, generatedAt: row.generated_at }
}
