import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { NewsListClient } from './NewsListClient'

export default async function NewsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('news')
    .select('id, title, category, excerpt, cover_url, cover_position, cover_zoom, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })

  const items = (data ?? []).map((n) => ({
    id:            n.id,
    title:         n.title,
    category:      n.category,
    excerpt:       n.excerpt as string | null,
    coverUrl:      n.cover_url as string | null,
    coverPosition: (n.cover_position as string | null) ?? '50% 50%',
    coverZoom:     (n.cover_zoom as number | null) ?? 1,
    createdAt:     n.created_at,
  }))

  return <NewsListClient items={items} userId={session.sub} />
}
