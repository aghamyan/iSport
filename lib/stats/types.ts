// Result letter from a single match's perspective
export type FormResult = 'W' | 'L' | 'D'

// One entry in a player's recent-form sequence
export type FormEntry = {
  matchId: string
  opponentId: string
  opponentName: string
  result: FormResult
  goalsFor: number
  goalsAgainst: number
  playedAt: string
  matchType: 'friendly' | 'championship'
}

// Head-to-head aggregate between two players
export type H2HRecord = {
  player1Wins: number
  player2Wins: number
  draws: number
  player1Goals: number
  player2Goals: number
  totalMatches: number
}

// One match in the H2H history between two players
export type H2HMatchEntry = {
  matchId: string
  date: string
  p1Score: number
  p2Score: number
  matchType: 'friendly' | 'championship'
  championshipName?: string
}

// A player's stats within one championship (season)
export type SeasonStats = {
  championshipId: string
  championshipName: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  points: number
  goalDiff: number
}

// Full player stats row (global, across all match types)
export type PlayerStatsRow = {
  id: string
  wins: number
  losses: number
  draws: number
  matchesPlayed: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  // Derived at read-time; not a DB column (would require referencing generated column)
  winRate: number
  updatedAt: string
}

// PlayerStatsRow enriched with user display fields (for leaderboard)
export type NamedPlayerStats = PlayerStatsRow & {
  name: string
  avatarUrl: string | null
}

// Player who has won one or more rivalries
export type RivalryWinner = {
  playerId: string
  name: string
  avatarUrl: string | null
  rivalriesWon: number
}

// A player's placement within a single championship (with accurate H2H ranking)
export type ChampionshipResult = {
  championshipId: string
  championshipName: string
  isActive: boolean
  rank: number
  totalPlayers: number
  played: number
  wins: number
  draws: number
  losses: number
  points: number
  goalDiff: number
  goalsFor: number
  goalsAgainst: number
}

// Winner of the last completed championship (for home page champion banner)
export type CurrentChampion = {
  playerId: string
  playerName: string
  avatarUrl: string | null
  championshipId: string
  championshipName: string
  points: number
  wins: number
  draws: number
  losses: number
  goalDiff: number
}

// Top-3 finishers of the most recent completed championship (for leaderboard podium)
export type LastChampionshipPodiumEntry = {
  rank: number
  playerId: string
  playerName: string
  avatarUrl: string | null
  points: number
  wins: number
  draws: number
  losses: number
  goalDiff: number
  played: number
  championshipId: string
  championshipName: string
}

// Current leader of a championship (for the leaderboard Championships tab)
export type ChampionshipLeader = {
  championshipId: string
  championshipName: string
  isActive: boolean
  playerId: string
  playerName: string
  avatarUrl: string | null
  played: number
  wins: number
  draws: number
  losses: number
  points: number
  goalDiff: number
}
