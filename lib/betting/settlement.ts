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
