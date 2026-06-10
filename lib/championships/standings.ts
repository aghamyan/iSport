export type MatchRow = {
  id: string
  homePlayerId: string
  awayPlayerId: string
  homeScore: number | null
  awayScore: number | null
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
