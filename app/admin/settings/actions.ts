'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

export async function updateSettingAction(
  key: string,
  value: unknown
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key,
      value: JSON.parse(JSON.stringify(value)),
      updated_at: new Date().toISOString(),
      updated_by: session!.sub,
    })

  if (error) throw new Error(error.message)

  await logAdminAction('update_setting', 'settings', key, { value })
  revalidatePath('/admin/settings')
}
