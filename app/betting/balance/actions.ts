'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'
import {
  getTransactionHistoryAdmin,
  getBalanceStats,
  type TransactionRow,
  type BalanceStats,
} from '@/lib/betting/balance'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

// ─── Admin: manual credit / debit ────────────────────────────────────────────

export async function adminAdjustBalanceAction(
  playerId: string,
  amount: number,     // positive = add, negative = remove
  reason: string
): Promise<{ newBalance: number }> {
  const session = await getSession()
  requireAdmin(session)

  if (!reason.trim()) throw new Error('Reason is required')
  if (amount === 0)   throw new Error('Amount cannot be zero')

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('admin_adjust_balance', {
    p_player_id: playerId,
    p_amount:    amount,
    p_reason:    reason.trim(),
    p_admin_id:  session!.sub,
  })

  if (error) throw new Error(error.message)

  await logAdminAction(
    amount > 0 ? 'balance_credit' : 'balance_debit',
    'player',
    playerId,
    { amount, reason: reason.trim() }
  )

  revalidatePath('/admin/balances')
  revalidatePath(`/players/${playerId}`)
  return { newBalance: Number(data) }
}

// ─── Admin: reset single player ───────────────────────────────────────────────

export async function adminResetBalanceAction(
  playerId: string,
  target = 10000
): Promise<{ newBalance: number }> {
  const session = await getSession()
  requireAdmin(session)

  if (target < 0) throw new Error('Target balance cannot be negative')

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('admin_reset_balance', {
    p_player_id: playerId,
    p_target:    target,
    p_admin_id:  session!.sub,
  })

  if (error) throw new Error(error.message)

  await logAdminAction('balance_reset', 'player', playerId, { target })

  revalidatePath('/admin/balances')
  revalidatePath(`/players/${playerId}`)
  return { newBalance: Number(data) }
}

// ─── Admin: bulk reset all active players ────────────────────────────────────

export async function adminBulkResetAction(
  target = 10000
): Promise<{ playersAffected: number }> {
  const session = await getSession()
  requireAdmin(session)

  if (target < 0) throw new Error('Target balance cannot be negative')

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('admin_bulk_reset', {
    p_target:   target,
    p_admin_id: session!.sub,
  })

  if (error) throw new Error(error.message)

  await logAdminAction('balance_bulk_reset', 'settings', undefined, { target, count: data })

  revalidatePath('/admin/balances')
  return { playersAffected: Number(data) }
}

// ─── Admin: fetch transaction history for any player ─────────────────────────

export async function fetchPlayerTransactionsAction(
  playerId: string,
  limit = 20
): Promise<TransactionRow[]> {
  const session = await getSession()
  requireAdmin(session)
  return getTransactionHistoryAdmin(playerId, limit)
}

// ─── Admin: house stats ───────────────────────────────────────────────────────

export async function fetchBalanceStatsAction(): Promise<BalanceStats | null> {
  const session = await getSession()
  requireAdmin(session)
  return getBalanceStats()
}

// ─── Admin: suspend / unsuspend a player ─────────────────────────────────────

export async function adminToggleSuspendAction(
  playerId:  string,
  suspended: boolean
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('users')
    .update({ is_active: !suspended })
    .eq('id', playerId)

  if (error) throw new Error(error.message)

  await logAdminAction(
    suspended ? 'unsuspend_player' : 'suspend_player',
    'player',
    playerId
  )

  revalidatePath('/admin/balances')
}

// ─── Player: ensure own balance row exists (call on first login) ──────────────

export async function ensurePlayerBalanceAction(): Promise<void> {
  const session = await getSession()
  if (!session) return

  const supabase = createServiceClient()

  // The SQL trigger fn_init_player_balance handles new users automatically,
  // but this covers any edge case where the trigger was missed.
  await supabase.from('player_balances').upsert(
    { player_id: session.sub },
    { onConflict: 'player_id', ignoreDuplicates: true }
  )
}
