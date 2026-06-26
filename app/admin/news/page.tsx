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
    .select('id, title, category, excerpt, content, cover_url, published, created_at')
    .order('created_at', { ascending: false })

  const items = (data ?? []).map((n) => ({
    id:        n.id,
    title:     n.title,
    category:  n.category,
    excerpt:   n.excerpt    as string | null,
    content:   n.content    as string | null,
    coverUrl:  n.cover_url  as string | null,
    published: n.published  as boolean,
    createdAt: n.created_at as string,
  }))

  return <NewsAdminClient items={items} />
}
