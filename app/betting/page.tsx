import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { BettingPageClient, type MatchBettingRow, type Preview1X2, type PreviewOpt } from './BettingPageClient'
import { BASE_SYMBOLS, makePlayerSymbols } from '@/lib/casino/slotGames'
import type { SlotSymbol } from '@/lib/casino/types'

export const dynamic = 'force-dynamic'

function extractName(val: unknown): string {
  if (!val) return '?'
  if (Array.isArray(val)) {
    const item = val[0] as { name?: string; display_name?: string } | undefined
    return item?.display_name ?? item?.name ?? '?'
  }
  const item = val as { name?: string; display_name?: string }
  return item.display_name ?? item.name ?? '?'
}

function extractChampName(val: unknown): string {
  if (!val) return 'Championship'
  if (Array.isArray(val)) return (val[0] as { name: string })?.name ?? 'Championship'
  return (val as { name: string }).name ?? 'Championship'
}

type RawMatch = {
  id: string
  status: string
  created_at: string
  home_player_id: string
  away_player_id: string
  home: unknown
  away: unknown
}

type RawChampMatch = RawMatch & { championships: unknown }

const PAGE_SIZE = 1000

async function fetchAllChampionshipMatches(
  supabase: ReturnType<typeof createServiceClient>
): Promise<RawChampMatch[]> {
  const { data: activeChamps } = await supabase
    .from('championships')
    .select('id')
    .eq('is_active', true)

  const activeIds = (activeChamps ?? []).map((c: { id: string }) => c.id)
  if (activeIds.length === 0) return []

  const rows: RawChampMatch[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('championship_matches')
      .select(`
        id, status, created_at, home_player_id, away_player_id,
        home:players!home_player_id(display_name),
        away:players!away_player_id(display_name),
        championships(name)
      `)
      .in('championship_id', activeIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as RawChampMatch[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}

export default async function BettingPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const supabase = createServiceClient()

  // Ensure balance row exists (covers users created before the betting system)
  await supabase
    .from('player_balances')
    .upsert({ player_id: session.sub }, { onConflict: 'player_id', ignoreDuplicates: true })

  // Fetch player avatars for casino slot symbols
  const playersRes = supabase
    .from('users')
    .select('name, avatar_url')
    .eq('is_active', true)
    .eq('is_admin', false)
    .not('avatar_url', 'is', null)

  const [fmRes, cmRes, balRes, playersData] = await Promise.all([
    supabase
      .from('friendly_matches')
      .select(`
        id, status, created_at, home_player_id, away_player_id,
        home:players!home_player_id(display_name),
        away:players!away_player_id(display_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(30),
    fetchAllChampionshipMatches(supabase),
    supabase
      .from('player_balances')
      .select('current_balance')
      .eq('player_id', session.sub)
      .single(),
    playersRes,
  ])

  const allFriendly    = (fmRes.data ?? []) as RawMatch[]
  const allChamp       = cmRes
  const initialBalance = Number(balRes.data?.current_balance ?? 10000)
  const allIds      = [...allFriendly, ...allChamp].map(m => m.id)

  // Build slot symbols from player avatars
  const playerRows    = (playersData.data ?? []) as { name: string; avatar_url: string | null }[]
  const playerAvatars = playerRows.map(p => p.avatar_url)
  const playerNames   = playerRows.map(p => p.name)
  const slotSymbols: SlotSymbol[] = [
    ...BASE_SYMBOLS.map(s => ({ ...s, imageUrl: undefined as string | undefined })),
    ...makePlayerSymbols(playerAvatars, playerNames),
  ]

  // Fetch open market counts + 1X2 preview odds in parallel
  const marketCounts = new Map<string, number>()
  const preview1x2Map = new Map<string, Preview1X2>()

  if (allIds.length > 0) {
    type CountRow = { match_id: string }
    type X12Row  = {
      market_id: string
      match_id:  string
      options:   Record<string, { key: string; label: string }>
      odds:      Record<string, number | string>
    }

    const [countsRes, x12Res] = await Promise.all([
      supabase
        .from('bet_markets')
        .select('match_id')
        .in('match_id', allIds)
        .eq('status', 'OPEN'),
      supabase
        .from('bet_markets')
        .select('market_id, match_id, options, odds')
        .in('match_id', allIds)
        .eq('market_type', '1X2')
        .eq('status', 'OPEN'),
    ])

    for (const m of (countsRes.data ?? []) as CountRow[]) {
      marketCounts.set(m.match_id, (marketCounts.get(m.match_id) ?? 0) + 1)
    }

    for (const m of (x12Res.data ?? []) as X12Row[]) {
      let home: PreviewOpt | null = null
      let draw: PreviewOpt | null = null
      let away: PreviewOpt | null = null

      for (const [optKey, optVal] of Object.entries(m.options ?? {})) {
        const o = Number(m.odds?.[optKey] ?? 0)
        if (o <= 1) continue
        if (optVal.key === 'home') home = { key: optKey, label: optVal.label, odds: o }
        else if (optVal.key === 'draw') draw = { key: optKey, label: optVal.label, odds: o }
        else if (optVal.key === 'away') away = { key: optKey, label: optVal.label, odds: o }
      }

      if (home && draw && away) {
        preview1x2Map.set(m.match_id, { marketId: m.market_id, home, draw, away })
      }
    }
  }

  const friendly: MatchBettingRow[] = allFriendly
    .filter(m => (marketCounts.get(m.id) ?? 0) > 0)
    .map(m => ({
      matchId:     m.id,
      matchType:   'friendly' as const,
      homeName:    extractName(m.home),
      awayName:    extractName(m.away),
      matchStatus: m.status,
      createdAt:   m.created_at,
      openMarkets: marketCounts.get(m.id) ?? 0,
      groupLabel:  'Friendly',
      preview1x2:  preview1x2Map.get(m.id),
    }))

  const championship: MatchBettingRow[] = allChamp
    .filter(m => (marketCounts.get(m.id) ?? 0) > 0)
    .map(m => ({
      matchId:     m.id,
      matchType:   'championship' as const,
      homeName:    extractName(m.home),
      awayName:    extractName(m.away),
      matchStatus: m.status,
      createdAt:   m.created_at,
      openMarkets: marketCounts.get(m.id) ?? 0,
      groupLabel:  extractChampName(m.championships),
      preview1x2:  preview1x2Map.get(m.id),
    }))

  return (
    <BettingPageClient
      userId={session.sub}
      matches={[...friendly, ...championship]}
      initialBalance={initialBalance}
      slotSymbols={slotSymbols}
    />
  )
}
