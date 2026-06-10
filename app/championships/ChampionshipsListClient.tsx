'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CreateChampionshipModal, type PlayerOption } from './CreateChampionshipModal'
import { BottomNav } from '@/app/components/BottomNav'

const BG    = '#050911'
const CARD  = '#0c1422'
const CARD2 = '#0f1a2e'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const GOLD  = '#f59e0b'
const TEXT  = '#f8fafc'
const MUTED = '#6b7280'
const GREEN = '#22c55e'

const ANIMS = `
  @keyframes trophyGlow {
    0%, 100% { box-shadow: 0 0 14px rgba(245,158,11,0.45), 0 0 28px rgba(245,158,11,0.2); }
    50%       { box-shadow: 0 0 24px rgba(245,158,11,0.75), 0 0 48px rgba(245,158,11,0.38); }
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes activePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.9); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
`

type ChampionshipItem = {
  id: string
  name: string
  numberOfCycles: number
  isActive: boolean
  createdAt: string
  playedAt: string | null
  playerCount: number
}

type Props = {
  championships: ChampionshipItem[]
  players: PlayerOption[]
  isAdmin: boolean
  userId: string
}

export function ChampionshipsListClient({ championships, players, isAdmin, userId }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const activeCount = championships.filter((c) => c.isActive).length

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '0 0 56px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: BG,
        minHeight: '100svh',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: ANIMS }} />

      {/* ── Header banner ── */}
      <div
        style={{
          background: 'linear-gradient(160deg, #050d1c 0%, #0c1e3a 55%, #050911 100%)',
          borderBottom: `1px solid ${BORDER}`,
          padding: '36px 24px 32px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          pointerEvents: 'none',
        }} />
        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 160, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, position: 'relative' }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.55)',
              textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>
              iSport FC
            </div>
            <h1 style={{ margin: '0 0 10px', fontSize: 30, fontWeight: 900, color: TEXT, letterSpacing: '-0.5px' }}>
              Championships
            </h1>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: MUTED }}>
                {championships.length} total
              </span>
              {activeCount > 0 && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: GREEN, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: GREEN,
                    animation: 'activePulse 2s ease-in-out infinite',
                    display: 'inline-block',
                  }} />
                  {activeCount} active
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '10px 22px',
                background: `linear-gradient(135deg, #1d4ed8, ${ACCENT})`,
                color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(59,130,246,0.4)', flexShrink: 0,
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(59,130,246,0.6)'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(59,130,246,0.4)'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
              }}
            >
              + New Championship
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div style={{ padding: '0 20px' }}>
        {championships.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 0', color: MUTED,
            border: `2px dashed ${BORDER}`, borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
              No championships yet
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  background: 'none', border: 'none', color: ACCENT, cursor: 'pointer',
                  fontSize: 14, fontWeight: 600, padding: 0,
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}
              >
                Create the first one
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {championships.map((c, i) => {
              const isActive = c.isActive
              return (
                <Link
                  key={c.id}
                  href={`/championships/${c.id}`}
                  style={{
                    textDecoration: 'none', color: 'inherit',
                    animation: `fadeSlideIn 0.35s ease both ${i * 0.06}s`,
                    display: 'block',
                  }}
                >
                  <div
                    style={{
                      border: `1px solid ${isActive ? 'rgba(245,158,11,0.35)' : BORDER}`,
                      borderRadius: 14,
                      padding: '16px 20px',
                      background: CARD,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                      boxShadow: isActive
                        ? '0 2px 14px rgba(245,158,11,0.1)'
                        : '0 2px 8px rgba(0,0,0,0.25)',
                      transition: 'box-shadow 0.2s, border-color 0.2s, background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.boxShadow = isActive
                        ? '0 0 0 1px rgba(245,158,11,0.6), 0 6px 24px rgba(245,158,11,0.18)'
                        : `0 0 0 1px rgba(59,130,246,0.55), 0 6px 24px rgba(59,130,246,0.18)`
                      el.style.borderColor = isActive ? 'rgba(245,158,11,0.65)' : 'rgba(59,130,246,0.5)'
                      el.style.background = CARD2
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.boxShadow = isActive ? '0 2px 14px rgba(245,158,11,0.1)' : '0 2px 8px rgba(0,0,0,0.25)'
                      el.style.borderColor = isActive ? 'rgba(245,158,11,0.35)' : BORDER
                      el.style.background = CARD
                    }}
                  >
                    {/* Trophy icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,191,36,0.12))'
                        : 'rgba(59,130,246,0.07)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                      border: `1px solid ${isActive ? 'rgba(245,158,11,0.35)' : BORDER}`,
                      animation: isActive ? 'trophyGlow 2.8s ease-in-out infinite' : 'none',
                    }}>
                      🏆
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 15, fontWeight: 700, color: TEXT,
                        marginBottom: 5, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.name}
                      </div>
                      <div style={{
                        fontSize: 12, color: MUTED, display: 'flex', gap: 12, flexWrap: 'wrap',
                      }}>
                        <span>
                          <strong style={{ color: '#94a3b8' }}>{c.playerCount}</strong> players
                        </span>
                        <span>
                          <strong style={{ color: '#94a3b8' }}>{c.numberOfCycles}</strong>{' '}
                          cycle{c.numberOfCycles !== 1 ? 's' : ''}
                        </span>
                        <span>
                          {new Date(c.playedAt ?? c.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Status + arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                        background: isActive ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.07)',
                        color: isActive ? GREEN : MUTED,
                        border: isActive ? '1px solid rgba(34,197,94,0.3)' : `1px solid ${BORDER}`,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        {isActive ? 'Active' : 'Ended'}
                      </span>
                      <span style={{ color: '#475569', fontSize: 18, lineHeight: 1 }}>›</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateChampionshipModal players={players} onClose={() => setShowCreate(false)} />
      )}
      <BottomNav userId={userId} />
    </div>
  )
}
