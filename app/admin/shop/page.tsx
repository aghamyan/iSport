import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { ShopAdminClient } from './ShopAdminClient'
import type { ProductRow } from '@/app/shop/shopActions'

export default async function AdminShopPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('products')
    .select('id, title, tagline, description, price, image_urls, category, badge, featured, active, created_at')
    .order('created_at', { ascending: false })

  const products: ProductRow[] = (data ?? []).map((p) => ({
    id:          p.id,
    title:       p.title,
    tagline:     p.tagline     as string | null,
    description: p.description as string | null,
    price:       p.price       as number,
    image_urls:  (p.image_urls as string[]) ?? [],
    category:    p.category    as string,
    badge:       p.badge       as string | null,
    featured:    p.featured    as boolean,
    active:      p.active      as boolean,
    created_at:  p.created_at  as string,
  }))

  return <ShopAdminClient products={products} />
}
