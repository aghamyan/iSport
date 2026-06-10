import { generateRoundRobin, type MatchSlot } from './roundRobin'
import { calculateStandings, type MatchRow } from './standings'
import { SEMI_LEG1_CYCLE, PENALTY_CYCLE } from './groupKnockout'

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
 * Two single-leg semi-final pairings:
 *   Semi 1: 1st (home) vs 4th (away)
 *   Semi 2: 2nd (home) vs 3rd (away)
 */
export function generatePlayoffSemiSlots(q: PlayoffQualifiers): MatchSlot[] {
  return [
    { homePlayerId: q.p1, awayPlayerId: q.p4, cycle: SEMI_LEG1_CYCLE, groupLabel: null, round: 'semi', leg: null },
    { homePlayerId: q.p2, awayPlayerId: q.p3, cycle: SEMI_LEG1_CYCLE, groupLabel: null, round: 'semi', leg: null },
  ]
}

/**
 * Resolves a single-leg semi-final or its penalty decider.
 * Returns winner ID, or null when the match is unplayed / tied (penalty needed).
 */
export function resolvePlayoffSemi(p1: string, p2: string, matches: SemiMatch[]): PlayoffSemiResult {
  const penalty = matches.find((m) => m.round === 'penalty')
  if (penalty && penalty.homeScore !== null && penalty.awayScore !== null) {
    const w = penalty.homeScore > penalty.awayScore ? penalty.homePlayerId : penalty.awayPlayerId
    return { winner: w, needsPenalty: false }
  }

  const semi = matches.find((m) => m.round === 'semi')
  if (!semi || semi.homeScore === null || semi.awayScore === null) {
    return { winner: null, needsPenalty: false }
  }

  if (semi.homeScore > semi.awayScore) return { winner: semi.homePlayerId, needsPenalty: false }
  if (semi.awayScore > semi.homeScore) return { winner: semi.awayPlayerId, needsPenalty: false }
  return { winner: null, needsPenalty: true }
}
