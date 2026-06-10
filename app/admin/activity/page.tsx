import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { ActivityLogClient } from './ActivityLogClient'

export default async function AdminActivityPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('admin_activity_log')
    .select(`
      id,
      action,
      entity_type,
      entity_id,
      details,
      created_at,
      admin:users!admin_id(name)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  const entries = (data ?? []).map((row) => {
    const admin = Array.isArray(row.admin) ? row.admin[0] : row.admin
    return {
      id:         row.id,
      adminName:  (admin as { name: string } | null)?.name ?? 'Unknown',
      action:     row.action,
      entityType: row.entity_type,
      entityId:   row.entity_id,
      details:    row.details as Record<string, unknown> | null,
      createdAt:  row.created_at,
    }
  })

  return <ActivityLogClient entries={entries} />
}
