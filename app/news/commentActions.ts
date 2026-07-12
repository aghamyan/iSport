'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient, getAuthedClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { notifyNewComment } from '@/lib/telegram/notify'

export async function addCommentAction(
  newsId: string,
  content: string,
  parentId?: string | null,
): Promise<{ error?: string; comment?: { id: string; createdAt: string } }> {
  const session = await getSession()
  if (!session) return { error: 'Sign in to comment' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'Comment cannot be empty' }
  if (trimmed.length > 500) return { error: 'Max 500 characters' }

  // Use authed client so auth.uid() resolves inside RLS
  const supabase = await getAuthedClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('news_comments')
    .insert({ news_id: newsId, user_id: session.sub, content: trimmed, parent_id: parentId ?? null })
    .select('id, created_at, user:users(name), news:news(title)')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/news/${newsId}`)

  let replyToName: string | null = null
  if (parentId) {
    const { data: parent } = await supabase
      .from('news_comments')
      .select('user:users(name)')
      .eq('id', parentId)
      .single()
    replyToName = extractJoinedField(parent?.user, 'name')
  }

  await notifyNewComment({
    newsId,
    newsTitle: extractJoinedField(data.news, 'title') ?? 'a post',
    authorName: extractJoinedField(data.user, 'name') ?? 'Someone',
    content: trimmed,
    replyToName,
  })

  return { comment: { id: data.id, createdAt: data.created_at } }
}

// Supabase's embedded-select shape (single object vs. one-item array) varies
// at runtime depending on how the relationship is detected, independent of
// the TS type it infers — see extractJoinedName in app/betting/bets/actions.ts.
function extractJoinedField(val: unknown, field: string): string | null {
  const item = Array.isArray(val) ? val[0] : val
  if (item && typeof item === 'object' && field in item) {
    return (item as Record<string, unknown>)[field] as string ?? null
  }
  return null
}

export async function deleteCommentAction(
  commentId: string,
  newsId: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }

  const supabase = createServiceClient()

  // Verify ownership or admin before deleting
  const { data: comment } = await supabase
    .from('news_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (!comment) return { error: 'Comment not found' }
  if (comment.user_id !== session.sub && !session.isAdmin) {
    return { error: 'Not allowed' }
  }

  const { error } = await supabase
    .from('news_comments')
    .delete()
    .eq('id', commentId)

  if (error) return { error: error.message }

  revalidatePath(`/news/${newsId}`)
  return {}
}
