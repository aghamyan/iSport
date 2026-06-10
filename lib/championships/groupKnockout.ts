import { generateRoundRobin, type MatchSlot } from './roundRobin'
import { calculateStandings, type MatchRow } from './standings'

// Knockout cycle constants — large numbers so they sort after all group cycles
export const SEMI_LEG1_CYCLE    = 1000
export const SEMI_LEG2_CYCLE    = 1001
export const PENALTY_CYCLE      = 1500
export const FINAL_CYCLE        = 2000
export const FINAL_PENALTY_CYCLE = 2001

export type GroupSplit = {
  groupA: string[]
  groupB: string[]
}

/** Splits playerIds in half. Group A gets the extra player if count is odd. */
export function splitIntoGroups(playerIds: string[]): GroupSplit {
  const mid = Math.ceil(playerIds.length / 2)
  return {
    groupA: playerIds.slice(0, mid),
    groupB: playerIds.slice(mid),
  }
}

/** Generates all group-stage MatchSlots for both groups. */
export function generateGroupStageSlots(groupA: string[], groupB: string[], cycles: number): MatchSlot[] {
  const slotsA = generateRoundRobin(groupA, cycles).map((s) => ({
    ...s,
    groupLabel: 'A' as const,
    round: 'group' as const,
    leg: null,
  }))
  const slotsB = generateRoundRobin(groupB, cycles).map((s) => ({
    ...s,
    groupLabel: 'B' as const,
    round: 'group' as const,
    leg: null,
  }))
  return [...slotsA, ...slotsB]
}

export type KnockoutQualifiers = {
  a1: string  // Group A 1st
  a2: string  // Group A 2nd
  b1: string  // Group B 1st
  b2: string  // Group B 2nd
}

/**
 * Given confirmed group-stage matches and per-group player lists,
 * returns the top-2 qualifiers from each group.
 */
export function getKnockoutQualifiers(
  groupMatches: MatchRow[],
  groupA: string[],
  groupB: string[]
): KnockoutQualifiers {
  const standingsA = calculateStandings(groupMatches.filter((m) =>
    groupA.includes(m.homePlayerId) && groupA.includes(m.awayPlayerId)
  ), groupA)

  const standingsB = calculateStandings(groupMatches.filter((m) =>
    groupB.includes(m.homePlayerId) && groupB.includes(m.awayPlayerId)
  ), groupB)

  return {
    a1: standingsA[0].playerId,
    a2: standingsA[1].playerId,
    b1: standingsB[0].playerId,
    b2: standingsB[1].playerId,
  }
}

/**
 * Semi-final pairings (CL-style):
 *   Tie 1: A1 (home) vs B2 (away)  — Leg 1 + Leg 2
 *   Tie 2: B1 (home) vs A2 (away)  — Leg 1 + Leg 2
 */
export function generateSemiSlots(q: KnockoutQualifiers): MatchSlot[] {
  return [
    // Tie 1 — Leg 1: A1 home
    { homePlayerId: q.a1, awayPlayerId: q.b2, cycle: SEMI_LEG1_CYCLE, groupLabel: null, round: 'semi', leg: 1 },
    // Tie 1 — Leg 2: B2 home
    { homePlayerId: q.b2, awayPlayerId: q.a1, cycle: SEMI_LEG2_CYCLE, groupLabel: null, round: 'semi', leg: 2 },
    // Tie 2 — Leg 1: B1 home
    { homePlayerId: q.b1, awayPlayerId: q.a2, cycle: SEMI_LEG1_CYCLE, groupLabel: null, round: 'semi', leg: 1 },
    // Tie 2 — Leg 2: A2 home
    { homePlayerId: q.a2, awayPlayerId: q.b1, cycle: SEMI_LEG2_CYCLE, groupLabel: null, round: 'semi', leg: 2 },
  ]
}

export type SemiResult = {
  /** The player who advances from the tie, or null if still unresolved */
  winner: string | null
  /** true when a penalty decider match is needed */
  needsPenalty: boolean
}

type SemiLeg = {
  homePlayerId: string
  awayPlayerId: string
  homeScore: number
  awayScore: number
  round: string
  leg: number | null
}

/**
 * Determines the winner of a two-legged semi-final tie.
 * p1 / p2 are the two players in the tie (order doesn't matter).
 * Returns winner ID, or null if tied on aggregate (penalty decider needed).
 */
export function resolveSemiTie(p1: string, p2: string, legs: SemiLeg[]): SemiResult {
  const leg1 = legs.find((m) => m.leg === 1 && m.round === 'semi')
  const leg2 = legs.find((m) => m.leg === 2 && m.round === 'semi')
  const penalty = legs.find((m) => m.round === 'penalty')

  // If a penalty decider exists, its result is authoritative
  if (penalty) {
    const w = penalty.homeScore > penalty.awayScore ? penalty.homePlayerId : penalty.awayPlayerId
    return { winner: w, needsPenalty: false }
  }

  if (!leg1 || !leg2) return { winner: null, needsPenalty: false }

  // Aggregate: treat each player's goals across both legs
  let p1Goals = 0
  let p2Goals = 0

  for (const leg of [leg1, leg2]) {
    if (leg.homePlayerId === p1) {
      p1Goals += leg.homeScore
      p2Goals += leg.awayScore
    } else {
      p2Goals += leg.homeScore
      p1Goals += leg.awayScore
    }
  }

  if (p1Goals > p2Goals) return { winner: p1, needsPenalty: false }
  if (p2Goals > p1Goals) return { winner: p2, needsPenalty: false }
  return { winner: null, needsPenalty: true }
}

/** Generates the single final match slot. */
export function generateFinalSlot(finalist1: string, finalist2: string): MatchSlot {
  return {
    homePlayerId: finalist1,
    awayPlayerId: finalist2,
    cycle: FINAL_CYCLE,
    groupLabel: null,
    round: 'final',
    leg: null,
  }
}

/** Generates a penalty-decider slot for a tied semi-final tie. */
export function generatePenaltySlot(p1: string, p2: string): MatchSlot {
  return {
    homePlayerId: p1,
    awayPlayerId: p2,
    cycle: PENALTY_CYCLE,
    groupLabel: null,
    round: 'penalty',
    leg: null,
  }
}

/** Generates a penalty-decider slot for a drawn final. */
export function generateFinalPenaltySlot(p1: string, p2: string): MatchSlot {
  return {
    homePlayerId: p1,
    awayPlayerId: p2,
    cycle: FINAL_PENALTY_CYCLE,
    groupLabel: null,
    round: 'final_penalty',
    leg: null,
  }
}
