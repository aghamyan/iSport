'use server'

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { createSession, deleteSession, getSession } from '@/lib/auth/session'

export type LoginState = { error: string } | null

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = formData.get('accessCode')
  if (typeof raw !== 'string' || !raw.trim()) {
    return { error: 'Access code is required' }
  }

  // Normalise: trim + uppercase so admin-created codes always match
  const accessCode = raw.trim().toUpperCase()
  const supabase = createServiceClient()

  const { data: user, error } = await supabase
    .from('users')
    .select('id, is_admin, is_active')
    .eq('access_code', accessCode)
    .single()

  if (error || !user) {
    return { error: 'Invalid access code' }
  }

  if (!user.is_active) {
    return { error: 'This access code has been deactivated' }
  }

  // Persist session record for admin-forced-logout support
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({ user_id: user.id })
    .select('id')
    .single()

  if (sessionErr || !session) {
    return { error: 'Could not create session — try again' }
  }

  await createSession(user.id, user.is_admin, session.id)

  redirect('/welcome')
}

export async function logoutAction() {
  const currentSession = await getSession()

  if (currentSession?.sessionId) {
    // Delete from DB so admin-forced-logout and audit queries stay clean
    const supabase = createServiceClient()
    await supabase.from('sessions').delete().eq('id', currentSession.sessionId)
  }

  await deleteSession()
  redirect('/login')
}
