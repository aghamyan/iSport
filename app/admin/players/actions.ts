'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

export async function createPlayerAction(formData: FormData) {
  const session = await getSession()
  requireAdmin(session)

  const name = (formData.get('name') as string)?.trim()
  if (!name) throw new Error('Player name is required')

  const rawCode = (formData.get('accessCode') as string)?.trim().toUpperCase()
  if (!rawCode) throw new Error('Access code is required')
  if (rawCode.length < 4) throw new Error('Access code must be at least 4 characters')
  if (!/^[A-Z0-9-]+$/.test(rawCode)) throw new Error('Access code may only contain letters, numbers, and dashes')

  const isAdmin  = formData.get('isAdmin') === 'true'
  const accessCode = rawCode
  const supabase = createServiceClient()

  const { data: user, error: userErr } = await supabase
    .from('users')
    .insert({ name, access_code: accessCode, is_admin: isAdmin })
    .select('id')
    .single()

  if (userErr || !user) throw new Error(userErr?.message ?? 'Failed to create user')

  const { error: playerErr } = await supabase
    .from('players')
    .insert({ id: user.id, display_name: name })

  if (playerErr) throw new Error(playerErr.message)

  await logAdminAction('create_player', 'player', user.id, { name, isAdmin })
  revalidatePath('/admin/players')
  return { accessCode }
}

export async function updatePlayerNameAction(userId: string, name: string) {
  const session = await getSession()
  requireAdmin(session)

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')

  const supabase = createServiceClient()

  const { error: userErr } = await supabase
    .from('users')
    .update({ name: trimmed })
    .eq('id', userId)

  if (userErr) throw new Error(userErr.message)

  const { error: playerErr } = await supabase
    .from('players')
    .update({ display_name: trimmed })
    .eq('id', userId)

  if (playerErr) throw new Error(playerErr.message)

  await logAdminAction('update_player_name', 'player', userId, { name: trimmed })
  revalidatePath('/admin/players')
}

export async function setPlayerActiveAction(userId: string, isActive: boolean) {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('users')
    .update({ is_active: isActive })
    .eq('id', userId)

  if (error) throw new Error(error.message)

  if (!isActive) {
    await supabase.from('sessions').delete().eq('user_id', userId)
  }

  await logAdminAction(isActive ? 'activate_player' : 'deactivate_player', 'player', userId)
  revalidatePath('/admin/players')
}

export async function setPlayerAdminAction(userId: string, isAdmin: boolean) {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('users')
    .update({ is_admin: isAdmin })
    .eq('id', userId)

  if (error) throw new Error(error.message)

  await logAdminAction(isAdmin ? 'grant_admin' : 'revoke_admin', 'player', userId)
  revalidatePath('/admin/players')
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rand = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${rand(4)}-${rand(4)}`
}

function validateCode(raw: string): string {
  const code = raw.trim().toUpperCase()
  if (!code) throw new Error('Access code is required')
  if (code.length < 4) throw new Error('Access code must be at least 4 characters')
  if (!/^[A-Z0-9-]+$/.test(code)) throw new Error('Access code may only contain letters, numbers, and dashes')
  return code
}

export async function updateAccessCodeAction(userId: string, rawCode: string) {
  const session = await getSession()
  requireAdmin(session)

  const code = validateCode(rawCode)
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('users')
    .update({ access_code: code })
    .eq('id', userId)

  if (error) throw new Error(error.message)

  await supabase.from('sessions').delete().eq('user_id', userId)

  await logAdminAction('update_access_code', 'player', userId)
  revalidatePath('/admin/players')
  return { newCode: code }
}

/**
 * Rotates the access code for a player (e.g. if it was leaked).
 * The old code is invalidated immediately; the new one is returned.
 */
export async function rotateAccessCodeAction(userId: string) {
  const session = await getSession()
  requireAdmin(session)

  const newCode = generateAccessCode()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('users')
    .update({ access_code: newCode })
    .eq('id', userId)

  if (error) throw new Error(error.message)

  await supabase.from('sessions').delete().eq('user_id', userId)

  await logAdminAction('rotate_access_code', 'player', userId)
  revalidatePath('/admin/players')
  return { newCode }
}

export async function deletePlayerAction(userId: string) {
  const session = await getSession()
  requireAdmin(session)
  if (session!.sub === userId) throw new Error('You cannot delete your own account')

  const supabase = createServiceClient()

  const { data: user } = await supabase.from('users').select('name').eq('id', userId).single()

  const { error } = await supabase.from('users').delete().eq('id', userId)

  if (error) {
    if (error.code === '23503') {
      throw new Error('Cannot delete a player who has match, championship, or rivalry history. Deactivate them instead.')
    }
    throw new Error(error.message)
  }

  await logAdminAction('delete_player', 'player', userId, { name: user?.name })
  revalidatePath('/admin/players')
}
