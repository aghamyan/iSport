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
    .select('id, name, is_active, is_admin, created_at, avatar_url, hero_photo_url')
    .order('created_at', { ascending: false })

  // Fetch social links separately — columns may not exist yet if migration hasn't run
  const { data: socialData } = await supabase
    .from('users')
    .select('id, instagram_url, navi_coords')
    .then((r) => (r.error ? { data: [] } : r))

  const socialMap: Record<string, { instagram_url: string | null; navi_coords: string | null }> =
    Object.fromEntries((socialData ?? []).map((s) => [s.id, { instagram_url: (s as Record<string,unknown>).instagram_url as string | null, navi_coords: (s as Record<string,unknown>).navi_coords as string | null }]))

  const players = (data ?? []).map((u) => ({
    id:           u.id,
    name:         u.name,
    isActive:     u.is_active,
    isAdmin:      u.is_admin,
    createdAt:    u.created_at,
    avatarUrl:    u.avatar_url as string | null,
    heroPhotoUrl: u.hero_photo_url as string | null,
    instagramUrl: socialMap[u.id]?.instagram_url ?? null,
    naviCoords:   socialMap[u.id]?.navi_coords ?? null,
  }))

  return <PlayersClient players={players} />
}
