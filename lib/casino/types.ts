// ─── Shared casino types ───────────────────────────────────────────────────────

export type GameType = 'slot' | 'roulette' | 'dice' | 'blackjack'
export type GameStatus = 'active' | 'coming_soon' | 'disabled'

// ─── Slot ─────────────────────────────────────────────────────────────────────

export type SlotVolatility = 'low' | 'medium' | 'high' | 'very_high'

export type SlotGame = {
  slug:          string
  name:          string
  tagline:       string
  rtp:           number        // e.g. 96.5
  volatility:    SlotVolatility
  minBet:        number
  maxBet:        number
  jackpot:       number
  status:        GameStatus
  theme:         string        // color gradient string
  accentColor:   string
  symbolCount:   number        // unique non-player symbols
}

export type SlotSymbol = {
  id:         string
  label:      string
  emoji:      string
  imageUrl?:  string           // player avatar URL
  isPlayer:   boolean
  weight:     number           // higher = more common
  multipliers: number[]        // index = match count (0-5), value = multiplier
}

export type SpinResult = {
  reelStops:       number[][]  // [reel][row] = symbolIndex
  paylines:        PaylineResult[]
  payoutMultiplier: number
  totalWin:        number      // betAmount * payoutMultiplier
}

export type PaylineResult = {
  lineIndex: number
  symbolId:  string
  matchCount: number
  multiplier: number
}

// ─── Roulette ─────────────────────────────────────────────────────────────────

export type RouletteBetType =
  | 'straight'   // single number 0-36, pays 35:1
  | 'red'        // pays 1:1
  | 'black'      // pays 1:1
  | 'even'       // pays 1:1
  | 'odd'        // pays 1:1
  | 'low'        // 1-18, pays 1:1
  | 'high'       // 19-36, pays 1:1
  | 'dozen_1'    // 1-12, pays 2:1
  | 'dozen_2'    // 13-24, pays 2:1
  | 'dozen_3'    // 25-36, pays 2:1
  | 'col_1'      // 1,4,7... pays 2:1
  | 'col_2'      // 2,5,8... pays 2:1
  | 'col_3'      // 3,6,9... pays 2:1

export type RouletteBet = {
  type:   RouletteBetType
  value?: number             // for 'straight' bets
  amount: number
}

export type RouletteResult = {
  winningNumber:   number
  color:           'red' | 'black' | 'green'
  totalPayout:     number    // total coins returned (including stake)
  totalBet:        number
  payoutMultiplier: number   // totalPayout / totalBet (effective)
  winningBets:     Array<{ bet: RouletteBet; payout: number }>
}

// ─── Casino Session ───────────────────────────────────────────────────────────

export type CasinoSession = {
  id:               string
  playerId:         string
  gameSlug:         string
  gameName:         string
  betAmount:        number
  payoutMultiplier: number
  winnings:         number
  netChange:        number
  createdAt:        string
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export type CasinoLeaderboardEntry = {
  id:               string
  playerId:         string
  playerName:       string
  avatarUrl:        string | null
  gameSlug:         string
  gameName:         string
  betAmount:        number
  winnings:         number
  payoutMultiplier: number
  netChange:        number
  createdAt:        string
}

// ─── Player Stats ─────────────────────────────────────────────────────────────

export type CasinoPlayerStats = {
  gamesPlayed:   number
  totalWagered:  number
  totalWon:      number
  totalLost:     number
  netChange:     number
  biggestWin:    number
  biggestMulti:  number
  winCount:      number
  lossCount:     number
  jackpotsWon:   number
  favoriteGame:  string | null
}

// ─── Admin Config ─────────────────────────────────────────────────────────────

export type CasinoConfig = {
  gameSlug:      string
  gameName:      string
  gameType:      GameType
  isActive:      boolean
  rtp:           number
  minBet:        number
  maxBet:        number
  jackpotAmount: number
}
