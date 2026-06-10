import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { PlayersClient } from './PlayersClient'

export default async function AdminPlayersPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('id, name, is_active, is_admin, created_at, avatar_url')
    .order('created_at', { ascending: false })

  const players = (data ?? []).map((u) => ({
    id:        u.id,
    name:      u.name,
    isActive:  u.is_active,
    isAdmin:   u.is_admin,
    createdAt: u.created_at,
    avatarUrl: u.avatar_url as string | null,
  }))

  return <PlayersClient players={players} />
}
