'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

type Ext = 'jpg' | 'jpeg' | 'png' | 'webp'

// Step 1 — returns a signed upload URL; no bytes through Next.js
export async function getSignedHeroPhotoUrlAction(
  targetUserId: string,
  ext: Ext,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload hero photos' }

  const supabase = createServiceClient()
  const storagePath = `${targetUserId}/hero-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('hero-photos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }

  return { signedUrl: data.signedUrl, storagePath }
}

// Step 2 — saves the public URL + position to the database after browser PUT succeeds
export async function finalizeHeroPhotoUploadAction(
  targetUserId: string,
  storagePath: string,
  position: string = '50% 15%',
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload hero photos' }

  const supabase = createServiceClient()

  const { data: { publicUrl } } = supabase.storage
    .from('hero-photos')
    .getPublicUrl(storagePath)

  const { error: dbError } = await supabase
    .from('users')
    .update({ hero_photo_url: publicUrl, hero_photo_position: position })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  revalidatePath('/admin/players')
  return { url: publicUrl }
}

// Update only the position of an existing hero photo (no re-upload)
export async function updateHeroPhotoPositionAction(
  targetUserId: string,
  position: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can reposition hero photos' }

  const supabase = createServiceClient()
  const { error: dbError } = await supabase
    .from('users')
    .update({ hero_photo_position: position })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  return {}
}

export async function removeHeroPhotoAction(
  targetUserId: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can remove hero photos' }

  const supabase = createServiceClient()

  const { error: dbError } = await supabase
    .from('users')
    .update({ hero_photo_url: null, hero_photo_position: '50% 15%' })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  revalidatePath('/admin/players')
  return {}
}
