'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { logAdminAction } from '@/lib/admin/activityLog'
import {
  getSettlementReport,
  getSettlementReportByPlayer,
  getBetOverrideAudit,
  type SettlementSummary,
  type SettlementPlayerRow,
  type OverrideAuditRow,
} from '@/lib/betting/settlement'
import {
  generateMatchMarkets,
  applyAdminOddsOverride,
  revertToAiOdds,
  createCustomPropMarket,
  getMatchMarkets,
  type GenerateMarketsResult,
  type MarketRow,
} from '@/lib/odds/markets'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

// ─── Generate all standard markets for a match ───────────────────────────────

/**
 * Called by admin when creating a friendly or championship match.
 * Creates 5 standard markets (1X2, O/U, Handicap, BTTS, Exact Score)
 * populated with AI-calculated odds.
 */
export async function generateMatchMarketsAction(
  matchId:      string,
  matchType:    'friendly' | 'championship',
  homePlayerId: string,
  awayPlayerId: string
): Promise<GenerateMarketsResult> {
  const session = await getSession()
  requireAdmin(session)

  // Fetch player names for readable market labels
  const supabase = createServiceClient()
  const { data: players } = await supabase
    .from('users')
    .select('id, name')
    .in('id', [homePlayerId, awayPlayerId])

  const nameMap  = new Map((players ?? []).map(p => [p.id, p.name]))
  const homeName = nameMap.get(homePlayerId) ?? 'Home'
  const awayName = nameMap.get(awayPlayerId) ?? 'Away'

  const result = await generateMatchMarkets(
    matchId, matchType,
    homePlayerId, awayPlayerId,
    homeName, awayName,
    session!.sub
  )

  await logAdminAction('generate_markets', 'match', matchId, {
    marketsCreated: result.markets.filter(m => m.success).length,
    confidence:     result.fullOdds.confidence.score,
  })

  revalidatePath(`/admin/matches`)
  revalidatePath(`/${matchType === 'championship' ? 'championships' : 'matches'}/${matchId}`)

  return result
}

// ─── Refresh odds for an existing match ──────────────────────────────────────

/**
 * Recalculates and updates all OPEN markets for a match.
 * Skips markets where admin_override = true.
 */
export async function refreshMatchMarketsAction(
  matchId:      string,
  matchType:    'friendly' | 'championship',
  homePlayerId: string,
  awayPlayerId: string
): Promise<{ refreshed: number; skipped: number }> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  // Delete existing non-overridden markets and regenerate
  await supabase
    .from('bet_markets')
    .delete()
    .eq('match_id',   matchId)
    .eq('match_type', matchType)
    .eq('status',     'OPEN')
    .eq('admin_override', false)

  const { data: players } = await supabase
    .from('users')
    .select('id, name')
    .in('id', [homePlayerId, awayPlayerId])

  const nameMap  = new Map((players ?? []).map(p => [p.id, p.name]))
  const homeName = nameMap.get(homePlayerId) ?? 'Home'
  const awayName = nameMap.get(awayPlayerId) ?? 'Away'

  const result = await generateMatchMarkets(
    matchId, matchType,
    homePlayerId, awayPlayerId,
    homeName, awayName,
    session!.sub
  )

  const succeeded = result.markets.filter(m => m.success).length
  const failed    = result.markets.filter(m => !m.success).length

  await logAdminAction('refresh_markets', 'match', matchId, { succeeded, failed })

  revalidatePath(`/${matchType === 'championship' ? 'championships' : 'matches'}/${matchId}`)

  return { refreshed: succeeded, skipped: failed }
}

// ─── Admin odds override ──────────────────────────────────────────────────────

export async function adminOverrideOddsAction(
  marketId: string,
  newOdds:  Record<string, number>,
  reason:   string
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  if (!reason.trim()) throw new Error('Override reason is required')

  // Basic validation: all odds must be > 1.0
  for (const [key, odd] of Object.entries(newOdds)) {
    if (odd <= 1.0) throw new Error(`Invalid odds for ${key}: must be greater than 1.0`)
  }

  await applyAdminOddsOverride(marketId, newOdds, session!.sub)

  await logAdminAction('override_odds', 'match', marketId, { newOdds, reason })

  revalidatePath('/admin/matches')
}

// ─── Revert to AI odds ────────────────────────────────────────────────────────

export async function revertToAiOddsAction(marketId: string): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  await revertToAiOdds(marketId)

  await logAdminAction('revert_ai_odds', 'match', marketId)

  revalidatePath('/admin/matches')
}

// ─── Lock / unlock a market ───────────────────────────────────────────────────

export async function setMarketStatusAction(
  marketId: string,
  status:   'OPEN' | 'LOCKED'
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  await supabase
    .from('bet_markets')
    .update({
      status,
      ...(status === 'LOCKED'   ? { locked_at:   now } : {}),
      ...(status === 'OPEN'     ? { unlocked_at: now } : {}),
    })
    .eq('market_id', marketId)

  await logAdminAction(status === 'LOCKED' ? 'lock_market' : 'unlock_market', 'match', marketId)

  revalidatePath('/admin/matches')
}

// ─── Create a custom prop market ─────────────────────────────────────────────

export async function createCustomPropAction(
  matchId:     string,
  matchType:   'friendly' | 'championship',
  description: string,
  options:     { label: string }[],
  customOdds?: number[]
): Promise<{ marketId: string }> {
  const session = await getSession()
  requireAdmin(session)

  if (!description.trim()) throw new Error('Description is required')
  if (options.length < 2 || options.length > 3)
    throw new Error('Custom prop requires 2 or 3 options')

  const marketId = await createCustomPropMarket(
    matchId, matchType, description, options, session!.sub, customOdds
  )

  await logAdminAction('create_custom_prop', 'match', matchId, { description, marketId })

  revalidatePath(`/${matchType === 'championship' ? 'championships' : 'matches'}/${matchId}`)

  return { marketId }
}

// ─── Get all markets for a match (for display) ───────────────────────────────

export async function getMatchMarketsAction(
  matchId:   string,
  matchType: 'friendly' | 'championship'
): Promise<MarketRow[]> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  return getMatchMarkets(matchId, matchType)
}

// ─── Settle a full market (admin picks winner) ───────────────────────────────

export async function settleMarketAction(
  marketId:      string,
  winningOption: 'option1' | 'option2' | 'option3',
  matchId:       string,
  matchType:     'friendly' | 'championship'
): Promise<{ betsSettled: number }> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('settle_market', {
    p_market_id:      marketId,
    p_winning_option: winningOption,
    p_admin_id:       session!.sub,
  })

  if (error) throw new Error(error.message)

  await logAdminAction('settle_market', 'match', marketId, {
    winningOption,
    betsSettled: data,
  })

  revalidatePath(`/${matchType === 'championship' ? 'championships' : 'matches'}/${matchId}`)
  revalidatePath('/admin/balances')

  return { betsSettled: Number(data) }
}

// ─── Cancel a market (RETURNED — refunds all bets) ────────────────────────────
//
// Edge case: market voided mid-stream (e.g. technical issue, abandoned match).
// Single bets → RETURNED (full refund).
// Parlay bets → affected leg set to RETURNED; parlay resolved per partial-return
// logic (fn_resolve_parlay): remaining WON legs recalculate odds, all-RETURNED
// legs → full refund.
//
// Draw handling: a draw result is NOT a cancellation.  Use settleMarketAction
// with winningOption='option2' instead.
//
export async function cancelMarketAction(
  marketId:  string,
  matchId:   string,
  matchType: 'friendly' | 'championship',
  reason:    string
): Promise<{ betsRefunded: number }> {
  const session = await getSession()
  requireAdmin(session)

  if (!reason.trim()) throw new Error('Cancellation reason is required')

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('cancel_market', {
    p_market_id: marketId,
    p_admin_id:  session!.sub,
    p_reason:    reason,
  })
  if (error) throw new Error(error.message)

  await logAdminAction('cancel_market', 'match', marketId, { reason, betsRefunded: data })

  revalidatePath('/admin/betting')
  revalidatePath('/admin/balances')
  revalidatePath(`/${matchType === 'championship' ? 'championships' : 'matches'}/${matchId}`)

  return { betsRefunded: Number(data) }
}

// ─── Admin override a settled bet ─────────────────────────────────────────────
//
// Reverses the old settlement effect and applies a new one atomically.
// Blocked if the bet was settled more than overrideWindowHours ago (default 24).
// Blocked if the reversal would push the player's balance below zero — use
// adminAdjustBalanceAction first, then retry.
//
export async function adminOverrideBetAction(
  betId:               string,
  newStatus:           'WON' | 'LOST' | 'RETURNED',
  reason:              string,
  overrideWindowHours  = 24
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  if (!reason.trim()) throw new Error('Override reason is required')

  const supabase = createServiceClient()
  const { error } = await supabase.rpc('admin_override_bet', {
    p_bet_id:         betId,
    p_new_status:     newStatus,
    p_admin_id:       session!.sub,
    p_reason:         reason,
    p_override_hours: overrideWindowHours,
  })
  if (error) throw new Error(error.message)

  await logAdminAction('override_bet', 'match', betId, { newStatus, reason })

  revalidatePath('/admin/betting')
  revalidatePath('/admin/balances')
}

// ─── Settlement report ─────────────────────────────────────────────────────────

export async function getSettlementReportAction(
  from?: Date,
  to?:   Date
): Promise<{ summary: SettlementSummary | null; players: SettlementPlayerRow[] }> {
  const session = await getSession()
  requireAdmin(session)

  const [summary, players] = await Promise.all([
    getSettlementReport(from, to),
    getSettlementReportByPlayer(from, to),
  ])
  return { summary, players }
}

// ─── Override audit log ────────────────────────────────────────────────────────

export async function getBetOverrideAuditAction(limit = 50): Promise<OverrideAuditRow[]> {
  const session = await getSession()
  requireAdmin(session)

  return getBetOverrideAudit(limit)
}
