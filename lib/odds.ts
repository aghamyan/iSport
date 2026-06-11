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
  // Use log-sum to avoid overflow: e^(-λ) * λ^k / k!
  let logP = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

/** P(X >= threshold) for X ~ Poisson(λ). */
function poissonCDF(upToExclusive: number, lambda: number): number {
  let acc = 0
  for (let k = 0; k < upToExclusive; k++) acc += poissonPMF(k, lambda)
  return acc
}

/**
 * Given fair probabilities (summing to 1.0), apply an overround margin
 * and return decimal odds. margin = 0.05 means 5 % bookmaker edge.
 */
export function applyMargin(probs: number[], margin: number): number[] {
  return probs.map(p => r2(1 / (p * (1 + margin))))
}

// ─── Additional output types ──────────────────────────────────────────────────

export type OverUnderMarket = {
  line:          number   // e.g. 2.5
  expectedTotal: number   // λ₁ + λ₂
  overProb:      number   // true probability (no margin)
  underProb:     number
  overOdds:      number   // decimal with margin
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
  label:    string   // "2-1"
}

export type HandicapMarket = {
  line:          number   // e.g. -1.5 (negative = home gives goals)
  homeOdds:      number   // home team wins after applying line
  awayOdds:      number
  homeProb:      number
  awayProb:      number
  expectedDiff:  number   // λ₁ - λ₂
}

export type ConfidenceResult = {
  score:       number   // 0–100
  label:       'low' | 'medium' | 'high'
  dataQuality: 'insufficient' | 'limited' | 'good' | 'excellent'
  factors:     { name: string; value: number; max: number; note: string }[]
}

export type CustomPropSuggestion = {
  numOptions:    2 | 3
  suggestedOdds: number[]   // one per option, with margin
  notes:         string
}

/** Complete odds package for all bet market types. */
export type FullMarketOdds = {
  // From the Elo engine
  match1x2:    OddsResult
  // Poisson extensions
  overUnder:   OverUnderMarket
  btts:        BTTSMarket
  exactScores: ExactScoreEntry[]
  handicap:    HandicapMarket
  // Meta
  confidence:  ConfidenceResult
  leagueAvgGoals: number
  calculatedAt:   string
}

// ─── Over / Under ─────────────────────────────────────────────────────────────

/**
 * Calculates Over/Under odds for a given goal line.
 * Default line is 2.5 (most common for FC/football games averaging 2–3 goals).
 */
export function calculateOverUnder(
  lambda1: number,
  lambda2: number,
  line = 2.5,
  margin = 0.055
): OverUnderMarket {
  const expectedTotal = r2(lambda1 + lambda2)
  const threshold     = Math.ceil(line)   // line=2.5 → threshold=3

  // P(total < threshold) = sum over all (a,b) where a+b < threshold
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
  margin = 0.055
): BTTSMarket {
  const pHome0  = poissonPMF(0, lambda1)   // P(home scores 0)
  const pAway0  = poissonPMF(0, lambda2)   // P(away scores 0)
  const pHome1p = 1 - pHome0               // P(home scores ≥ 1)
  const pAway1p = 1 - pAway0               // P(away scores ≥ 1)

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
  margin = 0.15
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
        odds:  r2(1 / (prob * (1 + margin))),
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
 * Calculates Asian-style handicap odds for a specific line.
 * Uses the Poisson distribution instead of the Elo approximation.
 * line > 0 = home team needs to win by more than `line` goals.
 */
export function calculateHandicapOdds(
  lambda1:      number,
  lambda2:      number,
  line:         number,   // e.g. 1.5 means home -1.5 (must win by 2+)
  margin = 0.055
): HandicapMarket {
  const expectedDiff = r2(lambda1 - lambda2)

  // Home covers: homeGoals - awayGoals > line
  // Away covers: awayGoals - homeGoals >= -line (i.e. diff <= line - epsilon)
  let homeProb = 0
  let awayProb = 0
  const MAX = 15

  for (let h = 0; h <= MAX; h++) {
    for (let a = 0; a <= MAX; a++) {
      const p   = poissonPMF(h, lambda1) * poissonPMF(a, lambda2)
      const diff = h - a
      if (diff > line)  homeProb += p
      if (diff < -line + 0.001) awayProb += p
      // Pushes (diff == ±line exactly) split 50/50 — only possible for whole-number lines
    }
  }

  // Normalise (push probability handled by not adding it to either)
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
 * Tries common lines [0.5, 1.0, 1.5, 2.0, 2.5] and picks the one where
 * |homeProb - 0.5| is minimised.
 */
export function suggestHandicapLine(lambda1: number, lambda2: number): number {
  const lines = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
  const diff  = lambda1 - lambda2
  if (Math.abs(diff) < 0.3) return 0.5  // very balanced match

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

  // ── Factor 4: result consistency — low variance = more predictable (max 15 pts)
  const allForm  = [...(homeForm ?? []), ...(awayForm ?? [])]
  let consScore  = 7.5   // neutral when no data
  if (allForm.length >= 4) {
    const wins   = allForm.filter(f => f.result === 'W').length / allForm.length
    const losses = allForm.filter(f => f.result === 'L').length / allForm.length
    // Consistency = how strongly one outcome dominates (deviation from 0.33 each)
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

// ─── Custom Prop Suggestions ──────────────────────────────────────────────────

/**
 * Suggests balanced starting odds for admin-created custom props.
 * For 2-option props: slightly less than evens (1.85) to embed margin.
 * For 3-option props: symmetric odds near 2.75 each.
 * Admin is expected to adjust manually from this baseline.
 */
export function suggestCustomPropOdds(numOptions: 2 | 3): CustomPropSuggestion {
  if (numOptions === 2) {
    return {
      numOptions:    2,
      suggestedOdds: [1.85, 1.85],
      notes:         'Balanced 2-way market at ~8% margin. Adjust if one outcome is clearly more likely.',
    }
  }
  return {
    numOptions:    3,
    suggestedOdds: [2.75, 2.75, 2.75],
    notes:         'Balanced 3-way market at ~9% margin. Adjust individual options to reflect true probabilities.',
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

  // ── 1X2 via Elo engine (existing algorithm)
  const match1x2 = calculateOdds(home, away, { homeForm, awayForm, h2h, matchType })

  const λ1 = Math.max(match1x2.expectedHomeGoals, 0.3)
  const λ2 = Math.max(match1x2.expectedAwayGoals, 0.3)

  // ── Choose the best O/U line based on expected total goals
  const expectedTotal = λ1 + λ2
  const ouLine = expectedTotal <= 2.0 ? 1.5
               : expectedTotal <= 3.5 ? 2.5
               : 3.5

  // ── Compute all Poisson markets
  const overUnder = calculateOverUnder(λ1, λ2, ouLine)

  const btts = calculateBTTS(λ1, λ2)

  const exactScores = calculateExactScores(λ1, λ2, 8)

  // ── Handicap: auto-suggest line, then compute odds
  const hcapLine = suggestHandicapLine(λ1, λ2)
  const handicap = calculateHandicapOdds(λ1, λ2, hcapLine)

  // ── Confidence
  const confidence = calculateConfidence(home, away, homeForm, awayForm, h2h)

  return {
    match1x2,
    overUnder,
    btts,
    exactScores,
    handicap,
    confidence,
    leagueAvgGoals,
    calculatedAt: new Date().toISOString(),
  }
}
