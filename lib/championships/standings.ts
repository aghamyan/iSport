export type MatchRow = {
  id: string
  homePlayerId: string
  awayPlayerId: string
  homeScore: number | null
  awayScore: number | null
  round?: string | null
}

export type StandingRow = {
  playerId: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  points: number
  goalDiff: number
}

function buildMap(matches: MatchRow[], playerIds: string[]): Map<string, StandingRow> {
  const map = new Map<string, StandingRow>()
  for (const pid of playerIds) {
    map.set(pid, {
      playerId: pid,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      goalDiff: 0,
    })
  }

  for (const m of matches) {
    if (m.homeScore === null || m.awayScore === null) continue
    const home = map.get(m.homePlayerId)
    const away = map.get(m.awayPlayerId)
    if (!home || !away) continue

    const hs = m.homeScore
    const as_ = m.awayScore

    home.played++
    away.played++
    home.goalsFor += hs
    home.goalsAgainst += as_
    away.goalsFor += as_
    away.goalsAgainst += hs

    if (hs > as_) {
      home.wins++
      away.losses++
      home.points += 3
    } else if (hs === as_) {
      home.draws++
      away.draws++
      home.points++
      away.points++
    } else {
      home.losses++
      away.wins++
      away.points += 3
    }

    home.goalDiff = home.goalsFor - home.goalsAgainst
    away.goalDiff = away.goalsFor - away.goalsAgainst
  }

  return map
}

function h2hMiniLeague(
  playerIds: string[],
  matches: MatchRow[]
): Map<string, { pts: number; gd: number; gf: number }> {
  const inGroup = new Set(playerIds)
  const h2h = new Map<string, { pts: number; gd: number; gf: number }>()
  for (const pid of playerIds) h2h.set(pid, { pts: 0, gd: 0, gf: 0 })

  for (const m of matches) {
    if (!inGroup.has(m.homePlayerId) || !inGroup.has(m.awayPlayerId)) continue
    if (m.homeScore === null || m.awayScore === null) continue

    const home = h2h.get(m.homePlayerId)!
    const away = h2h.get(m.awayPlayerId)!
    const hs = m.homeScore
    const as_ = m.awayScore

    home.gf += hs
    away.gf += as_
    home.gd += hs - as_
    away.gd += as_ - hs

    if (hs > as_) {
      home.pts += 3
    } else if (hs === as_) {
      home.pts++
      away.pts++
    } else {
      away.pts += 3
    }
  }

  return h2h
}

/**
 * Returns standings sorted by: points → goal diff → head-to-head
 * (points, gd, gf within h2h mini-league) → goals scored overall.
 */
export function calculateStandings(matches: MatchRow[], playerIds: string[]): StandingRow[] {
  const standingMap = buildMap(matches, playerIds)
  const rows = Array.from(standingMap.values())

  // Primary sort: points desc, then goal diff desc, then goals for desc
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    return b.goalsFor - a.goalsFor
  })

  // Within groups tied on points AND goal diff, apply H2H mini-league
  const result: StandingRow[] = []
  let i = 0
  while (i < rows.length) {
    let j = i + 1
    while (
      j < rows.length &&
      rows[j].points === rows[i].points &&
      rows[j].goalDiff === rows[i].goalDiff
    ) {
      j++
    }

    const group = rows.slice(i, j)

    if (group.length > 1) {
      const groupIds = group.map((r) => r.playerId)
      const h2h = h2hMiniLeague(groupIds, matches)

      group.sort((a, b) => {
        const ha = h2h.get(a.playerId)!
        const hb = h2h.get(b.playerId)!
        if (hb.pts !== ha.pts) return hb.pts - ha.pts
        if (hb.gd !== ha.gd) return hb.gd - ha.gd
        if (hb.gf !== ha.gf) return hb.gf - ha.gf
        return b.goalsFor - a.goalsFor
      })
    }

    result.push(...group)
    i = j
  }

  return result
}

const KNOCKOUT_ROUNDS = new Set(['semi', 'final', 'penalty', 'final_penalty'])

/** Group-stage matches only, excluding semis/final/penalties. */
export function filterGroupMatches<T extends { round?: string | null }>(matches: T[]): T[] {
  return matches.filter((m) => !KNOCKOUT_ROUNDS.has(m.round ?? ''))
}

/**
 * Full finishing order for a championship.
 *
 * The champion is whoever wins the final (or the final penalty shootout),
 * not whoever tops the group table — a lower seed can win the final and
 * still take 1st. That winner is promoted to the top of the order; every
 * other player keeps their group-stage table position. Formats without a
 * decided final (round_robin, or a knockout/playoff final not yet played)
 * fall back to plain table order, so `groupStandings[0]` is 1st.
 */
export function resolveChampionshipOrder(
  matches: MatchRow[],
  groupStandings: StandingRow[]
): string[] {
  const tableOrder = groupStandings.map((r) => r.playerId)

  const finalPenalty = matches.find((m) => m.round === 'final_penalty')
  const final = matches.find((m) => m.round === 'final')

  let championId: string | null = null
  if (finalPenalty && finalPenalty.homeScore !== null && finalPenalty.awayScore !== null) {
    championId = finalPenalty.homeScore > finalPenalty.awayScore
      ? finalPenalty.homePlayerId
      : finalPenalty.awayPlayerId
  } else if (
    final &&
    final.homeScore !== null &&
    final.awayScore !== null &&
    final.homeScore !== final.awayScore
  ) {
    championId = final.homeScore > final.awayScore ? final.homePlayerId : final.awayPlayerId
  }

  if (!championId || !tableOrder.includes(championId)) return tableOrder

  return [championId, ...tableOrder.filter((id) => id !== championId)]
}
