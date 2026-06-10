'use server'

import { getH2HStats } from '@/lib/stats/queries'
import type { H2HRecord } from '@/lib/stats/types'

export async function fetchH2HAction(
  player1Id: string,
  player2Id: string
): Promise<H2HRecord | null> {
  return getH2HStats(player1Id, player2Id)
}
