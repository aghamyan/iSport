import Link from 'next/link'
import { ArrowLeft, Mic, CheckCircle2, Radio } from 'lucide-react'

// Same "The Mic" journalist accent used in the live interview modal
// (app/championships/MatchInterviewModal.tsx) — kept as a literal RGB triple
// so rgba(MIC_RGB, alpha) tints stay valid in both themes.
const MIC_RGB = '139, 92, 246'
const MIC = `rgb(${MIC_RGB})`

type Message = { id: string; role: 'journalist' | 'player'; content: string; createdAt: string }

type Props = {
  phase: 'pre_match' | 'post_match'
  status: 'in_progress' | 'completed'
  playerName: string
  opponentName: string
  championshipName: string
  championshipId: string | null
  messages: Message[]
  currentUserId: string
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function InterviewTranscriptView({
  phase, status, playerName, opponentName, championshipName, championshipId, messages, currentUserId,
}: Props) {
  const title = phase === 'pre_match' ? 'Pre-Match Interview' : 'Post-Match Interview'
  const isDone = status === 'completed'

  return (
    <>
      <style>{`
        .transcript-back:hover { color: var(--accent) !important; }
        .transcript-champ-link:hover { text-decoration: underline; }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 'var(--fixed-nav-h)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>

          {/* Back link */}
          <Link href={championshipId ? `/championships/${championshipId}` : '/championships'} style={{ textDecoration: 'none' }}>
            <div
              className="transcript-back"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700, color: 'var(--muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                marginBottom: 20, cursor: 'pointer', transition: 'color 0.15s',
              }}
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              Back to Championship
            </div>
          </Link>

          {/* Hero card */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
            padding: '22px 20px', marginBottom: 18,
            boxShadow: 'var(--shadow-card)',
            backgroundImage: `linear-gradient(135deg, rgba(${MIC_RGB}, 0.10), transparent 65%)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: `rgba(${MIC_RGB}, 0.14)`, color: MIC,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Mic size={20} strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MIC, letterSpacing: '0.03em' }}>THE MIC</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                  {title}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              {playerName} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>vs</span> {opponentName}
            </div>
            <div style={{ marginTop: 3, fontSize: 13, color: 'var(--text2)' }}>
              {championshipId ? (
                <Link href={`/championships/${championshipId}`} className="transcript-champ-link" style={{ color: 'var(--text2)', textDecoration: 'none' }}>
                  {championshipName}
                </Link>
              ) : championshipName}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: `rgba(${MIC_RGB}, 0.12)`, color: MIC,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {phase === 'pre_match' ? 'Pre-match' : 'Post-match'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: isDone ? 'rgba(var(--rgb-win), 0.14)' : 'rgba(var(--rgb-gold), 0.14)',
                color: isDone ? 'var(--win)' : 'var(--gold)',
              }}>
                {isDone ? <CheckCircle2 size={12} strokeWidth={2.5} /> : <Radio size={12} strokeWidth={2.5} />}
                {isDone ? 'Completed' : 'In progress'}
              </span>
            </div>
          </div>

          {/* Transcript */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
            padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>
                No messages yet.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                title={fmtTime(m.createdAt)}
                style={{
                  display: 'flex', alignItems: 'flex-end', gap: 8,
                  alignSelf: m.role === 'journalist' ? 'flex-start' : 'flex-end',
                  maxWidth: '88%',
                }}
              >
                {m.role === 'journalist' && (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: `rgba(${MIC_RGB}, 0.14)`, color: MIC,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Mic size={13} strokeWidth={2} />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 700, marginBottom: 3,
                    color: m.role === 'journalist' ? MIC : 'var(--accent)',
                    textAlign: m.role === 'journalist' ? 'left' : 'right',
                  }}>
                    {m.role === 'journalist' ? 'The Mic' : playerName}
                  </div>
                  <div style={{
                    background: m.role === 'journalist' ? 'var(--card3)' : 'var(--accent)',
                    color: m.role === 'journalist' ? 'var(--text)' : '#fff',
                    borderRadius: 14,
                    borderTopLeftRadius: m.role === 'journalist' ? 4 : 14,
                    borderTopRightRadius: m.role === 'journalist' ? 14 : 4,
                    padding: '10px 14px',
                    fontSize: 14,
                    lineHeight: 1.55,
                    boxShadow: 'var(--shadow-sm)',
                    wordBreak: 'break-word',
                  }}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
