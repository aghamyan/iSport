// AI "Mic" journalist — pre-match and post-match interview generation.
// Pure prompt-construction + OpenAI call; no Supabase access here (callers
// in app/championships/interviewActions.ts assemble the context object).

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
export const OPENAI_MODEL = 'gpt-4o-mini'

// Player-turn cap per interview — bounds cost and keeps the exchange snappy.
export const MAX_PLAYER_TURNS = 6

export type InterviewRole = 'journalist' | 'player'

export type StandingLine = {
  rank: number
  totalPlayers: number
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

/** One recent championship-only result, with the score and who it was against —
 *  enough for the journalist to cite specifics ("lost to X 0-4") instead of just W/D/L. */
export type RecentMatchLine = {
  opponentName: string
  myGoals: number
  theirGoals: number
  result: 'W' | 'D' | 'L'
}

/** A quote pulled from the OPPONENT's own interview for this same match (pre or
 *  post), so the journalist can put it to the player: "X said... reaction?" */
export type OpponentQuote = {
  phase: 'pre_match' | 'post_match'
  content: string
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

export type InterviewContext = {
  phase: 'pre_match' | 'post_match'
  playerName: string
  opponentName: string
  championshipName: string
  playerRecord: { wins: number; losses: number; draws: number }
  opponentRecord: { wins: number; losses: number; draws: number }
  h2h: { playerWins: number; opponentWins: number; draws: number; totalMatches: number } | null
  playerForm: Array<'W' | 'D' | 'L'>
  opponentForm: Array<'W' | 'D' | 'L'>
  /** this player/opponent's standing in the CURRENT championship's table, if available */
  playerStanding: StandingLine | null
  opponentStanding: StandingLine | null
  /** each player's recent results within THIS championship specifically, with scorelines
   *  and opponent names (distinct from playerForm/opponentForm, which are bare W/D/L
   *  spanning every match type) */
  playerChampionshipForm: RecentMatchLine[]
  opponentChampionshipForm: RecentMatchLine[]
  /** betting odds for this match, if set */
  odds: { playerOdds: number; drawOdds: number; opponentOdds: number } | null
  /** completed championships other than this one, best finish first */
  playerPastChampionships: PastChampionshipLine[]
  opponentPastChampionships: PastChampionshipLine[]
  /** quotes from the OPPONENT's own interview(s) for this match, if they've done one */
  opponentQuotes: OpponentQuote[]
  /** P4P rating, if this player has any championship-match data to compute one from */
  playerP4P: P4PLine | null
  opponentP4P: P4PLine | null
  /** career match volume + recency — lets the journalist recognise a debut or a long layoff */
  playerActivity: ActivityLine
  opponentActivity: ActivityLine
  /** post_match only */
  finalResult?: { playerGoals: number; opponentGoals: number; outcome: 'W' | 'L' | 'D' }
  /** post_match only — this player's own answers from their pre-match interview, if any */
  priorPrediction?: string[]
}

function formString(form: Array<'W' | 'D' | 'L'>): string {
  return form.length > 0 ? form.join('') : 'no recent matches on record'
}

function standingString(name: string, s: StandingLine | null): string {
  if (!s) return `${name}'s position in this championship's table isn't available yet.`
  return (
    `${name} sits ${s.rank} of ${s.totalPlayers} in this championship's table ` +
    `(${s.points} pts, ${s.wins}W-${s.losses}L-${s.draws}D, goal diff ${s.goalDiff >= 0 ? '+' : ''}${s.goalDiff} from ${s.played} played).`
  )
}

function recentMatchesString(name: string, matches: RecentMatchLine[]): string {
  if (matches.length === 0) return `${name} has no other recorded matches in this championship yet.`
  const parts = matches.map((m) => {
    const verb = m.result === 'W' ? 'beat' : m.result === 'L' ? 'lost to' : 'drew with'
    return `${verb} ${m.opponentName} ${m.myGoals}-${m.theirGoals}`
  })
  return `${name}'s recent results in THIS championship (most recent first): ${parts.join('; ')}.`
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
  if (a.daysSinceLastMatch !== null && a.daysSinceLastMatch >= 21) noteParts.push(`hasn't played a match in ${a.daysSinceLastMatch} days, coming off a long layoff`)
  const note = noteParts.length > 0 ? ` (${noteParts.join('; ')})` : ''
  return `${name} has played ${a.matchesPlayed} career matches total${note}.`
}

function pastChampionshipsString(name: string, past: PastChampionshipLine[]): string {
  if (past.length === 0) return `${name} has no completed championships on record yet.`
  const finishes = past
    .map((p) => `${p.rank} of ${p.totalPlayers} in "${p.name}"`)
    .join(', ')
  return `${name}'s past championship finishes: ${finishes}.`
}

function buildContextBlock(ctx: InterviewContext): string {
  const lines: string[] = []
  lines.push(`Championship: ${ctx.championshipName}`)
  lines.push(`Player being interviewed: ${ctx.playerName} (career record ${ctx.playerRecord.wins}W-${ctx.playerRecord.losses}L-${ctx.playerRecord.draws}D)`)
  lines.push(`Opponent: ${ctx.opponentName} (career record ${ctx.opponentRecord.wins}W-${ctx.opponentRecord.losses}L-${ctx.opponentRecord.draws}D)`)
  lines.push(standingString(ctx.playerName, ctx.playerStanding))
  lines.push(standingString(ctx.opponentName, ctx.opponentStanding))
  lines.push(`${ctx.playerName}'s last 5 results overall (most recent first): ${formString(ctx.playerForm)}`)
  lines.push(`${ctx.opponentName}'s last 5 results overall (most recent first): ${formString(ctx.opponentForm)}`)
  lines.push(recentMatchesString(ctx.playerName, ctx.playerChampionshipForm))
  lines.push(recentMatchesString(ctx.opponentName, ctx.opponentChampionshipForm))
  lines.push(pastChampionshipsString(ctx.playerName, ctx.playerPastChampionships))
  lines.push(pastChampionshipsString(ctx.opponentName, ctx.opponentPastChampionships))
  lines.push(p4pString(ctx.playerName, ctx.playerP4P))
  lines.push(p4pString(ctx.opponentName, ctx.opponentP4P))
  lines.push(activityString(ctx.playerName, ctx.playerActivity))
  lines.push(activityString(ctx.opponentName, ctx.opponentActivity))

  if (ctx.odds) {
    lines.push(
      `Match odds: ${ctx.playerName} to win ${ctx.odds.playerOdds.toFixed(2)}, draw ${ctx.odds.drawOdds.toFixed(2)}, ` +
      `${ctx.opponentName} to win ${ctx.odds.opponentOdds.toFixed(2)}.`
    )
  } else {
    lines.push(`Match odds: not available for this match.`)
  }

  if (ctx.h2h && ctx.h2h.totalMatches > 0) {
    lines.push(
      `Head-to-head: ${ctx.playerName} has ${ctx.h2h.playerWins}W-${ctx.h2h.opponentWins}L-${ctx.h2h.draws}D ` +
      `vs ${ctx.opponentName} across ${ctx.h2h.totalMatches} meetings.`
    )
  } else {
    lines.push(`Head-to-head: this is their first recorded meeting.`)
  }

  if (ctx.phase === 'post_match' && ctx.finalResult) {
    const r = ctx.finalResult
    const verb = r.outcome === 'W' ? 'won' : r.outcome === 'L' ? 'lost' : 'drew'
    lines.push(`FINAL RESULT: ${ctx.playerName} just ${verb} ${r.playerGoals}-${r.opponentGoals} against ${ctx.opponentName}.`)
  }

  if (ctx.priorPrediction && ctx.priorPrediction.length > 0) {
    lines.push(
      `Before the match, ${ctx.playerName} said in their OWN pre-match interview: ` +
      ctx.priorPrediction.map((q) => `"${q}"`).join(' / ')
    )
  }

  const oppPreQuotes = ctx.opponentQuotes.filter((q) => q.phase === 'pre_match').map((q) => `"${q.content}"`)
  const oppPostQuotes = ctx.opponentQuotes.filter((q) => q.phase === 'post_match').map((q) => `"${q.content}"`)
  if (oppPreQuotes.length > 0) {
    lines.push(`In THEIR OWN pre-match interview, ${ctx.opponentName} said: ` + oppPreQuotes.join(' / '))
  }
  if (oppPostQuotes.length > 0) {
    lines.push(`In THEIR OWN post-match interview, ${ctx.opponentName} said: ` + oppPostQuotes.join(' / '))
  }

  return lines.join('\n')
}

function buildSystemPrompt(ctx: InterviewContext, isFinalTurn: boolean, forceShort: boolean, forceQuoteBeat: boolean): string {
  const phaseLabel = ctx.phase === 'pre_match' ? 'BEFORE the match' : 'AFTER the match'

  const closingInstruction = isFinalTurn
    ? 'This is the LAST exchange of the interview. Respond to what the player just said, then close out with one punchy sign-off line — do not ask another question.'
    : ctx.phase === 'pre_match'
      ? "Press the player on their chances, their prediction, or a stat that cuts against them. If this is your opening line, greet them briefly and go straight into your first question — don't waste it on small talk."
      : "React to how the result actually played out versus the stats, expectations, or the player's own prediction — sarcasm if it's warranted, credit if they backed it up. If this is your opening line, get straight to it."

  const lengthDirective = !isFinalTurn && forceShort
    ? ' For THIS reply specifically: ONE short sentence only — a quick jab, reaction, or one-line question. Nothing more.'
    : ''

  const quoteDirective = forceQuoteBeat
    ? ' For THIS reply specifically: pick the sharpest thing the opponent said in their own interview (see MATCH CONTEXT below) and put it directly to the player — quote it and ask for their reaction. This is the beat for it, use it now.'
    : ''

  return [
    `You are "The Mic", the in-house AI sports journalist for iSport, an amateur/friends esports league. You are interviewing ${ctx.playerName} ${phaseLabel}.`,
    '',
    'PERSONA: Sharp, witty, provocative — like a boxing pre-fight press conference host. You needle players about bad odds, shaky recent form, and lopsided head-to-head records, and you are not afraid of a pointed follow-up. You can be sarcastic when a prediction ages badly. But you are never actually cruel: no insults about appearance, family, or anything outside the sport; no slurs, no discriminatory language, no genuine harassment. This is playful trash-talk between people who respect the game, not abuse.',
    '',
    'ANALYSIS, NOT GENERIC HYPE: Every jab or question must be grounded in a SPECIFIC fact from MATCH CONTEXT below — a scoreline, a standings position, an odds number, a head-to-head record, or a quote. Never ask a vague "how are you feeling about the match" with nothing behind it. If the opponent just lost or barely won their last championship match, bring up the exact scoreline. If the table has the player well ahead or behind the opponent, say by how much. Get your facts exactly right — do not garble who won or who is ahead; double-check the numbers in MATCH CONTEXT before you state them. Sound like someone who actually watched the results come in, not someone guessing.',
    '',
    "DON'T INVENT FACTS: Only cite numbers, scorelines, and quotes that actually appear in MATCH CONTEXT below. You know the final score, not the play-by-play — never invent a specific in-game moment, a half-time score, a momentum swing, or an event that isn't given to you. You can speculate freely about mood, mentality, or narrative in general terms, but every concrete claim must trace back to something actually in MATCH CONTEXT.",
    '',
    "STYLE: Vary your message length — don't settle into a fixed 2-3 sentence rhythm every time. Plenty of messages should be a single short punchy line; let others run to 2-3 sentences when building up to something. Talk like a real person, not a press release: contractions, the odd interruption of your own thought, react to what the player just said before pivoting. You won't always end on a question — sometimes a reactive remark is enough and the next line is theirs. One sharp beat at a time — never a list. Stay in character; never mention that you are an AI or break the fourth wall." + lengthDirective,
    '',
    "OPPONENT'S OWN WORDS: If MATCH CONTEXT below includes something the opponent said in their own interview, that's some of your best material — quote it (or paraphrase tightly) and ask the player to react." + quoteDirective,
    '',
    "P4P RATING & EXPERIENCE: MATCH CONTEXT below includes each player's P4P rating (the league's overall skill rating) and career activity (total matches, days since their last match). You don't need to mention these every interview — most of the time they're just background you're aware of, not a topic. But use them when they're the sharpest angle: a big P4P gap between the two, a rating that doesn't match the odds, or especially if a player is new to the league (very few matches) or returning from a long layoff — in those cases, treat them like it (curious about a debut, needling some ring rust) instead of grilling them on a rich recent history or rivalry they don't actually have.",
    '',
    'MATCH CONTEXT:',
    buildContextBlock(ctx),
    '',
    closingInstruction,
  ].join('\n')
}

type OpenAIChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

// A prompt instruction alone doesn't reliably vary length turn to turn — models
// tend to converge on one comfortable size. Force it deterministically instead:
// every other journalist turn gets an explicit "one sentence" directive, with a
// code-level clip as a backstop for when the model runs long anyway. Truncating
// via max_tokens would just cut a reply off mid-word — clipping on a sentence
// boundary reads as a deliberately short remark instead of a bug.
function clipToFirstSentence(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:['")\]]*)|[^.!?]+$/g)
  if (!sentences || sentences.length <= 1) return text
  return sentences[0].trim()
}

export async function generateJournalistReply(
  ctx: InterviewContext,
  conversation: Array<{ role: InterviewRole; content: string }>,
  isFinalTurn = false
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const journalistTurnIndex = conversation.filter((m) => m.role === 'journalist').length
  // Left to its own judgment the model treats the opponent's quotes as optional and
  // often skips them across a whole interview — force the callback onto a specific
  // early turn instead of just suggesting it. Takes priority over the shortness slot
  // on the same turn so the quote-and-reaction beat has room to land properly.
  const forceQuoteBeat = !isFinalTurn && journalistTurnIndex === 1 && ctx.opponentQuotes.length > 0
  const forceShort = !isFinalTurn && !forceQuoteBeat && journalistTurnIndex % 2 === 1

  const messages: OpenAIChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx, isFinalTurn, forceShort, forceQuoteBeat) },
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
