'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'


// Step 1 — called from the browser: returns a short-lived signed upload URL.
// No file bytes pass through Next.js, so body-size limits are irrelevant.
export async function getSignedUploadUrlAction(
  targetUserId: string,
  ext: 'mp4' | 'webm',
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload intro videos' }

  const supabase = createServiceClient()
  const storagePath = `${targetUserId}/intro-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('intro-videos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }

  return { signedUrl: data.signedUrl, storagePath }
}

// Step 2 — called after the browser PUT succeeds: saves the public URL to the DB.
export async function finalizeVideoUploadAction(
  targetUserId: string,
  storagePath: string,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload intro videos' }

  const supabase = createServiceClient()

  const { data: { publicUrl } } = supabase.storage
    .from('intro-videos')
    .getPublicUrl(storagePath)

  const { error: dbError } = await supabase
    .from('users')
    .update({ intro_video_url: publicUrl })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  return { url: publicUrl }
}

export async function removeIntroVideoAction(
  targetUserId: string
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can remove intro videos' }

  const supabase = createServiceClient()

  const { error: dbError } = await supabase
    .from('users')
    .update({ intro_video_url: null })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  return {}
}
