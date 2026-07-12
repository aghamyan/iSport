import type { NamedPlayerStats } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// P4P v2 — Pound-for-Pound ranking engine
//
// Redesigned to reward sustained excellence over a hot streak on a small
// sample. See the design doc for full derivations; this file documents the
// "what" and "why" inline, formula by formula.
//
// ARCHITECTURE — three sample-size mechanisms, each with exactly one job:
//
//  1. Bayesian shrinkage (`bayesianShrink`) — de-biases a small-sample point
//     estimate (win rate, strength of schedule, recent form) toward a
//     neutral prior. A 2-0 record and an 80-20 record are both "100%" and
//     "80%" on paper, but a 2-0 record carries far less evidence about the
//     player's true skill — shrinkage pulls it toward 0.5 proportionally to
//     how little evidence backs it. Prior weight k is intentionally SMALL
//     (k=4): its only job is correcting bias, not penalizing volume.
//
//  2. Confidence gate (`confidenceGate`) — scales the six pillars that are
//     *statistical point estimates* (win quality, schedule strength, recent
//     form, goal dominance, attack, defense) toward zero when there isn't
//     enough evidence to trust ANY of them, ramping in gradually over
//     ~20-30 games. This is the mechanism that actually answers "how much
//     do we trust this player's ranking overall" — shrinkage answers
//     "which way is this one number probably wrong."
//
//  3. Experience pillar — rewards match volume directly and additively. It
//     is NOT gated by the confidence gate (that would be double-penalizing
//     the same dimension) and titles are NOT gated either (a completed
//     championship is a discrete, already-verified achievement, not a
//     noisy sample — there's no statistical uncertainty about whether you
//     won it).
//
// Reusing (1) is deliberate: win quality, strength of schedule, and recent
// form all funnel through the same `bayesianShrink` primitive with
// different (sum, effective-n) inputs, rather than three bespoke formulas.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tunable constants (all derived, documented below — none are guesses) ──

// Prior pseudo-observations for Bayesian shrinkage. k=4 means "trust the
// prior as much as 4 average games" — enough to pull a 2-0 record from
// 1.00 down to 0.67, not enough to meaningfully touch an 80-20 record
// (0.80 -> 0.79 at n=100). Small on purpose: bias-correction only.
const SHRINK_K = 4

// Confidence gate half-behaviour: C(n) = 1 - exp(-n/CONFIDENCE_TAU).
// Solved so C(25) = 0.95 — "roughly full confidence by 20-30 games" per
// spec: exp(-25/tau) = 0.05  =>  tau = 25 / ln(20).
const CONFIDENCE_TAU = 25 / Math.log(20) // ≈ 8.345

// Experience saturation: 1 - exp(-n/EXPERIENCE_TAU). Chosen larger than
// CONFIDENCE_TAU on purpose — "played for months" implies materially more
// games than "enough to trust your stats". n=40 -> 63%, n=80 -> 87%,
// n=120 -> 95%. Continues rewarding volume well past the confidence
// threshold, then plateaus so pure grinding can't buy a top rank.
const EXPERIENCE_TAU = 40

// Legacy half-saturation: LegacyRaw / (LegacyRaw + LEGACY_LAMBDA). Anchored
// so a single World Championship (prestige weight 8, see schema) alone
// reaches exactly half of the asymptotic max — "one truly prestigious
// title should already carry real weight" — while still rewarding the
// 7th/10th title with real (if shrinking) marginal value.
const LEGACY_LAMBDA = 8

// Recent-form recency half-life, in games: weight halves every 15 games
// back from the most recent, so influence decays smoothly instead of
// falling off a hard "last 15" cliff (which would be gameable by timing
// a reset right before a cutoff).
const RECENT_FORM_HALF_LIFE = 15
const RECENT_FORM_RHO = Math.pow(0.5, 1 / RECENT_FORM_HALF_LIFE)

// Pillar weights — sum to 1.0. See design doc for the ordering rationale
// (win quality highest: hardest to fake with volume once shrunk; goals
// lowest: style, not outcome).
const WEIGHTS = {
  winQuality:         0.30,
  legacy:             0.20,
  experience:         0.10,
  strengthOfSchedule: 0.10,
  recentForm:         0.10,
  goalDominance:       0.10,
  attack:             0.05,
  defense:            0.05,
} as const

// ── Core statistical primitives ─────────────────────────────────────────────

/** Beta-Binomial posterior mean: shrinks an observed rate toward a neutral
 *  prior, proportionally less as evidence (n) accumulates. */
function bayesianShrink(sum: number, n: number, priorMean: number, priorWeight: number): number {
  return (sum + priorWeight * priorMean) / (n + priorWeight)
}

/** 0 at n=0, ramps smoothly, ~0.95 by n=25. Gates the six noisy pillars. */
function confidenceGate(n: number): number {
  if (n <= 0) return 0
  return 1 - Math.exp(-n / CONFIDENCE_TAU)
}

/** Saturating [0,1) reward for cumulative volume — never fully caps. */
function saturate(n: number, tau: number): number {
  if (n <= 0) return 0
  return 1 - Math.exp(-n / tau)
}

/** Hyperbolic (Michaelis-Menten) diminishing returns: x/(x+c). Smooth,
 *  bounded [0,1), keeps rewarding larger x without a hard cap/cliff. */
function hyperbolic(x: number, c: number): number {
  if (x <= 0) return 0
  return x / (x + c)
}

/** Logistic centred at 0, scaled by s: maps (-inf,inf) -> (0,1). */
function logistic(x: number, s: number): number {
  return 1 / (1 + Math.exp(-x / s))
}

// ── Match-level input for Strength of Schedule + Recent Form ───────────────

export type P4PMatchEntry = {
  opponentId: string
  result: 'W' | 'D' | 'L'
  playedAt: string // ISO timestamp — championship-level date; ties across every match in the same championship
  recordedAt: string // ISO timestamp the score was actually recorded — breaks those ties chronologically
}

/** Weighted title record for one player: raw count (display) + prestige-
 *  weighted sum (the actual Legacy input). See championships.prestige_weight. */
export type TitleRecord = {
  count: number
  weightedSum: number
}

export type P4PBreakdown = {
  score:              number // final 0–100
  winQuality:         number // 0–30  Bayesian-shrunk match score (win=1, draw=0.5, loss=0)
  legacy:             number // 0–20  prestige-weighted championship titles, diminishing returns
  experience:         number // 0–10  saturating reward for total competitive matches played
  strengthOfSchedule: number // 0–10  performance weighted by opponent strength
  recentForm:         number // 0–10  exponentially recency-weighted match score
  goalDominance:       number // 0–10  logistic-saturated average goal difference
  attack:             number // 0–5   hyperbolic-saturated average goals for
  defense:            number // 0–5   hyperbolic-saturated average goals against
  confidence:         number // 0–1   confidence gate value (applied to the 6 pillars above marked *)
  titles:             number // raw completed-championship count (display only)
  legacyRaw:          number // prestige-weighted title sum feeding `legacy`
}

export type P4PRankedPlayer = NamedPlayerStats & {
  p4p: P4PBreakdown
}

// Pillars subject to the confidence gate — statistical point estimates that
// are unreliable on a small sample. Legacy and Experience are excluded:
// Legacy is a verified discrete achievement (no sampling uncertainty), and
// Experience already IS the volume signal (gating it would double-count n).
type GatedInputs = {
  winQuality: number
  strengthOfSchedule: number
  recentForm: number
  goalDominance: number
  attack: number
  defense: number
}

function gatedSubtotal(g: GatedInputs): number {
  return (
    WEIGHTS.winQuality * g.winQuality +
    WEIGHTS.strengthOfSchedule * g.strengthOfSchedule +
    WEIGHTS.recentForm * g.recentForm +
    WEIGHTS.goalDominance * g.goalDominance +
    WEIGHTS.attack * g.attack +
    WEIGHTS.defense * g.defense
  )
}

// ── Population-calibrated scale constants ───────────────────────────────────
//
// Goal Dominance / Attack / Defense use scale constants derived from the
// current player pool's own scoring behaviour (empirical Bayes in spirit)
// rather than hardcoded magic numbers, so they self-calibrate to this
// platform's actual match dynamics (e.g. if FC27 plays higher-scoring than
// FC26, these adapt automatically). Win Quality and Strength of Schedule
// deliberately do NOT do this — they're centred on a fixed neutral prior
// (0.5) so a player's rank doesn't drift purely because other players'
// stats changed, which matters most for the components that most directly
// decide "who is #1".

export type PopulationScale = {
  dominanceScale: number // logistic scale for avg goal diff
  attackScale:    number // hyperbolic half-saturation for avg goals for
  defenseScale:   number // hyperbolic half-saturation for avg goals against
}

export function computePopulationScale(players: NamedPlayerStats[]): PopulationScale {
  const withMatches = players.filter((p) => p.matchesPlayed > 0)
  if (withMatches.length === 0) {
    return { dominanceScale: 2, attackScale: 1.5, defenseScale: 1.5 }
  }

  const avgGDs = withMatches.map((p) => p.goalDiff / p.matchesPlayed)
  const avgGFs = withMatches.map((p) => p.goalsFor / p.matchesPlayed)
  const avgGAs = withMatches.map((p) => p.goalsAgainst / p.matchesPlayed)

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const stdev = (xs: number[]) => {
    const m = mean(xs)
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
  }

  return {
    dominanceScale: Math.max(1, stdev(avgGDs)),
    attackScale:    Math.max(1, mean(avgGFs)),
    defenseScale:   Math.max(1, mean(avgGAs)),
  }
}

// ── Base Skill Proxy — resolves the Strength-of-Schedule circularity ───────
//
// "How strong were my opponents?" needs *some* independent measure of each
// opponent's skill that doesn't itself depend on Strength of Schedule (or
// you get a circular / fixed-point problem). We use each player's own
// shrunk win-quality as that proxy — computed once per player from their
// aggregate record, independent of who they played. No persisted rating,
// no trigger, no migration: purely transient, recomputed on every read
// inside the same 60s stats cache.

function matchScoreSum(p: NamedPlayerStats): number {
  return p.wins + 0.5 * p.draws
}

export function computeBaseSkillProxy(players: NamedPlayerStats[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of players) {
    map.set(p.id, bayesianShrink(matchScoreSum(p), p.matchesPlayed, 0.5, SHRINK_K))
  }
  return map
}

const RESULT_VALUE: Record<P4PMatchEntry['result'], number> = { W: 1, D: 0.5, L: 0 }

/** Strength-of-Schedule: performance weighted by each opponent's base skill
 *  proxy, then Bayesian-shrunk using the total opponent-strength weight as
 *  the effective sample size. Beating strong opponents counts more than
 *  beating weak ones; facing nobody of note keeps this near neutral. */
function strengthOfSchedule(history: P4PMatchEntry[], bsp: Map<string, number>): number {
  let weightedSum = 0
  let weightTotal = 0
  for (const m of history) {
    const oppStrength = bsp.get(m.opponentId) ?? 0.5
    weightedSum += RESULT_VALUE[m.result] * oppStrength
    weightTotal += oppStrength
  }
  return bayesianShrink(weightedSum, weightTotal, 0.5, SHRINK_K)
}

/** Recent Form: exponentially recency-weighted match score (half-life
 *  RECENT_FORM_HALF_LIFE games), Bayesian-shrunk using the total decay
 *  weight as an effective sample size. No hard "last N" cutoff — decay
 *  is continuous, so there's no boundary to game by timing a reset. */
function recentForm(history: P4PMatchEntry[]): number {
  const sorted = [...history].sort((a, b) => {
    const dateDiff = new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
    if (dateDiff !== 0) return dateDiff
    return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  })
  let weightedSum = 0
  let weightTotal = 0
  sorted.forEach((m, i) => {
    const w = Math.pow(RECENT_FORM_RHO, i)
    weightedSum += RESULT_VALUE[m.result] * w
    weightTotal += w
  })
  return bayesianShrink(weightedSum, weightTotal, 0.5, SHRINK_K)
}

// ── Main per-player calculation ─────────────────────────────────────────────

export function calcP4P(
  player: NamedPlayerStats,
  titles: TitleRecord,
  history: P4PMatchEntry[],
  bsp: Map<string, number>,
  scale: PopulationScale,
): P4PBreakdown {
  const mp = player.matchesPlayed

  const avgGD = mp > 0 ? player.goalDiff / mp : 0
  const avgGF = mp > 0 ? player.goalsFor / mp : 0
  const avgGA = mp > 0 ? player.goalsAgainst / mp : 0

  // ── The six gated (statistically noisy) pillars, each 0–1 before weighting ──

  const winQuality01         = bayesianShrink(matchScoreSum(player), mp, 0.5, SHRINK_K)
  const strengthOfSchedule01 = strengthOfSchedule(history, bsp)
  const recentForm01         = recentForm(history)
  const goalDominance01       = logistic(avgGD, scale.dominanceScale)
  const attack01              = hyperbolic(avgGF, scale.attackScale)

  // Defense rewards LOW goals-against, so this is the inverted hyperbolic
  // form: scale/(scale+avgGA) instead of avgGA/(avgGA+scale).
  const defenseReward01 = avgGA <= 0 ? 1 : scale.defenseScale / (scale.defenseScale + avgGA)

  const confidence = confidenceGate(mp)

  const gated = gatedSubtotal({
    winQuality: winQuality01,
    strengthOfSchedule: strengthOfSchedule01,
    recentForm: recentForm01,
    goalDominance: goalDominance01,
    attack: attack01,
    defense: defenseReward01,
  })

  // ── The two ungated pillars ──────────────────────────────────────────────

  const legacy01     = hyperbolic(titles.weightedSum, LEGACY_LAMBDA)
  const experience01 = saturate(mp, EXPERIENCE_TAU)

  const ungated = WEIGHTS.legacy * legacy01 + WEIGHTS.experience * experience01

  const scoreFraction = confidence * gated + ungated
  const score = Math.round(scoreFraction * 1000) / 10 // 0-100, 1 decimal

  const round1 = (x: number) => Math.round(x * 10) / 10

  return {
    score,
    winQuality:         round1(WEIGHTS.winQuality * winQuality01 * 100),
    legacy:             round1(WEIGHTS.legacy * legacy01 * 100),
    experience:         round1(WEIGHTS.experience * experience01 * 100),
    strengthOfSchedule: round1(WEIGHTS.strengthOfSchedule * strengthOfSchedule01 * 100),
    recentForm:         round1(WEIGHTS.recentForm * recentForm01 * 100),
    goalDominance:       round1(WEIGHTS.goalDominance * goalDominance01 * 100),
    attack:             round1(WEIGHTS.attack * attack01 * 100),
    defense:            round1(WEIGHTS.defense * defenseReward01 * 100),
    confidence:         Math.round(confidence * 100) / 100,
    titles:             titles.count,
    legacyRaw:           titles.weightedSum,
  }
}

/**
 * Ranks players by P4P score.
 *
 * @param players               championship-only aggregate stats (see getChampionshipOnlyStats)
 * @param titlesByPlayer        playerId -> { count, weightedSum } from completed championships
 * @param matchHistoryByPlayer  playerId -> chronological championship match list (see getChampionshipMatchHistory)
 */
export function rankByP4P(
  players: NamedPlayerStats[],
  titlesByPlayer: Map<string, TitleRecord>,
  matchHistoryByPlayer: Map<string, P4PMatchEntry[]>,
): P4PRankedPlayer[] {
  const bsp   = computeBaseSkillProxy(players)
  const scale = computePopulationScale(players)

  return players
    .map((p) => ({
      ...p,
      p4p: calcP4P(
        p,
        titlesByPlayer.get(p.id) ?? { count: 0, weightedSum: 0 },
        matchHistoryByPlayer.get(p.id) ?? [],
        bsp,
        scale,
      ),
    }))
    .sort((a, b) => b.p4p.score - a.p4p.score)
}
