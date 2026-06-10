'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

const ALLOWED_TYPES = ['video/mp4', 'video/webm']
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export async function uploadIntroVideoAction(
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload intro videos' }

  const targetUserId = formData.get('targetUserId') as string | null
  if (!targetUserId) return { error: 'Missing target user' }

  const file = formData.get('introVideo') as File | null
  if (!file || !file.size) return { error: 'No file provided' }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Only MP4 and WebM videos are supported (.mov is not supported)' }
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Video must be under 50 MB' }
  }

  const supabase = createServiceClient()
  const ext = file.type === 'video/webm' ? 'webm' : 'mp4'
  const storagePath = `${targetUserId}/intro-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('intro-videos')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return { error: uploadError.message }

  const {
    data: { publicUrl },
  } = supabase.storage.from('intro-videos').getPublicUrl(storagePath)

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
