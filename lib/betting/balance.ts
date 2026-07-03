import { createServiceClient } from '@/lib/supabase/server'
import { getAuthedClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BalanceRecord = {
  playerId: string
  currentBalance: number
  initialBalance: number
  totalRakePaid: number
  lastUpdated: string
}

export type TransactionRow = {
  txId: string
  txType: TxType
  amount: number
  balanceBefore: number
  balanceAfter: number
  referenceId: string | null
  description: string
  createdAt: string
}

export type TxType =
  | 'BET_PLACED'
  | 'BET_WON'
  | 'BET_RETURNED'
  | 'BET_CANCELLED'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'ADMIN_RESET'
  | 'CASINO_BET'
  | 'CASINO_WIN'

export type PlayerBalanceSummary = BalanceRecord & {
  playerName: string
  avatarUrl: string | null
  isActive: boolean
}

export type BalanceStats = {
  totalPlayers: number
  totalBalances: number
  totalInPlay: number
  totalRakeCollected: number
  totalPaidOut: number
  avgBalance: number
  minBalance: number
  maxBalance: number
}

// ─── Player queries (user-context) ───────────────────────────────────────────

/** Own balance — readable via RLS with the session JWT. */
export async function getPlayerBalance(playerId: string): Promise<BalanceRecord | null> {
  const client = await getAuthedClient()
  if (!client) return null

  const { data, error } = await client
    .from('player_balances')
    .select('player_id, current_balance, initial_balance, total_rake_paid, last_updated')
    .eq('player_id', playerId)
    .single()

  if (error || !data) return null

  return {
    playerId:       data.player_id,
    currentBalance: Number(data.current_balance),
    initialBalance: Number(data.initial_balance),
    totalRakePaid:  Number(data.total_rake_paid),
    lastUpdated:    data.last_updated,
  }
}

/** Last N transactions for the logged-in player. */
export async function getTransactionHistory(
  playerId: string,
  limit = 10
): Promise<TransactionRow[]> {
  const client = await getAuthedClient()
  if (!client) return []

  const { data, error } = await client
    .from('balance_transactions')
    .select('tx_id, tx_type, amount, balance_before, balance_after, reference_id, description, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map(row => ({
    txId:          row.tx_id,
    txType:        row.tx_type as TxType,
    amount:        Number(row.amount),
    balanceBefore: Number(row.balance_before),
    balanceAfter:  Number(row.balance_after),
    referenceId:   row.reference_id,
    description:   row.description,
    createdAt:     row.created_at,
  }))
}

// ─── Admin queries (service role) ────────────────────────────────────────────

/** All players with their current balances — admin only. */
export async function getAllPlayerBalances(): Promise<PlayerBalanceSummary[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('player_balances')
    .select(`
      player_id, current_balance, initial_balance, total_rake_paid, last_updated,
      users!inner ( name, avatar_url, is_active )
    `)
    .order('current_balance', { ascending: false })

  if (error || !data) return []

  return data.map(row => {
    const u = (Array.isArray(row.users) ? row.users[0] : row.users) as { name: string; avatar_url: string | null; is_active: boolean }
    return {
      playerId:       row.player_id,
      currentBalance: Number(row.current_balance),
      initialBalance: Number(row.initial_balance),
      totalRakePaid:  Number(row.total_rake_paid),
      lastUpdated:    row.last_updated,
      playerName:     u.name,
      avatarUrl:      u.avatar_url,
      isActive:       u.is_active,
    }
  })
}

/** Transaction history for any player — admin only. */
export async function getTransactionHistoryAdmin(
  playerId: string,
  limit = 20
): Promise<TransactionRow[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('balance_transactions')
    .select('tx_id, tx_type, amount, balance_before, balance_after, reference_id, description, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map(row => ({
    txId:          row.tx_id,
    txType:        row.tx_type as TxType,
    amount:        Number(row.amount),
    balanceBefore: Number(row.balance_before),
    balanceAfter:  Number(row.balance_after),
    referenceId:   row.reference_id,
    description:   row.description,
    createdAt:     row.created_at,
  }))
}

/** House analytics. */
export async function getBalanceStats(): Promise<BalanceStats | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('get_balance_stats')
  if (error || !data || !data[0]) return null

  const r = data[0]
  return {
    totalPlayers:        Number(r.total_players),
    totalBalances:       Number(r.total_balances),
    totalInPlay:         Number(r.total_in_play),
    totalRakeCollected:  Number(r.total_rake_collected),
    totalPaidOut:        Number(r.total_paid_out),
    avgBalance:          Number(r.avg_balance),
    minBalance:          Number(r.min_balance),
    maxBalance:          Number(r.max_balance),
  }
}
