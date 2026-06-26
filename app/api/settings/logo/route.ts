import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'logo_url')
      .single()

    const url = data ? String(data.value).replace(/^"|"$/g, '') : null
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ url: null })
  }
}
