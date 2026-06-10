'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

export async function createBadgeAction(
  name: string,
  description: string,
  badgeType: string,
  iconUrl?: string
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('badges')
    .insert({ name: name.trim(), description: description.trim(), badge_type: badgeType.trim(), icon_url: iconUrl || null })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await logAdminAction('create_badge', 'badge', data.id, { name, badgeType })
  revalidatePath('/admin/badges')
}

export async function deleteBadgeAction(badgeId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { error } = await supabase.from('badges').delete().eq('id', badgeId)

  if (error) throw new Error(error.message)

  await logAdminAction('delete_badge', 'badge', badgeId)
  revalidatePath('/admin/badges')
}

export async function awardBadgeAction(
  playerId: string,
  badgeId: string
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('player_badges')
    .insert({ player_id: playerId, badge_id: badgeId })

  if (error) {
    if (error.code === '23505') throw new Error('Player already has this badge')
    throw new Error(error.message)
  }

  await logAdminAction('award_badge', 'badge', badgeId, { playerId })
  revalidatePath('/admin/badges')
}

export async function revokeBadgeAction(playerBadgeId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('player_badges')
    .select('player_id, badge_id')
    .eq('id', playerBadgeId)
    .single()

  const { error } = await supabase
    .from('player_badges')
    .delete()
    .eq('id', playerBadgeId)

  if (error) throw new Error(error.message)

  await logAdminAction('revoke_badge', 'badge', data?.badge_id, { playerBadgeId, playerId: data?.player_id })
  revalidatePath('/admin/badges')
}
