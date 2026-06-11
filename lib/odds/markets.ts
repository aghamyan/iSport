/**
 * DB integration layer for the AI odds system.
 *
 * Fetch: pulls player stats + form + H2H from existing stat queries.
 * Generate: calls calculateFullMarkets() and writes one bet_markets row per
 *           market type, logging the full calculation to odds_calculation_log.
 * Override: saves admin-overridden odds while preserving the AI values.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getPlayerStats, getPlayerForm, getH2HStats } from '@/lib/stats/queries'
import {
  calculateFullMarkets,
  suggestCustomPropOdds,
  type FullMarketOdds,
  type OddsFormEntry,
  type PlayerStats,
  type H2HInput,
} from '@/lib/odds'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketInsertResult = {
  marketId:   string
  marketType: string
  success:    boolean
  error?:     string
}

export type GenerateMarketsResult = {
  matchId:      string
  markets:      MarketInsertResult[]
  fullOdds:     FullMarketOdds
  logId:        string | null
}

// ─── League average goals ─────────────────────────────────────────────────────

/** Computes average goals per match across all confirmed matches in the DB. */
async function fetchLeagueAvgGoals(): Promise<number> {
  const supabase = createServiceClient()

  const [friendlyRes, champRes] = await Promise.all([
    supabase
      .from('friendly_matches')
      .select('home_score, away_score')
      .in('status', ['confirmed', 'final'])
      .not('home_score', 'is', null),
    supabase
      .from('championship_matches')
      .select('home_score, away_score')
      .in('status', ['confirmed', 'final'])
      .not('home_score', 'is', null),
  ])

  const allMatches = [
    ...(friendlyRes.data ?? []),
    ...(champRes.data ?? []),
  ] as { home_score: number; away_score: number }[]

  if (allMatches.length === 0) return 2.5

  const totalGoals = allMatches.reduce((s, m) => s + m.home_score + m.away_score, 0)
  return Math.max(totalGoals / allMatches.length, 1.5)
}

// ─── Fetch all inputs for odds calculation ────────────────────────────────────

type OddsInputBundle = {
  homeStats:  PlayerStats
  awayStats:  PlayerStats
  homeForm:   OddsFormEntry[]
  awayForm:   OddsFormEntry[]
  h2h:        H2HInput | undefined
  leagueAvg:  number
}

async function fetchOddsInputs(
  homePlayerId: string,
  awayPlayerId: string
): Promise<OddsInputBundle> {
  const [homeStatsRaw, awayStatsRaw, homeFormRaw, awayFormRaw, h2hRaw, leagueAvg] =
    await Promise.all([
      getPlayerStats(homePlayerId),
      getPlayerStats(awayPlayerId),
      getPlayerForm(homePlayerId, 5),
      getPlayerForm(awayPlayerId, 5),
      getH2HStats(homePlayerId, awayPlayerId),
      fetchLeagueAvgGoals(),
    ])

  const toStats = (s: typeof homeStatsRaw): PlayerStats => ({
    wins:          s?.wins          ?? 0,
    losses:        s?.losses        ?? 0,
    draws:         s?.draws         ?? 0,
    matchesPlayed: s?.matchesPlayed ?? 0,
    goalDiff:      s?.goalDiff      ?? 0,
    goalsFor:      s?.goalsFor      ?? 0,
  })

  const toForm = (form: typeof homeFormRaw): OddsFormEntry[] =>
    form.map(f => ({ result: f.result as 'W' | 'L' | 'D', goalsFor: f.goalsFor, goalsAgainst: f.goalsAgainst }))

  const h2h: H2HInput | undefined = h2hRaw ? {
    homeWins:     h2hRaw.player1Wins,
    awayWins:     h2hRaw.player2Wins,
    draws:        h2hRaw.draws,
    totalMatches: h2hRaw.totalMatches,
  } : undefined

  return {
    homeStats: toStats(homeStatsRaw),
    awayStats: toStats(awayStatsRaw),
    homeForm:  toForm(homeFormRaw),
    awayForm:  toForm(awayFormRaw),
    h2h,
    leagueAvg,
  }
}

// ─── Market option labels ─────────────────────────────────────────────────────

function buildMarketOptions(
  marketType: string,
  homeName:   string,
  awayName:   string,
  fullOdds:   FullMarketOdds
): { options: object; odds: object } {
  const m = fullOdds

  switch (marketType) {
    case '1X2':
      return {
        options: {
          option1: { key: 'home', label: homeName },
          option2: { key: 'draw', label: 'Draw' },
          option3: { key: 'away', label: awayName },
        },
        odds: {
          option1: m.match1x2.homeWinOdds,
          option2: m.match1x2.drawOdds,
          option3: m.match1x2.awayWinOdds,
        },
      }

    case 'OU2_5':
      return {
        options: {
          option1: { key: 'over',  label: `Over ${m.overUnder.line}`  },
          option2: { key: 'under', label: `Under ${m.overUnder.line}` },
        },
        odds: {
          option1: m.overUnder.overOdds,
          option2: m.overUnder.underOdds,
        },
      }

    case 'HANDICAP': {
      const absLine = Math.abs(m.handicap.line)
      const homeFav = m.handicap.line < 0   // negative line = home gives goals
      return {
        options: {
          option1: { key: 'home_hcap', label: `${homeName} ${homeFav ? '-' : '+'}${absLine}` },
          option2: { key: 'away_hcap', label: `${awayName} ${homeFav ? '+' : '-'}${absLine}` },
        },
        odds: {
          option1: m.handicap.homeOdds,
          option2: m.handicap.awayOdds,
        },
      }
    }

    case 'BTTS':
      return {
        options: {
          option1: { key: 'yes', label: 'Both Teams Score' },
          option2: { key: 'no',  label: 'Not Both Teams Score' },
        },
        odds: {
          option1: m.btts.yesOdds,
          option2: m.btts.noOdds,
        },
      }

    case 'EXACT_SCORE': {
      // Top 3 most likely scores as options
      const top3 = m.exactScores.slice(0, 3)
      return {
        options: {
          option1: { key: top3[0]?.label ?? '1-0', label: top3[0]?.label ?? '1-0' },
          option2: { key: top3[1]?.label ?? '0-1', label: top3[1]?.label ?? '0-1' },
          option3: { key: top3[2]?.label ?? '1-1', label: top3[2]?.label ?? '1-1' },
        },
        odds: {
          option1: top3[0]?.odds ?? 5.0,
          option2: top3[1]?.odds ?? 5.0,
          option3: top3[2]?.odds ?? 6.0,
        },
      }
    }

    default:
      return { options: {}, odds: {} }
  }
}

// ─── Generate all markets for a match ────────────────────────────────────────

const STANDARD_MARKET_TYPES = ['1X2', 'OU2_5', 'HANDICAP', 'BTTS', 'EXACT_SCORE'] as const

export async function generateMatchMarkets(
  matchId:      string,
  matchType:    'friendly' | 'championship',
  homePlayerId: string,
  awayPlayerId: string,
  homeName:     string,
  awayName:     string,
  adminId:      string
): Promise<GenerateMarketsResult> {
  const inputs   = await fetchOddsInputs(homePlayerId, awayPlayerId)
  const fullOdds = calculateFullMarkets(inputs.homeStats, inputs.awayStats, {
    homeForm:       inputs.homeForm,
    awayForm:       inputs.awayForm,
    h2h:            inputs.h2h,
    matchType,
    leagueAvgGoals: inputs.leagueAvg,
  })

  const supabase   = createServiceClient()
  const results:   MarketInsertResult[] = []

  // Log the full calculation for audit/admin review
  const { data: logRow } = await supabase
    .from('odds_calculation_log')
    .insert({
      match_id:         matchId,
      match_type:       matchType,
      home_player_id:   homePlayerId,
      away_player_id:   awayPlayerId,
      inputs:           inputs,
      full_odds_output: fullOdds,
      confidence_score: fullOdds.confidence.score,
      confidence_label: fullOdds.confidence.label,
      created_by:       adminId,
    })
    .select('log_id')
    .single()

  // Insert one row per market type (upsert on match_id + match_type + market_type)
  for (const mType of STANDARD_MARKET_TYPES) {
    const { options, odds } = buildMarketOptions(mType, homeName, awayName, fullOdds)

    const aiOdds = {
      calculatedAt:    fullOdds.calculatedAt,
      confidence:      fullOdds.confidence,
      raw: odds,
    }

    const { data, error } = await supabase
      .from('bet_markets')
      .upsert(
        {
          match_id:            matchId,
          match_type:          matchType,
          market_type:         mType,
          options,
          odds,
          ai_calculated_odds:  aiOdds,
          admin_override:      false,
          status:              'OPEN',
          created_by:          adminId,
        },
        {
          onConflict:    'match_id, match_type, market_type',
          ignoreDuplicates: false,
        }
      )
      .select('market_id')
      .single()

    results.push({
      marketId:   data?.market_id ?? '',
      marketType: mType,
      success:    !error,
      error:      error?.message,
    })
  }

  return {
    matchId,
    markets:  results,
    fullOdds,
    logId:    logRow?.log_id ?? null,
  }
}

// ─── Admin override: save manual odds ────────────────────────────────────────

export async function applyAdminOddsOverride(
  marketId: string,
  newOdds:  Record<string, number>,   // { option1: 1.85, option2: 3.2, option3: 2.0 }
  adminId:  string
): Promise<void> {
  const supabase = createServiceClient()

  // Fetch current AI odds to preserve them
  const { data: current } = await supabase
    .from('bet_markets')
    .select('ai_calculated_odds, odds')
    .eq('market_id', marketId)
    .single()

  const aiPreserved = current?.ai_calculated_odds ?? { raw: current?.odds }

  await supabase
    .from('bet_markets')
    .update({
      odds:               newOdds,
      admin_override:     true,
      // Annotate the AI odds with the override audit
      ai_calculated_odds: {
        ...aiPreserved,
        override: {
          by:          adminId,
          at:          new Date().toISOString(),
          previousOdds: current?.odds,
        },
      },
    })
    .eq('market_id', marketId)
}

// ─── Admin override: revert to AI odds ───────────────────────────────────────

export async function revertToAiOdds(marketId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: market } = await supabase
    .from('bet_markets')
    .select('ai_calculated_odds')
    .eq('market_id', marketId)
    .single()

  const aiOdds = market?.ai_calculated_odds as { raw?: Record<string, number> } | null
  if (!aiOdds?.raw) throw new Error('No AI odds stored for this market.')

  await supabase
    .from('bet_markets')
    .update({
      odds:           aiOdds.raw,
      admin_override: false,
    })
    .eq('market_id', marketId)
}

// ─── Get full market odds for a match (for display) ──────────────────────────

export type MarketRow = {
  marketId:          string
  marketType:        string
  options:           Record<string, { key: string; label: string }>
  odds:              Record<string, number>
  aiCalculatedOdds:  Record<string, unknown> | null
  adminOverride:     boolean
  status:            string
  result:            string | null
  confidence:        { score: number; label: string } | null
}

export async function getMatchMarkets(
  matchId:   string,
  matchType: 'friendly' | 'championship'
): Promise<MarketRow[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('bet_markets')
    .select('market_id, market_type, options, odds, ai_calculated_odds, admin_override, status, result')
    .eq('match_id',   matchId)
    .eq('match_type', matchType)
    .neq('status',    'CANCELLED')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map(row => {
    const ai = row.ai_calculated_odds as { confidence?: { score: number; label: string }; raw?: Record<string, number> } | null
    return {
      marketId:         row.market_id,
      marketType:       row.market_type,
      options:          row.options as Record<string, { key: string; label: string }>,
      odds:             row.odds as Record<string, number>,
      aiCalculatedOdds: ai as Record<string, unknown> | null,
      adminOverride:    row.admin_override,
      status:           row.status,
      result:           row.result,
      confidence:       ai?.confidence ?? null,
    }
  })
}

// ─── Custom prop: create with suggested odds ──────────────────────────────────

export async function createCustomPropMarket(
  matchId:     string,
  matchType:   'friendly' | 'championship',
  description: string,
  options:     { label: string }[],   // 2 or 3 options
  adminId:     string,
  customOdds?: number[]               // admin can pass their own odds
): Promise<string> {
  if (options.length < 2 || options.length > 3)
    throw new Error('Custom prop must have 2 or 3 options.')

  const suggestion = suggestCustomPropOdds(options.length as 2 | 3)
  const finalOdds  = customOdds ?? suggestion.suggestedOdds

  const optionsMap: Record<string, { key: string; label: string }> = {}
  const oddsMap:    Record<string, number> = {}
  options.forEach((o, i) => {
    const key = `option${i + 1}`
    optionsMap[key] = { key, label: o.label }
    oddsMap[key]    = finalOdds[i] ?? suggestion.suggestedOdds[i]
  })

  const supabase = createServiceClient()

  const { data: marketRow, error: mErr } = await supabase
    .from('bet_markets')
    .insert({
      match_id:           matchId,
      match_type:         matchType,
      market_type:        'CUSTOM_PROP',
      options:            optionsMap,
      odds:               oddsMap,
      ai_calculated_odds: {
        suggestion,
        customOddsProvided: !!customOdds,
      },
      admin_override: !!customOdds,
      status:         'OPEN',
      created_by:     adminId,
    })
    .select('market_id')
    .single()

  if (mErr || !marketRow) throw new Error(mErr?.message ?? 'Failed to create market')

  const { error: propErr } = await supabase
    .from('custom_props')
    .insert({
      market_id:  marketRow.market_id,
      match_id:   matchId,
      match_type: matchType,
      description,
      created_by: adminId,
    })

  if (propErr) throw new Error(propErr.message)

  return marketRow.market_id
}
