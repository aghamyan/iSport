import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { InterviewTranscriptView } from './InterviewTranscriptView'

type MatchRow = { id: string; championship_id: string; home_player_id: string; away_player_id: string }
type InterviewRow = {
  id: string
  championship_match_id: string
  player_id: string
  phase: 'pre_match' | 'post_match'
  status: 'in_progress' | 'completed'
}
type MessageRow = { id: string; role: 'journalist' | 'player'; content: string; created_at: string }

export default async function InterviewTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServiceClient()

  const { data: interviewData, error } = await supabase
    .from('match_interviews')
    .select('id, championship_match_id, player_id, phase, status')
    .eq('id', id)
    .single()
  if (error || !interviewData) notFound()
  const interview = interviewData as InterviewRow

  const { data: matchData } = await supabase
    .from('championship_matches')
    .select('id, championship_id, home_player_id, away_player_id')
    .eq('id', interview.championship_match_id)
    .single()
  const match = matchData as MatchRow | null

  const opponentId = match
    ? match.home_player_id === interview.player_id ? match.away_player_id : match.home_player_id
    : null

  const [usersResult, champResult, messagesResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, name')
      .in('id', [interview.player_id, opponentId].filter((v): v is string => !!v)),
    match
      ? supabase.from('championships').select('name').eq('id', match.championship_id).single()
      : Promise.resolve({ data: null as { name: string } | null }),
    supabase
      .from('match_interview_messages')
      .select('id, role, content, created_at')
      .eq('interview_id', id)
      .order('created_at', { ascending: true }),
  ])

  const nameMap = new Map(((usersResult.data ?? []) as Array<{ id: string; name: string }>).map((u) => [u.id, u.name]))

  return (
    <InterviewTranscriptView
      phase={interview.phase}
      status={interview.status}
      playerName={nameMap.get(interview.player_id) ?? 'Player'}
      opponentName={opponentId ? nameMap.get(opponentId) ?? 'Opponent' : 'Opponent'}
      championshipName={(champResult.data as { name?: string } | null)?.name ?? 'the championship'}
      championshipId={match?.championship_id ?? null}
      messages={((messagesResult.data ?? []) as MessageRow[]).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      }))}
      currentUserId={session.sub}
    />
  )
}
