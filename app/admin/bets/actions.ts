'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/admin/activityLog'
import { revalidatePath } from 'next/cache'

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminBetRow = {
  betId:             string
  playerId:          string
  playerName:        string
  betType:           'SINGLE' | 'PARLAY'
  betAmount:         number
  combinedOdds:      number
  potentialWinnings: number
  actualWinnings:    number
  rakeAmount:        number
  status:            string
  placedAt:          string
  settledAt:         string | null
  matchTitle:        string
  marketType:        string
  selectionLabel:    string
  legCount:          number
}

export type BetStatusFilter = 'ALL' | 'PENDING' | 'WON' | 'LOST' | 'RETURNED' | 'CANCELLED'

// ─── Fetch all bets (admin) ───────────────────────────────────────────────────

export async function getAdminAllBetsAction(
  statusFilter: BetStatusFilter = 'ALL',
  limit = 200
): Promise<AdminBetRow[]> {
  const session = await getSession()
  requireAdmin(session)

  const supabase = createServiceClient()

  type RawBet = {
    bet_id:             string
    player_id:          string
    bet_type:           string
    market_id:          string | null
    selected_option:    string | null
    bet_amount:         number
    combined_odds:      number
    potential_winnings: number
    actual_winnings:    number
    rake_amount:        number
    status:             string
    placed_at:          string
    settled_at:         string | null
    users:              unknown
  }

  let q = supabase
    .from('bets')
    .select(`
      bet_id, player_id, bet_type, market_id, selected_option,
      bet_amount, combined_odds, potential_winnings, actual_winnings,
      rake_amount, status, placed_at, settled_at,
      users!bets_player_id_fkey ( name )
    `)
    .order('placed_at', { ascending: false })
    .limit(limit)

  if (statusFilter !== 'ALL') q = q.eq('status', statusFilter)

  const { data: betsRaw, error } = await q
  if (error || !betsRaw) return []

  const bets = betsRaw as RawBet[]

  // Collect single-bet market IDs and parlay bet IDs
  const singleMarketIds = bets
    .filter(b => b.bet_type === 'SINGLE' && b.market_id)
    .map(b => b.market_id as string)

  const parlayIds = bets
    .filter(b => b.bet_type === 'PARLAY')
    .map(b => b.bet_id)

  type MarketRaw = {
    market_id:   string
    market_type: string
    options:     Record<string, { key: string; label: string }>
    match_id:    string
    match_type:  string
  }

  const [marketsRes, legsRes] = await Promise.all([
    singleMarketIds.length > 0
      ? supabase
          .from('bet_markets')
          .select('market_id, market_type, options, match_id, match_type')
          .in('market_id', singleMarketIds)
      : Promise.resolve({ data: [] as MarketRaw[] }),
    parlayIds.length > 0
      ? supabase
          .from('parlay_legs')
          .select('bet_id')
          .in('bet_id', parlayIds)
      : Promise.resolve({ data: [] as { bet_id: string }[] }),
  ])

  const marketMap = new Map(
    ((marketsRes.data ?? []) as MarketRaw[]).map(m => [m.market_id, m])
  )

  const legCounts = new Map<string, number>()
  for (const leg of (legsRes.data ?? []) as { bet_id: string }[]) {
    legCounts.set(leg.bet_id, (legCounts.get(leg.bet_id) ?? 0) + 1)
  }

  const matchIds = [...new Set(((marketsRes.data ?? []) as MarketRaw[]).map(m => m.match_id))]
  const matchTitles = await resolveMatchTitles(matchIds, supabase)

  return bets.map(bet => {
    const playerName = extractName(bet.users)
    const market     = bet.market_id ? marketMap.get(bet.market_id) : undefined
    const legs       = legCounts.get(bet.bet_id) ?? 0

    let matchTitle     = 'Unknown Match'
    let marketType     = bet.bet_type === 'PARLAY' ? 'PARLAY' : 'UNKNOWN'
    let selectionLabel = ''

    if (market) {
      matchTitle     = matchTitles.get(market.match_id) ?? 'Match'
      marketType     = market.market_type
      selectionLabel = bet.selected_option
        ? (market.options[bet.selected_option]?.label ?? bet.selected_option)
        : ''
    }

    if (bet.bet_type === 'PARLAY') {
      matchTitle = `Parlay (${legs} legs)`
    }

    return {
      betId:             bet.bet_id,
      playerId:          bet.player_id,
      playerName,
      betType:           bet.bet_type as 'SINGLE' | 'PARLAY',
      betAmount:         Number(bet.bet_amount),
      combinedOdds:      Number(bet.combined_odds),
      potentialWinnings: Number(bet.potential_winnings),
      actualWinnings:    Number(bet.actual_winnings),
      rakeAmount:        Number(bet.rake_amount),
      status:            bet.status,
      placedAt:          bet.placed_at,
      settledAt:         bet.settled_at,
      matchTitle,
      marketType,
      selectionLabel,
      legCount:          legs,
    }
  })
}

// ─── Cancel a PENDING bet (refund) ────────────────────────────────────────────

export async function adminCancelPendingBetAction(
  betId:  string,
  reason: string
): Promise<void> {
  const session = await getSession()
  requireAdmin(session)

  if (!reason.trim()) throw new Error('Reason is required')

  const supabase = createServiceClient()

  const { data: bet } = await supabase
    .from('bets')
    .select('status')
    .eq('bet_id', betId)
    .single()

  if (!bet) throw new Error('Bet not found')
  if (bet.status !== 'PENDING')
    throw new Error('Only PENDING bets can be cancelled here. Use Override for settled bets.')

  const { error } = await supabase.rpc('settle_bet', {
    p_bet_id:  betId,
    p_outcome: 'CANCELLED',
    p_admin_id: session!.sub,
    p_notes:   reason.trim(),
  })

  if (error) throw new Error(error.message)

  await logAdminAction('cancel_bet', 'match', betId, { reason })

  revalidatePath('/admin/bets')
  revalidatePath('/admin/balances')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractName(users: unknown): string {
  if (Array.isArray(users) && users.length > 0)
    return (users[0] as { name: string }).name ?? '?'
  if (users && typeof users === 'object' && 'name' in (users as object))
    return (users as { name: string }).name ?? '?'
  return '?'
}

async function resolveMatchTitles(
  matchIds: string[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<Map<string, string>> {
  if (!matchIds.length) return new Map()

  const [fmRes, cmRes] = await Promise.all([
    supabase
      .from('friendly_matches')
      .select('id, home:players!home_player_id(display_name), away:players!away_player_id(display_name)')
      .in('id', matchIds),
    supabase
      .from('championship_matches')
      .select('id, home:players!home_player_id(display_name), away:players!away_player_id(display_name)')
      .in('id', matchIds),
  ])

  const result = new Map<string, string>()
  const getName = (v: unknown): string => {
    if (Array.isArray(v)) {
      const item = v[0] as { name?: string; display_name?: string } | undefined
      return item?.display_name ?? item?.name ?? '?'
    }
    const item = v as { name?: string; display_name?: string }
    return item?.display_name ?? item?.name ?? '?'
  }

  type MatchRow = { id: string; home: unknown; away: unknown }
  for (const row of ([...(fmRes.data ?? []), ...(cmRes.data ?? [])] as MatchRow[])) {
    result.set(row.id, `${getName(row.home)} vs ${getName(row.away)}`)
  }
  return result
}
