'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import {
  getOrCreateInterviewAction,
  sendInterviewReplyAction,
  endInterviewAction,
  type InterviewSession,
  type InterviewPhase,
} from './interviewActions'

// "The Mic" journalist identity — a dedicated accent distinct from the app's
// shared semantic tokens (--accent/--gold/--win). Kept as a literal RGB triple
// (matching the --rgb-accent/--rgb-win/--rgb-gold convention in globals.css) so
// tints are built with rgba(MIC_RGB, alpha) — never string-concatenate a hex
// alpha suffix onto a var() reference, which silently produces invalid CSS.
const MIC_RGB = '139, 92, 246'
const MIC = `rgb(${MIC_RGB})`

const INTERVIEW_STYLES = `
  @keyframes interviewOverlayIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes interviewPanelIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes bubbleIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes typingDot { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }
  @keyframes pipFillIn { from { transform: scale(0); } to { transform: scale(1); } }

  .interview-composer-input {
    border-color: var(--border);
  }
  .interview-composer-input:focus {
    border-color: ${MIC};
    box-shadow: 0 0 0 3px rgba(${MIC_RGB}, 0.16);
  }
  .interview-send-btn:not(:disabled):hover {
    filter: brightness(1.08);
  }
  .interview-close-btn:hover {
    background: var(--card3);
    color: var(--text);
  }
  .interview-end-btn:hover {
    color: var(--text2);
  }

  @media (prefers-reduced-motion: reduce) {
    .interview-overlay, .interview-panel, .interview-bubble, .interview-pip {
      animation: none !important;
    }
  }
`

type Props = {
  matchId: string
  phase: InterviewPhase
  playerName: string
  opponentName: string
  onClose: () => void
}

function MicIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2.5 12L21 3.5 14.5 20.5 11.5 13.5 2.5 12Z" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function MicAvatar() {
  return (
    <div
      style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: `rgba(${MIC_RGB}, 0.14)`, color: MIC,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <MicIcon size={13} />
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <MicAvatar />
      <div style={{
        display: 'flex', gap: 4, alignItems: 'center',
        background: 'var(--card3)', borderRadius: 12, borderTopLeftRadius: 4,
        padding: '10px 13px',
      }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6, height: 6, borderRadius: '50%', background: MIC,
              animation: `typingDot 1.2s ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function MatchInterviewModal({ matchId, phase, playerName, opponentName, onClose }: Props) {
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initedRef = useRef(false)

  useEffect(() => {
    // Guard against React StrictMode's dev-only double effect invocation, which would
    // otherwise fire this server action (and its OpenAI call) twice on first mount.
    // The action itself is also safe under real concurrency (see 23505 handling in
    // getOrCreateInterviewAction), this just avoids the wasted duplicate call in dev.
    if (initedRef.current) return
    initedRef.current = true
    getOrCreateInterviewAction(matchId, phase)
      .then((s) => setSession(s))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not start interview'))
      .finally(() => setLoading(false))
  }, [matchId, phase])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [session?.messages.length, isPending])

  useEffect(() => {
    if (!loading && session?.status === 'in_progress') inputRef.current?.focus()
  }, [loading, session?.status])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleSend() {
    const text = draft.trim()
    if (!text || !session || session.status !== 'in_progress') return
    setDraft('')
    setError(null)
    startTransition(async () => {
      try {
        const updated = await sendInterviewReplyAction(session.id, text)
        setSession(updated)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not send reply')
      }
    })
  }

  function handleEnd() {
    if (!session) return
    startTransition(async () => {
      try {
        await endInterviewAction(session.id)
        setSession({ ...session, status: 'completed' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not end interview')
      }
    })
  }

  const playerTurns = session?.messages.filter((m) => m.role === 'player').length ?? 0
  const isDone = session?.status === 'completed'
  const title = phase === 'pre_match' ? 'Pre-Match Interview' : 'Post-Match Interview'
  const maxTurns = session?.maxPlayerTurns ?? 0

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="interview-overlay"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, animation: 'interviewOverlayIn 0.15s ease',
        padding: 16,
      }}
    >
      <style>{INTERVIEW_STYLES}</style>
      <div
        className="interview-panel"
        style={{
          width: 440, maxWidth: '100%', maxHeight: '86vh',
          background: 'var(--card)', borderRadius: 14, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-card-hover)',
          border: '1px solid var(--border)',
          animation: 'interviewPanelIn 0.2s ease',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 14px 18px',
          borderBottom: '1px solid var(--border)',
          background: `linear-gradient(135deg, rgba(${MIC_RGB}, 0.10), transparent 65%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <MicAvatar />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                The Mic <span style={{ color: 'var(--muted)', fontWeight: 600 }}>· {title}</span>
              </div>
              <div style={{
                fontSize: 11.5, color: 'var(--muted)', marginTop: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {playerName} vs {opponentName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close interview"
            className="interview-close-btn"
            style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label="Interview transcript"
          style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 0' }}>
              <TypingIndicator />
              <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Connecting to The Mic…</div>
            </div>
          )}
          {session?.messages.map((m) => (
            <div
              key={m.id}
              className="interview-bubble"
              title={new Date(m.createdAt).toLocaleString()}
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                alignSelf: m.role === 'journalist' ? 'flex-start' : 'flex-end',
                maxWidth: '86%',
                animation: 'bubbleIn 0.2s ease',
              }}
            >
              {m.role === 'journalist' && <MicAvatar />}
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
                  padding: '9px 13px',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  boxShadow: 'var(--shadow-sm)',
                  wordBreak: 'break-word',
                }}>
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {isPending && <TypingIndicator />}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px' }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(var(--rgb-accent), 0.10)', color: 'var(--accent)',
              borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, marginBottom: 8,
            }}>
              <AlertIcon />
              {error}
            </div>
          )}
          {isDone ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12.5, color: 'var(--muted)', fontWeight: 700, padding: '6px 0',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: 'rgba(var(--rgb-win), 0.15)',
                color: 'var(--win)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <CheckIcon />
              </span>
              Interview complete
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Type your answer…"
                  aria-label="Your answer"
                  disabled={loading || isPending}
                  maxLength={500}
                  className="interview-composer-input"
                  style={{
                    flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 9,
                    border: '1px solid var(--border)', fontSize: 13.5, outline: 'none',
                    background: 'var(--card2)', color: 'var(--text)',
                    transition: 'border-color 0.12s, box-shadow 0.12s',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || isPending || !draft.trim()}
                  aria-label="Send answer"
                  className="interview-send-btn"
                  style={{
                    flexShrink: 0, width: 40, height: 40, borderRadius: 9, border: 'none',
                    background: MIC, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: loading || isPending || !draft.trim() ? 'default' : 'pointer',
                    opacity: loading || isPending || !draft.trim() ? 0.45 : 1,
                    transition: 'opacity 0.12s, filter 0.12s',
                  }}
                >
                  <SendIcon />
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {session && maxTurns > 0 && (
                    <div style={{ display: 'flex', gap: 3 }} aria-hidden="true">
                      {Array.from({ length: maxTurns }).map((_, i) => (
                        <span
                          key={i}
                          className="interview-pip"
                          style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: i < playerTurns ? MIC : 'var(--border)',
                            animation: i === playerTurns - 1 ? 'pipFillIn 0.2s ease' : undefined,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                    {session ? `${playerTurns}/${maxTurns} exchanges` : ''}
                  </span>
                </div>
                {session && playerTurns > 0 && (
                  <button
                    onClick={handleEnd}
                    disabled={isPending}
                    className="interview-end-btn"
                    style={{
                      background: 'transparent', border: 'none', color: 'var(--muted)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      padding: '4px 2px', transition: 'color 0.12s',
                    }}
                  >
                    End interview
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
