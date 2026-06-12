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
  calculateOverUnder,
  calculateHandicapOdds,
  calculateIndividualTotal,
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
export async function fetchLeagueAvgGoals(): Promise<number> {
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
  awayPlayerId: string,
  precomputedLeagueAvg?: number
): Promise<OddsInputBundle> {
  const [homeStatsRaw, awayStatsRaw, homeFormRaw, awayFormRaw, h2hRaw, leagueAvg] =
    await Promise.all([
      getPlayerStats(homePlayerId),
      getPlayerStats(awayPlayerId),
      getPlayerForm(homePlayerId, 5),
      getPlayerForm(awayPlayerId, 5),
      getH2HStats(homePlayerId, awayPlayerId),
      precomputedLeagueAvg !== undefined ? Promise.resolve(precomputedLeagueAvg) : fetchLeagueAvgGoals(),
    ])

  const toStats = (s: typeof homeStatsRaw): PlayerStats => ({
    wins:          s?.wins          ?? 0,
    losses:        s?.losses        ?? 0,
    draws:         s?.draws         ?? 0,
    matchesPlayed: s?.matchesPlayed ?? 0,
    goalDiff:      s?.goalDiff      ?? 0,
    goalsFor:      s?.goalsFor      ?? 0,
    goalsAgainst:  s?.goalsAgainst  ?? 0,
  })

  const toForm = (form: typeof homeFormRaw): OddsFormEntry[] =>
    form.map(f => ({ result: f.result as 'W' | 'L' | 'D', goalsFor: f.goalsFor, goalsAgainst: f.goalsAgainst }))

  const h2h: H2HInput | undefined = h2hRaw ? {
    homeWins:     h2hRaw.player1Wins,
    awayWins:     h2hRaw.player2Wins,
    draws:        h2hRaw.draws,
    totalMatches: h2hRaw.totalMatches,
    homeGoals:    h2hRaw.player1Goals,
    awayGoals:    h2hRaw.player2Goals,
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

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

// Convert a line number to the suffix used in market type strings.
// e.g. 2.5 → '2_5', 1 → '1_0', 0.5 → '0_5'
function lineToSuffix(line: number): string {
  const abs = Math.abs(line)
  const int = Math.floor(abs)
  const dec = Math.round((abs - int) * 10)
  return `${int}_${dec}`
}

// Parse the suffix back to a number (inverse of lineToSuffix).
// e.g. '2_5' → 2.5, '1_0' → 1
function suffixToLine(suffix: string): number {
  return parseFloat(suffix.replace('_', '.'))
}

function buildMarketOptions(
  marketType: string,
  homeName:   string,
  awayName:   string,
  fullOdds:   FullMarketOdds
): { options: object; odds: object } {
  const m = fullOdds

  // ── OU_* — Over/Under for a specific line ────────────────────
  if (marketType.startsWith('OU_')) {
    const line = suffixToLine(marketType.slice(3))
    const ou   = m.overUnderLines.find(x => Math.abs(x.line - line) < 0.001)
             ?? calculateOverUnder(
                  m.match1x2.expectedHomeGoals,
                  m.match1x2.expectedAwayGoals,
                  line
                )
    return {
      options: {
        option1: { key: 'over',  label: `Over ${line}`  },
        option2: { key: 'under', label: `Under ${line}` },
      },
      odds: { option1: ou.overOdds, option2: ou.underOdds },
    }
  }

  // ── HCP_M* / HCP_P* — Handicap line ─────────────────────────
  if (marketType.startsWith('HCP_')) {
    const signChar = marketType[4]              // 'M' = home gives, 'P' = home gets
    const absLine  = suffixToLine(marketType.slice(5))
    // TypeScript convention: positive line = home gives goals (home fav)
    const tsLine   = signChar === 'M' ? absLine : -absLine
    const hcp      = m.handicapLines.find(x => Math.abs(x.line - tsLine) < 0.001)
                  ?? calculateHandicapOdds(
                       m.match1x2.expectedHomeGoals,
                       m.match1x2.expectedAwayGoals,
                       tsLine
                     )
    const homeLabel = signChar === 'M'
      ? `${homeName} -${absLine}`
      : `${homeName} +${absLine}`
    const awayLabel = signChar === 'M'
      ? `${awayName} +${absLine}`
      : `${awayName} -${absLine}`
    return {
      options: {
        option1: { key: 'home_hcap', label: homeLabel },
        option2: { key: 'away_hcap', label: awayLabel },
      },
      odds: { option1: hcp.homeOdds, option2: hcp.awayOdds },
    }
  }

  // ── IT_HOME_* — Individual total for home team ───────────────
  if (marketType.startsWith('IT_HOME_')) {
    const line = suffixToLine(marketType.slice(8))
    const it   = m.homeIndividualTotals.find(x => Math.abs(x.line - line) < 0.001)
              ?? calculateIndividualTotal(m.match1x2.expectedHomeGoals, line)
    return {
      options: {
        option1: { key: 'over',  label: `${homeName} Over ${line}`  },
        option2: { key: 'under', label: `${homeName} Under ${line}` },
      },
      odds: { option1: it.overOdds, option2: it.underOdds },
    }
  }

  // ── IT_AWAY_* — Individual total for away team ───────────────
  if (marketType.startsWith('IT_AWAY_')) {
    const line = suffixToLine(marketType.slice(8))
    const it   = m.awayIndividualTotals.find(x => Math.abs(x.line - line) < 0.001)
              ?? calculateIndividualTotal(m.match1x2.expectedAwayGoals, line)
    return {
      options: {
        option1: { key: 'over',  label: `${awayName} Over ${line}`  },
        option2: { key: 'under', label: `${awayName} Under ${line}` },
      },
      odds: { option1: it.overOdds, option2: it.underOdds },
    }
  }

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
      // Positive line = home gives goals (home is favourite); negative = away gives.
      const homeFav = m.handicap.line > 0
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

    case 'DOUBLE_CHANCE':
      return {
        options: {
          option1: { key: 'home_or_draw', label: `1X (${homeName} or Draw)` },
          option2: { key: 'away_or_draw', label: `X2 (${awayName} or Draw)` },
          option3: { key: 'no_draw',      label: `12 (${homeName} or ${awayName})` },
        },
        odds: {
          option1: m.doubleChance.homeOrDrawOdds,
          option2: m.doubleChance.awayOrDrawOdds,
          option3: m.doubleChance.neitherDrawOdds,
        },
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
      const scores = m.exactScores.slice(0, 8)
      const options: Record<string, { key: string; label: string }> = {}
      const odds: Record<string, number> = {}

      scores.forEach((score, idx) => {
        const key = `option${idx + 1}`
        options[key] = { key: score.label, label: score.label }
        odds[key] = score.odds
      })

      const listedProbability = scores.reduce((sum, score) => sum + score.prob, 0)
      const otherProbability = Math.max(0.02, 1 - listedProbability)
      const otherKey = `option${scores.length + 1}`
      options[otherKey] = { key: 'other', label: 'Other' }
      odds[otherKey] = r2(1 / (otherProbability * 1.15))

      return { options, odds }
    }

    default:
      return { options: {}, odds: {} }
  }
}

// ─── Generate all markets for a match ────────────────────────────────────────

// All Over/Under lines displayed in the Total Goals table
const OU_LINE_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
// All Handicap lines: M = home gives (fav), P = home gets (dog)
const HCP_TYPES = [
  'HCP_M2_5', 'HCP_M2_0', 'HCP_M1_5', 'HCP_M1_0', 'HCP_M0_5',
  'HCP_P0_5', 'HCP_P1_0', 'HCP_P1_5', 'HCP_P2_0', 'HCP_P2_5',
]
// Individual total lines
const IT_LINE_VALUES = [0.5, 1.5, 2.5]

const STANDARD_MARKET_TYPES: string[] = [
  '1X2',
  ...OU_LINE_VALUES.map(l => `OU_${lineToSuffix(l)}`),
  'DOUBLE_CHANCE',
  'BTTS',
  ...HCP_TYPES,
  ...IT_LINE_VALUES.map(l => `IT_HOME_${lineToSuffix(l)}`),
  ...IT_LINE_VALUES.map(l => `IT_AWAY_${lineToSuffix(l)}`),
  'EXACT_SCORE',
]

export async function generateMatchMarkets(
  matchId:      string,
  matchType:    'friendly' | 'championship',
  homePlayerId: string,
  awayPlayerId: string,
  homeName:     string,
  awayName:     string,
  adminId:      string,
  leagueAvgGoals?: number
): Promise<GenerateMarketsResult> {
  const inputs   = await fetchOddsInputs(homePlayerId, awayPlayerId, leagueAvgGoals)
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

  // Insert one row per market type.
  // We use INSERT (not upsert) because the schema replaces the unique table
  // constraint with a partial unique index (WHERE market_type != 'CUSTOM_PROP'),
  // and PostgreSQL's ON CONFLICT requires an exact constraint match — partial
  // indexes are not accepted. All callers guarantee no existing markets:
  //   • fresh match creation   → no prior markets
  //   • refreshMatchMarkets    → deletes OPEN markets before calling this
  //   • backfillChampionship   → skips matches that already have markets
  for (const mType of STANDARD_MARKET_TYPES) {
    const { options, odds } = buildMarketOptions(mType, homeName, awayName, fullOdds)

    const aiOdds = {
      calculatedAt:    fullOdds.calculatedAt,
      confidence:      fullOdds.confidence,
      raw: odds,
    }

    const { data, error } = await supabase
      .from('bet_markets')
      .insert({
        match_id:            matchId,
        match_type:          matchType,
        market_type:         mType,
        options,
        odds,
        ai_calculated_odds:  aiOdds,
        admin_override:      false,
        status:              'OPEN',
        created_by:          adminId,
      })
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
  description:       string | null
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

  const marketIds = data.map(row => row.market_id)
  const { data: propRows } = marketIds.length > 0
    ? await supabase
        .from('custom_props')
        .select('market_id, description')
        .in('market_id', marketIds)
    : { data: [] }

  const propDescriptions = new Map(
    (propRows ?? []).map(row => [row.market_id as string, row.description as string])
  )

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
      description:      propDescriptions.get(row.market_id) ?? null,
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
