import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Service-role client — bypasses RLS entirely.
 * Use ONLY for:
 *   1. Login: looking up access_code before a session exists
 *   2. Sessions table: insert on login, delete on logout
 * Using this for user writes silently disables the prevent_late_edit trigger
 * and all RLS write policies (auth.uid() is NULL under service role).
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * User-context client — passes the session JWT in Authorization header.
 * auth.uid() resolves to the logged-in user's UUID inside RLS policies
 * and the prevent_late_edit trigger. Use this for ALL user-initiated
 * reads and writes.
 */
export function createUserClient(jwt: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }
  )
}

/**
 * Convenience: reads the session cookie and returns an authenticated client,
 * or null if there is no session. Use in Server Components and Server Actions.
 */
export async function getAuthedClient(): Promise<SupabaseClient | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-session')?.value
  if (!token) return null
  return createUserClient(token)
}
