'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import type { SlipLeg } from '@/lib/betting/validation'
import { computeSlipSummary } from '@/lib/betting/validation'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlaceBetResult = {
  betId:          string
  betType:        'SINGLE' | 'PARLAY'
  actualWinnings: number
  combinedOdds:   number
  rake:           number
  newBalance:     number
}

export type BetHistoryLeg = {
  legId:          string
  legOrder:       number
  marketId:       string
  marketType:     string
  selectedOption: string
  selectionLabel: string
  oddsAtPlacement:number
  result:         'PENDING' | 'WON' | 'LOST' | 'RETURNED'
  matchTitle:     string
}

export type BetHistoryRow = {
  betId:           string
  betType:         'SINGLE' | 'PARLAY'
  betAmount:       number
  combinedOdds:    number
  potentialWinnings:number
  actualWinnings:  number
  rakeAmount:      number
  status:          string
  placedAt:        string
  settledAt:       string | null
  legs:            BetHistoryLeg[]
  // For single bets (populated from market data)
  marketType?:     string
  selectionLabel?: string
  matchTitle?:     string
}

// ─── Place bet ────────────────────────────────────────────────────────────────

export async function placeBetAction(
  legs:   SlipLeg[],
  amount: number
): Promise<PlaceBetResult> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (legs.length === 0) throw new Error('No selections in bet slip')
  if (amount <= 0)       throw new Error('Invalid bet amount')

  const supabase   = createServiceClient()
  const betType    = legs.length === 1 ? 'SINGLE' : 'PARLAY'
  const summary    = computeSlipSummary(legs, amount)

  let betId: string

  if (betType === 'SINGLE') {
    const leg = legs[0]
    const { data, error } = await supabase.rpc('place_bet', {
      p_player_id:       session.sub,
      p_bet_type:        'SINGLE',
      p_bet_amount:      amount,
      p_market_id:       leg.marketId,
      p_selected_option: leg.selectedOption,
    })
    if (error) throw new Error(mapBetError(error.message))
    betId = data as string
  } else {
    const parlayLegs = legs.map(l => ({
      market_id:       l.marketId,
      selected_option: l.selectedOption,
    }))
    const { data, error } = await supabase.rpc('place_bet', {
      p_player_id:  session.sub,
      p_bet_type:   'PARLAY',
      p_bet_amount: amount,
      p_legs:       parlayLegs,
    })
    if (error) throw new Error(mapBetError(error.message))
    betId = data as string
  }

  // Fetch updated balance
  const { data: balRow } = await supabase
    .from('player_balances')
    .select('current_balance')
    .eq('player_id', session.sub)
    .single()

  revalidatePath('/')
  revalidatePath('/players/' + session.sub)

  return {
    betId,
    betType:        summary.betType,
    actualWinnings: summary.actualWinnings,
    combinedOdds:   summary.combinedOdds,
    rake:           summary.rake,
    newBalance:     Number(balRow?.current_balance ?? 0),
  }
}

// ─── Get active bets (PENDING) ────────────────────────────────────────────────

export async function getActiveBetsAction(): Promise<BetHistoryRow[]> {
  const session = await getSession()
  if (!session) return []
  return fetchBets(session.sub, ['PENDING'])
}

// ─── Get bet history (all statuses) ──────────────────────────────────────────

export async function getBetHistoryAction(limit = 20): Promise<BetHistoryRow[]> {
  const session = await getSession()
  if (!session) return []
  return fetchBets(session.sub, ['PENDING', 'WON', 'LOST', 'RETURNED', 'CANCELLED'], limit)
}

// ─── Shared fetch logic ───────────────────────────────────────────────────────

async function fetchBets(
  playerId: string,
  statuses: string[],
  limit = 50
): Promise<BetHistoryRow[]> {
  const supabase = createServiceClient()

  const { data: betsRaw, error } = await supabase
    .from('bets')
    .select(`
      bet_id, bet_type, market_id, selected_option,
      bet_amount, combined_odds, potential_winnings,
      actual_winnings, rake_amount, status,
      placed_at, settled_at
    `)
    .eq('player_id', playerId)
    .in('status', statuses)
    .order('placed_at', { ascending: false })
    .limit(limit)

  if (error || !betsRaw) return []

  // Fetch parlay legs for parlay bets
  const parlayIds = betsRaw.filter(b => b.bet_type === 'PARLAY').map(b => b.bet_id)

  const [legsRes, marketsRes] = await Promise.all([
    parlayIds.length > 0
      ? supabase
          .from('parlay_legs')
          .select('leg_id, bet_id, leg_order, market_id, selected_option, odds_at_placement, result')
          .in('bet_id', parlayIds)
          .order('leg_order', { ascending: true })
      : { data: [] as BetLegRaw[], error: null },

    // Fetch market metadata for both single + parlay bets
    (() => {
      const allMarketIds = [
        ...betsRaw.map(b => b.market_id).filter(Boolean),
        // will add parlay leg market IDs after legs are fetched
      ] as string[]
      return allMarketIds.length > 0
        ? supabase
            .from('bet_markets')
            .select('market_id, market_type, options, match_id, match_type')
            .in('market_id', allMarketIds)
        : { data: [] as MarketRaw[], error: null }
    })(),
  ])

  // Second pass: collect leg market IDs
  const legMarketIds = ((legsRes.data ?? []) as BetLegRaw[]).map(l => l.market_id)
  const extraMarkets = legMarketIds.length > 0
    ? (await supabase
        .from('bet_markets')
        .select('market_id, market_type, options, match_id, match_type')
        .in('market_id', legMarketIds)).data ?? []
    : []

  const allMarkets = [
    ...((marketsRes.data ?? []) as MarketRaw[]),
    ...(extraMarkets as MarketRaw[]),
  ]
  const marketMap = new Map(allMarkets.map(m => [m.market_id, m]))

  // Fetch match titles for all matches referenced
  const matchIds = [...new Set(allMarkets.map(m => m.match_id))]
  const matchTitles = await resolveMatchTitles(matchIds, supabase)

  // Build output
  return betsRaw.map(bet => {
    const legs: BetHistoryLeg[] = bet.bet_type === 'PARLAY'
      ? ((legsRes.data ?? []) as BetLegRaw[])
          .filter(l => l.bet_id === bet.bet_id)
          .map(l => buildLeg(l, marketMap, matchTitles))
      : []

    // For single bets, extract market info
    let marketType: string | undefined
    let selectionLabel: string | undefined
    let matchTitle: string | undefined

    if (bet.bet_type === 'SINGLE' && bet.market_id) {
      const m = marketMap.get(bet.market_id)
      if (m) {
        marketType     = m.market_type
        selectionLabel = getOptionLabel(m, bet.selected_option ?? 'option1')
        matchTitle     = matchTitles.get(m.match_id) ?? 'Match'
      }
    }

    return {
      betId:             bet.bet_id,
      betType:           bet.bet_type as 'SINGLE' | 'PARLAY',
      betAmount:         Number(bet.bet_amount),
      combinedOdds:      Number(bet.combined_odds),
      potentialWinnings: Number(bet.potential_winnings),
      actualWinnings:    Number(bet.actual_winnings),
      rakeAmount:        Number(bet.rake_amount),
      status:            bet.status,
      placedAt:          bet.placed_at,
      settledAt:         bet.settled_at,
      legs,
      marketType,
      selectionLabel,
      matchTitle,
    }
  })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type BetLegRaw = {
  leg_id:           string
  bet_id:           string
  leg_order:        number
  market_id:        string
  selected_option:  string
  odds_at_placement:number
  result:           string
}

type MarketRaw = {
  market_id:   string
  market_type: string
  options:     Record<string, { key: string; label: string }>
  match_id:    string
  match_type:  string
}

function getOptionLabel(market: MarketRaw, option: string): string {
  return market.options?.[option]?.label ?? option
}

function buildLeg(
  leg:         BetLegRaw,
  marketMap:   Map<string, MarketRaw>,
  matchTitles: Map<string, string>
): BetHistoryLeg {
  const market = marketMap.get(leg.market_id)
  return {
    legId:           leg.leg_id,
    legOrder:        leg.leg_order,
    marketId:        leg.market_id,
    marketType:      market?.market_type ?? 'UNKNOWN',
    selectedOption:  leg.selected_option,
    selectionLabel:  market ? getOptionLabel(market, leg.selected_option) : leg.selected_option,
    oddsAtPlacement: Number(leg.odds_at_placement),
    result:          leg.result as BetHistoryLeg['result'],
    matchTitle:      market ? (matchTitles.get(market.match_id) ?? 'Match') : 'Match',
  }
}

// Fetches match titles (Player A vs Player B) for a set of match IDs.
// Tries friendly_matches first, then championship_matches.
async function resolveMatchTitles(
  matchIds: string[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<Map<string, string>> {
  if (!matchIds.length) return new Map()

  const [fmRes, cmRes] = await Promise.all([
    supabase
      .from('friendly_matches')
      .select('id, home_player_id, away_player_id, users!friendly_matches_home_player_id_fkey(name), users!friendly_matches_away_player_id_fkey(name)')
      .in('id', matchIds),
    supabase
      .from('championship_matches')
      .select('id, home_player_id, away_player_id, users!championship_matches_home_player_id_fkey(name), users!championship_matches_away_player_id_fkey(name)')
      .in('id', matchIds),
  ])

  const result = new Map<string, string>()

  type MatchRow = {
    id: string
    home_player_id: string
    away_player_id: string
    [key: string]: unknown
  }

  for (const row of ([...(fmRes.data ?? []), ...(cmRes.data ?? [])] as MatchRow[])) {
    // The joined user names come back as nested objects — flatten heuristically
    const raw = row as Record<string, unknown>
    // Supabase returns aliased joins under the relation name
    const homeName = extractName(raw, 'home')
    const awayName = extractName(raw, 'away')
    result.set(row.id, `${homeName} vs ${awayName}`)
  }

  return result
}

function extractName(row: Record<string, unknown>, side: 'home' | 'away'): string {
  // Supabase may return 'users' as array for multi-join; check common patterns
  const candidates = [
    `users!friendly_matches_${side}_player_id_fkey`,
    `users!championship_matches_${side}_player_id_fkey`,
    'users',
  ]
  for (const key of candidates) {
    const val = row[key]
    if (Array.isArray(val) && val.length > 0) return (val[0] as { name: string }).name ?? '?'
    if (val && typeof val === 'object' && 'name' in (val as object))
      return (val as { name: string }).name ?? '?'
  }
  return '?'
}

function mapBetError(msg: string): string {
  if (msg.includes('Insufficient balance'))  return 'Insufficient balance to place this bet.'
  if (msg.includes('not open'))              return 'Betting is closed for one of the selected markets.'
  if (msg.includes('not found'))             return 'One of the selected markets no longer exists.'
  if (msg.includes('at least 2'))            return 'Parlay requires at least 2 selections.'
  if (msg.includes('Invalid option'))        return 'Invalid selection — please refresh and try again.'
  return msg
}
