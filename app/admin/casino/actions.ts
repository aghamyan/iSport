'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'
import type { CasinoConfig } from '@/lib/casino/types'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

export async function getCasinoAdminConfigsAction(): Promise<CasinoConfig[]> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('casino_config')
    .select('game_slug, game_name, game_type, is_active, rtp, min_bet, max_bet, jackpot_amount')
    .order('game_type, game_name')

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map(r => ({
    gameSlug:      String(r.game_slug),
    gameName:      String(r.game_name),
    gameType:      String(r.game_type) as CasinoConfig['gameType'],
    isActive:      Boolean(r.is_active),
    rtp:           Number(r.rtp),
    minBet:        Number(r.min_bet),
    maxBet:        Number(r.max_bet),
    jackpotAmount: Number(r.jackpot_amount),
  }))
}

export async function updateCasinoConfigAction(
  gameSlug:  string,
  updates:   Partial<Pick<CasinoConfig, 'isActive' | 'rtp' | 'minBet' | 'maxBet' | 'jackpotAmount'>>
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.isActive      !== undefined) payload.is_active      = updates.isActive
  if (updates.rtp           !== undefined) payload.rtp            = updates.rtp
  if (updates.minBet        !== undefined) payload.min_bet        = updates.minBet
  if (updates.maxBet        !== undefined) payload.max_bet        = updates.maxBet
  if (updates.jackpotAmount !== undefined) payload.jackpot_amount = updates.jackpotAmount

  const { error } = await supabase
    .from('casino_config')
    .update(payload)
    .eq('game_slug', gameSlug)

  if (error) throw new Error(error.message)

  await logAdminAction('update_casino_config', 'settings', undefined, { gameSlug, updates })

  revalidatePath('/admin/casino')
}

export async function getCasinoSessionsAction(limit = 50) {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('casino_sessions')
    .select(`
      id, game_slug, bet_amount, payout_multiplier, winnings, net_change, created_at,
      users!casino_sessions_player_id_fkey(name, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map(r => {
    const u = (Array.isArray(r.users) ? r.users[0] : r.users) as { name: string; avatar_url: string | null } | null
    return {
      id:               String(r.id),
      gameSlug:         String(r.game_slug),
      playerName:       u?.name ?? '?',
      avatarUrl:        u?.avatar_url ?? null,
      betAmount:        Number(r.bet_amount),
      payoutMultiplier: Number(r.payout_multiplier),
      winnings:         Number(r.winnings),
      netChange:        Number(r.net_change),
      createdAt:        String(r.created_at),
    }
  })
}
