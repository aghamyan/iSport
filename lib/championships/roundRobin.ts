export type MatchSlot = {
  homePlayerId: string
  awayPlayerId: string
  cycle: number
  groupLabel?: string | null
  round?: string | null
  leg?: number | null
}

/**
 * Generates all round-robin pairings for the given player IDs and number of
 * cycles. Odd cycles: players[i] is home. Even cycles: home/away reversed,
 * so every pair plays at home exactly once per two-cycle block.
 */
export function generateRoundRobin(playerIds: string[], cycles: number): MatchSlot[] {
  const slots: MatchSlot[] = []
  for (let c = 1; c <= cycles; c++) {
    const evenCycle = c % 2 === 0
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        slots.push({
          homePlayerId: evenCycle ? playerIds[j] : playerIds[i],
          awayPlayerId: evenCycle ? playerIds[i] : playerIds[j],
          cycle: c,
        })
      }
    }
  }
  return slots
}
