import type { RouletteBet, RouletteResult } from './types'

// ─── Wheel layout (European) ──────────────────────────────────────────────────
// Standard clockwise order starting from 0 at top

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11,
  30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26,
]

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

export function getNumberColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

// Index of a number on the wheel (for animation target angle)
export function wheelPositionOf(n: number): number {
  return WHEEL_ORDER.indexOf(n)
}

// ─── Payout calculator ────────────────────────────────────────────────────────

export function calculateRoulettePayout(
  bets: RouletteBet[],
  winningNumber: number
): RouletteResult {
  const color = getNumberColor(winningNumber)
  const totalBet = bets.reduce((s, b) => s + b.amount, 0)

  const winningBets: Array<{ bet: RouletteBet; payout: number }> = []
  let totalPayout = 0

  for (const bet of bets) {
    const payout = singleBetPayout(bet, winningNumber, color)
    if (payout > 0) {
      winningBets.push({ bet, payout })
      totalPayout += payout
    }
  }

  return {
    winningNumber,
    color,
    totalPayout,
    totalBet,
    payoutMultiplier: totalBet > 0 ? totalPayout / totalBet : 0,
    winningBets,
  }
}

function singleBetPayout(
  bet: RouletteBet,
  num: number,
  color: 'red' | 'black' | 'green'
): number {
  switch (bet.type) {
    case 'straight':
      return bet.value === num ? bet.amount * 36 : 0  // 35:1 + stake

    case 'red':
      return color === 'red' ? bet.amount * 2 : 0

    case 'black':
      return color === 'black' ? bet.amount * 2 : 0

    case 'even':
      return num !== 0 && num % 2 === 0 ? bet.amount * 2 : 0

    case 'odd':
      return num !== 0 && num % 2 !== 0 ? bet.amount * 2 : 0

    case 'low':
      return num >= 1 && num <= 18 ? bet.amount * 2 : 0

    case 'high':
      return num >= 19 && num <= 36 ? bet.amount * 2 : 0

    case 'dozen_1':
      return num >= 1 && num <= 12 ? bet.amount * 3 : 0

    case 'dozen_2':
      return num >= 13 && num <= 24 ? bet.amount * 3 : 0

    case 'dozen_3':
      return num >= 25 && num <= 36 ? bet.amount * 3 : 0

    case 'col_1':
      return num !== 0 && num % 3 === 1 ? bet.amount * 3 : 0

    case 'col_2':
      return num !== 0 && num % 3 === 2 ? bet.amount * 3 : 0

    case 'col_3':
      return num !== 0 && num % 3 === 0 ? bet.amount * 3 : 0

    default:
      return 0
  }
}

// Effective payout multiplier for casino_play (total returned / total bet - 1 = net multiplier)
// We pass net multiplier to casino_play: multiply = totalPayout / totalBet
// If 0 total payout, multiplier = 0 (full loss)
export function effectiveMultiplier(result: RouletteResult): number {
  if (result.totalBet === 0) return 0
  return result.totalPayout / result.totalBet
}
