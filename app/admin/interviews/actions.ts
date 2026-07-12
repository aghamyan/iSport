'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

type InterviewRow = {
  id: string
  championship_match_id: string
  player_id: string
  phase: 'pre_match' | 'post_match'
  status: 'in_progress' | 'completed'
  started_at: string
  completed_at: string | null
}

type MatchRow = { id: string; championship_id: string; home_player_id: string; away_player_id: string }
type ChampionshipRow = { id: string; name: string }
type UserRow = { id: string; name: string }
type MessageIdRow = { interview_id: string }

export type InterviewListRow = {
  id: string
  phase: 'pre_match' | 'post_match'
  status: 'in_progress' | 'completed'
  startedAt: string
  completedAt: string | null
  messageCount: number
  playerName: string
  opponentName: string
  championshipName: string
  matchId: string
}

export async function getInterviewsListAction(): Promise<InterviewListRow[]> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data: interviewsData } = await supabase
    .from('match_interviews')
    .select('id, championship_match_id, player_id, phase, status, started_at, completed_at')
    .order('started_at', { ascending: false })
    .limit(200)

  const interviews = (interviewsData ?? []) as InterviewRow[]
  if (interviews.length === 0) return []

  const matchIds = [...new Set(interviews.map((r) => r.championship_match_id))]
  const { data: matchesData } = await supabase
    .from('championship_matches')
    .select('id, championship_id, home_player_id, away_player_id')
    .in('id', matchIds)
  const matches = (matchesData ?? []) as MatchRow[]
  const matchMap = new Map(matches.map((m) => [m.id, m]))

  const championshipIds = [...new Set(matches.map((m) => m.championship_id))]
  const { data: championshipsData } = await supabase
    .from('championships')
    .select('id, name')
    .in('id', championshipIds)
  const champMap = new Map(((championshipsData ?? []) as ChampionshipRow[]).map((c) => [c.id, c.name]))

  const playerIds = new Set<string>()
  for (const r of interviews) playerIds.add(r.player_id)
  for (const m of matches) {
    playerIds.add(m.home_player_id)
    playerIds.add(m.away_player_id)
  }
  const { data: usersData } = await supabase.from('users').select('id, name').in('id', [...playerIds])
  const nameMap = new Map(((usersData ?? []) as UserRow[]).map((u) => [u.id, u.name]))

  const interviewIds = interviews.map((r) => r.id)
  const { data: messagesData } = await supabase
    .from('match_interview_messages')
    .select('interview_id')
    .in('interview_id', interviewIds)
  const countMap = new Map<string, number>()
  for (const m of (messagesData ?? []) as MessageIdRow[]) {
    countMap.set(m.interview_id, (countMap.get(m.interview_id) ?? 0) + 1)
  }

  return interviews.map((r) => {
    const match = matchMap.get(r.championship_match_id)
    const opponentId = match
      ? match.home_player_id === r.player_id
        ? match.away_player_id
        : match.home_player_id
      : null

    return {
      id: r.id,
      phase: r.phase,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      messageCount: countMap.get(r.id) ?? 0,
      playerName: nameMap.get(r.player_id) ?? '?',
      opponentName: opponentId ? nameMap.get(opponentId) ?? '?' : '?',
      championshipName: match ? champMap.get(match.championship_id) ?? '?' : '?',
      matchId: r.championship_match_id,
    }
  })
}

export type InterviewTranscript = {
  id: string
  phase: 'pre_match' | 'post_match'
  status: 'in_progress' | 'completed'
  playerName: string
  opponentName: string
  championshipName: string
  messages: Array<{ id: string; role: 'journalist' | 'player'; content: string; createdAt: string }>
}

export async function getInterviewTranscriptAction(interviewId: string): Promise<InterviewTranscript> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { data: interviewData, error } = await supabase
    .from('match_interviews')
    .select('id, championship_match_id, player_id, phase, status')
    .eq('id', interviewId)
    .single()
  if (error || !interviewData) throw new Error('Interview not found')
  const interview = interviewData as Pick<InterviewRow, 'id' | 'championship_match_id' | 'player_id' | 'phase' | 'status'>

  const { data: matchData } = await supabase
    .from('championship_matches')
    .select('championship_id, home_player_id, away_player_id')
    .eq('id', interview.championship_match_id)
    .single()
  const match = matchData as Pick<MatchRow, 'championship_id' | 'home_player_id' | 'away_player_id'> | null

  const opponentId = match
    ? match.home_player_id === interview.player_id
      ? match.away_player_id
      : match.home_player_id
    : null

  const [usersResult, champResult, messagesResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, name')
      .in('id', [interview.player_id, opponentId].filter((id): id is string => !!id)),
    match
      ? supabase.from('championships').select('name').eq('id', match.championship_id).single()
      : Promise.resolve({ data: null as { name: string } | null }),
    supabase
      .from('match_interview_messages')
      .select('id, role, content, created_at')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: true }),
  ])

  const nameMap = new Map(((usersResult.data ?? []) as UserRow[]).map((u) => [u.id, u.name]))
  type MessageRow = { id: string; role: 'journalist' | 'player'; content: string; created_at: string }

  return {
    id: interview.id,
    phase: interview.phase,
    status: interview.status,
    playerName: nameMap.get(interview.player_id) ?? '?',
    opponentName: opponentId ? nameMap.get(opponentId) ?? '?' : '?',
    championshipName: (champResult.data as { name: string } | null)?.name ?? '?',
    messages: ((messagesResult.data ?? []) as MessageRow[]).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  }
}
