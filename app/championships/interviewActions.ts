'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import {
  generateJournalistReply,
  MAX_PLAYER_TURNS,
  type InterviewContext,
  type InterviewLanguage,
  type StandingLine,
  type PastChampionshipLine,
  type RecentMatchLine,
  type OpponentQuote,
  type P4PLine,
  type ActivityLine,
} from '@/lib/ai/interview'
import {
  getPlayerChampionshipPlacements,
  getChampionshipOnlyStats,
  getChampionshipLeaders,
  getChampionshipMatchHistory,
  buildTitleRecords,
} from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { isReservedAdminName } from '@/lib/players'

export type InterviewPhase = 'pre_match' | 'post_match'

export type InterviewMessage = {
  id: string
  role: 'journalist' | 'player'
  content: string
  createdAt: string
}

export type InterviewSession = {
  id: string
  phase: InterviewPhase
  status: 'in_progress' | 'completed'
  maxPlayerTurns: number
  messages: InterviewMessage[]
}

const MAX_MESSAGE_LENGTH = 500

type MatchRow = {
  id: string
  championship_id: string
  home_player_id: string
  away_player_id: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'confirmed' | 'final'
}

async function loadMatchAndAuthorize(matchId: string, phase: InterviewPhase) {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = createServiceClient()
  const { data: match, error } = await supabase
    .from('championship_matches')
    .select('id, championship_id, home_player_id, away_player_id, home_score, away_score, status')
    .eq('id', matchId)
    .single()

  if (error || !match) throw new Error('Match not found')
  const row = match as MatchRow

  const isHome = row.home_player_id === session.sub
  const isAway = row.away_player_id === session.sub
  if (!isHome && !isAway) throw new Error('You are not a participant in this match')

  if (phase === 'pre_match' && row.status !== 'pending') {
    throw new Error('Pre-match interviews are only available before a result is recorded')
  }
  if (phase === 'post_match' && row.status === 'pending') {
    throw new Error('Post-match interviews are only available after a result is recorded')
  }

  const opponentId = isHome ? row.away_player_id : row.home_player_id
  return { session, supabase, match: row, playerId: session.sub, opponentId, isHome }
}

type FormRow = { result: 'W' | 'D' | 'L'; played_at: string }
type H2HRow = { player1_wins?: number | string; player2_wins?: number | string; draws?: number | string; total_matches?: number | string }
type OddsRow = { home_win_odds: number | string | null; draw_odds: number | string | null; away_win_odds: number | string | null }
type ChampMatchRow = { id: string; home_player_id: string; away_player_id: string; home_score: number; away_score: number }

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

async function buildContext(
  supabase: SupabaseClient,
  match: MatchRow,
  playerId: string,
  opponentId: string,
  isHome: boolean,
  phase: InterviewPhase,
  language: InterviewLanguage
): Promise<InterviewContext> {
  const [
    usersResult,
    playersResult,
    playerFormResult,
    opponentFormResult,
    h2hResult,
    champResult,
    oddsResult,
    champMatchesResult,
    playerPlacements,
    opponentPlacements,
    p4pStats,
    p4pLeaders,
    p4pMatchHistory,
  ] = await Promise.all([
    supabase.from('users').select('id, name').in('id', [playerId, opponentId]),
    supabase.from('players').select('id, wins, losses, draws').in('id', [playerId, opponentId]),
    supabase.rpc('get_player_form', { p_player_id: playerId, p_limit: 5 }),
    supabase.rpc('get_player_form', { p_player_id: opponentId, p_limit: 5 }),
    supabase.rpc('get_h2h_stats', { p_player1_id: playerId, p_player2_id: opponentId }),
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
    getPlayerChampionshipPlacements(playerId),
    getPlayerChampionshipPlacements(opponentId),
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
  // playerForm/opponentForm RPC rows are ordered most-recent-first (see get_player_form) —
  // the head of that same list is the cheapest reliable "when did they last play" signal.
  const lastPlayedAt = (rows: FormRow[] | null): string | null => (rows && rows.length > 0 ? rows[0].played_at : null)
  const daysSince = (iso: string | null): number | null =>
    iso === null ? null : Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)))

  const playerFormRows = playerFormResult.data as FormRow[] | null
  const opponentFormRows = opponentFormResult.data as FormRow[] | null

  const p4pRanked = rankByP4P(p4pStats, buildTitleRecords(p4pLeaders), p4pMatchHistory)
  const p4pIndex = new Map<string, P4PLine>(
    p4pRanked.map((p, i) => [p.id, { score: p.p4p.score, confidence: p.p4p.confidence, rank: i + 1, totalPlayers: p4pRanked.length }])
  )

  const h2hRows = (h2hResult.data ?? []) as H2HRow[]
  const h2hRow = h2hRows[0]
  const totalMatches = Number(h2hRow?.total_matches ?? 0)
  const h2h = h2hRow && totalMatches > 0
    ? {
        playerWins: Number(h2hRow.player1_wins ?? 0),
        opponentWins: Number(h2hRow.player2_wins ?? 0),
        draws: Number(h2hRow.draws ?? 0),
        totalMatches,
      }
    : null

  const oddsRow = oddsResult.data as OddsRow | null
  const odds = oddsRow && oddsRow.home_win_odds !== null && oddsRow.draw_odds !== null && oddsRow.away_win_odds !== null
    ? {
        playerOdds: Number(isHome ? oddsRow.home_win_odds : oddsRow.away_win_odds),
        drawOdds: Number(oddsRow.draw_odds),
        opponentOdds: Number(isHome ? oddsRow.away_win_odds : oddsRow.home_win_odds),
      }
    : null

  // Recent results within THIS championship only — distinct from playerForm/opponentForm,
  // which blend in friendly matches and every other championship the player has been in.
  const champMatches = (champMatchesResult.data ?? []) as ChampMatchRow[]
  const otherParticipant = (m: ChampMatchRow, id: string) => (m.home_player_id === id ? m.away_player_id : m.home_player_id)
  // Pull a few extra raw rows beyond the 3 we'll actually show — any of them might
  // involve the reserved ADMIN account (loadMatchAndAuthorize's own participants never
  // are, but a third-party opponent in an older match could be) and get filtered below.
  const playerRawRows = champMatches.filter((m) => m.home_player_id === playerId || m.away_player_id === playerId).slice(0, 8)
  const opponentRawRows = champMatches.filter((m) => m.home_player_id === opponentId || m.away_player_id === opponentId).slice(0, 8)

  const thirdPartyIds = new Set<string>()
  for (const m of playerRawRows) thirdPartyIds.add(otherParticipant(m, playerId))
  for (const m of opponentRawRows) thirdPartyIds.add(otherParticipant(m, opponentId))
  thirdPartyIds.delete(playerId)
  thirdPartyIds.delete(opponentId)

  const [extraUsersResult, opponentInterviewsResult] = await Promise.all([
    thirdPartyIds.size > 0
      ? supabase.from('users').select('id, name').in('id', Array.from(thirdPartyIds))
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    // Opponent's own interview session(s) for THIS match — source for the "X said... reaction?" beats.
    supabase.from('match_interviews').select('id, phase').eq('championship_match_id', match.id).eq('player_id', opponentId),
  ])

  for (const u of (extraUsersResult.data ?? []) as Array<{ id: string; name: string }>) {
    if (!nameMap.has(u.id)) nameMap.set(u.id, u.name)
  }

  const opponentInterviews = (opponentInterviewsResult.data ?? []) as Array<{ id: string; phase: 'pre_match' | 'post_match' }>
  let opponentQuotes: OpponentQuote[] = []
  if (opponentInterviews.length > 0) {
    const phaseByInterview = new Map(opponentInterviews.map((i) => [i.id, i.phase]))
    const { data: opponentMessages } = await supabase
      .from('match_interview_messages')
      .select('interview_id, content, created_at')
      .in('interview_id', opponentInterviews.map((i) => i.id))
      .eq('role', 'player')
      .order('created_at', { ascending: true })

    opponentQuotes = ((opponentMessages ?? []) as Array<{ interview_id: string; content: string }>).map((m) => ({
      phase: phaseByInterview.get(m.interview_id) ?? 'pre_match',
      content: m.content,
    }))
  }

  const toRecentMatchLines = (rows: ChampMatchRow[], id: string): RecentMatchLine[] => {
    const lines: RecentMatchLine[] = []
    for (const m of rows) {
      if (lines.length >= 3) break
      const otherId = otherParticipant(m, id)
      const opponentName = nameMap.get(otherId)
      if (!opponentName || isReservedAdminName(opponentName)) continue // skip admin / unresolved names
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

  const playerStanding = toStandingLine(playerPlacements.find((p) => p.championshipId === match.championship_id))
  const opponentStanding = toStandingLine(opponentPlacements.find((p) => p.championshipId === match.championship_id))

  const toPastChampionships = (placements: typeof playerPlacements): PastChampionshipLine[] =>
    placements
      .filter((p) => p.championshipId !== match.championship_id && !p.isActive)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 5)
      .map((p) => ({ name: p.championshipName, rank: p.rank, totalPlayers: p.totalPlayers }))

  const playerRecord = recordMap.get(playerId) ?? { wins: 0, losses: 0, draws: 0 }
  const opponentRecord = recordMap.get(opponentId) ?? { wins: 0, losses: 0, draws: 0 }
  const toActivity = (record: { wins: number; losses: number; draws: number }, formRows: FormRow[] | null): ActivityLine => ({
    matchesPlayed: record.wins + record.losses + record.draws,
    daysSinceLastMatch: daysSince(lastPlayedAt(formRows)),
  })

  const context: InterviewContext = {
    phase,
    language,
    playerName: nameMap.get(playerId) ?? 'Player',
    opponentName: nameMap.get(opponentId) ?? 'Opponent',
    championshipName: (champResult.data as { name?: string } | null)?.name ?? 'the championship',
    playerRecord,
    opponentRecord,
    h2h,
    playerForm: toForm(playerFormRows),
    opponentForm: toForm(opponentFormRows),
    playerStanding,
    opponentStanding,
    playerChampionshipForm: toRecentMatchLines(playerRawRows, playerId),
    opponentChampionshipForm: toRecentMatchLines(opponentRawRows, opponentId),
    odds,
    playerPastChampionships: toPastChampionships(playerPlacements),
    opponentPastChampionships: toPastChampionships(opponentPlacements),
    opponentQuotes,
    playerP4P: p4pIndex.get(playerId) ?? null,
    opponentP4P: p4pIndex.get(opponentId) ?? null,
    playerActivity: toActivity(playerRecord, playerFormRows),
    opponentActivity: toActivity(opponentRecord, opponentFormRows),
  }

  if (phase === 'post_match' && match.home_score !== null && match.away_score !== null) {
    const playerGoals = isHome ? match.home_score : match.away_score
    const opponentGoals = isHome ? match.away_score : match.home_score
    const outcome: 'W' | 'L' | 'D' = playerGoals === opponentGoals ? 'D' : playerGoals > opponentGoals ? 'W' : 'L'
    context.finalResult = { playerGoals, opponentGoals, outcome }

    const { data: preInterview } = await supabase
      .from('match_interviews')
      .select('id')
      .eq('championship_match_id', match.id)
      .eq('player_id', playerId)
      .eq('phase', 'pre_match')
      .maybeSingle()

    if (preInterview) {
      const { data: preMessages } = await supabase
        .from('match_interview_messages')
        .select('content')
        .eq('interview_id', (preInterview as { id: string }).id)
        .eq('role', 'player')
        .order('created_at', { ascending: true })

      const quotes = ((preMessages ?? []) as Array<{ content: string }>).map((m) => m.content)
      if (quotes.length > 0) context.priorPrediction = quotes
    }
  }

  return context
}

async function loadMessages(supabase: SupabaseClient, interviewId: string): Promise<InterviewMessage[]> {
  const { data } = await supabase
    .from('match_interview_messages')
    .select('id, role, content, created_at')
    .eq('interview_id', interviewId)
    .order('created_at', { ascending: true })

  return ((data ?? []) as Array<{ id: string; role: 'journalist' | 'player'; content: string; created_at: string }>).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }))
}

/** Checks whether an interview already exists for this (match, player, phase) without creating
 *  one, so the client can skip the language picker — and the OpenAI call it would trigger —
 *  when resuming a session instead of starting a fresh one. */
export async function getInterviewStatusAction(
  matchId: string,
  phase: InterviewPhase
): Promise<{ exists: boolean; language: InterviewLanguage | null }> {
  const { supabase, playerId } = await loadMatchAndAuthorize(matchId, phase)

  const { data: existing } = await supabase
    .from('match_interviews')
    .select('language')
    .eq('championship_match_id', matchId)
    .eq('player_id', playerId)
    .eq('phase', phase)
    .maybeSingle()

  const row = existing as { language: InterviewLanguage } | null
  return { exists: !!row, language: row?.language ?? null }
}

/** Fetches an existing interview or starts a new one (generating the AI's opening line).
 *  `language` only takes effect when creating a new session — an existing one keeps the
 *  language it was started with, read back from its own row. */
export async function getOrCreateInterviewAction(
  matchId: string,
  phase: InterviewPhase,
  language: InterviewLanguage = 'en'
): Promise<InterviewSession> {
  const { supabase, match, playerId, opponentId, isHome } = await loadMatchAndAuthorize(matchId, phase)

  const { data: existing } = await supabase
    .from('match_interviews')
    .select('id, status')
    .eq('championship_match_id', matchId)
    .eq('player_id', playerId)
    .eq('phase', phase)
    .maybeSingle()

  let interviewId: string
  let status: 'in_progress' | 'completed'

  if (existing) {
    interviewId = (existing as { id: string; status: 'in_progress' | 'completed' }).id
    status = (existing as { id: string; status: 'in_progress' | 'completed' }).status
  } else {
    const context = await buildContext(supabase, match, playerId, opponentId, isHome, phase, language)
    const opener = await generateJournalistReply(context, [])

    const { data: created, error: createErr } = await supabase
      .from('match_interviews')
      .insert({ championship_match_id: matchId, player_id: playerId, phase, status: 'in_progress', language })
      .select('id, status')
      .single()

    if (createErr) {
      // 23505 = unique_violation on (championship_match_id, player_id, phase) — a concurrent
      // request (double-effect in dev, duplicate tab) already created this interview. Fall
      // back to it and discard the opener we just generated instead of erroring out.
      if (createErr.code === '23505') {
        const { data: raceExisting, error: raceErr } = await supabase
          .from('match_interviews')
          .select('id, status')
          .eq('championship_match_id', matchId)
          .eq('player_id', playerId)
          .eq('phase', phase)
          .single()
        if (raceErr || !raceExisting) throw new Error('Could not start the interview')
        interviewId = (raceExisting as { id: string; status: 'in_progress' | 'completed' }).id
        status = (raceExisting as { id: string; status: 'in_progress' | 'completed' }).status
      } else {
        throw new Error(createErr.message)
      }
    } else {
      interviewId = (created as { id: string; status: 'in_progress' | 'completed' }).id
      status = (created as { id: string; status: 'in_progress' | 'completed' }).status

      const { error: msgErr } = await supabase
        .from('match_interview_messages')
        .insert({ interview_id: interviewId, role: 'journalist', content: opener })
      if (msgErr) throw new Error(msgErr.message)
    }
  }

  return {
    id: interviewId,
    phase,
    status,
    maxPlayerTurns: MAX_PLAYER_TURNS,
    messages: await loadMessages(supabase, interviewId),
  }
}

/** Submits the player's reply and generates the next journalist message. */
export async function sendInterviewReplyAction(interviewId: string, content: string): Promise<InterviewSession> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const trimmed = content.trim().slice(0, MAX_MESSAGE_LENGTH)
  if (!trimmed) throw new Error('Message is empty')

  const supabase = createServiceClient()
  const { data: interviewData, error: interviewErr } = await supabase
    .from('match_interviews')
    .select('id, championship_match_id, player_id, phase, status, language')
    .eq('id', interviewId)
    .single()
  if (interviewErr || !interviewData) throw new Error('Interview not found')

  const interview = interviewData as {
    id: string
    championship_match_id: string
    player_id: string
    phase: InterviewPhase
    status: 'in_progress' | 'completed'
    language: InterviewLanguage
  }
  if (interview.player_id !== session.sub) throw new Error('This is not your interview')
  if (interview.status !== 'in_progress') throw new Error('This interview has ended')

  const { data: matchData } = await supabase
    .from('championship_matches')
    .select('id, championship_id, home_player_id, away_player_id, home_score, away_score, status')
    .eq('id', interview.championship_match_id)
    .single()
  if (!matchData) throw new Error('Match not found')
  const match = matchData as MatchRow

  const isHome = match.home_player_id === session.sub
  const opponentId = isHome ? match.away_player_id : match.home_player_id

  const history = await loadMessages(supabase, interviewId)
  const playerTurnsSoFar = history.filter((m) => m.role === 'player').length
  const nextPlayerTurn = playerTurnsSoFar + 1
  const isFinalTurn = nextPlayerTurn >= MAX_PLAYER_TURNS

  const { error: insertErr } = await supabase
    .from('match_interview_messages')
    .insert({ interview_id: interviewId, role: 'player', content: trimmed })
  if (insertErr) throw new Error(insertErr.message)

  const context = await buildContext(supabase, match, session.sub, opponentId, isHome, interview.phase, interview.language)
  const conversation = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'player' as const, content: trimmed },
  ]
  const reply = await generateJournalistReply(context, conversation, isFinalTurn)

  const { error: replyErr } = await supabase
    .from('match_interview_messages')
    .insert({ interview_id: interviewId, role: 'journalist', content: reply })
  if (replyErr) throw new Error(replyErr.message)

  if (isFinalTurn) {
    await supabase
      .from('match_interviews')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', interviewId)
  }

  return {
    id: interviewId,
    phase: interview.phase,
    status: isFinalTurn ? 'completed' : 'in_progress',
    maxPlayerTurns: MAX_PLAYER_TURNS,
    messages: await loadMessages(supabase, interviewId),
  }
}

/** Lets the player end the interview early without forcing another AI turn. */
export async function endInterviewAction(interviewId: string): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = createServiceClient()
  const { data: interview } = await supabase
    .from('match_interviews')
    .select('player_id')
    .eq('id', interviewId)
    .single()
  if (!interview || (interview as { player_id: string }).player_id !== session.sub) {
    throw new Error('This is not your interview')
  }

  await supabase
    .from('match_interviews')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', interviewId)
}
