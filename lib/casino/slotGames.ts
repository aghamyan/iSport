import type { SlotGame, SlotSymbol, SpinResult, PaylineResult } from './types'

// ─── Game Definitions ─────────────────────────────────────────────────────────

export const SLOT_GAMES: SlotGame[] = [
  {
    slug:        'champions-crown',
    name:        'Champions Crown',
    tagline:     'Claim the ultimate glory',
    rtp:         96.5,
    volatility:  'high',
    minBet:      10,
    maxBet:      5000,
    jackpot:     500000,
    status:      'active',
    theme:       'linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%)',
    accentColor: '#F59E0B',
    symbolCount: 7,
  },
  {
    slug:        'golden-goal',
    name:        'Golden Goal',
    tagline:     'Every spin is a winning shot',
    rtp:         95.0,
    volatility:  'very_high',
    minBet:      10,
    maxBet:      10000,
    jackpot:     1000000,
    status:      'active',
    theme:       'linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #162032 100%)',
    accentColor: '#22C55E',
    symbolCount: 7,
  },
  {
    slug:        'stadium-fortune',
    name:        'Stadium Fortune',
    tagline:     'The crowd goes wild',
    rtp:         97.0,
    volatility:  'medium',
    minBet:      10,
    maxBet:      5000,
    jackpot:     250000,
    status:      'active',
    theme:       'linear-gradient(135deg, #1a0000 0%, #2d0000 50%, #1a0a0a 100%)',
    accentColor: '#EF4444',
    symbolCount: 7,
  },
  {
    slug:        'ultimate-xi',
    name:        'Ultimate XI',
    tagline:     'Build your legendary team',
    rtp:         94.5,
    volatility:  'very_high',
    minBet:      10,
    maxBet:      10000,
    jackpot:     750000,
    status:      'active',
    theme:       'linear-gradient(135deg, #0a1628 0%, #0e2040 50%, #071020 100%)',
    accentColor: '#818CF8',
    symbolCount: 7,
  },
  {
    slug:        'trophy-rush',
    name:        'Trophy Rush',
    tagline:     'Rush to the top',
    rtp:         96.0,
    volatility:  'high',
    minBet:      10,
    maxBet:      5000,
    jackpot:     500000,
    status:      'active',
    theme:       'linear-gradient(135deg, #1a1500 0%, #2d2400 50%, #1a1900 100%)',
    accentColor: '#FBBF24',
    symbolCount: 7,
  },
]

// ─── Base Symbols ─────────────────────────────────────────────────────────────
// multipliers[n] = payout multiplier for matching exactly n symbols (3-5)

export const BASE_SYMBOLS: Omit<SlotSymbol, 'imageUrl'>[] = [
  {
    id:          'trophy',
    label:       'Trophy',
    emoji:       '🏆',
    isPlayer:    false,
    weight:      2,
    multipliers: [0, 0, 0, 30, 100, 500],
  },
  {
    id:          'crown',
    label:       'Crown',
    emoji:       '👑',
    isPlayer:    false,
    weight:      3,
    multipliers: [0, 0, 0, 15, 50, 200],
  },
  {
    id:          'goldball',
    label:       'Golden Ball',
    emoji:       '⚽',
    isPlayer:    false,
    weight:      5,
    multipliers: [0, 0, 0, 8, 25, 80],
  },
  {
    id:          'star',
    label:       'Star',
    emoji:       '⭐',
    isPlayer:    false,
    weight:      7,
    multipliers: [0, 0, 0, 5, 12, 40],
  },
  {
    id:          'diamond',
    label:       'Diamond',
    emoji:       '💎',
    isPlayer:    false,
    weight:      10,
    multipliers: [0, 0, 0, 3, 8, 20],
  },
  {
    id:          'boot',
    label:       'Boot',
    emoji:       '👟',
    isPlayer:    false,
    weight:      14,
    multipliers: [0, 0, 0, 2, 5, 12],
  },
  {
    id:          'whistle',
    label:       'Whistle',
    emoji:       '📯',
    isPlayer:    false,
    weight:      18,
    multipliers: [0, 0, 0, 1.5, 3, 8],
  },
]

// Player symbols get the best payouts
export function makePlayerSymbols(avatarUrls: (string | null)[], names: string[]): SlotSymbol[] {
  return avatarUrls
    .map((url, i) => ({
      id:          `player_${i}`,
      label:       names[i] ?? `Player ${i + 1}`,
      emoji:       '🧑',
      imageUrl:    url ?? undefined,
      isPlayer:    true,
      weight:      1,
      multipliers: [0, 0, 0, 50, 200, 1000] as number[],
    }))
    .filter((_, i) => avatarUrls[i] !== null) // only players with real photos
}

// ─── Weighted random pick ─────────────────────────────────────────────────────

function pickWeighted(symbols: SlotSymbol[], rng: () => number): number {
  const total = symbols.reduce((sum, s) => sum + s.weight, 0)
  let rand = rng() * total
  for (let i = 0; i < symbols.length; i++) {
    rand -= symbols[i].weight
    if (rand <= 0) return i
  }
  return symbols.length - 1
}

// ─── Paylines  (5 reels × 3 rows) ────────────────────────────────────────────
// Each payline is 5 [reel, row] pairs

const PAYLINES: [number, number][][] = [
  // Straight rows
  [[0,1],[1,1],[2,1],[3,1],[4,1]], // middle row (most likely winner)
  [[0,0],[1,0],[2,0],[3,0],[4,0]], // top row
  [[0,2],[1,2],[2,2],[3,2],[4,2]], // bottom row
  // V shapes
  [[0,0],[1,1],[2,2],[3,1],[4,0]], // V-up
  [[0,2],[1,1],[2,0],[3,1],[4,2]], // V-down
  // Zigzags
  [[0,0],[1,0],[2,1],[3,2],[4,2]], // step down
  [[0,2],[1,2],[2,1],[3,0],[4,0]], // step up
  [[0,0],[1,1],[2,0],[3,1],[4,0]], // zigzag top
  [[0,1],[1,0],[2,1],[3,2],[4,1]], // zigzag mixed
]

// ─── Core spin function (SERVER-SIDE ONLY — call from server action) ──────────

export function computeSpin(
  symbols:     SlotSymbol[],
  betAmount:   number,
  rng:         () => number = Math.random
): SpinResult {
  // Generate 5 reels × 3 rows
  const reelStops: number[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => pickWeighted(symbols, rng))
  )

  // Check each payline
  const paylines: PaylineResult[] = []
  let payoutMultiplier = 0

  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li]
    // Get symbol index at each position
    const symbolIndices = line.map(([reel, row]) => reelStops[reel][row])

    // Count consecutive matching symbols from left
    const firstSym = symbolIndices[0]
    let matchCount = 1
    for (let i = 1; i < symbolIndices.length; i++) {
      if (symbolIndices[i] === firstSym) matchCount++
      else break
    }

    if (matchCount >= 3) {
      const sym = symbols[firstSym]
      const multiplier = (sym.multipliers[matchCount] ?? 0)
      if (multiplier > 0) {
        paylines.push({
          lineIndex:  li,
          symbolId:   sym.id,
          matchCount,
          multiplier,
        })
        payoutMultiplier += multiplier
      }
    }
  }

  return {
    reelStops,
    paylines,
    payoutMultiplier,
    totalWin: betAmount * payoutMultiplier,
  }
}

export { PAYLINES }
