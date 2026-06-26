import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlayerForm, getPlayerChampionshipPlacements } from '@/lib/stats/queries'
import { PlayerProfile } from './PlayerProfile'

export const dynamic = 'force-dynamic'

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServiceClient()

  const [userResult, playerResult, badgesResult, rivalriesResult, formResult, placementsResult, allUsersResult] =
    await Promise.all([
      supabase.from('users').select('id, name, avatar_url, intro_video_url, hero_photo_url, hero_photo_position, intro_audio_url, intro_audio_trim_start, intro_audio_trim_end, is_active, instagram_url, navi_coords').eq('id', id).single(),
      supabase
        .from('players')
        .select('wins, losses, draws, matches_played, goals_for, goals_against, goal_diff')
        .eq('id', id)
        .single(),
      supabase
        .from('player_badges')
        .select('id, earned_at, source_rivalry_id, badges(name, description, badge_type, icon_url)')
        .eq('player_id', id)
        .order('earned_at', { ascending: false }),
      supabase
        .from('rivalries')
        .select('id, best_of, player1_id, player2_id, player1_wins, player2_wins, winner_id, status')
        .or(`player1_id.eq.${id},player2_id.eq.${id}`)
        .order('status', { ascending: true }),
      getPlayerForm(id, 5),
      getPlayerChampionshipPlacements(id),
      supabase.from('users').select('id, name').eq('is_active', true).neq('id', id).order('name'),
    ])

  if (userResult.error || !userResult.data) notFound()

  const user = userResult.data
  const player = playerResult.data

  // Fetch opponent names for rivalries
  const opponentIds = [
    ...new Set(
      (rivalriesResult.data ?? []).map((r) =>
        r.player1_id === id ? r.player2_id : r.player1_id
      )
    ),
  ]

  const { data: opponents } = opponentIds.length
    ? await supabase.from('users').select('id, name').in('id', opponentIds)
    : { data: [] }

  const opponentMap: Record<string, string> = {}
  for (const o of opponents ?? []) opponentMap[o.id] = o.name

  const badges = (badgesResult.data ?? []).map((b) => {
    const badge = b.badges as unknown as {
      name: string; description: string | null; badge_type: string; icon_url: string | null
    } | null
    return {
      id:               b.id as string,
      name:             badge?.name ?? 'Badge',
      description:      badge?.description ?? '',
      badgeType:        badge?.badge_type ?? '',
      iconUrl:          badge?.icon_url ?? null,
      earnedAt:         b.earned_at as string,
      sourceRivalryId:  b.source_rivalry_id as string | null,
    }
  })

  const rivalries = (rivalriesResult.data ?? []).map((r) => {
    const opponentId = r.player1_id === id ? r.player2_id : r.player1_id
    const myWins     = r.player1_id === id ? r.player1_wins : r.player2_wins
    const theirWins  = r.player1_id === id ? r.player2_wins : r.player1_wins
    return {
      id:           r.id,
      opponentId,
      opponentName: opponentMap[opponentId] ?? 'Unknown',
      bestOf:       r.best_of,
      myWins,
      theirWins,
      winnerId:     r.winner_id as string | null,
      status:       r.status as 'active' | 'completed',
    }
  })

  const allPlayers = (allUsersResult.data ?? []).map((u) => ({ id: u.id, name: u.name }))

  return (
    <PlayerProfile
      player={{
        id:            user.id,
        name:          user.name,
        avatarUrl:      user.avatar_url as string | null,
        introVideoUrl:  user.intro_video_url as string | null,
        heroPhotoUrl:        user.hero_photo_url as string | null,
        heroPhotoPosition:   (user.hero_photo_position as string | null) ?? '50% 15%',
        introAudioUrl:       user.intro_audio_url as string | null,
        introAudioTrimStart: (user.intro_audio_trim_start as number | null) ?? 0,
        introAudioTrimEnd:   user.intro_audio_trim_end as number | null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instagramUrl:   ((user as any).instagram_url as string | null) ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        naviCoords:     ((user as any).navi_coords as string | null) ?? null,
        isActive:       user.is_active,
        wins:          player?.wins ?? 0,
        losses:        player?.losses ?? 0,
        draws:         player?.draws ?? 0,
        matchesPlayed: player?.matches_played ?? 0,
        goalsFor:      player?.goals_for ?? 0,
        goalsAgainst:  player?.goals_against ?? 0,
        goalDiff:      player?.goal_diff ?? 0,
      }}
      badges={badges}
      rivalries={rivalries}
      recentMatches={formResult}
      championshipPlacements={placementsResult}
      allPlayers={allPlayers}
      isOwnProfile={session.sub === id}
      isAdmin={session.isAdmin}
      viewerId={session.sub}
    />
  )
}
