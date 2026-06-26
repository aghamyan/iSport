'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

type Ext = 'jpg' | 'jpeg' | 'png' | 'webp'

// ── Signed upload URL (Step 1) ─────────────────────────────────────────────
export async function getSignedNewsPhotoUrl(
  newsId: string,
  ext: Ext,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Admin only' }

  const supabase = createServiceClient()
  const storagePath = `${newsId}/cover-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('news-photos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }
  return { signedUrl: data.signedUrl, storagePath }
}

// ── Finalize upload — save public URL to DB (Step 2) ──────────────────────
export async function finalizeNewsPhotoUpload(
  newsId: string,
  storagePath: string,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Admin only' }

  const supabase = createServiceClient()
  const { data: { publicUrl } } = supabase.storage
    .from('news-photos')
    .getPublicUrl(storagePath)

  const { error } = await supabase
    .from('news')
    .update({ cover_url: publicUrl })
    .eq('id', newsId)

  if (error) return { error: error.message }

  revalidatePath('/news')
  revalidatePath(`/news/${newsId}`)
  revalidatePath('/admin/news')
  return { url: publicUrl }
}

// ── Create news article ────────────────────────────────────────────────────
export async function createNewsAction(payload: {
  title: string
  category: string
  excerpt: string
  content: string
  published: boolean
}): Promise<{ error?: string; id?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Admin only' }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('news')
    .insert({
      title:     payload.title.trim(),
      category:  payload.category.trim().toUpperCase(),
      excerpt:   payload.excerpt.trim(),
      content:   payload.content.trim(),
      published: payload.published,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/news')
  revalidatePath('/admin/news')
  return { id: data.id }
}

// ── Update news article ────────────────────────────────────────────────────
export async function updateNewsAction(
  id: string,
  payload: {
    title: string
    category: string
    excerpt: string
    content: string
    published: boolean
  },
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Admin only' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('news')
    .update({
      title:     payload.title.trim(),
      category:  payload.category.trim().toUpperCase(),
      excerpt:   payload.excerpt.trim(),
      content:   payload.content.trim(),
      published: payload.published,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/news')
  revalidatePath(`/news/${id}`)
  revalidatePath('/admin/news')
  return {}
}

// ── Delete news article ────────────────────────────────────────────────────
export async function deleteNewsAction(id: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Admin only' }

  const supabase = createServiceClient()
  const { error } = await supabase.from('news').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/news')
  revalidatePath('/admin/news')
  return {}
}
