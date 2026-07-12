// AI match preview — a written, pre-match-style analysis for the "AI Preview"
// tab in MatchPreviewModal. Pure prompt-construction + OpenAI call; no
// Supabase access here (the caller in app/championships/aiPreviewActions.ts
// assembles the context object and caches the result).

import {
  type StandingLine,
  type PastChampionshipLine,
  type RecentMatchLine,
  type P4PLine,
  type ActivityLine,
} from './interview'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini'

export type MatchPreviewAiContext = {
  championshipName: string
  roundLabel: string | null // e.g. "GRAND FINAL", "SEMI-FINAL", "GROUP A" — null for regular round-robin matches
  homeName: string
  awayName: string
  homeRecord: { wins: number; losses: number; draws: number }
  awayRecord: { wins: number; losses: number; draws: number }
  homeStanding: StandingLine | null
  awayStanding: StandingLine | null
  h2h: { homeWins: number; awayWins: number; draws: number; totalMatches: number } | null
  homeForm: Array<'W' | 'D' | 'L'>
  awayForm: Array<'W' | 'D' | 'L'>
  homeChampionshipForm: RecentMatchLine[]
  awayChampionshipForm: RecentMatchLine[]
  homePastChampionships: PastChampionshipLine[]
  awayPastChampionships: PastChampionshipLine[]
  homeP4P: P4PLine | null
  awayP4P: P4PLine | null
  homeActivity: ActivityLine
  awayActivity: ActivityLine
  odds: { homeOdds: number; drawOdds: number; awayOdds: number } | null
  /** null if the match hasn't been played yet */
  finalScore: { homeGoals: number; awayGoals: number } | null
  /** quotes from each player's OWN pre-match interview for this match, if they did one */
  homeQuotes: string[]
  awayQuotes: string[]
}

export type MatchPreviewAiResult = {
  headline: string
  summary: string
  insights: Array<{ title: string; detail: string }>
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
  const finishes = past.map((p) => `${p.rank} of ${p.totalPlayers} in "${p.name}"`).join(', ')
  return `${name}'s past championship finishes: ${finishes}.`
}

function buildContextBlock(ctx: MatchPreviewAiContext): string {
  const lines: string[] = []
  lines.push(`Championship: ${ctx.championshipName}`)
  if (ctx.roundLabel) lines.push(`Round: ${ctx.roundLabel}`)
  lines.push(`Home player: ${ctx.homeName} (career record ${ctx.homeRecord.wins}W-${ctx.homeRecord.losses}L-${ctx.homeRecord.draws}D)`)
  lines.push(`Away player: ${ctx.awayName} (career record ${ctx.awayRecord.wins}W-${ctx.awayRecord.losses}L-${ctx.awayRecord.draws}D)`)
  lines.push(standingString(ctx.homeName, ctx.homeStanding))
  lines.push(standingString(ctx.awayName, ctx.awayStanding))
  lines.push(`${ctx.homeName}'s last 5 results overall (most recent first): ${formString(ctx.homeForm)}`)
  lines.push(`${ctx.awayName}'s last 5 results overall (most recent first): ${formString(ctx.awayForm)}`)
  lines.push(recentMatchesString(ctx.homeName, ctx.homeChampionshipForm))
  lines.push(recentMatchesString(ctx.awayName, ctx.awayChampionshipForm))
  lines.push(pastChampionshipsString(ctx.homeName, ctx.homePastChampionships))
  lines.push(pastChampionshipsString(ctx.awayName, ctx.awayPastChampionships))
  lines.push(p4pString(ctx.homeName, ctx.homeP4P))
  lines.push(p4pString(ctx.awayName, ctx.awayP4P))
  lines.push(activityString(ctx.homeName, ctx.homeActivity))
  lines.push(activityString(ctx.awayName, ctx.awayActivity))

  if (ctx.odds) {
    lines.push(
      `Match odds: ${ctx.homeName} to win ${ctx.odds.homeOdds.toFixed(2)}, draw ${ctx.odds.drawOdds.toFixed(2)}, ` +
      `${ctx.awayName} to win ${ctx.odds.awayOdds.toFixed(2)}.`
    )
  } else {
    lines.push('Match odds: not available for this match.')
  }

  if (ctx.h2h && ctx.h2h.totalMatches > 0) {
    lines.push(
      `Head-to-head: ${ctx.homeName} has ${ctx.h2h.homeWins}W-${ctx.h2h.awayWins}L-${ctx.h2h.draws}D ` +
      `vs ${ctx.awayName} across ${ctx.h2h.totalMatches} meetings.`
    )
  } else {
    lines.push('Head-to-head: this is their first recorded meeting.')
  }

  if (ctx.finalScore) {
    lines.push(
      `THIS MATCH HAS ALREADY BEEN PLAYED. Final score: ${ctx.homeName} ${ctx.finalScore.homeGoals}-${ctx.finalScore.awayGoals} ${ctx.awayName}. ` +
      'Write the preview as a recap that judges how it played out against the pre-match picture, not as a forward-looking prediction.'
    )
  } else {
    lines.push('THIS MATCH HAS NOT BEEN PLAYED YET. Write the preview as a forward-looking, pre-match analysis.')
  }

  if (ctx.homeQuotes.length > 0) {
    lines.push(`In THEIR OWN pre-match interview, ${ctx.homeName} said: ` + ctx.homeQuotes.map((q) => `"${q}"`).join(' / '))
  }
  if (ctx.awayQuotes.length > 0) {
    lines.push(`In THEIR OWN pre-match interview, ${ctx.awayName} said: ` + ctx.awayQuotes.map((q) => `"${q}"`).join(' / '))
  }

  return lines.join('\n')
}

function buildSystemPrompt(ctx: MatchPreviewAiContext): string {
  return [
    'You are the in-house AI match analyst for iSport, an amateur/friends esports league. You write short, sharp pre-match previews the way a good sports site does: grounded in the numbers, alert to storylines, never generic.',
    '',
    'ANALYSIS, NOT GENERIC HYPE: Every insight must be grounded in a SPECIFIC fact from MATCH CONTEXT below — a scoreline, a standings position, an odds number, a head-to-head record, a P4P rating, or a quote. Never write a vague "this should be a great match" with nothing behind it. Get your facts exactly right — do not garble who is ahead, who won a past meeting, or which way the odds point. Double-check every number you cite against MATCH CONTEXT before writing it down.',
    '',
    "DON'T INVENT FACTS: Only cite numbers, scorelines, standings, and quotes that actually appear in MATCH CONTEXT below. Never invent a specific in-game moment, an injury, a storyline, or a stat that isn't given to you. You can speculate about mentality, momentum, or narrative in general terms, but every concrete claim must trace back to something actually in MATCH CONTEXT.",
    '',
    'STYLE: Confident, knowledgeable, a little colorful — like a beat writer who has watched this league closely. Vary sentence rhythm. No bullet-speak inside prose fields; write in full sentences. Never mention that you are an AI or that you were given "context" — just write the preview.',
    '',
    'WHAT TO COVER, using whichever angles are actually the sharpest given MATCH CONTEXT (you do not need to force all of them): recent form and momentum, the head-to-head history, what the current championship standings mean for each player (title race, survival, pride), each player\'s P4P rating and what the gap (or lack of one) suggests, past championship pedigree, a notable debut or long layoff, what the betting odds imply versus what the underlying numbers suggest, and anything sharp either player said in their own pre-match interview quoted in MATCH CONTEXT.',
    '',
    'MATCH CONTEXT:',
    buildContextBlock(ctx),
    '',
    'Respond with ONLY a JSON object (no markdown fences, no commentary) matching this exact shape:',
    '{',
    '  "headline": string,   // one punchy line hooking the reader on this specific match, under 90 characters',
    '  "summary": string,    // 2-4 sentences setting the scene: who these two are, what is at stake, and the overall shape of the matchup',
    '  "insights": [         // 3 to 5 items, each a distinct angle grounded in MATCH CONTEXT — no filler, no repeating the summary',
    '    { "title": string, "detail": string }  // title: a short punchy label (2-6 words). detail: 1-3 sentences backing it up with specifics',
    '  ]',
    '}',
  ].join('\n')
}

export async function generateMatchPreview(ctx: MatchPreviewAiContext): Promise<MatchPreviewAiResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: buildSystemPrompt(ctx) }],
        temperature: 0.8,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenAI request failed (${res.status}): ${errText.slice(0, 300)}`)
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('OpenAI returned an empty response')

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('OpenAI returned malformed JSON')
    }

    const obj = parsed as Record<string, unknown>
    const headline = typeof obj.headline === 'string' ? obj.headline.trim() : ''
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
    const rawInsights = Array.isArray(obj.insights) ? obj.insights : []
    const insights = rawInsights
      .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
      .map((i) => ({
        title: typeof i.title === 'string' ? i.title.trim() : '',
        detail: typeof i.detail === 'string' ? i.detail.trim() : '',
      }))
      .filter((i) => i.title.length > 0 && i.detail.length > 0)
      .slice(0, 5)

    if (!headline || !summary || insights.length === 0) {
      throw new Error('OpenAI response was missing required preview fields')
    }

    return { headline, summary, insights }
  } finally {
    clearTimeout(timeout)
  }
}
