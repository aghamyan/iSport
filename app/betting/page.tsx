import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { BettingPageClient, type MatchBettingRow } from './BettingPageClient'

export const dynamic = 'force-dynamic'

function extractName(val: unknown): string {
  if (!val) return '?'
  if (Array.isArray(val)) return (val[0] as { name: string })?.name ?? '?'
  return (val as { name: string }).name ?? '?'
}

function extractChampName(val: unknown): string {
  if (!val) return 'Championship'
  if (Array.isArray(val)) return (val[0] as { name: string })?.name ?? 'Championship'
  return (val as { name: string }).name ?? 'Championship'
}

type RawMatch = {
  id: string
  home_player_id: string
  away_player_id: string
  home: unknown
  away: unknown
}

type RawChampMatch = RawMatch & { championships: unknown }

export default async function BettingPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const supabase = createServiceClient()

  const [fmRes, cmRes] = await Promise.all([
    supabase
      .from('friendly_matches')
      .select(`
        id, home_player_id, away_player_id,
        home:users!friendly_matches_home_player_id_fkey(name),
        away:users!friendly_matches_away_player_id_fkey(name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('championship_matches')
      .select(`
        id, home_player_id, away_player_id,
        home:users!championship_matches_home_player_id_fkey(name),
        away:users!championship_matches_away_player_id_fkey(name),
        championships(name)
      `)
      .in('status', ['pending', 'playing'])
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const allFriendly = (fmRes.data ?? []) as RawMatch[]
  const allChamp    = (cmRes.data ?? []) as RawChampMatch[]
  const allIds      = [...allFriendly, ...allChamp].map(m => m.id)

  // Fetch open market counts — used to filter out matches with no bettable markets
  const marketCounts = new Map<string, number>()
  if (allIds.length > 0) {
    const { data: markets } = await supabase
      .from('bet_markets')
      .select('match_id')
      .in('match_id', allIds)
      .eq('status', 'OPEN')

    for (const m of markets ?? []) {
      marketCounts.set(m.match_id, (marketCounts.get(m.match_id) ?? 0) + 1)
    }
  }

  const friendly: MatchBettingRow[] = allFriendly
    .filter(m => (marketCounts.get(m.id) ?? 0) > 0)
    .map(m => ({
      matchId:    m.id,
      matchType:  'friendly' as const,
      homeName:   extractName(m.home),
      awayName:   extractName(m.away),
      openMarkets: marketCounts.get(m.id) ?? 0,
      groupLabel: 'Friendly',
    }))

  const championship: MatchBettingRow[] = allChamp
    .filter(m => (marketCounts.get(m.id) ?? 0) > 0)
    .map(m => ({
      matchId:    m.id,
      matchType:  'championship' as const,
      homeName:   extractName(m.home),
      awayName:   extractName(m.away),
      openMarkets: marketCounts.get(m.id) ?? 0,
      groupLabel: extractChampName(m.championships),
    }))

  return (
    <BettingPageClient
      userId={session.sub}
      matches={[...friendly, ...championship]}
    />
  )
}
