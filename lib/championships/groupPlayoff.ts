import { generateRoundRobin, type MatchSlot } from './roundRobin'
import { calculateStandings, type MatchRow } from './standings'
import { SEMI_LEG1_CYCLE, SEMI_LEG2_CYCLE, PENALTY_CYCLE } from './groupKnockout'

export type PlayoffQualifiers = {
  p1: string  // 1st place
  p2: string  // 2nd place
  p3: string  // 3rd place
  p4: string  // 4th place
}

// Sorts after all group cycles, before the semi-final legs.
export const FOURTH_PLACE_DECIDER_CYCLE = 900

export type FourthPlaceTie = {
  p4: string
  p5: string
}

export type DeciderMatchResult = {
  homePlayerId: string
  awayPlayerId: string
  homeScore: number | null
  awayScore: number | null
}

export type PlayoffSemiResult = {
  winner: string | null
  needsPenalty: boolean
}

type SemiMatch = {
  homePlayerId: string
  awayPlayerId: string
  homeScore: number | null
  awayScore: number | null
  round: string
  leg: number | null
}

/** Single-group round-robin with round:'group' tags. */
export function generateGroupPlayoffStageSlots(playerIds: string[], cycles: number): MatchSlot[] {
  return generateRoundRobin(playerIds, cycles).map((s) => ({
    ...s,
    groupLabel: null,
    round: 'group' as const,
    leg: null,
  }))
}

/**
 * Returns top-4 qualifiers from the single group standings.
 *
 * When the 4th and 5th-placed players are tied on points, a decider
 * match may have been played between them (see `getFourthPlaceTie` /
 * `generateFourthPlaceDeciderSlot`). If `deciderMatch` has a decisive
 * result for that exact pair, its winner takes the 4th qualifying spot
 * instead of whoever the goal-diff/H2H tiebreak would have picked.
 */
export function getPlayoffQualifiers(
  groupMatches: MatchRow[],
  playerIds: string[],
  deciderMatch?: DeciderMatchResult | null
): PlayoffQualifiers {
  const standings = calculateStandings(groupMatches, playerIds)
  if (standings.length < 4) throw new Error('Need at least 4 players in standings')

  const order = standings.map((r) => r.playerId)

  if (
    deciderMatch &&
    deciderMatch.homeScore !== null &&
    deciderMatch.awayScore !== null &&
    deciderMatch.homeScore !== deciderMatch.awayScore &&
    order.length >= 5
  ) {
    const fourth = order[3]
    const fifth = order[4]
    const pair = new Set([deciderMatch.homePlayerId, deciderMatch.awayPlayerId])
    if (pair.has(fourth) && pair.has(fifth)) {
      const winner = deciderMatch.homeScore > deciderMatch.awayScore ? deciderMatch.homePlayerId : deciderMatch.awayPlayerId
      if (winner !== fourth) {
        order[3] = winner
        order[4] = fourth
      }
    }
  }

  return {
    p1: order[0],
    p2: order[1],
    p3: order[2],
    p4: order[3],
  }
}

/**
 * When the 4th and 5th-placed players in the group table are level on
 * points, offers an on-pitch decider instead of relying solely on goal
 * difference / head-to-head. Returns the tied pair, or null if there's
 * no tie at the qualification boundary (or fewer than 5 players).
 */
export function getFourthPlaceTie(groupMatches: MatchRow[], playerIds: string[]): FourthPlaceTie | null {
  const standings = calculateStandings(groupMatches, playerIds)
  if (standings.length < 5) return null
  if (standings[3].points !== standings[4].points) return null
  return { p4: standings[3].playerId, p5: standings[4].playerId }
}

/**
 * Generates the 4th-place decider match slot. This match is registered
 * like any other but tagged with round 'qualifier_decider' so it's
 * excluded from the group table (which only counts round === 'group').
 */
export function generateFourthPlaceDeciderSlot(p4: string, p5: string): MatchSlot {
  return {
    homePlayerId: p4,
    awayPlayerId: p5,
    cycle: FOURTH_PLACE_DECIDER_CYCLE,
    groupLabel: null,
    round: 'qualifier_decider',
    leg: null,
  }
}

/**
 * Two-legged semi-final pairings (CL-style):
 *   Semi 1: 1st (home) vs 4th (away) — Leg 1 + Leg 2
 *   Semi 2: 2nd (home) vs 3rd (away) — Leg 1 + Leg 2
 */
export function generatePlayoffSemiSlots(q: PlayoffQualifiers): MatchSlot[] {
  return [
    // Semi 1 — Leg 1: p1 home
    { homePlayerId: q.p1, awayPlayerId: q.p4, cycle: SEMI_LEG1_CYCLE, groupLabel: null, round: 'semi', leg: 1 },
    // Semi 1 — Leg 2: p4 home
    { homePlayerId: q.p4, awayPlayerId: q.p1, cycle: SEMI_LEG2_CYCLE, groupLabel: null, round: 'semi', leg: 2 },
    // Semi 2 — Leg 1: p2 home
    { homePlayerId: q.p2, awayPlayerId: q.p3, cycle: SEMI_LEG1_CYCLE, groupLabel: null, round: 'semi', leg: 1 },
    // Semi 2 — Leg 2: p3 home
    { homePlayerId: q.p3, awayPlayerId: q.p2, cycle: SEMI_LEG2_CYCLE, groupLabel: null, round: 'semi', leg: 2 },
  ]
}

/**
 * Resolves a two-legged semi-final tie (or its penalty decider) on aggregate.
 * Returns winner ID, or null when not yet resolved (legs incomplete / aggregate level).
 */
export function resolvePlayoffSemi(p1: string, p2: string, matches: SemiMatch[]): PlayoffSemiResult {
  const penalty = matches.find((m) => m.round === 'penalty')
  if (penalty && penalty.homeScore !== null && penalty.awayScore !== null) {
    const w = penalty.homeScore > penalty.awayScore ? penalty.homePlayerId : penalty.awayPlayerId
    return { winner: w, needsPenalty: false }
  }

  const legs = matches.filter((m) => m.round === 'semi')
  const leg1 = legs.find((m) => m.leg === 1)
  const leg2 = legs.find((m) => m.leg === 2)

  if (!leg1 || !leg2 || leg1.homeScore === null || leg2.homeScore === null) {
    return { winner: null, needsPenalty: false }
  }

  let p1Goals = 0
  let p2Goals = 0
  for (const leg of [leg1, leg2]) {
    if (leg.homePlayerId === p1) {
      p1Goals += leg.homeScore!
      p2Goals += leg.awayScore!
    } else {
      p2Goals += leg.homeScore!
      p1Goals += leg.awayScore!
    }
  }

  if (p1Goals > p2Goals) return { winner: p1, needsPenalty: false }
  if (p2Goals > p1Goals) return { winner: p2, needsPenalty: false }
  return { winner: null, needsPenalty: true }
}
