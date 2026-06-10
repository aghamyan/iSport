import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export type EntityType = 'player' | 'match' | 'championship' | 'badge' | 'settings'

export async function logAdminAction(
  action: string,
  entityType: EntityType,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const session = await getSession()
  if (!session?.isAdmin) return

  const supabase = createServiceClient()
  await supabase.from('admin_activity_log').insert({
    admin_id:    session.sub,
    action,
    entity_type: entityType,
    entity_id:   entityId ?? null,
    details:     details ?? null,
  })
}
