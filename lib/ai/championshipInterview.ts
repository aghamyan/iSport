// AI "Mic" journalist — championship season-wrap interview generation.
// Pure prompt-construction + OpenAI call; no Supabase access here (the caller
// in app/championships/championshipInterviewActions.ts assembles the context
// object). Sibling to lib/ai/interview.ts (pre/post-match interviews), kept
// as a separate file so the two features can be tuned independently — this
// one looks back at an entire finished championship, not a single match.

import { OPENAI_MODEL } from './interview'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

// Player-turn cap per interview — bounds cost and keeps the exchange snappy.
export const MAX_PLAYER_TURNS = 6

export type InterviewRole = 'journalist' | 'player'
export type InterviewLanguage = 'en' | 'hy'
export type ChampionshipFormat = 'round_robin' | 'group_knockout' | 'group_playoff'

/** One match from the championship — not necessarily one the interviewee
 *  played in, so the journalist can bring up games they only watched. */
export type SeasonMatchLine = {
  homeName: string
  awayName: string
  homeGoals: number
  awayGoals: number
  round: string // e.g. "Group A", "Semi-Final", "Final", "Round 3"
}

export type FullTableRow = {
  rank: number
  name: string
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalDiff: number
}

export type PastChampionshipLine = {
  name: string
  rank: number
  totalPlayers: number
}

export type P4PLine = {
  score: number // 0-100
  rank: number
  totalPlayers: number
  confidence: number // 0-1 — the P4P engine's own sample-size gate; low means "early rating, small sample"
}

export type ActivityLine = {
  matchesPlayed: number // career total, across every match type
  daysSinceLastMatch: number | null // null if they've never played a recorded match
}

export type ChampionshipInterviewContext = {
  language: InterviewLanguage
  playerName: string
  championshipName: string
  format: ChampionshipFormat
  isChampion: boolean
  playerFinal: {
    rank: number
    totalPlayers: number
    points: number
    played: number
    wins: number
    draws: number
    losses: number
    goalDiff: number
    goalsFor: number
    goalsAgainst: number
  }
  /** the complete final table, every roster player, 1st to last */
  fullTable: FullTableRow[]
  /** every match played in this championship, including ones the interviewee wasn't in */
  allMatches: SeasonMatchLine[]
  playerP4P: P4PLine | null
  playerActivity: ActivityLine
  /** other completed championships this player has finished, best finish first */
  pastChampionships: PastChampionshipLine[]
}

function formatLabel(format: ChampionshipFormat): string {
  if (format === 'group_knockout') return 'a group + knockout championship'
  if (format === 'group_playoff') return 'a group + playoff championship'
  return 'a round-robin championship'
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function playerFinalString(ctx: ChampionshipInterviewContext): string {
  const f = ctx.playerFinal
  const champNote = ctx.isChampion ? ' — they are the CHAMPION.' : ''
  return (
    `${ctx.playerName} finished ${ordinal(f.rank)} of ${f.totalPlayers}${champNote} ` +
    `(${f.points} pts, ${f.wins}W-${f.losses}L-${f.draws}D from ${f.played} played, ` +
    `${f.goalsFor} scored / ${f.goalsAgainst} conceded, goal diff ${f.goalDiff >= 0 ? '+' : ''}${f.goalDiff}).`
  )
}

function fullTableString(rows: FullTableRow[]): string {
  if (rows.length === 0) return 'Final table not available.'
  return rows
    .map((r) => `${r.rank}. ${r.name} — ${r.points} pts (${r.wins}W-${r.losses}L-${r.draws}D, GD ${r.goalDiff >= 0 ? '+' : ''}${r.goalDiff})`)
    .join('\n')
}

function allMatchesString(matches: SeasonMatchLine[]): string {
  if (matches.length === 0) return 'No recorded matches in this championship.'
  return matches
    .map((m) => `[${m.round}] ${m.homeName} ${m.homeGoals}-${m.awayGoals} ${m.awayName}`)
    .join('\n')
}

function p4pString(name: string, p4p: P4PLine | null): string {
  if (!p4p) return `${name} has no P4P rating yet (no championship match data to compute one from).`
  const sampleNote = p4p.confidence < 0.3 ? ' — early rating, still a small sample, do not treat it as gospel' : ''
  return `${name}'s P4P rating: ${p4p.score}/100, ranked ${p4p.rank} of ${p4p.totalPlayers}${sampleNote}.`
}

function activityString(name: string, a: ActivityLine): string {
  if (a.matchesPlayed === 0) return `${name} has no recorded matches yet — this would be their debut.`
  const noteParts: string[] = []
  if (a.matchesPlayed <= 3) noteParts.push(`still very new to the league, only ${a.matchesPlayed} career matches on record`)
  if (a.daysSinceLastMatch !== null && a.daysSinceLastMatch >= 21) noteParts.push(`hasn't played a match in ${a.daysSinceLastMatch} days`)
  const note = noteParts.length > 0 ? ` (${noteParts.join('; ')})` : ''
  return `${name} has played ${a.matchesPlayed} career matches total${note}.`
}

function pastChampionshipsString(name: string, past: PastChampionshipLine[]): string {
  if (past.length === 0) return `${name} has no other completed championships on record yet — this was their first.`
  const finishes = past.map((p) => `${ordinal(p.rank)} of ${p.totalPlayers} in "${p.name}"`).join(', ')
  return `${name}'s other past championship finishes: ${finishes}.`
}

function buildContextBlock(ctx: ChampionshipInterviewContext): string {
  const lines: string[] = []
  lines.push(`Championship: ${ctx.championshipName} (${formatLabel(ctx.format)}, now finished)`)
  lines.push(playerFinalString(ctx))
  lines.push('')
  lines.push('FINAL TABLE:')
  lines.push(fullTableString(ctx.fullTable))
  lines.push('')
  lines.push('ALL MATCHES PLAYED IN THIS CHAMPIONSHIP:')
  lines.push(allMatchesString(ctx.allMatches))
  lines.push('')
  lines.push(p4pString(ctx.playerName, ctx.playerP4P))
  lines.push(activityString(ctx.playerName, ctx.playerActivity))
  lines.push(pastChampionshipsString(ctx.playerName, ctx.pastChampionships))
  return lines.join('\n')
}

function buildSystemPrompt(ctx: ChampionshipInterviewContext, isFinalTurn: boolean, forceShort: boolean): string {
  const closingInstruction = isFinalTurn
    ? 'This is the LAST exchange of the interview. Respond to what the player just said, then close out with one punchy sign-off line — do not ask another question.'
    : "Look back at their whole campaign, not just one match. If this is your opening line, greet them briefly and get straight into it — ask about how the whole run felt, a specific result from ALL MATCHES that stands out (good or bad), or their reaction to where they landed in the final table. Don't waste turns on small talk."

  const lengthDirective = !isFinalTurn && forceShort
    ? ' For THIS reply specifically: ONE short sentence only — a quick jab, reaction, or one-line question. Nothing more.'
    : ''

  const languageDirective = ctx.language === 'hy'
    ? 'LANGUAGE: Write ONLY in Armenian (Հայերեն), using natural, colloquial spoken Armenian — the way a sharp Armenian sports journalist would actually talk, not a stiff literal translation. Keep player names, the league name "iSport", and your own name "The Mic" as-is (do not transliterate them). Every reply must be entirely in Armenian — no English sentences mixed in.'
    : 'LANGUAGE: Write in English.'

  const outcomeDirective = ctx.isChampion
    ? "This player WON the championship — treat this like a champion's post-tournament sit-down. Congratulate them for real, but still press them: was there a shaky result along the way, a rival they barely got past, a game they should highlight?"
    : ctx.playerFinal.rank === ctx.playerFinal.totalPlayers
      ? "This player finished LAST. Be direct about it without being cruel — ask what went wrong, whether a specific loss from ALL MATCHES summed up their tournament, what changes next time."
      : "This player finished mid-table or just off the podium — dig into whether they're satisfied with that finish given how the table and their results actually went, and whether a specific match cost them a better spot."

  return [
    `You are "The Mic", the in-house AI sports journalist for iSport, an amateur/friends esports league. The championship "${ctx.championshipName}" has just concluded, and you're sitting down with ${ctx.playerName} for a season-wrap interview about their whole campaign.`,
    '',
    languageDirective,
    '',
    'PERSONA: Sharp, witty, provocative — like a post-tournament press conference host. You needle players about bad results, praise big wins, and are not afraid of a pointed follow-up. You can be sarcastic when it is warranted. But you are never actually cruel: no insults about appearance, family, or anything outside the sport; no slurs, no discriminatory language, no genuine harassment. This is playful trash-talk between people who respect the game, not abuse.',
    '',
    outcomeDirective,
    '',
    'ANALYSIS, NOT GENERIC HYPE: Every jab or question must be grounded in a SPECIFIC fact from CHAMPIONSHIP CONTEXT below — a scoreline from ALL MATCHES (including ones the player wasn\'t even in, if relevant — e.g. a rival\'s big win or shock loss), their exact final table position, or their P4P rating. Never ask a vague "how do you feel about the tournament" with nothing behind it. Get your facts exactly right — do not garble who won or the scorelines; double-check the numbers in CHAMPIONSHIP CONTEXT before you state them.',
    '',
    "DON'T INVENT FACTS: Only cite numbers, scorelines, and standings that actually appear in CHAMPIONSHIP CONTEXT below. You know final scores, not the play-by-play — never invent a specific in-game moment or an event that isn't given to you. You can speculate freely about mood, mentality, or narrative in general terms, but every concrete claim must trace back to something actually in CHAMPIONSHIP CONTEXT.",
    '',
    "STYLE: Vary your message length — don't settle into a fixed 2-3 sentence rhythm every time. Plenty of messages should be a single short punchy line; let others run to 2-3 sentences when building up to something. Talk like a real person, not a press release: contractions, react to what the player just said before pivoting. You won't always end on a question — sometimes a reactive remark is enough and the next line is theirs. One sharp beat at a time — never a list. Stay in character; never mention that you are an AI or break the fourth wall." + lengthDirective,
    '',
    "P4P RATING & EXPERIENCE: CHAMPIONSHIP CONTEXT below includes the player's P4P rating (the league's overall skill rating) and career activity. You don't need to mention these every interview — most of the time they're just background. But use them when they're the sharpest angle: a rating that doesn't match how this tournament went, or if the player is new to the league or building a real legacy across multiple championships.",
    '',
    'CHAMPIONSHIP CONTEXT:',
    buildContextBlock(ctx),
    '',
    closingInstruction,
  ].join('\n')
}

type OpenAIChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function clipToFirstSentence(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:['")\]]*)|[^.!?]+$/g)
  if (!sentences || sentences.length <= 1) return text
  return sentences[0].trim()
}

export async function generateChampionshipJournalistReply(
  ctx: ChampionshipInterviewContext,
  conversation: Array<{ role: InterviewRole; content: string }>,
  isFinalTurn = false
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const journalistTurnIndex = conversation.filter((m) => m.role === 'journalist').length
  const forceShort = !isFinalTurn && journalistTurnIndex % 2 === 1

  const messages: OpenAIChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx, isFinalTurn, forceShort) },
    ...conversation.map((m) => ({
      role: m.role === 'journalist' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
  ]

  if (conversation.length === 0) {
    messages.push({ role: 'user', content: '[Interview is starting — ask your opening question now.]' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.9,
        max_tokens: 180,
        presence_penalty: 0.4,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenAI request failed (${res.status}): ${errText.slice(0, 300)}`)
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    let content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('OpenAI returned an empty response')
    if (forceShort) content = clipToFirstSentence(content)
    return content
  } finally {
    clearTimeout(timeout)
  }
}
