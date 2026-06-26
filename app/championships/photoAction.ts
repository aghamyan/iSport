'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

type Ext = 'jpg' | 'jpeg' | 'png' | 'webp'

export async function getSignedChampionshipPhotoUrlAction(
  championshipId: string,
  ext: Ext,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload championship photos' }

  const supabase = createServiceClient()
  const storagePath = `${championshipId}/icon-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('championship-photos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }

  return { signedUrl: data.signedUrl, storagePath }
}

export async function finalizeChampionshipPhotoUploadAction(
  championshipId: string,
  storagePath: string,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload championship photos' }

  const supabase = createServiceClient()

  const { data: { publicUrl } } = supabase.storage
    .from('championship-photos')
    .getPublicUrl(storagePath)

  const { error: dbError } = await supabase
    .from('championships')
    .update({ photo_url: publicUrl })
    .eq('id', championshipId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/championships/${championshipId}`)
  revalidatePath('/championships')
  return { url: publicUrl }
}

export async function removeChampionshipPhotoAction(
  championshipId: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can remove championship photos' }

  const supabase = createServiceClient()
  const { error: dbError } = await supabase
    .from('championships')
    .update({ photo_url: null })
    .eq('id', championshipId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/championships/${championshipId}`)
  revalidatePath('/championships')
  return {}
}

// ─── Banner (hero) photo actions ──────────────────────────────────────────────

export async function getSignedChampionshipBannerUrlAction(
  championshipId: string,
  ext: Ext,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload championship banners' }

  const supabase = createServiceClient()
  const storagePath = `${championshipId}/banner-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('championship-photos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }

  return { signedUrl: data.signedUrl, storagePath }
}

export async function finalizeChampionshipBannerUploadAction(
  championshipId: string,
  storagePath: string,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload championship banners' }

  const supabase = createServiceClient()

  const { data: { publicUrl } } = supabase.storage
    .from('championship-photos')
    .getPublicUrl(storagePath)

  const { data, error: dbError } = await supabase
    .from('championships')
    .update({ banner_url: publicUrl })
    .eq('id', championshipId)
    .select('banner_url')
    .single()

  if (dbError) return { error: `DB error: ${dbError.message} (code: ${dbError.code})` }
  if (!data) return { error: 'Championship not found or no rows updated' }

  revalidatePath(`/championships/${championshipId}`)
  revalidatePath('/championships')
  return { url: publicUrl }
}

export async function removeChampionshipBannerAction(
  championshipId: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can remove championship banners' }

  const supabase = createServiceClient()
  const { error: dbError } = await supabase
    .from('championships')
    .update({ banner_url: null })
    .eq('id', championshipId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/championships/${championshipId}`)
  revalidatePath('/championships')
  return {}
}
