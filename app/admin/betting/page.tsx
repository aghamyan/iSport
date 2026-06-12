import { createServiceClient } from '@/lib/supabase/server'
import { BettingAdminClient } from './BettingAdminClient'

export const dynamic = 'force-dynamic'

export type AdminMatchData = {
  matchId:         string
  matchType:       'friendly' | 'championship'
  homeName:        string
  awayName:        string
  homePlayerId:    string
  awayPlayerId:    string
  totalMarkets:    number
  openMarkets:     number
  lockedMarkets:   number
  settledMarkets:  number
  confidenceScore: number | null
  confidenceLabel: string | null
}

function extractName(val: unknown): string {
  if (!val) return '?'
  if (Array.isArray(val)) {
    const item = val[0] as { name?: string; display_name?: string } | undefined
    return item?.display_name ?? item?.name ?? '?'
  }
  const item = val as { name?: string; display_name?: string }
  return item.display_name ?? item.name ?? '?'
}

type RawMatch = {
  id: string
  home_player_id: string
  away_player_id: string
  home: unknown
  away: unknown
}

const PAGE_SIZE = 1000

async function fetchAllChampionshipMatches(
  supabase: ReturnType<typeof createServiceClient>
): Promise<RawMatch[]> {
  // Only show matches from active (non-completed) championships
  const { data: activeChamps } = await supabase
    .from('championships')
    .select('id')
    .eq('is_active', true)

  const activeIds = (activeChamps ?? []).map((c: { id: string }) => c.id)
  if (activeIds.length === 0) return []

  const rows: RawMatch[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('championship_matches')
      .select(`
        id, home_player_id, away_player_id,
        home:players!home_player_id(display_name),
        away:players!away_player_id(display_name)
      `)
      .in('championship_id', activeIds)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as RawMatch[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}

export default async function AdminBettingPage() {
  const supabase = createServiceClient()

  const [fmRes, cmRes] = await Promise.all([
    supabase
      .from('friendly_matches')
      .select(`
        id, home_player_id, away_player_id,
        home:players!home_player_id(display_name),
        away:players!away_player_id(display_name)
      `)
      .eq('status', 'pending'),
    fetchAllChampionshipMatches(supabase),
  ])

  const allFriendly = (fmRes.data ?? []) as RawMatch[]
  const allChamp    = cmRes
  const allIds      = [...allFriendly, ...allChamp].map(m => m.id)

  const [marketsRes, logsRes] = await Promise.all([
    allIds.length > 0
      ? supabase
          .from('bet_markets')
          .select('match_id, status')
          .in('match_id', allIds)
          .neq('status', 'CANCELLED')
      : Promise.resolve({ data: [] }),
    allIds.length > 0
      ? supabase
          .from('odds_calculation_log')
          .select('match_id, confidence_score, confidence_label, created_at')
          .in('match_id', allIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  type MarketCountRow = { match_id: string; status: string }
  type LogRow = { match_id: string; confidence_score: number | null; confidence_label: string | null }

  const marketsByMatch = new Map<string, { total: number; open: number; locked: number; settled: number }>()
  for (const m of (marketsRes.data ?? []) as MarketCountRow[]) {
    if (!marketsByMatch.has(m.match_id))
      marketsByMatch.set(m.match_id, { total: 0, open: 0, locked: 0, settled: 0 })
    const v = marketsByMatch.get(m.match_id)!
    v.total++
    if (m.status === 'OPEN')    v.open++
    if (m.status === 'LOCKED')  v.locked++
    if (m.status === 'SETTLED') v.settled++
  }

  const confByMatch = new Map<string, { score: number | null; label: string | null }>()
  for (const log of (logsRes.data ?? []) as LogRow[]) {
    if (!confByMatch.has(log.match_id))
      confByMatch.set(log.match_id, { score: log.confidence_score, label: log.confidence_label })
  }

  function buildMatch(m: RawMatch, matchType: 'friendly' | 'championship'): AdminMatchData {
    const markets = marketsByMatch.get(m.id) ?? { total: 0, open: 0, locked: 0, settled: 0 }
    const conf    = confByMatch.get(m.id) ?? { score: null, label: null }
    return {
      matchId:         m.id,
      matchType,
      homePlayerId:    m.home_player_id,
      awayPlayerId:    m.away_player_id,
      homeName:        extractName(m.home),
      awayName:        extractName(m.away),
      totalMarkets:    markets.total,
      openMarkets:     markets.open,
      lockedMarkets:   markets.locked,
      settledMarkets:  markets.settled,
      confidenceScore: conf.score,
      confidenceLabel: conf.label,
    }
  }

  const friendly     = allFriendly.map(m => buildMatch(m, 'friendly'))
  const championship = allChamp.map(m => buildMatch(m, 'championship'))

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#111827' }}>
        Betting Markets
      </h1>
      <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280' }}>
        Generate, lock, override, and settle bet markets for non-final matches.
      </p>
      <BettingAdminClient friendly={friendly} championship={championship} />
    </div>
  )
}
