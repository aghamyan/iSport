import Link from 'next/link'
import { ArrowLeft, Mic, CheckCircle2, Radio, Trophy } from 'lucide-react'

// Same "The Mic" journalist accent used in the match interview modal/transcript
// (app/championships/MatchInterviewModal.tsx) — kept as a literal RGB triple
// so rgba(MIC_RGB, alpha) tints stay valid in both themes.
const MIC_RGB = '139, 92, 246'
const MIC = `rgb(${MIC_RGB})`

type Message = { id: string; role: 'journalist' | 'player'; content: string; createdAt: string }

type Props = {
  status: 'in_progress' | 'completed'
  playerName: string
  playerAvatarUrl: string | null
  championshipName: string
  championshipId: string
  finalRank: number
  totalPlayers: number
  points: number
  wins: number
  draws: number
  losses: number
  goalDiff: number
  messages: Message[]
  currentUserId: string
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'var(--accent)', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#84cc16',
]

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// Same avatar treatment as ChampionshipDetail.tsx's Avatar — photo with a graceful
// initials fallback, plus a gold ring + pulse for the champion so the transcript
// header reads the same way the standings tab does.
function PlayerAvatar({ url, name, size = 44, champion = false }: { url: string | null; name: string; size?: number; champion?: boolean }) {
  const initials = getInitials(name)
  const bg = nameToColor(name)
  const fontSize = Math.round(size * 0.38)

  const sharedStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    outline: champion ? '2px solid var(--gold)' : undefined,
    outlineOffset: 2,
    animation: champion ? 'ciGoldPulse 2.5s ease-in-out infinite' : undefined,
  }

  if (url) {
    return (
      <div style={{ ...sharedStyle, background: 'var(--card)', border: '2px solid rgba(var(--rgb-overlay),0.08)', overflow: 'hidden' }}>
        <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  return (
    <div style={{
      ...sharedStyle, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: 800, color: '#fff', border: '2px solid rgba(var(--rgb-overlay),0.05)', letterSpacing: '-0.5px',
    }}>
      {initials}
    </div>
  )
}

export function ChampionshipInterviewTranscriptView({
  status, playerName, playerAvatarUrl, championshipName, championshipId, finalRank, totalPlayers,
  points, wins, draws, losses, goalDiff, messages, currentUserId,
}: Props) {
  const isDone = status === 'completed'
  const isChampion = finalRank === 1

  return (
    <>
      <style>{`
        @keyframes ciGoldPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(245,158,11,0.45), 0 0 20px rgba(245,158,11,0.18); }
          50%       { box-shadow: 0 0 16px rgba(245,158,11,0.7), 0 0 32px rgba(245,158,11,0.3); }
        }
        .transcript-back:hover { color: var(--accent) !important; }
        .transcript-champ-link:hover { text-decoration: underline; }
        @media (prefers-reduced-motion: reduce) {
          .ci-player-avatar { animation: none !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 'var(--fixed-nav-h)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>

          {/* Back link */}
          <Link href={`/championships/${championshipId}`} style={{ textDecoration: 'none' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mic size={13} strokeWidth={2.5} style={{ color: MIC }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: MIC, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                The Mic · Season-Wrap Interview
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
              <PlayerAvatar url={playerAvatarUrl} name={playerName} size={56} champion={isChampion} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {playerName}
                  {isChampion && <Trophy size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                </div>
                <div style={{ marginTop: 3, fontSize: 13, color: 'var(--text2)' }}>
                  <Link href={`/championships/${championshipId}`} className="transcript-champ-link" style={{ color: 'var(--text2)', textDecoration: 'none' }}>
                    {championshipName}
                  </Link>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: isChampion ? 'rgba(var(--rgb-gold), 0.14)' : `rgba(${MIC_RGB}, 0.12)`,
                color: isChampion ? 'var(--gold)' : MIC,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {isChampion ? 'Champion' : `Finished ${ordinal(finalRank)} of ${totalPlayers}`}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: 'var(--card3)', color: 'var(--text2)',
              }}>
                {points} pts · {wins}W-{losses}L-{draws}D · GD {goalDiff >= 0 ? '+' : ''}{goalDiff}
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
                {m.role === 'player' && (
                  <PlayerAvatar url={playerAvatarUrl} name={playerName} size={26} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
