// Telegram group notifications for news comments.
// Sends via the Bot API to a single shared group chat (TELEGRAM_CHAT_ID) —
// no per-user linking, everyone in the group sees every new comment/reply.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn('Telegram notify skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set')
    return
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      console.error('Telegram sendMessage failed', res.status, await res.text())
    }
  } catch (err) {
    console.error('Telegram sendMessage error', err)
  }
}

function newsLink(newsId: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  return `${siteUrl}/news/${newsId}`
}

function interviewLink(interviewId: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  return `${siteUrl}/interviews/${interviewId}`
}

function championshipInterviewLink(interviewId: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  return `${siteUrl}/championship-interviews/${interviewId}`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

export async function notifyNewComment(params: {
  newsId: string
  newsTitle: string
  authorName: string
  replyToName?: string | null
}): Promise<void> {
  const action = params.replyToName
    ? `replied to <b>${escapeHtml(params.replyToName)}</b>`
    : 'commented'

  const text =
    `💬 <b>${escapeHtml(params.authorName)}</b> ${action} on "<b>${escapeHtml(params.newsTitle)}</b>"\n\n` +
    `View on ${newsLink(params.newsId)}`

  await sendTelegramMessage(text)
}

export async function notifyNewsPublished(params: {
  newsId: string
  title: string
}): Promise<void> {
  const text =
    `📰 New article: <b>${escapeHtml(params.title)}</b>\n\n` +
    `Read it on ${newsLink(params.newsId)}`

  await sendTelegramMessage(text)
}

export async function notifyInterviewCompleted(params: {
  interviewId: string
  playerName: string
  opponentName: string
  phase: 'pre_match' | 'post_match'
  championshipName: string
}): Promise<void> {
  const matchup = params.phase === 'pre_match'
    ? `ahead of their match vs <b>${escapeHtml(params.opponentName)}</b>`
    : `after their match vs <b>${escapeHtml(params.opponentName)}</b>`

  const text =
    `🎙 <b>${escapeHtml(params.playerName)}</b> gave a ${params.phase === 'pre_match' ? 'pre-match' : 'post-match'} interview ` +
    `${matchup} in <b>${escapeHtml(params.championshipName)}</b>\n\n` +
    `Read it on ${interviewLink(params.interviewId)}`

  await sendTelegramMessage(text)
}

export async function notifyChampionshipInterviewCompleted(params: {
  interviewId: string
  playerName: string
  championshipName: string
  rank: number
  totalPlayers: number
}): Promise<void> {
  const finishNote = params.rank === 1
    ? 'as CHAMPION'
    : `finishing ${ordinal(params.rank)} of ${params.totalPlayers}`

  const text =
    `🎙 <b>${escapeHtml(params.playerName)}</b> gave a season-wrap interview after ${finishNote} ` +
    `in <b>${escapeHtml(params.championshipName)}</b>\n\n` +
    `Read it on ${championshipInterviewLink(params.interviewId)}`

  await sendTelegramMessage(text)
}
