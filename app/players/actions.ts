'use server'

import { getH2HStats, getH2HMatches, getPlayerForm } from '@/lib/stats/queries'
import type { H2HRecord, H2HMatchEntry, FormEntry } from '@/lib/stats/types'

export async function fetchH2HAction(
  player1Id: string,
  player2Id: string
): Promise<H2HRecord | null> {
  return getH2HStats(player1Id, player2Id)
}

export async function fetchH2HMatchesAction(
  player1Id: string,
  player2Id: string
): Promise<H2HMatchEntry[]> {
  return getH2HMatches(player1Id, player2Id)
}

export async function fetchMoreMatchesAction(
  playerId: string,
  limit: number
): Promise<FormEntry[]> {
  return getPlayerForm(playerId, limit)
}
