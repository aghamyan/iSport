import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BetNotification = {
  notifId:   string
  betId:     string
  betStatus: 'WON' | 'LOST' | 'RETURNED' | 'CANCELLED'
  message:   string
  /** Positive = credit (WON / RETURNED); negative = loss magnitude (LOST) */
  amount:    number
  isRead:    boolean
  createdAt: string
}

export type OverrideAuditRow = {
  auditId:      string
  betId:        string
  playerName:   string
  adminName:    string
  oldStatus:    string
  newStatus:    string
  reason:       string
  balanceDelta: number
  overriddenAt: string
}

export type SettlementSummary = {
  period: { from: string; to: string }
  summary: {
    totalBets:        number
    totalWon:         number
    totalLost:        number
    totalReturned:    number
    totalCancelled:   number
    /** actual_winnings credited on WON bets */
    totalPayout:      number
    /** rake collected on WON bets */
    totalRake:        number
    /** stakes returned on RETURNED + CANCELLED bets */
    totalRefunded:    number
    /** stakes kept (house profit) on LOST bets */
    totalStakesLost:  number
    biggestWin:       number | null
    biggestBet:       number | null
  }
  byType: {
    single: { count: number; won: number; lost: number }
    parlay: { count: number; won: number; lost: number }
  }
}

export type SettlementPlayerRow = {
  playerId:     string
  playerName:   string
  betsPlaced:   number
  betsWon:      number
  betsLost:     number
  betsReturned: number
  totalStaked:  number
  /** actual_winnings received on WON bets */
  totalWon:     number
  totalRake:    number
  /** totalWon − stakes lost (refunded bets are neutral) */
  netResult:    number
}

export type MatchSettlementResult = {
  auditId: string | null
  matchId: string
  matchType: 'friendly' | 'championship'
  result: Record<string, unknown>
  marketsSettled: number
  marketsSkipped: number
  failedCount: number
  betsAffected: number
  totalStaked: number
  totalWinningsPaid: number
  totalRakeCollected: number
}

export type MatchCancellationResult = {
  auditId: string | null
  betsRefunded: number
  totalRefunded: number
  failedCount: number
}

export type DueFinalizationResult = {
  friendlyFinalized: number
  championshipFinalized: number
  totalFinalized: number
}

export type RetrySettlementResult = {
  attempted: number
  resolved: number
  failed: number
}

export type SettlementAuditRow = {
  auditId: string
  matchId: string
  matchType: 'friendly' | 'championship'
  result: Record<string, unknown>
  marketsSettled: number
  marketsSkipped: number
  failedCount: number
  betsAffected: number
  totalStaked: number
  totalWinningsPaid: number
  totalRakeCollected: number
  settlementStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CANCELLED'
  notes: string | null
  createdAt: string
}

export type SettlementErrorRow = {
  errorId: string
  auditId: string | null
  matchId: string
  matchType: 'friendly' | 'championship'
  marketId: string | null
  betId: string | null
  errorMessage: string
  retryCount: number
  lastRetryAt: string | null
  resolvedAt: string | null
  createdAt: string
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export async function getPlayerNotifications(
  playerId:  string,
  unreadOnly = false,
  limit      = 20
): Promise<BetNotification[]> {
  const supabase = createServiceClient()

  let q = supabase
    .from('bet_notifications')
    .select('notif_id, bet_id, bet_status, message, amount, is_read, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) q = q.eq('is_read', false)

  const { data, error } = await q
  if (error || !data) return []

  return data.map(r => ({
    notifId:   r.notif_id,
    betId:     r.bet_id,
    betStatus: r.bet_status as BetNotification['betStatus'],
    message:   r.message,
    amount:    Number(r.amount),
    isRead:    r.is_read,
    createdAt: r.created_at,
  }))
}

/**
 * Mark one notification read (pass notifId) or all unread ones (omit notifId).
 */
export async function markNotificationsRead(
  playerId: string,
  notifId?: string
): Promise<void> {
  const supabase = createServiceClient()
  let q = supabase
    .from('bet_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('player_id', playerId)

  if (notifId) q = q.eq('notif_id', notifId)
  else         q = q.eq('is_read', false)

  await q
}

export async function getUnreadNotificationCount(playerId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('bet_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('is_read', false)
  return count ?? 0
}

// ─── Settlement reports (admin) ───────────────────────────────────────────────

export async function getSettlementReport(
  from?: Date,
  to?:   Date
): Promise<SettlementSummary | null> {
  const supabase = createServiceClient()
  const p_from = (from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString()
  const p_to   = (to   ?? new Date()).toISOString()

  const { data, error } = await supabase.rpc('get_settlement_report', { p_from, p_to })
  if (error || !data) return null

  const d = data as Record<string, unknown>
  const s = d.summary  as Record<string, unknown>
  const t = d.by_type  as Record<string, Record<string, unknown>>

  return {
    period: { from: p_from, to: p_to },
    summary: {
      totalBets:       Number(s.total_bets        ?? 0),
      totalWon:        Number(s.total_won         ?? 0),
      totalLost:       Number(s.total_lost        ?? 0),
      totalReturned:   Number(s.total_returned    ?? 0),
      totalCancelled:  Number(s.total_cancelled   ?? 0),
      totalPayout:     Number(s.total_payout      ?? 0),
      totalRake:       Number(s.total_rake        ?? 0),
      totalRefunded:   Number(s.total_refunded    ?? 0),
      totalStakesLost: Number(s.total_stakes_lost ?? 0),
      biggestWin:      s.biggest_win != null ? Number(s.biggest_win) : null,
      biggestBet:      s.biggest_bet != null ? Number(s.biggest_bet) : null,
    },
    byType: {
      single: {
        count: Number(t.single?.count ?? 0),
        won:   Number(t.single?.won   ?? 0),
        lost:  Number(t.single?.lost  ?? 0),
      },
      parlay: {
        count: Number(t.parlay?.count ?? 0),
        won:   Number(t.parlay?.won   ?? 0),
        lost:  Number(t.parlay?.lost  ?? 0),
      },
    },
  }
}

export async function getSettlementReportByPlayer(
  from?: Date,
  to?:   Date
): Promise<SettlementPlayerRow[]> {
  const supabase = createServiceClient()
  const p_from = (from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString()
  const p_to   = (to   ?? new Date()).toISOString()

  const { data, error } = await supabase.rpc('get_settlement_report_by_player', { p_from, p_to })
  if (error || !data) return []

  return (data as Record<string, unknown>[]).map(r => ({
    playerId:     String(r.player_id),
    playerName:   String(r.player_name),
    betsPlaced:   Number(r.bets_placed),
    betsWon:      Number(r.bets_won),
    betsLost:     Number(r.bets_lost),
    betsReturned: Number(r.bets_returned),
    totalStaked:  Number(r.total_staked),
    totalWon:     Number(r.total_won),
    totalRake:    Number(r.total_rake),
    netResult:    Number(r.net_result),
  }))
}

// ─── Match settlement workflow (admin/system) ────────────────────────────────

export async function settleMatchBets(
  matchId: string,
  matchType: 'friendly' | 'championship',
  adminId: string | null = null
): Promise<MatchSettlementResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('settle_match_bets', {
    p_match_id:   matchId,
    p_match_type: matchType,
    p_admin_id:   adminId,
  })
  if (error) throw new Error(error.message)

  return mapMatchSettlementResult(data as Record<string, unknown>)
}

export async function cancelMatchBets(
  matchId: string,
  matchType: 'friendly' | 'championship',
  adminId: string,
  reason: string
): Promise<MatchCancellationResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('cancel_match_bets', {
    p_match_id:   matchId,
    p_match_type: matchType,
    p_admin_id:   adminId,
    p_reason:     reason,
  })
  if (error) {
    if (!isMissingRpcError(error)) throw new Error(error.message)
    await cancelMatchBetsWithoutRpc(matchId, matchType, adminId)
    return { auditId: null, betsRefunded: 0, totalRefunded: 0, failedCount: 0 }
  }

  const d = (data ?? {}) as Record<string, unknown>
  return {
    auditId:       d.audit_id != null ? String(d.audit_id) : null,
    betsRefunded:  Number(d.bets_refunded ?? 0),
    totalRefunded: Number(d.total_refunded ?? 0),
    failedCount:   Number(d.failed_count ?? 0),
  }
}

function isMissingRpcError(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST202' || /function .*cancel_match_bets|Could not find the function/i.test(error.message ?? '')
}

function isMissingBettingTableError(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(error.message ?? '')
}

async function cancelMatchBetsWithoutRpc(
  matchId: string,
  matchType: 'friendly' | 'championship',
  adminId: string
): Promise<void> {
  const supabase = createServiceClient()

  const { data: markets, error: marketsError } = await supabase
    .from('bet_markets')
    .select('market_id')
    .eq('match_id', matchId)
    .eq('match_type', matchType)

  if (marketsError) {
    if (isMissingBettingTableError(marketsError)) return
    throw new Error(marketsError.message)
  }

  const marketIds = (markets ?? [])
    .map((m) => String((m as { market_id?: unknown }).market_id ?? ''))
    .filter(Boolean)

  if (marketIds.length > 0) {
    const { count: singleCount, error: singleError } = await supabase
      .from('bets')
      .select('bet_id', { count: 'exact', head: true })
      .in('market_id', marketIds)
      .eq('status', 'PENDING')

    if (singleError) {
      if (!isMissingBettingTableError(singleError)) throw new Error(singleError.message)
    } else if ((singleCount ?? 0) > 0) {
      throw new Error('Cannot delete match while pending bets exist. Apply the betting workflow patch so bets can be refunded automatically.')
    }

    const { data: parlayLegs, error: parlayError } = await supabase
      .from('parlay_legs')
      .select('bet_id')
      .in('market_id', marketIds)
      .limit(1000)

    if (parlayError) {
      if (!isMissingBettingTableError(parlayError)) throw new Error(parlayError.message)
    } else {
      const parlayBetIds = [...new Set((parlayLegs ?? [])
        .map((leg) => String((leg as { bet_id?: unknown }).bet_id ?? ''))
        .filter(Boolean))]

      if (parlayBetIds.length > 0) {
        const { count: parlayCount, error: parlayBetError } = await supabase
          .from('bets')
          .select('bet_id', { count: 'exact', head: true })
          .in('bet_id', parlayBetIds)
          .eq('status', 'PENDING')

        if (parlayBetError) {
          if (!isMissingBettingTableError(parlayBetError)) throw new Error(parlayBetError.message)
        } else if ((parlayCount ?? 0) > 0) {
          throw new Error('Cannot delete match while pending parlay bets exist. Apply the betting workflow patch so bets can be refunded automatically.')
        }
      }
    }
  }

  const { error: updateError } = await supabase
    .from('bet_markets')
    .update({
      status:     'CANCELLED',
      settled_at: new Date().toISOString(),
      settled_by: adminId,
    })
    .eq('match_id', matchId)
    .eq('match_type', matchType)
    .in('status', ['OPEN', 'LOCKED'])

  if (updateError && !isMissingBettingTableError(updateError)) {
    throw new Error(updateError.message)
  }
}

export async function finalizeDueMatches(
  adminId: string | null = null
): Promise<DueFinalizationResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('finalize_due_matches', {
    p_admin_id: adminId,
  })
  if (error) throw new Error(error.message)

  const d = (data ?? {}) as Record<string, unknown>
  return {
    friendlyFinalized:     Number(d.friendly_finalized ?? 0),
    championshipFinalized: Number(d.championship_finalized ?? 0),
    totalFinalized:        Number(d.total_finalized ?? 0),
  }
}

export async function retryFailedSettlements(
  adminId: string,
  limit = 20
): Promise<RetrySettlementResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('retry_failed_settlements', {
    p_admin_id: adminId,
    p_limit:    limit,
  })
  if (error) throw new Error(error.message)

  const d = (data ?? {}) as Record<string, unknown>
  return {
    attempted: Number(d.attempted ?? 0),
    resolved:  Number(d.resolved  ?? 0),
    failed:    Number(d.failed    ?? 0),
  }
}

export async function getSettlementAuditReport(
  from?: Date,
  to?: Date
): Promise<SettlementAuditRow[]> {
  const supabase = createServiceClient()
  const p_from = (from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString()
  const p_to   = (to   ?? new Date()).toISOString()

  const { data, error } = await supabase.rpc('get_settlement_audit_report', { p_from, p_to })
  if (error || !data) return []

  return (data as Record<string, unknown>[]).map(mapSettlementAuditRow)
}

export async function getSettlementErrorReport(limit = 100): Promise<SettlementErrorRow[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('get_settlement_error_report', { p_limit: limit })
  if (error || !data) return []

  return (data as Record<string, unknown>[]).map(r => ({
    errorId:      String(r.error_id),
    auditId:      r.audit_id != null ? String(r.audit_id) : null,
    matchId:      String(r.match_id),
    matchType:    String(r.match_type) as SettlementErrorRow['matchType'],
    marketId:     r.market_id != null ? String(r.market_id) : null,
    betId:        r.bet_id != null ? String(r.bet_id) : null,
    errorMessage: String(r.error_message ?? ''),
    retryCount:   Number(r.retry_count ?? 0),
    lastRetryAt:  r.last_retry_at != null ? String(r.last_retry_at) : null,
    resolvedAt:   r.resolved_at != null ? String(r.resolved_at) : null,
    createdAt:    String(r.created_at),
  }))
}

// ─── Override audit log (admin) ───────────────────────────────────────────────

export async function getBetOverrideAudit(limit = 50): Promise<OverrideAuditRow[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('bet_override_audit')
    .select(`
      audit_id, bet_id, old_status, new_status, reason, balance_delta, overridden_at,
      player:users!bet_override_audit_player_id_fkey ( name ),
      admin:users!bet_override_audit_admin_id_fkey   ( name )
    `)
    .order('overridden_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  function extractName(val: unknown): string {
    if (Array.isArray(val)) return (val[0] as { name: string })?.name ?? '?'
    return (val as { name?: string })?.name ?? '?'
  }

  type Raw = {
    audit_id:      string
    bet_id:        string
    old_status:    string
    new_status:    string
    reason:        string
    balance_delta: number
    overridden_at: string
    player:        unknown
    admin:         unknown
  }

  return (data as Raw[]).map(r => ({
    auditId:      r.audit_id,
    betId:        r.bet_id,
    playerName:   extractName(r.player),
    adminName:    extractName(r.admin),
    oldStatus:    r.old_status,
    newStatus:    r.new_status,
    reason:       r.reason,
    balanceDelta: Number(r.balance_delta),
    overriddenAt: r.overridden_at,
  }))
}

function mapMatchSettlementResult(d: Record<string, unknown>): MatchSettlementResult {
  return {
    auditId:             d.audit_id != null ? String(d.audit_id) : null,
    matchId:             String(d.match_id),
    matchType:           String(d.match_type) as MatchSettlementResult['matchType'],
    result:              (d.result ?? {}) as Record<string, unknown>,
    marketsSettled:      Number(d.markets_settled ?? 0),
    marketsSkipped:      Number(d.markets_skipped ?? 0),
    failedCount:         Number(d.failed_count ?? 0),
    betsAffected:        Number(d.bets_affected ?? 0),
    totalStaked:         Number(d.total_staked ?? 0),
    totalWinningsPaid:   Number(d.total_winnings_paid ?? 0),
    totalRakeCollected:  Number(d.total_rake_collected ?? 0),
  }
}

function mapSettlementAuditRow(r: Record<string, unknown>): SettlementAuditRow {
  return {
    auditId:             String(r.audit_id),
    matchId:             String(r.match_id),
    matchType:           String(r.match_type) as SettlementAuditRow['matchType'],
    result:              (r.result ?? {}) as Record<string, unknown>,
    marketsSettled:      Number(r.markets_settled ?? 0),
    marketsSkipped:      Number(r.markets_skipped ?? 0),
    failedCount:         Number(r.failed_count ?? 0),
    betsAffected:        Number(r.bets_affected ?? 0),
    totalStaked:         Number(r.total_staked ?? 0),
    totalWinningsPaid:   Number(r.total_winnings_paid ?? 0),
    totalRakeCollected:  Number(r.total_rake_collected ?? 0),
    settlementStatus:    String(r.settlement_status ?? 'SUCCESS') as SettlementAuditRow['settlementStatus'],
    notes:               r.notes != null ? String(r.notes) : null,
    createdAt:           String(r.created_at),
  }
}
