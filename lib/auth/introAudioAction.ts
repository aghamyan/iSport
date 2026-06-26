'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

type AudioExt = 'mp3' | 'aac' | 'ogg' | 'wav' | 'm4a'

export async function getSignedAudioUploadUrlAction(
  targetUserId: string,
  ext: AudioExt,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload intro audio' }

  const supabase = createServiceClient()
  const storagePath = `${targetUserId}/intro-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('intro-audio')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }

  return { signedUrl: data.signedUrl, storagePath }
}

export async function finalizeAudioUploadAction(
  targetUserId: string,
  storagePath: string,
  trimStart: number = 0,
  trimEnd: number | null = null,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload intro audio' }

  const supabase = createServiceClient()

  const { data: { publicUrl } } = supabase.storage
    .from('intro-audio')
    .getPublicUrl(storagePath)

  const { error: dbError } = await supabase
    .from('users')
    .update({
      intro_audio_url:        publicUrl,
      intro_audio_trim_start: trimStart,
      intro_audio_trim_end:   trimEnd,
    })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  return { url: publicUrl }
}

export async function updateAudioTrimAction(
  targetUserId: string,
  trimStart: number,
  trimEnd: number | null,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can trim intro audio' }

  const supabase = createServiceClient()

  const { error: dbError } = await supabase
    .from('users')
    .update({
      intro_audio_trim_start: trimStart,
      intro_audio_trim_end:   trimEnd,
    })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  return {}
}

export async function removeIntroAudioAction(
  targetUserId: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can remove intro audio' }

  const supabase = createServiceClient()

  const { error: dbError } = await supabase
    .from('users')
    .update({
      intro_audio_url:        null,
      intro_audio_trim_start: 0,
      intro_audio_trim_end:   null,
    })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  return {}
}
