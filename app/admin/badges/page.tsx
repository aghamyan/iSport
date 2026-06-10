import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { BadgesAdminClient } from './BadgesAdminClient'

export default async function AdminBadgesPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()

  const [badgesRes, playerBadgesRes, playersRes] = await Promise.all([
    supabase
      .from('badges')
      .select('id, name, description, badge_type, icon_url')
      .order('name'),
    supabase
      .from('player_badges')
      .select(`
        id,
        player_id,
        badge_id,
        earned_at,
        player:players!player_id(display_name),
        badge:badges!badge_id(name)
      `)
      .order('earned_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  const badges = (badgesRes.data ?? []).map((b) => ({
    id:          b.id,
    name:        b.name,
    description: b.description,
    badgeType:   b.badge_type,
    iconUrl:     b.icon_url,
  }))

  const playerBadges = (playerBadgesRes.data ?? []).map((pb) => {
    const player = Array.isArray(pb.player) ? pb.player[0] : pb.player
    const badge  = Array.isArray(pb.badge)  ? pb.badge[0]  : pb.badge
    return {
      id:         pb.id,
      playerId:   pb.player_id,
      playerName: (player as { display_name: string } | null)?.display_name ?? 'Unknown',
      badgeId:    pb.badge_id,
      badgeName:  (badge as { name: string } | null)?.name ?? 'Unknown',
      earnedAt:   pb.earned_at,
    }
  })

  const players = (playersRes.data ?? []).map((u) => ({ id: u.id, name: u.name }))

  return <BadgesAdminClient badges={badges} playerBadges={playerBadges} players={players} />
}
