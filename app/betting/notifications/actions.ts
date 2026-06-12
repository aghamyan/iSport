'use server'

import { getSession } from '@/lib/auth/session'
import {
  getPlayerNotifications,
  markNotificationsRead,
  type BetNotification,
} from '@/lib/betting/settlement'

export async function getBetNotificationsAction(
  limit = 10
): Promise<BetNotification[]> {
  const session = await getSession()
  if (!session) return []

  return getPlayerNotifications(session.sub, false, limit)
}

export async function markBetNotificationsReadAction(notifId?: string): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  await markNotificationsRead(session.sub, notifId)
}
