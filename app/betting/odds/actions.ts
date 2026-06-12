'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { logAdminAction } from '@/lib/admin/activityLog'
import {
  getSettlementReport,
  getSettlementReportByPlayer,
  getSettlementAuditReport,
  getSettlementErrorReport,
  getBetOverrideAudit,
  settleMatchBets,
  cancelMatchBets,
  finalizeDueMatches,
  retryFailedSettlements,
  type SettlementSummary,
  type SettlementPlayerRow,
  type SettlementAuditRow,
  type SettlementErrorRow,
  type MatchSettlementResult,
  type MatchCancellationResult,
  type DueFinalizationResult,
  type RetrySettlementResult,
  type OverrideAuditRow,
} from '@/lib/betting/settlement'
import {
  generateMatchMarkets,
  fetchLeagueAvgGoals,
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

  // Fetch player display names for readable market labels
  const supabase = createServiceClient()
  const { data: playerRows } = await supabase
    .from('players')
    .select('id, display_name')
    .in('id', [homePlayerId, awayPlayerId])

  const nameMap  = new Map((playerRows ?? []).map(p => [p.id, p.display_name as string | null]))
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

  revalidatePath('/betting')
  revalidatePath('/admin/betting')
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

  const { data: playerRows } = await supabase
    .from('players')
    .select('id, display_name')
    .in('id', [homePlayerId, awayPlayerId])

  const nameMap  = new Map((playerRows ?? []).map(p => [p.id, p.display_name as string | null]))
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

  revalidatePath('/betting')
  revalidatePath('/admin/betting')
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
  winningOption: string,
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

// ─── Settle a full match from its final score ────────────────────────────────

export async function settleMatchBetsAction(
  matchId:   string,
  matchType: 'friendly' | 'championship'
): Promise<MatchSettlementResult> {
  const session = await getSession()
  requireAdmin(session)

  const result = await settleMatchBets(matchId, matchType, session!.sub)

  await logAdminAction('settle_match_bets', 'match', matchId, {
    matchType,
    betsAffected: result.betsAffected,
    failedCount: result.failedCount,
  })

  revalidatePath('/admin/betting')
  revalidatePath('/admin/reports')
  revalidatePath('/admin/balances')
  revalidatePath(`/${matchType === 'championship' ? 'championships' : 'matches'}/${matchId}`)

  return result
}

// ─── Cancel every market on a match and refund pending bets ──────────────────

export async function cancelMatchBetsAction(
  matchId:   string,
  matchType: 'friendly' | 'championship',
  reason:    string
): Promise<MatchCancellationResult> {
  const session = await getSession()
  requireAdmin(session)

  if (!reason.trim()) throw new Error('Cancellation reason is required')

  const result = await cancelMatchBets(matchId, matchType, session!.sub, reason.trim())

  await logAdminAction('cancel_match_bets', 'match', matchId, {
    matchType,
    reason,
    betsRefunded: result.betsRefunded,
    failedCount: result.failedCount,
  })

  revalidatePath('/admin/betting')
  revalidatePath('/admin/reports')
  revalidatePath('/admin/balances')
  revalidatePath(`/${matchType === 'championship' ? 'championships' : 'matches'}/${matchId}`)

  return result
}

// ─── Finalize confirmed matches whose 4-hour window has elapsed ─────────────

export async function finalizeDueMatchesAction(): Promise<DueFinalizationResult> {
  const session = await getSession()
  requireAdmin(session)

  const result = await finalizeDueMatches(session!.sub)

  await logAdminAction('finalize_due_matches', 'match', undefined, result)

  revalidatePath('/admin/matches')
  revalidatePath('/admin/championships')
  revalidatePath('/admin/betting')
  revalidatePath('/admin/reports')
  revalidatePath('/admin/balances')

  return result
}

// ─── Retry failed settlement jobs ────────────────────────────────────────────

export async function retryFailedSettlementsAction(limit = 20): Promise<RetrySettlementResult> {
  const session = await getSession()
  requireAdmin(session)

  const result = await retryFailedSettlements(session!.sub, limit)

  await logAdminAction('retry_failed_settlements', 'match', undefined, result)

  revalidatePath('/admin/reports')
  revalidatePath('/admin/balances')

  return result
}

// ─── Settlement report ─────────────────────────────────────────────────────────

export async function getSettlementReportAction(
  from?: Date,
  to?:   Date
): Promise<{
  summary: SettlementSummary | null
  players: SettlementPlayerRow[]
  audits:  SettlementAuditRow[]
  errors:  SettlementErrorRow[]
}> {
  const session = await getSession()
  requireAdmin(session)

  const [summary, players, audits, errors] = await Promise.all([
    getSettlementReport(from, to),
    getSettlementReportByPlayer(from, to),
    getSettlementAuditReport(from, to),
    getSettlementErrorReport(100),
  ])
  return { summary, players, audits, errors }
}

// ─── Override audit log ────────────────────────────────────────────────────────

export async function getBetOverrideAuditAction(limit = 50): Promise<OverrideAuditRow[]> {
  const session = await getSession()
  requireAdmin(session)

  return getBetOverrideAudit(limit)
}

// ─── Backfill markets for existing pending championship matches ───────────────

export type BackfillResult = {
  total:     number
  generated: number
  skipped:   number
  failed:    number
}

/**
 * Generates bet_markets for all pending/confirmed championship matches that
 * currently have no markets. Idempotent — safe to run multiple times.
 */
export async function backfillChampionshipMarketsAction(): Promise<BackfillResult> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  // Fetch all pending/confirmed championship matches
  const { data: matches, error } = await supabase
    .from('championship_matches')
    .select(`
      id, home_player_id, away_player_id,
      home:players!home_player_id(display_name),
      away:players!away_player_id(display_name)
    `)
    .in('status', ['pending', 'confirmed'])

  if (error) throw new Error(error.message)
  if (!matches || matches.length === 0) return { total: 0, generated: 0, skipped: 0, failed: 0 }

  // Find matches that already have at least one market
  const allIds = matches.map(m => m.id)
  const { data: existingMarkets } = await supabase
    .from('bet_markets')
    .select('match_id')
    .in('match_id', allIds)
    .neq('status', 'CANCELLED')

  const alreadyHasMarkets = new Set((existingMarkets ?? []).map(m => m.match_id))
  const toGenerate = matches.filter(m => !alreadyHasMarkets.has(m.id))

  if (toGenerate.length === 0) {
    return { total: matches.length, generated: 0, skipped: matches.length, failed: 0 }
  }

  // Compute league average once for the whole batch
  const leagueAvg = await fetchLeagueAvgGoals()

  function extractName(val: unknown): string {
    if (!val) return '?'
    if (Array.isArray(val)) return (val[0] as { display_name?: string })?.display_name ?? '?'
    return (val as { display_name?: string }).display_name ?? '?'
  }

  let generated = 0
  let failed    = 0

  const CHUNK = 5
  for (let i = 0; i < toGenerate.length; i += CHUNK) {
    const chunk = toGenerate.slice(i, i + CHUNK)
    const results = await Promise.allSettled(
      chunk.map(m =>
        generateMatchMarkets(
          m.id, 'championship',
          m.home_player_id, m.away_player_id,
          extractName(m.home),
          extractName(m.away),
          session!.sub,
          leagueAvg
        )
      )
    )
    for (const r of results) {
      if (r.status === 'fulfilled') generated++
      else failed++
    }
  }

  await logAdminAction('backfill_championship_markets', 'match', undefined, {
    total: toGenerate.length, generated, failed,
  })

  revalidatePath('/betting')
  revalidatePath('/admin/betting')

  return {
    total:     matches.length,
    generated,
    skipped:   alreadyHasMarkets.size,
    failed,
  }
}
