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

export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'RETURNED' | 'CANCELLED'
export type BetMatchType = 'friendly' | 'championship'

export type BetHistoryLeg = {
  legId:           string
  legOrder:        number
  marketId:        string
  marketType:      string
  selectedOption:  string
  selectionLabel:  string
  oddsAtPlacement: number
  currentOdds:     number | null
  oddsDelta:       number | null
  result:          'PENDING' | 'WON' | 'LOST' | 'RETURNED'
  matchId:         string | null
  matchType:       BetMatchType | null
  matchTitle:      string
  matchStatus:     string | null
  marketStatus:    string | null
  settledAt:       string | null
  reason:          string | null
}

export type BetHistoryRow = {
  betId:           string
  playerId:        string
  playerName:      string
  betType:         'SINGLE' | 'PARLAY'
  betAmount:       number
  combinedOdds:    number
  potentialWinnings:number
  actualWinnings:  number
  rakeAmount:      number
  status:          BetStatus
  placedAt:        string
  settledAt:       string | null
  adminNotes:      string | null
  legs:            BetHistoryLeg[]
  // For single bets (populated from market data)
  marketType?:     string
  selectionLabel?: string
  matchTitle?:     string
  matchType?:      BetMatchType | null
  matchStatus?:    string | null
  oddsAtPlacement?:number
  currentOdds?:    number | null
  oddsDelta?:      number | null
  cancellationReason?: string | null
  lostReason?:     string | null
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

  // Reject same-match parlays server-side (UI already warns, but server is the last line of defence)
  if (legs.length > 1) {
    const matchIds = legs.map(l => l.matchId)
    if (new Set(matchIds).size < legs.length) {
      throw new Error('Markets from the same match cannot be combined in a parlay.')
    }
  }

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

export async function getBetHistoryAction(limit?: number): Promise<BetHistoryRow[]> {
  const session = await getSession()
  if (!session) return []
  return fetchBets(session.sub, ['PENDING', 'WON', 'LOST', 'RETURNED', 'CANCELLED'], limit)
}

// ─── Shared fetch logic ───────────────────────────────────────────────────────

async function fetchBets(
  playerId: string,
  statuses: string[],
  limit?: number
): Promise<BetHistoryRow[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('bets')
    .select(`
      bet_id, player_id, bet_type, market_id, selected_option, odds_at_placement,
      bet_amount, combined_odds, potential_winnings,
      actual_winnings, rake_amount, status,
      placed_at, settled_at, admin_notes,
      player:users!bets_player_id_fkey ( name )
    `)
    .eq('player_id', playerId)
    .in('status', statuses)
    .order('placed_at', { ascending: false })

  if (limit) query = query.limit(limit)

  const { data: betsRaw, error } = await query

  if (error || !betsRaw) return []

  // Fetch parlay legs for parlay bets
  const parlayIds = betsRaw.filter(b => b.bet_type === 'PARLAY').map(b => b.bet_id)

  const legsRes = parlayIds.length > 0
    ? await supabase
        .from('parlay_legs')
        .select('leg_id, bet_id, leg_order, market_id, selected_option, odds_at_placement, result, settled_at')
        .in('bet_id', parlayIds)
        .order('leg_order', { ascending: true })
    : { data: [] as BetLegRaw[], error: null }

  const legsRaw = (legsRes.data ?? []) as BetLegRaw[]
  const allMarketIds = [...new Set([
    ...(betsRaw.map(b => b.market_id).filter(Boolean) as string[]),
    ...legsRaw.map(l => l.market_id),
  ])]

  const marketsRes = allMarketIds.length > 0
    ? await supabase
        .from('bet_markets')
        .select('market_id, market_type, options, odds, match_id, match_type, status, result')
        .in('market_id', allMarketIds)
    : { data: [] as MarketRaw[], error: null }

  const allMarkets = (marketsRes.data ?? []) as MarketRaw[]
  const marketMap = new Map(allMarkets.map(m => [m.market_id, m]))

  // Fetch match metadata for all matches referenced.
  const matchMeta = await resolveMatchMeta(allMarkets, supabase)

  // Build output
  return betsRaw.map(bet => {
    const legs: BetHistoryLeg[] = bet.bet_type === 'PARLAY'
      ? legsRaw
          .filter(l => l.bet_id === bet.bet_id)
          .map(l => buildParlayLeg(l, marketMap, matchMeta))
      : bet.market_id
        ? [buildSingleLeg(bet as RawBet, marketMap, matchMeta)]
        : []

    const primaryLeg = legs[0]
    const status = bet.status as BetStatus

    return {
      betId:             bet.bet_id,
      playerId:          bet.player_id,
      playerName:        extractJoinedName((bet as RawBet).player),
      betType:           bet.bet_type as 'SINGLE' | 'PARLAY',
      betAmount:         Number(bet.bet_amount),
      combinedOdds:      Number(bet.combined_odds),
      potentialWinnings: Number(bet.potential_winnings),
      actualWinnings:    Number(bet.actual_winnings),
      rakeAmount:        Number(bet.rake_amount),
      status,
      placedAt:          bet.placed_at,
      settledAt:         bet.settled_at,
      adminNotes:        (bet as RawBet).admin_notes ?? null,
      legs,
      marketType:        primaryLeg?.marketType,
      selectionLabel:    primaryLeg?.selectionLabel,
      matchTitle:        primaryLeg?.matchTitle,
      matchType:         primaryLeg?.matchType ?? null,
      matchStatus:       primaryLeg?.matchStatus ?? null,
      oddsAtPlacement:   primaryLeg?.oddsAtPlacement,
      currentOdds:       primaryLeg?.currentOdds ?? null,
      oddsDelta:         primaryLeg?.oddsDelta ?? null,
      cancellationReason: getCancellationReason(status, (bet as RawBet).admin_notes ?? null),
      lostReason:        getLostReason(status, legs, (bet as RawBet).admin_notes ?? null),
    }
  })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type RawBet = {
  bet_id:             string
  player_id:          string
  bet_type:           string
  market_id:          string | null
  selected_option:    string | null
  odds_at_placement:  number | null
  bet_amount:         number
  combined_odds:      number
  potential_winnings: number
  actual_winnings:    number
  rake_amount:        number
  status:             string
  placed_at:          string
  settled_at:         string | null
  admin_notes:        string | null
  player:             unknown
}

type BetLegRaw = {
  leg_id:           string
  bet_id:           string
  leg_order:        number
  market_id:        string
  selected_option:  string
  odds_at_placement:number
  result:           string
  settled_at:       string | null
}

type MarketRaw = {
  market_id:   string
  market_type: string
  options:     Record<string, { key: string; label: string }>
  odds:        Record<string, number | string>
  match_id:    string
  match_type:  BetMatchType
  status:      string
  result:      string | null
}

type MatchMeta = {
  title:       string
  matchType:   BetMatchType
  matchStatus: string | null
}

function getOptionLabel(market: MarketRaw, option: string): string {
  return market.options?.[option]?.label ?? option
}

function getOptionOdds(market: MarketRaw, option: string): number | null {
  const raw = market.odds?.[option]
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function getOddsDelta(placed: number, current: number | null): number | null {
  if (current === null) return null
  return Math.round((current - placed) * 100) / 100
}

function getWinningReason(market: MarketRaw | undefined, selectedOption: string): string | null {
  if (!market?.result) return null
  if (market.result === selectedOption) return null
  const winningLabel = getOptionLabel(market, market.result)
  return `${winningLabel} won`
}

function legResultFromBetStatus(status: string): BetHistoryLeg['result'] {
  if (status === 'WON') return 'WON'
  if (status === 'LOST') return 'LOST'
  if (status === 'RETURNED' || status === 'CANCELLED') return 'RETURNED'
  return 'PENDING'
}

function buildSingleLeg(
  bet:       RawBet,
  marketMap: Map<string, MarketRaw>,
  matchMeta: Map<string, MatchMeta>
): BetHistoryLeg {
  const market = bet.market_id ? marketMap.get(bet.market_id) : undefined
  const selectedOption = bet.selected_option ?? 'option1'
  const oddsAtPlacement = Number(bet.odds_at_placement ?? bet.combined_odds)
  const currentOdds = market ? getOptionOdds(market, selectedOption) : null
  const meta = market ? matchMeta.get(market.match_id) : undefined
  const result = legResultFromBetStatus(bet.status)

  return {
    legId:           `${bet.bet_id}:single`,
    legOrder:        1,
    marketId:        bet.market_id ?? '',
    marketType:      market?.market_type ?? 'UNKNOWN',
    selectedOption,
    selectionLabel:  market ? getOptionLabel(market, selectedOption) : selectedOption,
    oddsAtPlacement,
    currentOdds,
    oddsDelta:       getOddsDelta(oddsAtPlacement, currentOdds),
    result,
    matchId:         market?.match_id ?? null,
    matchType:       meta?.matchType ?? market?.match_type ?? null,
    matchTitle:      meta?.title ?? 'Match',
    matchStatus:     meta?.matchStatus ?? null,
    marketStatus:    market?.status ?? null,
    settledAt:       bet.settled_at,
    reason:          result === 'LOST'
      ? getWinningReason(market, selectedOption)
      : getCancellationReason(bet.status as BetStatus, bet.admin_notes),
  }
}

function buildParlayLeg(
  leg:       BetLegRaw,
  marketMap: Map<string, MarketRaw>,
  matchMeta: Map<string, MatchMeta>
): BetHistoryLeg {
  const market = marketMap.get(leg.market_id)
  const currentOdds = market ? getOptionOdds(market, leg.selected_option) : null
  const meta = market ? matchMeta.get(market.match_id) : undefined
  const oddsAtPlacement = Number(leg.odds_at_placement)

  return {
    legId:           leg.leg_id,
    legOrder:        leg.leg_order,
    marketId:        leg.market_id,
    marketType:      market?.market_type ?? 'UNKNOWN',
    selectedOption:  leg.selected_option,
    selectionLabel:  market ? getOptionLabel(market, leg.selected_option) : leg.selected_option,
    oddsAtPlacement,
    currentOdds,
    oddsDelta:       getOddsDelta(oddsAtPlacement, currentOdds),
    result:          leg.result as BetHistoryLeg['result'],
    matchId:         market?.match_id ?? null,
    matchType:       meta?.matchType ?? market?.match_type ?? null,
    matchTitle:      meta?.title ?? 'Match',
    matchStatus:     meta?.matchStatus ?? null,
    marketStatus:    market?.status ?? null,
    settledAt:       leg.settled_at,
    reason:          leg.result === 'LOST'
      ? getWinningReason(market, leg.selected_option)
      : leg.result === 'RETURNED'
        ? 'Selection returned'
        : null,
  }
}

async function resolveMatchMeta(
  markets:  MarketRaw[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<Map<string, MatchMeta>> {
  if (!markets.length) return new Map()

  const friendlyIds = [...new Set(markets
    .filter(m => m.match_type === 'friendly')
    .map(m => m.match_id))]
  const championshipIds = [...new Set(markets
    .filter(m => m.match_type === 'championship')
    .map(m => m.match_id))]

  const [fmRes, cmRes] = await Promise.all([
    friendlyIds.length > 0
      ? supabase
          .from('friendly_matches')
          .select('id, status, home:players!home_player_id(display_name), away:players!away_player_id(display_name)')
          .in('id', friendlyIds)
      : { data: [] as MatchMetaRaw[], error: null },
    championshipIds.length > 0
      ? supabase
          .from('championship_matches')
          .select('id, status, home:players!home_player_id(display_name), away:players!away_player_id(display_name)')
          .in('id', championshipIds)
      : { data: [] as MatchMetaRaw[], error: null },
  ])

  const result = new Map<string, MatchMeta>()

  for (const row of ((fmRes.data ?? []) as MatchMetaRaw[])) {
    result.set(row.id, {
      title: `${extractJoinedName(row.home)} vs ${extractJoinedName(row.away)}`,
      matchType: 'friendly',
      matchStatus: row.status ?? null,
    })
  }

  for (const row of ((cmRes.data ?? []) as MatchMetaRaw[])) {
    result.set(row.id, {
      title: `${extractJoinedName(row.home)} vs ${extractJoinedName(row.away)}`,
      matchType: 'championship',
      matchStatus: row.status ?? null,
    })
  }

  return result
}

type MatchMetaRaw = {
  id:     string
  status: string | null
  home:   unknown
  away:   unknown
}

function extractJoinedName(val: unknown): string {
  if (Array.isArray(val) && val.length > 0) {
    const item = val[0] as { name?: string; display_name?: string } | undefined
    return item?.display_name ?? item?.name ?? '?'
  }
  if (val && typeof val === 'object') {
    const item = val as { name?: string; display_name?: string }
    return item.display_name ?? item.name ?? '?'
  }
  return '?'
}

function getCancellationReason(status: BetStatus, adminNotes: string | null): string | null {
  if (status !== 'RETURNED' && status !== 'CANCELLED') return null
  if (adminNotes?.trim()) return adminNotes.trim()
  return status === 'RETURNED' ? 'Bet returned' : 'Bet cancelled'
}

function getLostReason(
  status:     BetStatus,
  legs:       BetHistoryLeg[],
  adminNotes: string | null
): string | null {
  if (status !== 'LOST') return null
  if (adminNotes?.trim()) return adminNotes.trim()
  return legs.find(l => l.reason)?.reason ?? 'Bet lost'
}

function mapBetError(msg: string): string {
  if (msg.includes('Insufficient balance'))  return 'Insufficient balance to place this bet.'
  if (msg.includes('not open'))              return 'Betting is closed for one of the selected markets.'
  if (msg.includes('not found'))             return 'One of the selected markets no longer exists.'
  if (msg.includes('at least 2'))            return 'Parlay requires at least 2 selections.'
  if (msg.includes('Invalid option'))        return 'Invalid selection — please refresh and try again.'
  return msg
}
