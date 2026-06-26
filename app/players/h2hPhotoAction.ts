'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

type Ext = 'jpg' | 'jpeg' | 'png' | 'webp'

export async function getH2HPhotoAction(
  playerAId: string,
  playerBId: string,
): Promise<{ photoUrl: string | null }> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('h2h_photos')
    .select('photo_url')
    .eq('player1_id', playerAId)
    .eq('player2_id', playerBId)
    .maybeSingle()
  return { photoUrl: data?.photo_url ?? null }
}

export async function getSignedH2HPhotoUrlAction(
  playerAId: string,
  playerBId: string,
  ext: Ext,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload H2H photos' }

  const supabase = createServiceClient()
  const storagePath = `${playerAId}-${playerBId}/banner-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('h2h-photos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }
  return { signedUrl: data.signedUrl, storagePath }
}

export async function finalizeH2HPhotoUploadAction(
  playerAId: string,
  playerBId: string,
  storagePath: string,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can upload H2H photos' }

  const supabase = createServiceClient()

  const { data: { publicUrl } } = supabase.storage
    .from('h2h-photos')
    .getPublicUrl(storagePath)

  const { error: dbError } = await supabase
    .from('h2h_photos')
    .upsert(
      { player1_id: playerAId, player2_id: playerBId, photo_url: publicUrl },
      { onConflict: 'player1_id,player2_id' },
    )

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${playerAId}`)
  revalidatePath(`/players/${playerBId}`)
  return { url: publicUrl }
}

export async function removeH2HPhotoAction(
  playerAId: string,
  playerBId: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can remove H2H photos' }

  const supabase = createServiceClient()

  const { error: dbError } = await supabase
    .from('h2h_photos')
    .delete()
    .eq('player1_id', playerAId)
    .eq('player2_id', playerBId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${playerAId}`)
  revalidatePath(`/players/${playerBId}`)
  return {}
}
