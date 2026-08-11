'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { CreateChampionshipModal, type PlayerOption } from './CreateChampionshipModal'
import { useTranslation } from '@/lib/i18n/context'

const BG     = 'var(--bg)'
const BORDER = 'var(--border)'
const ACCENT = 'var(--accent)'
const GOLD   = 'var(--gold)'
const TEXT   = 'var(--text)'
const MUTED  = 'var(--muted)'
const GREEN  = 'var(--win)'

const ANIMS = `
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes activePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.9); }
  }
  @keyframes trophyGlow {
    0%, 100% { box-shadow: 0 0 10px rgba(245,158,11,0.35), 0 0 22px rgba(245,158,11,0.15); }
    50%       { box-shadow: 0 0 18px rgba(245,158,11,0.6), 0 0 36px rgba(245,158,11,0.28); }
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
  const { t } = useTranslation()
  const [showCreate, setShowCreate] = useState(false)
  const activeCount = championships.filter((c) => c.isActive).length

  return (
    <div
      className="app-page"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: BG,
        minHeight: '100svh',
        paddingBottom: 'var(--nav-h)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: ANIMS }} />
      <div className="page-content-wide">

      {/* ── Header banner ── */}
      <div
        style={{
          background: 'var(--gradient-banner)',
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
          backgroundImage: 'linear-gradient(rgba(220,38,38,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.03) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          pointerEvents: 'none',
        }} />
        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 160, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(220,38,38,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, position: 'relative', flexWrap: 'wrap' }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 800, color: 'rgba(107,114,128,0.7)',
              textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>
              ULTIMATE FC CHAMPIONSHIPS
            </div>
            <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(22px, 6vw, 30px)', fontWeight: 900, color: TEXT, letterSpacing: '-0.5px' }}>
              {t('champ.title')}
            </h1>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: MUTED }}>
                {t('champ.total', { n: championships.length })}
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
                  {t('champ.activeCount', { n: activeCount })}
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '10px 22px',
                background: `linear-gradient(135deg, var(--accent), var(--accent2))`,
                color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(220,38,38,0.3)', flexShrink: 0,
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(220,38,38,0.5)'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(220,38,38,0.3)'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
              }}
            >
              {t('champ.newChampionship')}
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Trophy size={48} style={{ color: GOLD, opacity: 0.5 }} /></div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--muted2)', marginBottom: 8 }}>
              {t('champ.noChampYet')}
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
                {t('champ.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                      border: `1.5px solid ${isActive ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: 'var(--card)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'stretch',
                      minHeight: 96,
                      boxShadow: isActive
                        ? '0 2px 14px rgba(245,158,11,0.2), 0 4px 20px rgba(0,0,0,0.25)'
                        : '0 2px 8px rgba(var(--rgb-overlay),0.18)',
                      transition: 'transform 0.15s, box-shadow 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = isActive
                        ? '0 6px 24px rgba(245,158,11,0.3), 0 8px 32px rgba(0,0,0,0.3)'
                        : '0 6px 20px rgba(0,0,0,0.22), 0 2px 6px rgba(var(--rgb-overlay),0.12)'
                      el.style.borderColor = isActive ? 'rgba(245,158,11,0.65)' : 'var(--border)'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.transform = 'translateY(0)'
                      el.style.boxShadow = isActive
                        ? '0 2px 14px rgba(245,158,11,0.2), 0 4px 20px rgba(0,0,0,0.25)'
                        : '0 2px 8px rgba(var(--rgb-overlay),0.18)'
                      el.style.borderColor = isActive ? 'rgba(245,158,11,0.4)' : 'var(--border)'
                    }}
                  >
                    {/* Left emblem area */}
                    <div style={{
                      width: 80,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.15))'
                        : `rgba(var(--rgb-overlay),0.04)`,
                      borderRight: `1px solid ${isActive ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                      animation: isActive ? 'trophyGlow 2.8s ease-in-out infinite' : 'none',
                    }}>
                      <Trophy size={30} style={{ color: isActive ? 'var(--gold)' : 'var(--accent)' }} />
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1, padding: '18px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                      <div style={{
                        fontSize: 17,
                        fontWeight: 800,
                        color: 'var(--text)',
                        marginBottom: 6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {c.name}
                      </div>
                      <div style={{
                        fontSize: 12.5,
                        color: 'var(--muted)',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}>
                        <span>{t('champ.playerCount', { n: c.playerCount })}</span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border)', display: 'inline-block', flexShrink: 0 }} />
                        <span>
                          {t(c.numberOfCycles !== 1 ? 'champ.cycle.many' : 'champ.cycle.one', { n: c.numberOfCycles })}
                        </span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border)', display: 'inline-block', flexShrink: 0 }} />
                        <span>
                          {new Date(c.playedAt ?? c.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Status + arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 18, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)',
                        color: isActive ? '#15803d' : '#64748B',
                        border: isActive ? '1px solid rgba(34,197,94,0.35)' : '1px solid #e5e7eb',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        whiteSpace: 'nowrap',
                      }}>
                        {isActive ? t('champ.active') : t('champ.ended')}
                      </span>
                      <span style={{ color: 'var(--muted2)', fontSize: 20, lineHeight: 1, fontWeight: 300 }}>›</span>
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
      </div>
    </div>
  )
}
