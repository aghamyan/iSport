import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { NewsAdminClient } from './NewsAdminClient'

export default async function AdminNewsPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('news')
    .select('id, title, category, excerpt, content, cover_url, cover_position, cover_zoom, published, created_at')
    .order('created_at', { ascending: false })

  const items = (data ?? []).map((n) => ({
    id:            n.id,
    title:         n.title,
    category:      n.category,
    excerpt:       n.excerpt        as string | null,
    content:       n.content        as string | null,
    coverUrl:      n.cover_url      as string | null,
    coverPosition: (n.cover_position as string | null) ?? '50% 50%',
    coverZoom:     (n.cover_zoom    as number | null) ?? 1,
    published:     n.published      as boolean,
    createdAt:     n.created_at     as string,
  }))

  return <NewsAdminClient items={items} />
}
