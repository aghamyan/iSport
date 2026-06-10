'use client'

import { createClient } from '@supabase/supabase-js'

// Browser-side anon client — only for reads (RLS: select policies are public)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default supabase
