import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { ChampionshipInterviewTranscriptView } from './ChampionshipInterviewTranscriptView'

type InterviewRow = {
  id: string
  championship_id: string
  player_id: string
  status: 'in_progress' | 'completed'
  final_rank: number
  total_players: number
  points: number
  wins: number
  draws: number
  losses: number
  goal_diff: number
}
type MessageRow = { id: string; role: 'journalist' | 'player'; content: string; created_at: string }

export default async function ChampionshipInterviewTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServiceClient()

  const { data: interviewData, error } = await supabase
    .from('championship_interviews')
    .select('id, championship_id, player_id, status, final_rank, total_players, points, wins, draws, losses, goal_diff')
    .eq('id', id)
    .single()
  if (error || !interviewData) notFound()
  const interview = interviewData as InterviewRow

  const [userResult, champResult, messagesResult] = await Promise.all([
    supabase.from('users').select('id, name, avatar_url').eq('id', interview.player_id).single(),
    supabase.from('championships').select('name').eq('id', interview.championship_id).single(),
    supabase
      .from('championship_interview_messages')
      .select('id, role, content, created_at')
      .eq('interview_id', id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <ChampionshipInterviewTranscriptView
      status={interview.status}
      playerName={(userResult.data as { name?: string } | null)?.name ?? 'Player'}
      playerAvatarUrl={(userResult.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
      championshipName={(champResult.data as { name?: string } | null)?.name ?? 'the championship'}
      championshipId={interview.championship_id}
      finalRank={interview.final_rank}
      totalPlayers={interview.total_players}
      points={interview.points}
      wins={interview.wins}
      draws={interview.draws}
      losses={interview.losses}
      goalDiff={interview.goal_diff}
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
