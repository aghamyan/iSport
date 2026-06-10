import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'

export default async function AdminSettingsPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')

  const settings = (data ?? []).map((row) => ({ key: row.key, value: row.value }))

  return <SettingsClient settings={settings} />
}
