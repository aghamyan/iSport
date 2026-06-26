'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { NamedPlayerStats, ChampionshipLeader } from '@/lib/stats/types'
import type { RivalryItem } from './HomeLoggedIn'
import { ChampionsWalk } from './components/ChampionsWalk'
import { useTranslation } from '@/lib/i18n/context'

// ── Dynamic import: Three.js canvas (no SSR) ──────────────────────────────

const CinematicCanvas = dynamic(
  () => import('@/app/components/CinematicCanvas'),
  {
    ssr: false,
    loading: () => <div style={{ position: 'absolute', inset: 0, background: '#000' }} />,
  }
)

// ── Types ─────────────────────────────────────────────────────────────────

type Props = {
  players:     NamedPlayerStats[]
  champLeaders: ChampionshipLeader[]
  rivalries:   RivalryItem[]
}

// ── Scroll reveal hook (module-level) ─────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref     = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return [ref, visible] as const
}

// ── Animated number counter ────────────────────────────────────────────────

function Counter({ value, visible }: { value: number; visible: boolean }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (!visible || value === 0) return
    const start    = performance.now()
    const duration = 1800
    const tick = (now: number) => {
      const p    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 4)
      setDisplay(Math.round(ease * value))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [visible, value])

  return <>{display.toLocaleString()}</>
}

// ── Root component ─────────────────────────────────────────────────────────

export function HomeLoggedOut({ players, champLeaders, rivalries }: Props) {
  const { t }    = useTranslation()
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const [scrolled,     setScrolled]     = useState(false)

  const activeChamps = champLeaders.filter(c => c.isActive)

  const totalPlayers = players.length
  const totalMatches = Math.floor(players.reduce((s, p) => s + p.matchesPlayed, 0) / 2)
  const totalGoals   = players.reduce((s, p) => s + p.goalsFor, 0)

  // Header fill on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Stats counters trigger
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div style={{ background: '#000', color: '#fff', fontFamily: "'system-ui', -apple-system, sans-serif", overflowX: 'clip' }}>

      {/* ─── Global animation styles ─────────────────────────────────────── */}
      <style>{`
        @keyframes fc-title-in {
          0%   { opacity: 0; transform: translateY(80px) skewY(3deg); filter: blur(18px); }
          65%  { filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) skewY(0deg); }
        }
        @keyframes fc-fade-up {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fc-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fc-scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 0.4; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
        @keyframes fc-flare-pulse {
          0%, 100% { opacity: 0.22; transform: translate(-50%,-50%) scale(1); }
          50%       { opacity: 0.50; transform: translate(-50%,-50%) scale(1.18); }
        }
        @keyframes fc-dot-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.9); }
          70%  { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
        @keyframes fc-scroll-bounce {
          0%,100% { transform: translateY(0) scaleY(1); opacity: 0.5; }
          50%      { transform: translateY(7px) scaleY(1.15); opacity: 1; }
        }
        @keyframes fc-cta-in {
          from { opacity: 0; transform: translateY(24px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Scroll reveal ──────────────────────────── */
        .fc-reveal {
          opacity: 0;
          transform: translateY(48px);
          transition: opacity 0.75s cubic-bezier(0.16,1,0.3,1),
                      transform 0.75s cubic-bezier(0.16,1,0.3,1);
        }
        .fc-reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── Interactive hover states ────────────────── */
        .fc-btn-primary  { transition: transform 0.18s ease, box-shadow 0.18s ease !important; }
        .fc-btn-primary:hover  { transform: scale(1.04) !important; box-shadow: 0 8px 40px rgba(220,38,38,0.6) !important; }
        .fc-btn-ghost:hover    { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.3) !important; }
        .fc-player-row:hover   { background: rgba(255,255,255,0.04) !important; }
        .fc-player-row-1:hover { background: rgba(220,38,38,0.1) !important; }
        .fc-rivalry:hover      { background: rgba(255,255,255,0.03) !important; border-color: rgba(220,38,38,0.28) !important; }
        .fc-champ-card:hover   { border-color: rgba(245,158,11,0.42) !important; }
        .fc-view-all:hover     { color: rgba(255,255,255,0.7) !important; border-color: rgba(255,255,255,0.22) !important; }

        html { scroll-behavior: auto; }
      `}</style>

      {/* ═══════════════════════ HEADER ═══════════════════════════════════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(0,0,0,0.82)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'background 0.5s ease, backdrop-filter 0.5s ease, border-bottom 0.4s ease',
      }}>
        {/* Logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em',
            boxShadow: '0 0 20px rgba(220,38,38,0.55)',
            flexShrink: 0,
          }}>
            FC
          </div>
          <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: '-0.025em', color: '#fff' }}>
            26{' '}
            <span style={{ color: 'rgba(255,255,255,0.32)', fontWeight: 400, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Manager
            </span>
          </span>
        </div>

        <Link href="/login" style={{
          padding: '9px 22px',
          background: '#DC2626',
          color: '#fff',
          borderRadius: 100,
          fontWeight: 800,
          fontSize: 12,
          textDecoration: 'none',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          boxShadow: '0 0 18px rgba(220,38,38,0.4)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}>
          {t('common.login')}
        </Link>
      </header>

      {/* ═══════════════════════ HERO ═════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        height: '100svh', minHeight: 620,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>

        {/* THREE.JS CANVAS */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <CinematicCanvas />
        </div>

        {/* SCAN LINE */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(220,38,38,0.3) 25%, rgba(255,60,60,0.7) 50%, rgba(220,38,38,0.3) 75%, transparent 100%)',
            animation: 'fc-scan 5s linear infinite',
            animationDelay: '2.5s',
          }} />
        </div>

        {/* LENS FLARE */}
        <div style={{
          position: 'absolute', top: '38%', left: '50%',
          width: 700, height: 700,
          pointerEvents: 'none', zIndex: 1,
          animation: 'fc-flare-pulse 6s ease-in-out infinite',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.14) 0%, rgba(220,38,38,0.04) 40%, transparent 70%)',
            borderRadius: '50%',
          }} />
        </div>

        {/* EDGE VIGNETTE */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 85% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.65) 100%)',
        }} />

        {/* BOTTOM FADE */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
          background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
          zIndex: 2, pointerEvents: 'none',
        }} />

        {/* HERO TEXT */}
        <div style={{
          position: 'relative', zIndex: 3,
          textAlign: 'center',
          padding: '0 20px',
          maxWidth: 920, width: '100%',
          marginTop: '-40px',
        }}>

          {/* Overline */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            marginBottom: 36,
            animation: 'fc-fade-in 1s ease both',
            animationDelay: '0.4s',
            opacity: 0,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#DC2626',
              animation: 'fc-dot-pulse 2s ease-out infinite',
            }} />
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.24em',
              color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
            }}>
              FC26 · MANAGER · SEASON 2026
            </span>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#DC2626',
              animation: 'fc-dot-pulse 2s ease-out infinite 0.7s',
            }} />
          </div>

          {/* Main title — staggered word reveal */}
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(40px, 12vw, 136px)',
            fontWeight: 900,
            letterSpacing: '-0.035em',
            lineHeight: 0.88,
            textTransform: 'uppercase',
            color: '#fff',
          }}>
            {[
              { text: 'ULTIMATE',     color: '#fff'    },
              { text: 'FC',           color: '#DC2626' },
              { text: 'CHAMPIONSHIP', color: '#fff'    },
            ].map((word, i) => (
              <span
                key={word.text}
                style={{
                  display: 'block',
                  color: word.color,
                  animation: 'fc-title-in 1.1s cubic-bezier(0.16,1,0.3,1) both',
                  animationDelay: `${0.65 + i * 0.22}s`,
                  opacity: 0,
                  textShadow: word.color === '#DC2626'
                    ? '0 0 80px rgba(220,38,38,0.5), 0 0 40px rgba(220,38,38,0.25)'
                    : '0 4px 60px rgba(0,0,0,0.9)',
                }}
              >
                {word.text}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p style={{
            margin: '32px auto 0',
            fontSize: 'clamp(13px, 1.6vw, 16px)',
            color: 'rgba(255,255,255,0.38)',
            letterSpacing: '0.04em',
            maxWidth: 400,
            lineHeight: 1.65,
            animation: 'fc-fade-up 0.9s ease both',
            animationDelay: '1.5s',
            opacity: 0,
          }}>
            Compete, climb the rankings, and claim championship glory.
          </p>

          {/* CTA buttons */}
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center',
            marginTop: 40, flexWrap: 'wrap',
            animation: 'fc-cta-in 0.85s ease both',
            animationDelay: '1.9s',
            opacity: 0,
          }}>
            <Link href="/login" className="fc-btn-primary" style={{
              padding: '15px 38px',
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              color: '#fff',
              borderRadius: 100,
              fontWeight: 800,
              fontSize: 13,
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              boxShadow: '0 4px 28px rgba(220,38,38,0.45)',
              display: 'block',
            }}>
              Enter the Arena
            </Link>
            <a href="#arena" className="fc-btn-ghost" style={{
              padding: '15px 32px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: 100,
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              transition: 'background 0.2s ease, border-color 0.2s ease',
              display: 'block',
            }}>
              Explore ↓
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          animation: 'fc-fade-in 1s ease both',
          animationDelay: '2.8s',
          opacity: 0,
        }}>
          <span style={{
            fontSize: 8, fontWeight: 800, letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
          }}>
            SCROLL
          </span>
          <div style={{
            width: 1, height: 36,
            background: 'linear-gradient(to bottom, #DC2626, transparent)',
            animation: 'fc-scroll-bounce 2s ease-in-out infinite',
          }} />
        </div>
      </section>

      {/* ═══════════════════════ LIVE STATS ═══════════════════════════════ */}
      <div ref={statsRef} style={{
        background: '#080808',
        borderTop:    '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '48px 24px',
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
        }}>
          {[
            { label: 'Players',       value: totalPlayers },
            { label: 'Matches',       value: totalMatches },
            { label: 'Goals Scored',  value: totalGoals   },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              padding: '20px 16px',
              textAlign: 'center',
              borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <div style={{
                fontSize: 'clamp(38px, 8vw, 60px)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                color: '#fff',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                <Counter value={stat.value} visible={statsVisible} />
              </div>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.16em',
                color: '#DC2626', textTransform: 'uppercase', marginTop: 10,
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ THE CHAMPIONS WALK ══════════════════════ */}
      {players.length > 0 && (
        <ChampionsWalk players={players} />
      )}

      {/* ═══════════════════════ CHAMPIONSHIPS ════════════════════════════ */}
      {activeChamps.length > 0 && (
        <TrophiesSection champs={activeChamps} />
      )}

      {/* ═══════════════════════ RIVALRIES ════════════════════════════════ */}
      {rivalries.length > 0 && (
        <RivalriesSection rivalries={rivalries} />
      )}

      {/* ═══════════════════════ FINAL CTA ════════════════════════════════ */}
      <FinalCTA />
    </div>
  )
}

// ─── Trophies Section ──────────────────────────────────────────────────────────

function TrophiesSection({ champs }: { champs: ChampionshipLeader[] }) {
  const [ref, visible] = useReveal()

  return (
    <section style={{
      padding: '100px 24px',
      background: 'linear-gradient(180deg, #000 0%, #050300 60%, #000 100%)',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        <div ref={ref} className={`fc-reveal${visible ? ' visible' : ''}`} style={{
          display: 'flex', alignItems: 'center', gap: 18, marginBottom: 52,
        }}>
          <div style={{
            width: 3, height: 44,
            background: 'linear-gradient(to bottom, #F59E0B, rgba(245,158,11,0.3))',
            borderRadius: 2,
            boxShadow: '0 0 14px rgba(245,158,11,0.45)',
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', color: '#F59E0B', textTransform: 'uppercase', marginBottom: 8 }}>
              THE TROPHIES
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(30px, 6vw, 62px)', fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase', lineHeight: 1, color: '#fff' }}>
              CHAMPIONSHIPS
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {champs.map((c, i) => (
            <div
              key={c.championshipId}
              className={`fc-reveal fc-champ-card${visible ? ' visible' : ''}`}
              style={{
                transitionDelay: `${i * 80}ms`,
                padding: '20px 24px',
                background: 'rgba(245,158,11,0.05)',
                border: '1px solid rgba(245,158,11,0.14)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 16,
                transition: 'border-color 0.2s ease, opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <div style={{ fontSize: 28, flexShrink: 0 }}>🏆</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#F59E0B', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.championshipName}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.playerName}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>Current Leader</div>
              </div>
              <div style={{ display: 'flex', gap: 18, flexShrink: 0 }}>
                {[
                  { label: 'PTS', value: c.points, color: '#F59E0B' },
                  { label: 'W',   value: c.wins,   color: '#22C55E' },
                  { label: 'PLD', value: c.played, color: '#fff' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Rivalries Section ─────────────────────────────────────────────────────────

function RivalriesSection({ rivalries }: { rivalries: RivalryItem[] }) {
  const [ref, visible] = useReveal()
  const top = rivalries.slice(0, 6)

  return (
    <section style={{ padding: '100px 24px', background: '#000' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        <div ref={ref} className={`fc-reveal${visible ? ' visible' : ''}`} style={{
          display: 'flex', alignItems: 'center', gap: 18, marginBottom: 52,
        }}>
          <div style={{
            width: 3, height: 44,
            background: 'linear-gradient(to bottom, #DC2626, rgba(220,38,38,0.3))',
            borderRadius: 2,
            boxShadow: '0 0 16px rgba(220,38,38,0.5)',
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', color: '#DC2626', textTransform: 'uppercase', marginBottom: 8 }}>
              HEAD TO HEAD
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(30px, 6vw, 62px)', fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase', lineHeight: 1, color: '#fff' }}>
              RIVALRIES
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {top.map((r, i) => {
            const total = r.player1Wins + r.player2Wins
            const pct1  = total > 0 ? (r.player1Wins / total) * 100 : 50

            return (
              <div
                key={r.id}
                className={`fc-reveal fc-rivalry${visible ? ' visible' : ''}`}
                style={{
                  transitionDelay: `${i * 75}ms`,
                  padding: '18px 22px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  transition: 'background 0.2s, border-color 0.2s, opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                {/* Names + Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.player1Name}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    flexShrink: 0, minWidth: 88, justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: 26, fontWeight: 900, lineHeight: 1,
                      color: r.player1Wins >= r.player2Wins ? '#fff' : 'rgba(255,255,255,0.3)',
                    }}>
                      {r.player1Wins}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.18)', fontWeight: 400, fontSize: 16 }}>—</span>
                    <span style={{
                      fontSize: 26, fontWeight: 900, lineHeight: 1,
                      color: r.player2Wins >= r.player1Wins ? '#fff' : 'rgba(255,255,255,0.3)',
                    }}>
                      {r.player2Wins}
                    </span>
                  </div>

                  <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.player2Name}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 14, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: visible ? `${pct1}%` : '50%',
                    background: 'linear-gradient(90deg, #DC2626 0%, rgba(220,38,38,0.5) 100%)',
                    borderRadius: 1,
                    transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>

                <div style={{
                  textAlign: 'center', marginTop: 8,
                  fontSize: 9, color: 'rgba(255,255,255,0.2)',
                  fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em',
                }}>
                  Best of {r.bestOf} · {total} played
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCTA() {
  const [ref, visible] = useReveal(0.25)

  return (
    <section style={{
      padding: '120px 24px 100px',
      background: '#000',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      position: 'relative',
      overflow: 'hidden',
      textAlign: 'center',
    }}>
      {/* Background radial glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 700, height: 700,
        background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div ref={ref} className={`fc-reveal${visible ? ' visible' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.24em',
          color: '#DC2626', textTransform: 'uppercase', marginBottom: 22,
        }}>
          JOIN THE COMPETITION
        </div>

        <h2 style={{
          margin: '0 0 18px',
          fontSize: 'clamp(38px, 9vw, 88px)',
          fontWeight: 900,
          letterSpacing: '-0.035em',
          textTransform: 'uppercase',
          lineHeight: 0.92,
          color: '#fff',
        }}>
          READY TO<br />COMPETE?
        </h2>

        <p style={{
          color: 'rgba(255,255,255,0.32)',
          fontSize: 14,
          margin: '0 auto 44px',
          maxWidth: 300,
          lineHeight: 1.65,
        }}>
          Climb the leaderboard. Win championships. Forge rivalries.
        </p>

        <Link href="/login" className="fc-btn-primary" style={{
          display: 'inline-block',
          padding: '18px 56px',
          background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
          color: '#fff',
          borderRadius: 100,
          fontWeight: 800,
          fontSize: 14,
          textDecoration: 'none',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          boxShadow: '0 4px 36px rgba(220,38,38,0.4)',
        }}>
          Enter the Arena →
        </Link>
      </div>
    </section>
  )
}
