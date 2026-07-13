'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import {
  generateChampionshipJournalistReply,
  MAX_PLAYER_TURNS,
  type ChampionshipInterviewContext,
  type InterviewLanguage,
  type ChampionshipFormat,
  type FullTableRow,
  type SeasonMatchLine,
  type P4PLine,
  type ActivityLine,
  type PastChampionshipLine,
} from '@/lib/ai/championshipInterview'
import { calculateStandings, filterGroupMatches, resolveChampionshipOrder } from '@/lib/championships/standings'
import {
  getPlayerChampionshipPlacements,
  getChampionshipOnlyStats,
  getChampionshipLeaders,
  getChampionshipMatchHistory,
  buildTitleRecords,
} from '@/lib/stats/queries'
import { rankByP4P } from '@/lib/stats/p4p'
import { notifyChampionshipInterviewCompleted } from '@/lib/telegram/notify'

export type ChampionshipInterviewMessage = {
  id: string
  role: 'journalist' | 'player'
  content: string
  createdAt: string
}

export type ChampionshipInterviewSession = {
  id: string
  status: 'in_progress' | 'completed'
  maxPlayerTurns: number
  messages: ChampionshipInterviewMessage[]
}

const MAX_MESSAGE_LENGTH = 500

type ChampionshipRow = { id: string; name: string; is_active: boolean; format: ChampionshipFormat }
type ChampMatchRow = {
  id: string
  home_player_id: string
  away_player_id: string
  home_score: number | null
  away_score: number | null
  round: string | null
  group_label: string | null
  cycle: number
  confirmed_at: string | null
}

function roundLabel(m: { round: string | null; group_label: string | null; cycle: number }): string {
  if (m.round === 'final_penalty') return 'Final (Penalties)'
  if (m.round === 'final') return 'Final'
  if (m.round === 'semi') return 'Semi-Final'
  if (m.round === 'penalty') return 'Penalties'
  if (m.round === 'group' && m.group_label) return `Group ${m.group_label}`
  return `Round ${m.cycle}`
}

async function loadChampionshipAndAuthorize(championshipId: string) {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = createServiceClient()
  const { data: champData, error } = await supabase
    .from('championships')
    .select('id, name, is_active, format')
    .eq('id', championshipId)
    .single()

  if (error || !champData) throw new Error('Championship not found')
  const championship = champData as ChampionshipRow
  if (championship.is_active) throw new Error('This championship has not finished yet')

  const { data: rosterRow, error: rosterErr } = await supabase
    .from('championship_players')
    .select('player_id')
    .eq('championship_id', championshipId)
    .eq('player_id', session.sub)
    .maybeSingle()
  if (rosterErr || !rosterRow) throw new Error('You did not take part in this championship')

  return { session, supabase, championship, playerId: session.sub }
}

async function buildContext(
  supabase: SupabaseClient,
  championship: ChampionshipRow,
  playerId: string,
  language: InterviewLanguage
): Promise<{ context: ChampionshipInterviewContext; snapshot: {
  finalRank: number; totalPlayers: number; points: number; played: number
  wins: number; draws: number; losses: number; goalDiff: number
} }> {
  const [rosterResult, matchesResult, playerPlacements, p4pStats, p4pLeaders, p4pMatchHistory, playerRow, formResult] =
    await Promise.all([
      supabase.from('championship_players').select('player_id').eq('championship_id', championship.id),
      supabase
        .from('championship_matches')
        .select('id, home_player_id, away_player_id, home_score, away_score, round, group_label, cycle, confirmed_at')
        .eq('championship_id', championship.id)
        .in('status', ['confirmed', 'final'])
        .not('home_score', 'is', null)
        .order('confirmed_at', { ascending: true }),
      getPlayerChampionshipPlacements(playerId),
      // Same inputs the leaderboard's P4P tab uses — cached, so this is an in-memory
      // recompute over already-fetched data, not an extra round of heavy queries.
      getChampionshipOnlyStats(),
      getChampionshipLeaders(),
      getChampionshipMatchHistory(),
      supabase.from('players').select('id, wins, losses, draws').eq('id', playerId).single(),
      supabase.rpc('get_player_form', { p_player_id: playerId, p_limit: 1 }),
    ])

  const playerIds = ((rosterResult.data ?? []) as Array<{ player_id: string }>).map((r) => r.player_id)
  const { data: users } = playerIds.length
    ? await supabase.from('users').select('id, name').in('id', playerIds)
    : { data: [] as Array<{ id: string; name: string }> }
  const nameMap = new Map(((users ?? []) as Array<{ id: string; name: string }>).map((u) => [u.id, u.name]))

  const matches = (matchesResult.data ?? []) as ChampMatchRow[]
  const matchRowsForStandings = matches.map((m) => ({
    id: m.id,
    homePlayerId: m.home_player_id,
    awayPlayerId: m.away_player_id,
    homeScore: m.home_score,
    awayScore: m.away_score,
    round: m.round,
  }))

  const groupStandings = calculateStandings(filterGroupMatches(matchRowsForStandings), playerIds)
  const order = resolveChampionshipOrder(matchRowsForStandings, groupStandings)
  const standingsById = new Map(groupStandings.map((r) => [r.playerId, r]))

  const fullTable: FullTableRow[] = order.map((pid, i) => {
    const row = standingsById.get(pid)
    return {
      rank: i + 1,
      name: nameMap.get(pid) ?? 'Unknown',
      points: row?.points ?? 0,
      played: row?.played ?? 0,
      wins: row?.wins ?? 0,
      draws: row?.draws ?? 0,
      losses: row?.losses ?? 0,
      goalDiff: row?.goalDiff ?? 0,
    }
  })

  const rank = order.indexOf(playerId) + 1
  const playerStanding = standingsById.get(playerId)
  const totalPlayers = playerIds.length

  const allMatches: SeasonMatchLine[] = matches.map((m) => ({
    homeName: nameMap.get(m.home_player_id) ?? 'Unknown',
    awayName: nameMap.get(m.away_player_id) ?? 'Unknown',
    homeGoals: m.home_score ?? 0,
    awayGoals: m.away_score ?? 0,
    round: roundLabel(m),
  }))

  const p4pRanked = rankByP4P(p4pStats, buildTitleRecords(p4pLeaders), p4pMatchHistory)
  const p4pIndex = new Map<string, P4PLine>(
    p4pRanked.map((p, i) => [p.id, { score: p.p4p.score, confidence: p.p4p.confidence, rank: i + 1, totalPlayers: p4pRanked.length }])
  )

  const record = playerRow.data as { wins: number; losses: number; draws: number } | null
  const formRows = (formResult.data ?? []) as Array<{ played_at: string }>
  const lastPlayedAt = formRows.length > 0 ? formRows[0].played_at : null
  const daysSinceLastMatch = lastPlayedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastPlayedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : null
  const activity: ActivityLine = {
    matchesPlayed: record ? record.wins + record.losses + record.draws : 0,
    daysSinceLastMatch,
  }

  const pastChampionships: PastChampionshipLine[] = playerPlacements
    .filter((p) => p.championshipId !== championship.id && !p.isActive)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .map((p) => ({ name: p.championshipName, rank: p.rank, totalPlayers: p.totalPlayers }))

  const context: ChampionshipInterviewContext = {
    language,
    playerName: nameMap.get(playerId) ?? 'Player',
    championshipName: championship.name,
    format: championship.format,
    isChampion: rank === 1,
    playerFinal: {
      rank,
      totalPlayers,
      points: playerStanding?.points ?? 0,
      played: playerStanding?.played ?? 0,
      wins: playerStanding?.wins ?? 0,
      draws: playerStanding?.draws ?? 0,
      losses: playerStanding?.losses ?? 0,
      goalDiff: playerStanding?.goalDiff ?? 0,
      goalsFor: playerStanding?.goalsFor ?? 0,
      goalsAgainst: playerStanding?.goalsAgainst ?? 0,
    },
    fullTable,
    allMatches,
    playerP4P: p4pIndex.get(playerId) ?? null,
    playerActivity: activity,
    pastChampionships,
  }

  return {
    context,
    snapshot: {
      finalRank: rank,
      totalPlayers,
      points: playerStanding?.points ?? 0,
      played: playerStanding?.played ?? 0,
      wins: playerStanding?.wins ?? 0,
      draws: playerStanding?.draws ?? 0,
      losses: playerStanding?.losses ?? 0,
      goalDiff: playerStanding?.goalDiff ?? 0,
    },
  }
}

async function loadMessages(supabase: SupabaseClient, interviewId: string): Promise<ChampionshipInterviewMessage[]> {
  const { data } = await supabase
    .from('championship_interview_messages')
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

/** Fires the Telegram "championship interview finished" notification with a link to the
 *  public transcript page. Best-effort — sendTelegramMessage swallows its own errors,
 *  so this never throws. */
async function announceChampionshipInterviewCompletion(
  supabase: SupabaseClient,
  interviewId: string
): Promise<void> {
  const { data } = await supabase
    .from('championship_interviews')
    .select('player_id, championship_id, final_rank, total_players')
    .eq('id', interviewId)
    .single()
  const row = data as { player_id: string; championship_id: string; final_rank: number; total_players: number } | null
  if (!row) return

  const [userResult, champResult] = await Promise.all([
    supabase.from('users').select('name').eq('id', row.player_id).single(),
    supabase.from('championships').select('name').eq('id', row.championship_id).single(),
  ])

  await notifyChampionshipInterviewCompleted({
    interviewId,
    playerName: (userResult.data as { name?: string } | null)?.name ?? 'Player',
    championshipName: (champResult.data as { name?: string } | null)?.name ?? 'the championship',
    rank: row.final_rank,
    totalPlayers: row.total_players,
  })
}

/** Checks whether an interview already exists for this (championship, player) without
 *  creating one, so the client can skip the language picker — and the OpenAI call it
 *  would trigger — when resuming a session instead of starting a fresh one. */
export async function getChampionshipInterviewStatusAction(
  championshipId: string
): Promise<{ exists: boolean; language: InterviewLanguage | null }> {
  const { supabase, playerId } = await loadChampionshipAndAuthorize(championshipId)

  const { data: existing } = await supabase
    .from('championship_interviews')
    .select('language')
    .eq('championship_id', championshipId)
    .eq('player_id', playerId)
    .maybeSingle()

  const row = existing as { language: InterviewLanguage } | null
  return { exists: !!row, language: row?.language ?? null }
}

/** Fetches an existing interview or starts a new one (generating the AI's opening line).
 *  `language` only takes effect when creating a new session. */
export async function getOrCreateChampionshipInterviewAction(
  championshipId: string,
  language: InterviewLanguage = 'en'
): Promise<ChampionshipInterviewSession> {
  const { supabase, championship, playerId } = await loadChampionshipAndAuthorize(championshipId)

  const { data: existing } = await supabase
    .from('championship_interviews')
    .select('id, status')
    .eq('championship_id', championshipId)
    .eq('player_id', playerId)
    .maybeSingle()

  let interviewId: string
  let status: 'in_progress' | 'completed'

  if (existing) {
    interviewId = (existing as { id: string; status: 'in_progress' | 'completed' }).id
    status = (existing as { id: string; status: 'in_progress' | 'completed' }).status
  } else {
    const { context, snapshot } = await buildContext(supabase, championship, playerId, language)
    const opener = await generateChampionshipJournalistReply(context, [])

    const { data: created, error: createErr } = await supabase
      .from('championship_interviews')
      .insert({
        championship_id: championshipId,
        player_id: playerId,
        status: 'in_progress',
        language,
        final_rank: snapshot.finalRank,
        total_players: snapshot.totalPlayers,
        points: snapshot.points,
        played: snapshot.played,
        wins: snapshot.wins,
        draws: snapshot.draws,
        losses: snapshot.losses,
        goal_diff: snapshot.goalDiff,
      })
      .select('id, status')
      .single()

    if (createErr) {
      // 23505 = unique_violation on (championship_id, player_id) — a concurrent request
      // (double-effect in dev, duplicate tab) already created this interview. Fall back
      // to it and discard the opener we just generated instead of erroring out.
      if (createErr.code === '23505') {
        const { data: raceExisting, error: raceErr } = await supabase
          .from('championship_interviews')
          .select('id, status')
          .eq('championship_id', championshipId)
          .eq('player_id', playerId)
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
        .from('championship_interview_messages')
        .insert({ interview_id: interviewId, role: 'journalist', content: opener })
      if (msgErr) throw new Error(msgErr.message)
    }
  }

  return {
    id: interviewId,
    status,
    maxPlayerTurns: MAX_PLAYER_TURNS,
    messages: await loadMessages(supabase, interviewId),
  }
}

/** Submits the player's reply and generates the next journalist message. */
export async function sendChampionshipInterviewReplyAction(
  interviewId: string,
  content: string
): Promise<ChampionshipInterviewSession> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const trimmed = content.trim().slice(0, MAX_MESSAGE_LENGTH)
  if (!trimmed) throw new Error('Message is empty')

  const supabase = createServiceClient()
  const { data: interviewData, error: interviewErr } = await supabase
    .from('championship_interviews')
    .select('id, championship_id, player_id, status, language')
    .eq('id', interviewId)
    .single()
  if (interviewErr || !interviewData) throw new Error('Interview not found')

  const interview = interviewData as {
    id: string
    championship_id: string
    player_id: string
    status: 'in_progress' | 'completed'
    language: InterviewLanguage
  }
  if (interview.player_id !== session.sub) throw new Error('This is not your interview')
  if (interview.status !== 'in_progress') throw new Error('This interview has ended')

  const { data: champData } = await supabase
    .from('championships')
    .select('id, name, is_active, format')
    .eq('id', interview.championship_id)
    .single()
  if (!champData) throw new Error('Championship not found')
  const championship = champData as ChampionshipRow

  const history = await loadMessages(supabase, interviewId)
  const playerTurnsSoFar = history.filter((m) => m.role === 'player').length
  const nextPlayerTurn = playerTurnsSoFar + 1
  const isFinalTurn = nextPlayerTurn >= MAX_PLAYER_TURNS

  const { error: insertErr } = await supabase
    .from('championship_interview_messages')
    .insert({ interview_id: interviewId, role: 'player', content: trimmed })
  if (insertErr) throw new Error(insertErr.message)

  const { context } = await buildContext(supabase, championship, session.sub, interview.language)
  const conversation = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'player' as const, content: trimmed },
  ]
  const reply = await generateChampionshipJournalistReply(context, conversation, isFinalTurn)

  const { error: replyErr } = await supabase
    .from('championship_interview_messages')
    .insert({ interview_id: interviewId, role: 'journalist', content: reply })
  if (replyErr) throw new Error(replyErr.message)

  if (isFinalTurn) {
    await supabase
      .from('championship_interviews')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', interviewId)

    await announceChampionshipInterviewCompletion(supabase, interviewId)
  }

  return {
    id: interviewId,
    status: isFinalTurn ? 'completed' : 'in_progress',
    maxPlayerTurns: MAX_PLAYER_TURNS,
    messages: await loadMessages(supabase, interviewId),
  }
}

/** Lets the player end the interview early without forcing another AI turn. */
export async function endChampionshipInterviewAction(interviewId: string): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const supabase = createServiceClient()
  const { data: interviewData } = await supabase
    .from('championship_interviews')
    .select('player_id, status')
    .eq('id', interviewId)
    .single()
  const interview = interviewData as { player_id: string; status: 'in_progress' | 'completed' } | null
  if (!interview || interview.player_id !== session.sub) {
    throw new Error('This is not your interview')
  }
  if (interview.status === 'completed') return

  await supabase
    .from('championship_interviews')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', interviewId)

  await announceChampionshipInterviewCompletion(supabase, interviewId)
}
