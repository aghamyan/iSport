'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

type Ext = 'jpg' | 'jpeg' | 'png' | 'webp'

// ── Types ─────────────────────────────────────────────────────────────────

export interface ProductRow {
  id: string
  title: string
  tagline: string | null
  description: string | null
  price: number
  image_urls: string[]
  category: string
  badge: string | null
  featured: boolean
  active: boolean
  created_at: string
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createProductAction(data: {
  title: string
  tagline: string
  description: string
  price: number
  category: string
  badge: string
  featured: boolean
}): Promise<{ error?: string; id?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()
  const { data: row, error } = await supabase
    .from('products')
    .insert({
      title:       data.title.trim(),
      tagline:     data.tagline.trim() || null,
      description: data.description.trim() || null,
      price:       data.price,
      category:    data.category,
      badge:       data.badge.trim() || null,
      featured:    data.featured,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/shop')
  revalidatePath('/admin/shop')
  return { id: row.id }
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateProductAction(
  id: string,
  data: {
    title: string
    tagline: string
    description: string
    price: number
    category: string
    badge: string
    featured: boolean
    active: boolean
  },
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('products')
    .update({
      title:       data.title.trim(),
      tagline:     data.tagline.trim() || null,
      description: data.description.trim() || null,
      price:       data.price,
      category:    data.category,
      badge:       data.badge.trim() || null,
      featured:    data.featured,
      active:      data.active,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/shop')
  revalidatePath('/admin/shop')
  return {}
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteProductAction(id: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()
  const { error } = await supabase.from('products').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/shop')
  revalidatePath('/admin/shop')
  return {}
}

// ── Image upload (signed URL) ─────────────────────────────────────────────

export async function getSignedShopPhotoUrlAction(
  productId: string,
  ext: Ext,
): Promise<{ error?: string; signedUrl?: string; storagePath?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()
  const storagePath = `${productId}/${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('shop-photos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Failed to create upload URL' }

  return { signedUrl: data.signedUrl, storagePath }
}

export async function finalizeShopPhotoUploadAction(
  productId: string,
  storagePath: string,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()

  const { data: { publicUrl } } = supabase.storage
    .from('shop-photos')
    .getPublicUrl(storagePath)

  // Append to image_urls array
  const { data: current } = await supabase
    .from('products')
    .select('image_urls')
    .eq('id', productId)
    .single()

  const existing: string[] = current?.image_urls ?? []
  const { error } = await supabase
    .from('products')
    .update({ image_urls: [...existing, publicUrl] })
    .eq('id', productId)

  if (error) return { error: error.message }

  revalidatePath('/shop')
  revalidatePath('/admin/shop')
  return { url: publicUrl }
}

export async function removeShopPhotoAction(
  productId: string,
  photoUrl: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session?.isAdmin) return { error: 'Unauthorized' }

  const supabase = createServiceClient()

  const { data: current } = await supabase
    .from('products')
    .select('image_urls')
    .eq('id', productId)
    .single()

  const existing: string[] = current?.image_urls ?? []
  const { error } = await supabase
    .from('products')
    .update({ image_urls: existing.filter((u) => u !== photoUrl) })
    .eq('id', productId)

  if (error) return { error: error.message }

  revalidatePath('/shop')
  revalidatePath('/admin/shop')
  return {}
}
