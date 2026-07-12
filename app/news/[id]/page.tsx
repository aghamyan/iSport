import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { NewsDetail } from './NewsDetail'
import type { Comment, CurrentUser } from './CommentsSection'

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServiceClient()

  const [articleRes, commentsRes, userRes] = await Promise.all([
    supabase
      .from('news')
      .select('id, title, category, excerpt, content, cover_url, created_at')
      .eq('id', id)
      .eq('published', true)
      .single(),

    supabase
      .from('news_comments')
      .select('id, content, created_at, user_id')
      .eq('news_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('id', session.sub)
      .single(),
  ])

  if (!articleRes.data) notFound()

  const commentRows = commentsRes.data ?? []
  const authorIds = [...new Set(commentRows.map((c) => c.user_id))]
  const { data: authors } = authorIds.length
    ? await supabase.from('users').select('id, name, avatar_url').in('id', authorIds)
    : { data: [] as { id: string; name: string; avatar_url: string | null }[] }
  const authorsById = new Map((authors ?? []).map((a) => [a.id, a]))

  const comments: Comment[] = commentRows.map((c) => {
    const user = authorsById.get(c.user_id)
    return {
      id:        c.id,
      content:   c.content,
      createdAt: c.created_at,
      user: {
        id:        user?.id        ?? c.user_id,
        name:      user?.name      ?? 'Player',
        avatarUrl: user?.avatar_url ?? null,
      },
    }
  })

  const currentUser: CurrentUser | null = userRes.data
    ? {
        id:        userRes.data.id,
        name:      userRes.data.name,
        avatarUrl: userRes.data.avatar_url as string | null,
        isAdmin:   session.isAdmin,
      }
    : null

  const article = articleRes.data
  return (
    <NewsDetail
      item={{
        id:        article.id,
        title:     article.title,
        category:  article.category,
        excerpt:   article.excerpt    as string | null,
        content:   article.content    as string | null,
        coverUrl:  article.cover_url  as string | null,
        createdAt: article.created_at,
      }}
      comments={comments}
      currentUser={currentUser}
    />
  )
}
