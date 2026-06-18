import { generateRoundRobin, type MatchSlot } from './roundRobin'
import { calculateStandings, type MatchRow } from './standings'
import { SEMI_LEG1_CYCLE, SEMI_LEG2_CYCLE, PENALTY_CYCLE } from './groupKnockout'

export type PlayoffQualifiers = {
  p1: string  // 1st place
  p2: string  // 2nd place
  p3: string  // 3rd place
  p4: string  // 4th place
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

/** Returns top-4 qualifiers from the single group standings. */
export function getPlayoffQualifiers(groupMatches: MatchRow[], playerIds: string[]): PlayoffQualifiers {
  const standings = calculateStandings(groupMatches, playerIds)
  if (standings.length < 4) throw new Error('Need at least 4 players in standings')
  return {
    p1: standings[0].playerId,
    p2: standings[1].playerId,
    p3: standings[2].playerId,
    p4: standings[3].playerId,
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
