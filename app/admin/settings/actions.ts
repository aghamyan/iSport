'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

export async function updateSettingAction(
  key: string,
  value: unknown
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key,
      value: JSON.parse(JSON.stringify(value)),
      updated_at: new Date().toISOString(),
      updated_by: session!.sub,
    })

  if (error) throw new Error(error.message)

  await logAdminAction('update_setting', 'settings', key, { value })
  revalidatePath('/admin/settings')
}

type ImgExt = 'jpg' | 'jpeg' | 'png' | 'webp' | 'svg'

export async function getHeroBannerSignedUploadUrlAction(
  ext: Exclude<ImgExt, 'svg'>,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()
  const storagePath = `hero-banner-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('logos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }
  return { signedUrl: data.signedUrl, storagePath }
}

export async function finalizeHeroBannerUploadAction(
  storagePath: string,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()
  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(storagePath)

  await updateSettingAction('homepage_hero_url', publicUrl)
  revalidatePath('/', 'layout')
  return { url: publicUrl }
}

export async function removeHeroBannerAction(): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  await updateSettingAction('homepage_hero_url', '')
  revalidatePath('/', 'layout')
  return {}
}

export async function getLogoSignedUploadUrlAction(
  ext: ImgExt,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()
  const storagePath = `logo-${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('logos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }
  return { signedUrl: data.signedUrl, storagePath }
}

export async function finalizeLogoUploadAction(
  storagePath: string,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()
  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(storagePath)

  await updateSettingAction('logo_url', publicUrl)
  revalidatePath('/', 'layout')
  return { url: publicUrl }
}
