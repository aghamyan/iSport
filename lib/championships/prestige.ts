// Prestige weight (P4P Legacy pillar input, see lib/stats/p4p.ts) is derived
// from the size of the player pool a champion has to beat, not chosen by
// hand. A bigger field is an objectively harder gauntlet to win outright, so
// player count is a non-arbitrary proxy for how much a title should count —
// no admin judgment call, no picker to second-guess.
//
//   2-4 players  -> friendly  -> weight 2
//   5-6 players  -> standard  -> weight 4
//   7+  players  -> major     -> weight 8

export type PrestigeTier = 'friendly' | 'standard' | 'major'

export const PRESTIGE_WEIGHT: Record<PrestigeTier, number> = {
  friendly: 2,
  standard: 4,
  major:    8,
}

export function prestigeTierForPlayerCount(playerCount: number): PrestigeTier {
  if (playerCount <= 4) return 'friendly'
  if (playerCount <= 6) return 'standard'
  return 'major'
}

export function prestigeWeightForPlayerCount(playerCount: number): number {
  return PRESTIGE_WEIGHT[prestigeTierForPlayerCount(playerCount)]
}
