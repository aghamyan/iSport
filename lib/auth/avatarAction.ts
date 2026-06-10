'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 3 * 1024 * 1024

export async function uploadAvatarAction(
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }
  if (!session.isAdmin) return { error: 'Only admins can change player avatars' }

  const targetUserId = formData.get('targetUserId') as string | null
  if (!targetUserId) return { error: 'Missing target user' }

  const file = formData.get('avatar') as File | null
  if (!file || !file.size) return { error: 'No file provided' }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Only JPEG, PNG, and WebP images are supported' }
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Image must be under 3 MB' }
  }

  const supabase = createServiceClient()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${targetUserId}/avatar-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return { error: uploadError.message }

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(storagePath)

  const { error: dbError } = await supabase
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', targetUserId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/players/${targetUserId}`)
  revalidatePath('/')
  return { url: publicUrl }
}
