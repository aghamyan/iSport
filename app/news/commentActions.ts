'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient, getAuthedClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function addCommentAction(
  newsId: string,
  content: string,
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
    .insert({ news_id: newsId, user_id: session.sub, content: trimmed })
    .select('id, created_at')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/news/${newsId}`)
  return { comment: { id: data.id, createdAt: data.created_at } }
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
