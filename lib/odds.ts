// Pure algorithm — no DB calls, fully unit-testable.

// ─── Input types ──────────────────────────────────────────────────────────────

export type PlayerStats = {
  wins: number
  losses: number
  draws: number
  matchesPlayed: number
  goalDiff: number
  goalsFor?: number
  goalsAgainst?: number   // used for defensive rating and Dixon-Coles xG
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
  homeGoals?: number   // total goals scored by home player in H2H
  awayGoals?: number   // total goals scored by away player in H2H
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
  // Decimal odds (with bookmaker margin applied)
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
  // Expected goals (Dixon-Coles blended with form)
  expectedHomeGoals: number
  expectedAwayGoals: number
  // Overround: implied probability sum, e.g. 1.10 = 10 % margin
  overround: number
  // Breakdown for display / bookmaker prep
  homeFactors: OddsFactor[]
  awayFactors: OddsFactor[]
}

// ─── Margin constants ─────────────────────────────────────────────────────────
// Different markets have different house edge levels (matching real-world bookmakers):
//   1X2 (3-way): 10 %  → equal teams ≈ 2.52 / 3.26 / 2.52
//   2-way (OU, handicap, BTTS, IT): 11 %  → 50/50 ≈ 1.80
//   Exact score: 15 %  (long-tail market)
const MARGIN_1X2  = 0.10
const MARGIN_2WAY = 0.11
const MARGIN_EXACT = 0.15

// Exponential weights for recency bias — index 0 = most recent match.
const FORM_WEIGHTS = [1.0, 0.7, 0.5, 0.35, 0.25]
const RESULT_SCORE: Record<'W' | 'L' | 'D', number> = { W: 1, D: 0.5, L: 0 }

function r2(n: number): number { return Math.round(n * 100) / 100 }

/** Floor any odds value — decimal odds below 1.01 are invalid. */
function floorOdds(odds: number): number { return Math.max(1.01, odds) }

// ─── Rating helpers ───────────────────────────────────────────────────────────

/**
 * Elo-like career rating centred at 1000.
 * Win rate is the primary signal; goal differential is secondary.
 * A defensive bonus rewards conceding fewer goals than the league average.
 */
function careerRating(s: PlayerStats, leagueAvgPerTeam: number): number {
  if (s.matchesPlayed === 0) return 1000
  const winRate    = s.wins / s.matchesPlayed
  const avgGoalDiff = s.goalDiff / s.matchesPlayed

  let rating = 1000
    + (winRate - 0.5) * 400   // ±200 for pure win/loss dominance
    + avgGoalDiff * 20         // ±varies with scoring margin

  // Defensive component: conceding less than the league average earns extra rating.
  // Uses goalsAgainst when available; falls back to goalDiff-derived estimate.
  if (s.goalsAgainst !== undefined && s.matchesPlayed > 0) {
    const avgConceded = s.goalsAgainst / s.matchesPlayed
    rating += (leagueAvgPerTeam - avgConceded) * 15  // ±≈15 per goal/game vs average
  }

  return rating
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

// ─── Dixon-Coles expected goals ───────────────────────────────────────────────

/**
 * Computes expected goals for an attacker facing a specific defender.
 *
 * Career leg uses the Dixon-Coles multiplicative model:
 *   xG = attackRate × defenseRate × leagueBase
 * where attackRate = attacker goals/game ÷ leagueBase (>1 = above average attack)
 *       defenseRate = defender goals conceded/game ÷ leagueBase (>1 = weak defense)
 *
 * Form leg blends the attacker's recent scoring with the defender's recent
 * concession rate, then weights form vs career by how much data we have.
 */
function computeExpectedGoals(
  attacker: PlayerStats,
  defender: PlayerStats,
  attackerForm: OddsFormEntry[],
  defenderForm: OddsFormEntry[],
  leagueAvgPerTeam: number
): number {
  // --- Career xG (Dixon-Coles) ---
  // Use goalsFor directly when available; undefined means "no data" (not zero goals).
  const careerAttack = attacker.matchesPlayed > 0 && attacker.goalsFor !== undefined
    ? attacker.goalsFor / attacker.matchesPlayed
    : leagueAvgPerTeam

  const careerDefense = defender.matchesPlayed > 0 && defender.goalsAgainst !== undefined
    ? defender.goalsAgainst / defender.matchesPlayed
    : leagueAvgPerTeam

  const attackRatio  = careerAttack  / leagueAvgPerTeam
  const defenseRatio = careerDefense / leagueAvgPerTeam
  const careerXG     = attackRatio * defenseRatio * leagueAvgPerTeam

  if (attackerForm.length === 0 && defenderForm.length === 0) {
    return Math.max(0.3, Math.min(careerXG, 5.5))
  }

  // --- Form xG ---
  // Attacker's recent goals scored:
  const formGoalsFor = attackerForm.length > 0
    ? attackerForm.reduce((s, e) => s + e.goalsFor, 0) / attackerForm.length
    : careerAttack

  // Defender's recent goals conceded (what they let in each game):
  const formGoalsAgainst = defenderForm.length > 0
    ? defenderForm.reduce((s, e) => s + e.goalsAgainst, 0) / defenderForm.length
    : careerDefense

  // Average the two signals to get a form-based xG estimate.
  const formXG = (formGoalsFor + formGoalsAgainst) / 2

  // Scale form weight with data volume (max 65 % when both sides have full form data).
  const totalEntries = attackerForm.length + defenderForm.length
  const formWeight = totalEntries >= 8 ? 0.65
                   : totalEntries >= 4 ? 0.50
                   : totalEntries >= 2 ? 0.35
                   : 0.25

  const blended = formWeight * formXG + (1 - formWeight) * careerXG
  return Math.max(0.3, Math.min(blended, 5.5))
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calculates pre-match odds from career stats + optional recent form + optional
 * head-to-head record.
 *
 * Expected goals use the Dixon-Coles attack × defense × league-base model,
 * blended with form data and adjusted by H2H goal history.
 *
 * H2H Elo bonus applies from 2 meetings (statistically smaller bonus)
 * and scales up with more matches (capped at ±100 Elo for 7+ meetings).
 *
 * All output odds are floored at 1.01 to prevent invalid sub-1.0 values
 * for extreme mismatches. Margins: 1X2 = 10 %, 2-way = 11 % (50/50 → 1.80).
 */
export function calculateOdds(
  home: PlayerStats,
  away: PlayerStats,
  options?: {
    homeForm?:      OddsFormEntry[]
    awayForm?:      OddsFormEntry[]
    h2h?:           H2HInput
    matchType?:     'friendly' | 'championship'
    leagueAvgGoals?: number
  }
): OddsResult {
  const {
    homeForm    = [],
    awayForm    = [],
    h2h,
    matchType   = 'friendly',
    leagueAvgGoals = 2.5,
  } = options ?? {}

  const leagueAvgPerTeam = leagueAvgGoals / 2  // per-team average goals per game

  const homeFactors: OddsFactor[] = []
  const awayFactors: OddsFactor[] = []

  // ── 1. Career ratings ──────────────────────────────────────────────────────
  const homeCareer = careerRating(home, leagueAvgPerTeam)
  const awayCareer = careerRating(away, leagueAvgPerTeam)

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

  // ── 2. Form ratings (up to 65 % weight when data is available) ────────────
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

  // ── 3. H2H Elo adjustment ──────────────────────────────────────────────────
  // Threshold lowered to 2 meetings (minimum meaningful signal).
  // Bonus scales with match count: ±30 Elo at 2 meetings → ±100 at 7+ meetings.
  if (h2h && h2h.totalMatches >= 2) {
    const homeH2HRate = h2h.homeWins / h2h.totalMatches
    const maxBonus    = Math.min(h2h.totalMatches * 15, 100)  // caps at 100 Elo
    const homeBonus   = (homeH2HRate - 0.5) * 2 * maxBonus
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
    drawP = Math.min(drawP + 0.02, 0.35)
    const note = 'Championship match — draw probability slightly elevated'
    homeFactors.push({ label: 'Match type', description: note, impact: 'neutral', ratingDelta: 0 })
    awayFactors.push({ label: 'Match type', description: note, impact: 'neutral', ratingDelta: 0 })
  }

  const homeWinProb = Math.max(0.02, homeWinExp * (1 - drawP))
  const awayWinProb = Math.max(0.02, awayWinExp * (1 - drawP))
  const drawProb    = Math.max(0.02, 1 - homeWinProb - awayWinProb)

  // ── 6. Decimal odds with 10 % house edge (1X2) ────────────────────────────
  // Compute raw odds first so overround reflects the true margin; then floor.
  const rawHomeOdds = r2(1 / (homeWinProb * (1 + MARGIN_1X2)))
  const rawDrawOdds = r2(1 / (drawProb     * (1 + MARGIN_1X2)))
  const rawAwayOdds = r2(1 / (awayWinProb  * (1 + MARGIN_1X2)))

  const overround   = r2(1 / rawHomeOdds + 1 / rawDrawOdds + 1 / rawAwayOdds)

  const homeWinOdds = floorOdds(rawHomeOdds)
  const drawOdds    = floorOdds(rawDrawOdds)
  const awayWinOdds = floorOdds(rawAwayOdds)

  // ── 7. Asian handicap ──────────────────────────────────────────────────────
  const goalDiffExp  = (homeRating - awayRating) / 80
  const homeHandicap = Math.round(-goalDiffExp * 4) / 4
  const awayHandicap = -homeHandicap

  // ── 8. Expected goals (Dixon-Coles) with H2H goals fine-tuning ────────────
  let expectedHomeGoals = computeExpectedGoals(home, away, homeForm, awayForm, leagueAvgPerTeam)
  let expectedAwayGoals = computeExpectedGoals(away, home, awayForm, homeForm, leagueAvgPerTeam)

  // Fine-tune with H2H goals history when at least 2 meetings and goals are recorded.
  if (h2h && h2h.totalMatches >= 2 && h2h.homeGoals !== undefined && h2h.awayGoals !== undefined) {
    const h2hAvgHome = h2h.homeGoals / h2h.totalMatches
    const h2hAvgAway = h2h.awayGoals / h2h.totalMatches
    // Weight increases with more H2H matches (max 25 % at 5+ meetings).
    const h2hGoalsWeight = Math.min(h2h.totalMatches / 20, 0.25)
    expectedHomeGoals = (1 - h2hGoalsWeight) * expectedHomeGoals + h2hGoalsWeight * h2hAvgHome
    expectedAwayGoals = (1 - h2hGoalsWeight) * expectedAwayGoals + h2hGoalsWeight * h2hAvgAway
  }

  return {
    homeWinOdds, drawOdds, awayWinOdds,
    homeHandicap, awayHandicap,
    homeWinPct:          r2(homeWinProb  * 100),
    drawPct:             r2(drawProb     * 100),
    awayWinPct:          r2(awayWinProb  * 100),
    expectedHomeGoals:   r2(Math.max(0.3, expectedHomeGoals)),
    expectedAwayGoals:   r2(Math.max(0.3, expectedAwayGoals)),
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

// ═══════════════════════════════════════════════════════════════════════════════
// POISSON-BASED MARKET EXTENSIONS
// All functions below are pure/side-effect-free and fully unit-testable.
//
// The core insight: once we have expected goals (λ₁, λ₂) from calculateOdds(),
// a Poisson model gives us probability distributions over all scorelines,
// from which we derive O/U, BTTS, exact scores, and handicap odds.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Poisson helpers ──────────────────────────────────────────────────────────

/** P(X = k) for X ~ Poisson(λ). Safe for k up to ~30. */
export function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  if (k < 0)       return 0
  let logP = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

/**
 * Given fair probabilities (summing to 1.0), apply an overround margin
 * and return decimal odds. margin = 0.11 ≈ 11 % house edge.
 * All outputs are floored at 1.01 (invalid to pay back less than stake).
 */
export function applyMargin(probs: number[], margin = MARGIN_2WAY): number[] {
  return probs.map(p => floorOdds(r2(1 / (p * (1 + margin)))))
}

// ─── Internal: Poisson 1X2 probabilities ─────────────────────────────────────

function poissonWinProbs(lambda1: number, lambda2: number): { homeWin: number; draw: number; awayWin: number } {
  const MAX = 12
  let homeWin = 0, draw = 0
  for (let h = 0; h <= MAX; h++) {
    const ph = poissonPMF(h, lambda1)
    for (let a = 0; a <= MAX; a++) {
      const p = ph * poissonPMF(a, lambda2)
      if (h > a) homeWin += p
      else if (h === a) draw += p
    }
  }
  return { homeWin, draw, awayWin: Math.max(0, 1 - homeWin - draw) }
}

/**
 * Adjusts the λ1:λ2 ratio so the Poisson model's home-win probability matches
 * the Elo-derived target. Total expected goals (λ1+λ2) is preserved, ensuring
 * all markets (handicap, BTTS, OU, exact scores) are consistent with 1X2 odds.
 */
function calibrateExpectedGoals(
  rawLambda1: number,
  rawLambda2: number,
  targetHomeWinProb: number
): { lambda1: number; lambda2: number } {
  const total = rawLambda1 + rawLambda2
  if (total < 0.1 || targetHomeWinProb <= 0.02 || targetHomeWinProb >= 0.98) {
    return { lambda1: rawLambda1, lambda2: rawLambda2 }
  }

  let lo = 0.02, hi = 0.98
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const { homeWin } = poissonWinProbs(mid * total, (1 - mid) * total)
    if (homeWin < targetHomeWinProb) lo = mid
    else hi = mid
  }

  const ratio = (lo + hi) / 2
  return {
    lambda1: Math.max(0.3, r2(ratio * total)),
    lambda2: Math.max(0.3, r2((1 - ratio) * total)),
  }
}

// ─── Additional output types ──────────────────────────────────────────────────

export type OverUnderMarket = {
  line:          number
  expectedTotal: number
  overProb:      number
  underProb:     number
  overOdds:      number
  underOdds:     number
}

export type BTTSMarket = {
  yesProb:  number
  noProb:   number
  yesOdds:  number
  noOdds:   number
}

export type ExactScoreEntry = {
  home:     number
  away:     number
  prob:     number
  odds:     number
  label:    string
}

export type HandicapMarket = {
  line:          number
  homeOdds:      number
  awayOdds:      number
  homeProb:      number
  awayProb:      number
  expectedDiff:  number
}

export type ConfidenceResult = {
  score:       number
  label:       'low' | 'medium' | 'high'
  dataQuality: 'insufficient' | 'limited' | 'good' | 'excellent'
  factors:     { name: string; value: number; max: number; note: string }[]
}

export type CustomPropSuggestion = {
  numOptions:    2 | 3
  suggestedOdds: number[]
  notes:         string
}

export type DoubleChanceMarket = {
  homeOrDrawOdds:  number
  awayOrDrawOdds:  number
  neitherDrawOdds: number
  homeOrDrawProb:  number
  awayOrDrawProb:  number
  neitherDrawProb: number
}

/** Complete odds package for all bet market types. */
export type FullMarketOdds = {
  match1x2:    OddsResult
  overUnder:   OverUnderMarket
  btts:        BTTSMarket
  exactScores: ExactScoreEntry[]
  handicap:    HandicapMarket
  confidence:  ConfidenceResult
  leagueAvgGoals: number
  calculatedAt:   string
  doubleChance:         DoubleChanceMarket
  overUnderLines:       OverUnderMarket[]
  handicapLines:        HandicapMarket[]
  homeIndividualTotals: OverUnderMarket[]
  awayIndividualTotals: OverUnderMarket[]
}

// ─── Over / Under ─────────────────────────────────────────────────────────────

/**
 * Calculates Over/Under odds for a given goal line using Poisson joint PMF.
 * Uses 11 % margin so 50/50 lines price at ≈ 1.80 / 1.80.
 */
export function calculateOverUnder(
  lambda1: number,
  lambda2: number,
  line = 2.5,
  margin = MARGIN_2WAY
): OverUnderMarket {
  const expectedTotal = r2(lambda1 + lambda2)
  const threshold     = Math.ceil(line)

  let underProb = 0
  for (let a = 0; a < threshold; a++) {
    for (let b = 0; b < threshold - a; b++) {
      underProb += poissonPMF(a, lambda1) * poissonPMF(b, lambda2)
    }
  }
  underProb = Math.min(Math.max(underProb, 0.02), 0.98)
  const overProb = 1 - underProb

  const [overOdds, underOdds] = applyMargin([overProb, underProb], margin)

  return { line, expectedTotal, overProb: r2(overProb), underProb: r2(underProb), overOdds, underOdds }
}

// ─── BTTS ─────────────────────────────────────────────────────────────────────

/** P(both teams score ≥ 1 goal) derived from Poisson lambdas. */
export function calculateBTTS(
  lambda1: number,
  lambda2: number,
  margin = MARGIN_2WAY
): BTTSMarket {
  const pHome0  = poissonPMF(0, lambda1)
  const pAway0  = poissonPMF(0, lambda2)
  const pHome1p = 1 - pHome0
  const pAway1p = 1 - pAway0

  const yesProb = Math.min(Math.max(pHome1p * pAway1p, 0.02), 0.98)
  const noProb  = 1 - yesProb

  const [yesOdds, noOdds] = applyMargin([yesProb, noProb], margin)

  return { yesProb: r2(yesProb), noProb: r2(noProb), yesOdds, noOdds }
}

// ─── Exact Scores ─────────────────────────────────────────────────────────────

/**
 * Returns the top `topN` most-probable exact scorelines with Poisson odds.
 * Higher margin applied (exact score is a long-tail market).
 */
export function calculateExactScores(
  lambda1: number,
  lambda2: number,
  topN   = 8,
  margin = MARGIN_EXACT
): ExactScoreEntry[] {
  const MAX_GOALS = 7
  const entries: ExactScoreEntry[] = []

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const prob = poissonPMF(h, lambda1) * poissonPMF(a, lambda2)
      entries.push({
        home:  h,
        away:  a,
        prob:  r2(prob),
        odds:  floorOdds(r2(1 / (prob * (1 + margin)))),
        label: `${h}-${a}`,
      })
    }
  }

  return entries
    .sort((x, y) => y.prob - x.prob)
    .slice(0, topN)
}

// ─── Handicap (Poisson version) ───────────────────────────────────────────────

/**
 * Calculates Asian-style handicap odds for a specific line using Poisson.
 * line > 0 = home team must win by more than `line` goals.
 */
export function calculateHandicapOdds(
  lambda1:      number,
  lambda2:      number,
  line:         number,
  margin = MARGIN_2WAY
): HandicapMarket {
  const expectedDiff = r2(lambda1 - lambda2)

  let homeProb = 0
  let awayProb = 0
  const MAX = 15

  for (let h = 0; h <= MAX; h++) {
    for (let a = 0; a <= MAX; a++) {
      const p    = poissonPMF(h, lambda1) * poissonPMF(a, lambda2)
      const diff = h - a
      if (diff > line)       homeProb += p
      else if (diff < line)  awayProb += p
      // diff === line → push (stake returned); excluded from pricing
    }
  }

  // Normalize over non-push outcomes so whole-number lines price correctly.
  const totalCovered = homeProb + awayProb
  if (totalCovered > 0) {
    homeProb /= totalCovered
    awayProb /= totalCovered
  } else {
    homeProb = 0.5
    awayProb = 0.5
  }

  homeProb = Math.min(Math.max(homeProb, 0.02), 0.98)
  awayProb = 1 - homeProb

  const [homeOdds, awayOdds] = applyMargin([homeProb, awayProb], margin)

  return {
    line,
    homeOdds,
    awayOdds,
    homeProb:     r2(homeProb),
    awayProb:     r2(awayProb),
    expectedDiff,
  }
}

/**
 * Picks the most book-balanced handicap line (closest to 50/50 odds).
 */
export function suggestHandicapLine(lambda1: number, lambda2: number): number {
  const lines = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
  const diff  = lambda1 - lambda2
  if (Math.abs(diff) < 0.3) return 0.5

  let bestLine = 1.5
  let bestDist = Infinity
  for (const line of lines) {
    const { homeProb } = calculateHandicapOdds(lambda1, lambda2, line * Math.sign(diff))
    const dist = Math.abs(homeProb - 0.5)
    if (dist < bestDist) { bestDist = dist; bestLine = line }
  }
  return bestLine * Math.sign(diff) || 0.5
}

// ─── Confidence Score ─────────────────────────────────────────────────────────

/**
 * Produces a 0–100 confidence score and qualitative label reflecting how
 * much statistical evidence exists to back the calculated odds.
 */
export function calculateConfidence(
  home:      PlayerStats,
  away:      PlayerStats,
  homeForm?: OddsFormEntry[],
  awayForm?: OddsFormEntry[],
  h2h?:      H2HInput
): ConfidenceResult {
  const factors: ConfidenceResult['factors'] = []

  // ── Factor 1: career data volume (max 40 pts)
  const minMatches = Math.min(home.matchesPlayed, away.matchesPlayed)
  const dataScore  = Math.min(minMatches / 20, 1) * 40
  factors.push({
    name:  'Career data',
    value: r2(dataScore),
    max:   40,
    note:  `${minMatches} matches (weakest player)`,
  })

  // ── Factor 2: recent form (max 25 pts)
  const homeFormLen = (homeForm ?? []).length
  const awayFormLen = (awayForm ?? []).length
  const formScore   = Math.min((homeFormLen + awayFormLen) / 10, 1) * 25
  factors.push({
    name:  'Recent form data',
    value: r2(formScore),
    max:   25,
    note:  `${homeFormLen + awayFormLen} form entries`,
  })

  // ── Factor 3: H2H history (max 20 pts)
  const h2hMatches = h2h?.totalMatches ?? 0
  const h2hScore   = Math.min(h2hMatches / 5, 1) * 20
  factors.push({
    name:  'Head-to-head history',
    value: r2(h2hScore),
    max:   20,
    note:  `${h2hMatches} direct meetings`,
  })

  // ── Factor 4: result consistency (max 15 pts)
  const allForm  = [...(homeForm ?? []), ...(awayForm ?? [])]
  let consScore  = 7.5
  if (allForm.length >= 4) {
    const wins   = allForm.filter(f => f.result === 'W').length / allForm.length
    const losses = allForm.filter(f => f.result === 'L').length / allForm.length
    consScore = Math.min(Math.max(wins, losses) / 0.8, 1) * 15
  }
  factors.push({
    name:  'Form consistency',
    value: r2(consScore),
    max:   15,
    note:  allForm.length >= 4 ? 'Computed from form data' : 'Default (insufficient form data)',
  })

  const total = factors.reduce((s, f) => s + f.value, 0)
  const score = r2(Math.min(total, 100))

  return {
    score,
    label:       score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    dataQuality: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 35 ? 'limited' : 'insufficient',
    factors,
  }
}

// ─── Double Chance ────────────────────────────────────────────────────────────

/**
 * Calculates Double Chance odds (1X, X2, 12).
 * Uses 1X2 margin (10 %) since these cover large probability ranges.
 */
export function calculateDoubleChance(
  homeWinProb: number,
  drawProb:    number,
  awayWinProb: number,
  margin = MARGIN_1X2
): DoubleChanceMarket {
  const homeOrDrawProb  = Math.min(Math.max(homeWinProb + drawProb,    0.02), 0.98)
  const awayOrDrawProb  = Math.min(Math.max(awayWinProb + drawProb,    0.02), 0.98)
  const neitherDrawProb = Math.min(Math.max(homeWinProb + awayWinProb, 0.02), 0.98)

  return {
    homeOrDrawOdds:  floorOdds(r2(1 / (homeOrDrawProb  * (1 + margin)))),
    awayOrDrawOdds:  floorOdds(r2(1 / (awayOrDrawProb  * (1 + margin)))),
    neitherDrawOdds: floorOdds(r2(1 / (neitherDrawProb * (1 + margin)))),
    homeOrDrawProb:  r2(homeOrDrawProb),
    awayOrDrawProb:  r2(awayOrDrawProb),
    neitherDrawProb: r2(neitherDrawProb),
  }
}

// ─── Individual Team Total ────────────────────────────────────────────────────

/** Over/Under for a single team's goals (one-dimensional Poisson). */
export function calculateIndividualTotal(
  lambda: number,
  line:   number,
  margin = MARGIN_2WAY
): OverUnderMarket {
  const threshold = Math.ceil(line)
  let underProb = 0
  for (let k = 0; k < threshold; k++) underProb += poissonPMF(k, lambda)
  underProb = Math.min(Math.max(underProb, 0.02), 0.98)
  const overProb = 1 - underProb
  const [overOdds, underOdds] = applyMargin([overProb, underProb], margin)
  return {
    line,
    expectedTotal: r2(lambda),
    overProb:  r2(overProb),
    underProb: r2(underProb),
    overOdds,
    underOdds,
  }
}

// ─── Custom Prop Suggestions ──────────────────────────────────────────────────

/**
 * Suggests balanced starting odds for admin-created custom props.
 * For 2-option props: ~1.80 to embed 11 % margin.
 * For 3-option props: symmetric odds near 2.70 each.
 */
export function suggestCustomPropOdds(numOptions: 2 | 3): CustomPropSuggestion {
  if (numOptions === 2) {
    return {
      numOptions:    2,
      suggestedOdds: [1.80, 1.80],
      notes:         'Balanced 2-way market at ~11% margin. Adjust if one outcome is clearly more likely.',
    }
  }
  return {
    numOptions:    3,
    suggestedOdds: [2.70, 2.70, 2.70],
    notes:         'Balanced 3-way market at ~10% margin. Adjust individual options to reflect true probabilities.',
  }
}

// ─── Full Markets (entry point) ───────────────────────────────────────────────

/**
 * Master function: computes every market type in a single call.
 * Pass leagueAvgGoals from your DB query (or leave undefined to default to 2.5).
 */
export function calculateFullMarkets(
  home: PlayerStats,
  away: PlayerStats,
  options?: {
    homeForm?:      OddsFormEntry[]
    awayForm?:      OddsFormEntry[]
    h2h?:           H2HInput
    matchType?:     'friendly' | 'championship'
    leagueAvgGoals?: number
  }
): FullMarketOdds {
  const { homeForm = [], awayForm = [], h2h, matchType = 'friendly', leagueAvgGoals = 2.5 } = options ?? {}

  // 1X2 via Elo engine — passes leagueAvgGoals so xG uses the actual league baseline.
  const match1x2 = calculateOdds(home, away, { homeForm, awayForm, h2h, matchType, leagueAvgGoals })

  const rawλ1 = Math.max(match1x2.expectedHomeGoals, 0.3)
  const rawλ2 = Math.max(match1x2.expectedAwayGoals, 0.3)

  // Calibrate the λ ratio so the Poisson model's win-probability matches the
  // Elo-derived 1X2. This guarantees handicap direction, BTTS, and OU are all
  // coherent with the match-result odds — no more contradictory signals.
  const calibrated = calibrateExpectedGoals(rawλ1, rawλ2, match1x2.homeWinPct / 100)
  const λ1 = calibrated.lambda1
  const λ2 = calibrated.lambda2
  match1x2.expectedHomeGoals = λ1
  match1x2.expectedAwayGoals = λ2

  // Choose the primary O/U line based on expected total goals.
  const expectedTotal = λ1 + λ2
  const ouLine = expectedTotal <= 2.0 ? 1.5
               : expectedTotal <= 3.5 ? 2.5
               : 3.5

  // Poisson markets — all derived from the same calibrated λ values.
  const overUnder = calculateOverUnder(λ1, λ2, ouLine)
  const btts = calculateBTTS(λ1, λ2)
  const exactScores = calculateExactScores(λ1, λ2, 8)

  const hcapLine = suggestHandicapLine(λ1, λ2)
  const handicap = calculateHandicapOdds(λ1, λ2, hcapLine)

  const confidence = calculateConfidence(home, away, homeForm, awayForm, h2h)

  // Extended markets
  const OU_LINES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
  const overUnderLines = OU_LINES.map(l => calculateOverUnder(λ1, λ2, l))

  const HCP_TS_LINES = [2.5, 2, 1.5, 1, 0.5, -0.5, -1, -1.5, -2, -2.5]
  const handicapLines = HCP_TS_LINES.map(l => calculateHandicapOdds(λ1, λ2, l))

  const IT_LINES = [0.5, 1.5, 2.5]
  const homeIndividualTotals = IT_LINES.map(l => calculateIndividualTotal(λ1, l))
  const awayIndividualTotals = IT_LINES.map(l => calculateIndividualTotal(λ2, l))

  const doubleChance = calculateDoubleChance(
    match1x2.homeWinPct / 100,
    match1x2.drawPct    / 100,
    match1x2.awayWinPct / 100,
  )

  return {
    match1x2,
    overUnder,
    btts,
    exactScores,
    handicap,
    confidence,
    leagueAvgGoals,
    calculatedAt: new Date().toISOString(),
    doubleChance,
    overUnderLines,
    handicapLines,
    homeIndividualTotals,
    awayIndividualTotals,
  }
}
