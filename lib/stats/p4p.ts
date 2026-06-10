import type { NamedPlayerStats } from './types'

export type P4PBreakdown = {
  score:      number  // final 0–100
  clutch:     number  // 0–35  win rate
  form:       number  // 0–20  points per game
  dominance:  number  // 0–20  avg goal diff
  legacy:     number  // 0–15  championship titles
  attack:     number  // 0–6   goals scored per game
  resilience: number  // 0–4   goals conceded per game
  confidence: number  // 0–1   sample-size multiplier
  titles:     number  // raw title count
}

export type P4PRankedPlayer = NamedPlayerStats & {
  p4p: P4PBreakdown
}

/**
 * P4P (Pound-for-Pound) rating — a weighted composite that rewards consistent
 * winning, championship titles, goal dominance, and balanced attack/defense.
 *
 * Pillars               Weight   What it captures
 * ──────────────────────────────────────────────────────────────────────────
 * Clutch   (win rate)    35 pts  How often you win outright
 * Form     (PPG)         20 pts  Points-per-game incl. draws (3/1/0)
 * Dominance (avg GD)     20 pts  Goal-margin control per game
 * Legacy   (titles)      15 pts  Championship belts won
 * Attack   (avg GF)       6 pts  Offensive output per game
 * Resilience (avg GA)     4 pts  Defensive solidity per game
 *
 * Confidence multiplier: linear ramp from 0.30 (1 game) → 1.00 (≥5 games)
 * so a new player can never leapfrog an established one on a single result.
 */
export function calcP4P(
  player: NamedPlayerStats,
  titles: number,
): P4PBreakdown {
  const mp = player.matchesPlayed

  if (mp === 0) {
    return {
      score: 0, clutch: 0, form: 0, dominance: 0,
      legacy: 0, attack: 0, resilience: 0, confidence: 0, titles,
    }
  }

  const winRate = player.wins / mp
  const ppg     = (player.wins * 3 + player.draws) / mp
  const avgGD   = player.goalDiff / mp
  const avgGF   = player.goalsFor / mp
  const avgGA   = player.goalsAgainst / mp

  // ── Pillars ───────────────────────────────────────────────────────────────

  const clutch     = winRate * 35

  const form       = (ppg / 3) * 20

  // avgGD range anchored at [-3, +3]; below -3 scores 0, above +3 maxes out
  const dominance  = Math.max(0, Math.min(1, (avgGD + 3) / 6)) * 20

  // First title worth 10 pts, each extra +2.5, hard-capped at 15
  const legacy     = Math.min(15, titles > 0 ? 10 + (titles - 1) * 2.5 : 0)

  // Goals-for normalised to 3/game ceiling
  const attack     = Math.min(1, avgGF / 3) * 6

  // Goals-against: 0 GA/game → full 4 pts, 4 GA/game → 0 pts
  const resilience = Math.max(0, 1 - avgGA / 4) * 4

  // ── Confidence ────────────────────────────────────────────────────────────
  // Linear: 0.30 at 1 game, 1.00 at ≥5 games
  const confidence = 0.3 + 0.7 * Math.min(1, mp / 5)

  const raw   = clutch + form + dominance + legacy + attack + resilience
  const score = raw * confidence

  return {
    score:      Math.round(score * 10) / 10,
    clutch:     Math.round(clutch * 10) / 10,
    form:       Math.round(form * 10) / 10,
    dominance:  Math.round(dominance * 10) / 10,
    legacy:     Math.round(legacy * 10) / 10,
    attack:     Math.round(attack * 10) / 10,
    resilience: Math.round(resilience * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    titles,
  }
}

/**
 * Given the leaderboard and a map of playerId → title count (from completed
 * championships), returns all players sorted by P4P descending.
 */
export function rankByP4P(
  players: NamedPlayerStats[],
  titlesByPlayer: Map<string, number>,
): P4PRankedPlayer[] {
  return players
    .map((p) => ({
      ...p,
      p4p: calcP4P(p, titlesByPlayer.get(p.id) ?? 0),
    }))
    .sort((a, b) => b.p4p.score - a.p4p.score)
}
