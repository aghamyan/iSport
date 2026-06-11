// Pure, side-effect-free — fully unit-testable, no DB or React imports.

// ─── Core types ───────────────────────────────────────────────────────────────

export type SlipLeg = {
  marketId:       string
  matchId:        string
  matchType:      'friendly' | 'championship'
  marketType:     string          // '1X2' | 'OU2_5' | 'HANDICAP' | 'BTTS' | 'EXACT_SCORE' | 'CUSTOM_PROP'
  marketLabel:    string          // "Match Result", "Over/Under 2.5", etc.
  selectedOption: 'option1' | 'option2' | 'option3'
  selectionLabel: string          // "Player A wins", "Over 2.5", "0-0"
  odds:           number          // decimal odds for this option
  matchTitle:     string          // "Arthur vs Artur"
}

export type SlipSummary = {
  betType:           'SINGLE' | 'PARLAY'
  legs:              number
  combinedOdds:      number
  stake:             number
  potentialWinnings: number   // stake * combinedOdds
  rake:              number   // 10% of profit only
  actualWinnings:    number   // potentialWinnings − rake
}

export type ValidationResult = {
  valid:    boolean
  errors:   string[]
  warnings: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number): number { return Math.round(n * 100) / 100 }

export function fmtAMD(n: number): string {
  return n.toLocaleString('hy-AM') + ' ֏'
}

// ─── Parlay rules ─────────────────────────────────────────────────────────────

/**
 * Rule: you cannot have two legs pointing at the same market.
 * Same match + different market type is allowed.
 * Different matches + same market type is allowed.
 * Only same marketId = same market on same match = forbidden.
 */
export function validateParlayCombination(legs: SlipLeg[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Duplicate marketId check
  const seenMarkets = new Map<string, number>()
  for (const leg of legs) {
    const count = (seenMarkets.get(leg.marketId) ?? 0) + 1
    seenMarkets.set(leg.marketId, count)
  }

  for (const [, count] of seenMarkets) {
    if (count > 1) {
      errors.push('You cannot add the same market twice.')
      break
    }
  }

  // Note: same match + different market type is ALLOWED (e.g. 1X2 + Over/Under on same match)
  // We just warn to inform the player
  const matchIds = legs.map(l => l.matchId)
  const uniqueMatches = new Set(matchIds).size
  if (uniqueMatches < legs.length && legs.length > 1) {
    const sameMatchLegs = legs.filter(l => matchIds.filter(id => id === l.matchId).length > 1)
    const matchTitles = [...new Set(sameMatchLegs.map(l => l.matchTitle))]
    warnings.push(`Correlated: ${matchTitles.join(', ')} used in multiple legs.`)
  }

  // Warn on extreme combined odds (long shot)
  if (legs.length >= 2) {
    const combined = legs.reduce((acc, l) => acc * l.odds, 1)
    if (combined > 50) {
      warnings.push(`Very high parlay odds (${r2(combined)}×) — this is a long shot.`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ─── Full slip validation ─────────────────────────────────────────────────────

export function validateBetSlip(
  legs:    SlipLeg[],
  amount:  number,
  balance: number
): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  if (legs.length === 0) {
    errors.push('Add at least one selection to place a bet.')
    return { valid: false, errors, warnings }
  }

  // Amount
  if (isNaN(amount) || amount <= 0) {
    errors.push('Enter a valid bet amount greater than 0.')
  } else if (amount > balance) {
    errors.push(`Insufficient balance. Available: ${fmtAMD(balance)}, required: ${fmtAMD(amount)}.`)
  } else if (amount < 100) {
    warnings.push('Minimum recommended bet is 100 ֏.')
  }

  // Parlay combination rules
  if (legs.length > 1) {
    const parlay = validateParlayCombination(legs)
    errors.push(...parlay.errors)
    warnings.push(...parlay.warnings)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ─── Summary computation ──────────────────────────────────────────────────────

export function computeSlipSummary(legs: SlipLeg[], amount: number): SlipSummary {
  const betType      = legs.length === 1 ? 'SINGLE' : 'PARLAY'
  const combinedOdds = r2(legs.reduce((acc, l) => acc * l.odds, 1))
  const potential    = r2(amount * combinedOdds)
  const profit       = potential - amount
  const rake         = r2(Math.max(profit * 0.10, 0))
  const actual       = r2(potential - rake)

  return {
    betType,
    legs:              legs.length,
    combinedOdds,
    stake:             amount,
    potentialWinnings: potential,
    rake,
    actualWinnings:    actual,
  }
}

// ─── Market type display helpers ──────────────────────────────────────────────

export const MARKET_LABELS: Record<string, string> = {
  '1X2':        'Match Result',
  'OU2_5':      'Over / Under',
  'HANDICAP':   'Handicap',
  'BTTS':       'Both Teams Score',
  'EXACT_SCORE':'Exact Score',
  'CUSTOM_PROP':'Special',
}

export const MARKET_SHORT: Record<string, string> = {
  '1X2':        '1×2',
  'OU2_5':      'O/U',
  'HANDICAP':   'HCP',
  'BTTS':       'BTTS',
  'EXACT_SCORE':'Score',
  'CUSTOM_PROP':'Prop',
}
