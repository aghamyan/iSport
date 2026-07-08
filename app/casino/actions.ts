'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { computeSpin, BASE_SYMBOLS, makePlayerSymbols } from '@/lib/casino/slotGames'
import { calculateRoulettePayout, effectiveMultiplier } from '@/lib/casino/roulette'
import { isReservedAdminName } from '@/lib/players'
import type {
  SlotSymbol, SpinResult, RouletteBet, RouletteResult,
  CasinoLeaderboardEntry, CasinoPlayerStats, CasinoConfig,
} from '@/lib/casino/types'

// ─── Get available symbols (base + player avatars) ────────────────────────────

async function getSlotSymbols(): Promise<SlotSymbol[]> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('users')
    .select('id, name, avatar_url')
    .eq('is_active', true)
    .not('avatar_url', 'is', null)

  const rows = (data ?? []).filter((u) => !isReservedAdminName(u.name as string))
  const playerAvatars = rows.map(u => u.avatar_url as string | null)
  const playerNames   = rows.map(u => u.name as string)
  const playerSymbols = makePlayerSymbols(playerAvatars, playerNames)

  return [...BASE_SYMBOLS.map(s => ({ ...s, imageUrl: undefined })), ...playerSymbols] as SlotSymbol[]
}

// ─── Get casino config for a game ────────────────────────────────────────────

async function getGameConfig(gameSlug: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('casino_config')
    .select('game_slug, is_active, rtp, min_bet, max_bet, jackpot_amount')
    .eq('game_slug', gameSlug)
    .single()

  return data
}

// ─── Spin Action ─────────────────────────────────────────────────────────────

export type SpinActionResult = {
  spin:       SpinResult
  newBalance: number
  sessionId:  string
  winnings:   number
  netChange:  number
}

export async function playCasinoSpinAction(
  gameSlug:  string,
  betAmount: number
): Promise<SpinActionResult> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  if (betAmount <= 0) throw new Error('Invalid bet amount')

  const gameConfig = await getGameConfig(gameSlug)
  if (!gameConfig) throw new Error('Game not found')
  if (!gameConfig.is_active) throw new Error('This game is currently unavailable')
  if (betAmount < gameConfig.min_bet) throw new Error(`Minimum bet is ${gameConfig.min_bet}`)
  if (betAmount > gameConfig.max_bet) throw new Error(`Maximum bet is ${gameConfig.max_bet}`)

  // Server-side: fetch symbols and compute outcome
  const symbols = await getSlotSymbols()
  const spin    = computeSpin(symbols, betAmount)

  // Determine final multiplier (capped at jackpot level to protect house)
  const payoutMultiplier = Math.min(spin.payoutMultiplier, 1000)

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('casino_play', {
    p_player_id:          session.sub,
    p_game_slug:          gameSlug,
    p_bet_amount:         betAmount,
    p_payout_multiplier:  payoutMultiplier,
    p_game_data: {
      reel_stops:  spin.reelStops,
      paylines:    spin.paylines,
      symbol_ids:  symbols.map(s => s.id),
    },
  })

  if (error) throw new Error(mapCasinoError(error.message))

  const result = data as {
    session_id:  string
    new_balance: number
    winnings:    number
    net_change:  number
  }

  // Return the pre-computed spin result (server authority)
  return {
    spin:       { ...spin, payoutMultiplier },
    newBalance: Number(result.new_balance),
    sessionId:  result.session_id,
    winnings:   Number(result.winnings),
    netChange:  Number(result.net_change),
  }
}

// ─── Roulette Action ──────────────────────────────────────────────────────────

export type RouletteActionResult = {
  result:     RouletteResult
  newBalance: number
  sessionId:  string
}

export async function playCasinoRouletteAction(
  bets: RouletteBet[]
): Promise<RouletteActionResult> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  if (!bets.length) throw new Error('No bets placed')

  const totalBet = bets.reduce((s, b) => s + b.amount, 0)
  if (totalBet <= 0) throw new Error('Invalid bet amount')

  const gameConfig = await getGameConfig('european-roulette')
  if (!gameConfig?.is_active) throw new Error('Roulette is currently unavailable')
  if (totalBet < gameConfig.min_bet) throw new Error(`Minimum total bet is ${gameConfig.min_bet}`)
  if (totalBet > gameConfig.max_bet) throw new Error(`Maximum total bet is ${gameConfig.max_bet}`)

  // Server-side RNG for winning number
  const winningNumber = Math.floor(Math.random() * 37)   // 0-36

  // Compute payout
  const result     = calculateRoulettePayout(bets, winningNumber)
  const multiplier = effectiveMultiplier(result)

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('casino_play', {
    p_player_id:          session.sub,
    p_game_slug:          'european-roulette',
    p_bet_amount:         totalBet,
    p_payout_multiplier:  multiplier,
    p_game_data: {
      winning_number: winningNumber,
      bets:           bets,
      payout:         result.totalPayout,
    },
  })

  if (error) throw new Error(mapCasinoError(error.message))

  const raw = data as { session_id: string; new_balance: number }

  return {
    result,
    newBalance: Number(raw.new_balance),
    sessionId:  raw.session_id,
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getCasinoLeaderboardAction(limit = 20): Promise<CasinoLeaderboardEntry[]> {
  const session = await getSession()
  if (!session) return []

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('casino_leaderboard')
    .select('*')
    .limit(limit)

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map(row => ({
    id:               String(row.id),
    playerId:         String(row.player_id),
    playerName:       String(row.player_name),
    avatarUrl:        (row.avatar_url as string | null) ?? null,
    gameSlug:         String(row.game_slug),
    gameName:         String(row.game_name),
    betAmount:        Number(row.bet_amount),
    winnings:         Number(row.winnings),
    payoutMultiplier: Number(row.payout_multiplier),
    netChange:        Number(row.net_change),
    createdAt:        String(row.created_at),
  }))
}

// ─── Player stats ─────────────────────────────────────────────────────────────

export async function getPlayerCasinoStatsAction(
  targetPlayerId?: string
): Promise<CasinoPlayerStats | null> {
  const session = await getSession()
  if (!session) return null

  const playerId = targetPlayerId ?? session.sub

  // Non-admins can only see their own stats
  if (playerId !== session.sub && !session.isAdmin) return null

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('casino_player_stats', {
    p_player_id: playerId,
  })

  if (error || !data) return null

  const r = data as Record<string, unknown>
  return {
    gamesPlayed:  Number(r.games_played ?? 0),
    totalWagered: Number(r.total_wagered ?? 0),
    totalWon:     Number(r.total_won ?? 0),
    totalLost:    Number(r.total_lost ?? 0),
    netChange:    Number(r.net_change ?? 0),
    biggestWin:   Number(r.biggest_win ?? 0),
    biggestMulti: Number(r.biggest_multi ?? 0),
    winCount:     Number(r.win_count ?? 0),
    lossCount:    Number(r.loss_count ?? 0),
    jackpotsWon:  Number(r.jackpots_won ?? 0),
    favoriteGame: (r.favorite_game as string | null) ?? null,
  }
}

// ─── All configs ──────────────────────────────────────────────────────────────

export async function getCasinoConfigsAction(): Promise<CasinoConfig[]> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('casino_config')
    .select('game_slug, game_name, game_type, is_active, rtp, min_bet, max_bet, jackpot_amount')
    .order('game_slug')

  if (!data) return []

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

// ─── Get slot symbols for client ──────────────────────────────────────────────

export async function getSlotSymbolsAction(): Promise<SlotSymbol[]> {
  const session = await getSession()
  if (!session) return []
  return getSlotSymbols()
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapCasinoError(msg: string): string {
  if (msg.includes('Insufficient balance')) return 'Insufficient balance.'
  if (msg.includes('unavailable'))         return 'This game is currently unavailable.'
  if (msg.includes('minimum'))             return msg
  if (msg.includes('maximum'))             return msg
  return msg
}

