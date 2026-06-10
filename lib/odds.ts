// Pure algorithm — no DB calls, fully unit-testable.

// ─── Input types ──────────────────────────────────────────────────────────────

export type PlayerStats = {
  wins: number
  losses: number
  draws: number
  matchesPlayed: number
  goalDiff: number
  goalsFor?: number
}

/** Minimal form entry needed by the odds algorithm. */
export type OddsFormEntry = {
  result: 'W' | 'L' | 'D'
  goalsFor: number
  goalsAgainst: number
}

/** H2H from home-player perspective: homeWins = home player's wins. */
export type H2HInput = {
  homeWins: number
  awayWins: number
  draws: number
  totalMatches: number
}

// ─── Output types ─────────────────────────────────────────────────────────────

export type OddsFormat = 'decimal' | 'fractional' | 'american' | 'percent'

export type OddsFactor = {
  label: string
  description: string
  impact: 'positive' | 'negative' | 'neutral'
  ratingDelta: number
}

export type OddsResult = {
  // Decimal odds (with 5 % bookmaker margin)
  homeWinOdds: number
  drawOdds: number
  awayWinOdds: number
  // Asian handicap: negative = home gives goals (favourite), positive = home gets goals
  homeHandicap: number
  awayHandicap: number
  // True win probabilities without margin (sum to 1.0)
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  // Expected goals (blended form + career)
  expectedHomeGoals: number
  expectedAwayGoals: number
  // Overround: implied probability sum, e.g. 1.05 = 5 % margin
  overround: number
  // Breakdown for display / bookmaker prep
  homeFactors: OddsFactor[]
  awayFactors: OddsFactor[]
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Exponential weights for recency bias — index 0 = most recent match.
const FORM_WEIGHTS = [1.0, 0.7, 0.5, 0.35, 0.25]
const RESULT_SCORE: Record<'W' | 'L' | 'D', number> = { W: 1, D: 0.5, L: 0 }

function r2(n: number): number { return Math.round(n * 100) / 100 }

/** Elo-like career rating centred at 1000. */
function careerRating(s: PlayerStats): number {
  if (s.matchesPlayed === 0) return 1000
  const winRate = s.wins / s.matchesPlayed
  const avgGoalDiff = s.goalDiff / s.matchesPlayed
  return 1000 + (winRate - 0.5) * 400 + avgGoalDiff * 20
}

/** Weighted form score: 0 = all losses, 0.5 = neutral, 1 = all wins. */
function weightedFormScore(form: OddsFormEntry[]): number {
  if (form.length === 0) return 0.5
  let scoreSum = 0, weightSum = 0
  form.slice(0, 5).forEach((entry, i) => {
    const w = FORM_WEIGHTS[i] ?? 0.2
    scoreSum  += w * RESULT_SCORE[entry.result]
    weightSum += w
  })
  return scoreSum / weightSum
}

/** Average goals scored; blends recent form with career rate. */
function avgGoalsFor(form: OddsFormEntry[], stats: PlayerStats): number {
  const careerAvg = stats.matchesPlayed > 0
    ? (stats.goalsFor !== undefined
        ? stats.goalsFor / stats.matchesPlayed
        : Math.max(0, (stats.goalDiff / stats.matchesPlayed) / 2 + 1.2))
    : 1.5

  if (form.length === 0) return careerAvg

  const formAvg = form.reduce((s, e) => s + e.goalsFor, 0) / form.length
  // Blend weight towards form when we have enough samples
  const formWeight = form.length >= 4 ? 0.7 : form.length >= 2 ? 0.5 : 0.3
  return formWeight * formAvg + (1 - formWeight) * careerAvg
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calculates pre-match odds from career stats + optional recent form + optional
 * head-to-head record.
 *
 * Form is weighted 60 % vs career 40 % when data is available, satisfying the
 * requirement that recent form dominates overall stats.
 *
 * H2H is applied as a flat Elo bonus when ≥ 3 meetings exist.
 * Championship matches receive a small draw-probability boost.
 */
export function calculateOdds(
  home: PlayerStats,
  away: PlayerStats,
  options?: {
    homeForm?: OddsFormEntry[]
    awayForm?: OddsFormEntry[]
    h2h?: H2HInput
    matchType?: 'friendly' | 'championship'
  }
): OddsResult {
  const {
    homeForm    = [],
    awayForm    = [],
    h2h,
    matchType   = 'friendly',
  } = options ?? {}

  const homeFactors: OddsFactor[] = []
  const awayFactors: OddsFactor[] = []

  // ── 1. Career ratings ──────────────────────────────────────────────────────
  const homeCareer = careerRating(home)
  const awayCareer = careerRating(away)

  const careerDeltaHome = r2(homeCareer - 1000)
  const careerDeltaAway = r2(awayCareer - 1000)

  homeFactors.push({
    label: 'Career record',
    description: home.matchesPlayed > 0
      ? `${home.wins}W ${home.draws}D ${home.losses}L — goal diff ${home.goalDiff >= 0 ? '+' : ''}${home.goalDiff}`
      : 'No matches played yet',
    impact: careerDeltaHome > 10 ? 'positive' : careerDeltaHome < -10 ? 'negative' : 'neutral',
    ratingDelta: careerDeltaHome,
  })
  awayFactors.push({
    label: 'Career record',
    description: away.matchesPlayed > 0
      ? `${away.wins}W ${away.draws}D ${away.losses}L — goal diff ${away.goalDiff >= 0 ? '+' : ''}${away.goalDiff}`
      : 'No matches played yet',
    impact: careerDeltaAway > 10 ? 'positive' : careerDeltaAway < -10 ? 'negative' : 'neutral',
    ratingDelta: careerDeltaAway,
  })

  // ── 2. Form ratings (60 % weight when data is available) ──────────────────
  const homeFS = weightedFormScore(homeForm)
  const awayFS = weightedFormScore(awayForm)
  const hasForm = homeForm.length > 0 || awayForm.length > 0

  // Form rating range: 700 (all losses) → 1300 (all wins)
  const homeFormRating = 1000 + (homeFS - 0.5) * 600
  const awayFormRating = 1000 + (awayFS - 0.5) * 600

  const FORM_WEIGHT   = hasForm ? 0.6 : 0
  const CAREER_WEIGHT = 1 - FORM_WEIGHT

  if (homeForm.length > 0) {
    const delta = r2(homeFormRating - 1000)
    homeFactors.push({
      label: 'Recent form',
      description: `Last ${homeForm.length}: ${homeForm.slice(0, 5).map(f => f.result).join(' ')}`,
      impact: delta > 15 ? 'positive' : delta < -15 ? 'negative' : 'neutral',
      ratingDelta: delta,
    })
  }
  if (awayForm.length > 0) {
    const delta = r2(awayFormRating - 1000)
    awayFactors.push({
      label: 'Recent form',
      description: `Last ${awayForm.length}: ${awayForm.slice(0, 5).map(f => f.result).join(' ')}`,
      impact: delta > 15 ? 'positive' : delta < -15 ? 'negative' : 'neutral',
      ratingDelta: delta,
    })
  }

  let homeRating = CAREER_WEIGHT * homeCareer + FORM_WEIGHT * homeFormRating
  let awayRating = CAREER_WEIGHT * awayCareer + FORM_WEIGHT * awayFormRating

  // ── 3. H2H adjustment (min 3 meetings for statistical significance) ────────
  if (h2h && h2h.totalMatches >= 3) {
    const homeH2HRate = h2h.homeWins / h2h.totalMatches
    const homeBonus   = (homeH2HRate - 0.5) * 150   // ±75 Elo points at most
    const awayBonus   = -homeBonus

    homeRating += homeBonus
    awayRating += awayBonus

    if (Math.abs(homeBonus) > 5) {
      homeFactors.push({
        label: 'Head-to-head',
        description: `${h2h.homeWins}W ${h2h.draws}D ${h2h.awayWins}L in ${h2h.totalMatches} meetings`,
        impact: homeBonus > 0 ? 'positive' : 'negative',
        ratingDelta: r2(homeBonus),
      })
      awayFactors.push({
        label: 'Head-to-head',
        description: `${h2h.awayWins}W ${h2h.draws}D ${h2h.homeWins}L in ${h2h.totalMatches} meetings`,
        impact: awayBonus > 0 ? 'positive' : 'negative',
        ratingDelta: r2(awayBonus),
      })
    }
  }

  // ── 4. Win probabilities via Elo formula ───────────────────────────────────
  const ratingDiff  = awayRating - homeRating   // positive → away is stronger
  const homeWinExp  = 1 / (1 + Math.pow(10, ratingDiff / 400))
  const awayWinExp  = 1 - homeWinExp

  // ── 5. Draw probability ────────────────────────────────────────────────────
  const ratingGap   = Math.abs(ratingDiff)
  let   drawP       = Math.max(0.05, 0.28 - ratingGap * 0.0005)

  if (matchType === 'championship') {
    // Championship pressure slightly increases draw rate
    drawP = Math.min(drawP + 0.02, 0.35)
    const note = 'Championship match — draw probability slightly elevated'
    homeFactors.push({ label: 'Match type', description: note, impact: 'neutral', ratingDelta: 0 })
    awayFactors.push({ label: 'Match type', description: note, impact: 'neutral', ratingDelta: 0 })
  }

  const homeWinProb = Math.max(0.02, homeWinExp * (1 - drawP))
  const awayWinProb = Math.max(0.02, awayWinExp * (1 - drawP))
  const drawProb    = Math.max(0.02, 1 - homeWinProb - awayWinProb)

  // ── 6. Decimal odds with 5 % bookmaker margin ──────────────────────────────
  const MARGIN      = 1.05
  const homeWinOdds = r2(MARGIN / homeWinProb)
  const drawOdds    = r2(MARGIN / drawProb)
  const awayWinOdds = r2(MARGIN / awayWinProb)

  const overround   = r2(1 / homeWinOdds + 1 / drawOdds + 1 / awayWinOdds)

  // ── 7. Asian handicap ──────────────────────────────────────────────────────
  // Positive ratingDiff = away stronger → home is underdog → home receives goals (+ve handicap)
  // Negative ratingDiff = home stronger → home is favourite → home gives goals (-ve handicap)
  const goalDiffExp   = (homeRating - awayRating) / 80
  const homeHandicap  = Math.round(-goalDiffExp * 4) / 4  // rounds to nearest 0.25
  const awayHandicap  = -homeHandicap

  // ── 8. Expected goals ──────────────────────────────────────────────────────
  const expectedHomeGoals = r2(avgGoalsFor(homeForm, home))
  const expectedAwayGoals = r2(avgGoalsFor(awayForm, away))

  return {
    homeWinOdds, drawOdds, awayWinOdds,
    homeHandicap, awayHandicap,
    homeWinPct:          r2(homeWinProb  * 100),
    drawPct:             r2(drawProb     * 100),
    awayWinPct:          r2(awayWinProb  * 100),
    expectedHomeGoals,
    expectedAwayGoals,
    overround,
    homeFactors,
    awayFactors,
  }
}

// ─── Format converters ────────────────────────────────────────────────────────

/** GCD via Euclidean algorithm. */
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b) }

/**
 * Decimal odds → fractional string, e.g. 2.5 → "3/2".
 * Rounds to 3 decimal places before reducing to avoid floating-point drift.
 */
export function decimalToFractional(decimal: number): string {
  const profit = Math.round((decimal - 1) * 1000)
  const denom  = 1000
  const g      = gcd(profit, denom)
  return `${profit / g}/${denom / g}`
}

/** Decimal odds → American moneyline, e.g. 2.5 → "+150", 1.5 → "-200". */
export function decimalToAmerican(decimal: number): string {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`
  return `${Math.round(-100 / (decimal - 1))}`
}

/** Format decimal odds according to the user's chosen format. */
export function formatOdds(decimal: number, format: OddsFormat): string {
  switch (format) {
    case 'decimal':    return decimal.toFixed(2)
    case 'fractional': return decimalToFractional(decimal)
    case 'american':   return decimalToAmerican(decimal)
    case 'percent': {
      const impliedPct = (1 / decimal) * 100
      return `${r2(impliedPct)}%`
    }
  }
}

/** Human-readable format label for UI toggles. */
export const FORMAT_LABELS: Record<OddsFormat, string> = {
  decimal:    '1.50',
  fractional: '1/2',
  american:   '+150',
  percent:    '%',
}
