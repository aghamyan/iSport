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

export async function notifyNewComment(params: {
  newsId: string
  newsTitle: string
  authorName: string
  replyToName?: string | null
}): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const link = `${siteUrl}/news/${params.newsId}`

  const action = params.replyToName
    ? `replied to <b>${escapeHtml(params.replyToName)}</b>`
    : 'commented'

  const text =
    `💬 <b>${escapeHtml(params.authorName)}</b> ${action} on "<b>${escapeHtml(params.newsTitle)}</b>"\n\n` +
    `View on ${link}`

  await sendTelegramMessage(text)
}
