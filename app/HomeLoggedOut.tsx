'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import type { NamedPlayerStats, ChampionshipLeader } from '@/lib/stats/types'
import type { RivalryItem } from './HomeLoggedIn'
import { ChampionsWalk } from './components/ChampionsWalk'
import { useTranslation } from '@/lib/i18n/context'
import { homeHeadingFont, homeBodyFont } from './home/fonts'
import { StandingsTable } from './home/StandingsTable'
import { LiveStatsStrip, PublicSectionHeading, PublicChampionshipRow, PublicRivalryRow, FinalCTA } from './home/PublicSections'

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

// ── Root component ─────────────────────────────────────────────────────────

export function HomeLoggedOut({ players, champLeaders, rivalries }: Props) {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)

  const activeChamps = champLeaders.filter((c) => c.isActive)
  const topRivalries = rivalries.slice(0, 6)

  const totalPlayers = players.length
  const totalMatches = Math.floor(players.reduce((s, p) => s + p.matchesPlayed, 0) / 2)
  const totalGoals = players.reduce((s, p) => s + p.goalsFor, 0)

  // Header fill on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    // Pinned dark — this landing shell doesn't expose a theme toggle (that
    // lives in BottomNav, logged-in only), so it locks the shared semantic
    // tokens to their dark values rather than drifting with the light default.
    <div
      data-theme="dark"
      className={`${homeHeadingFont.variable} ${homeBodyFont.variable} bg-black font-sans text-white`}
      style={{ overflowX: 'clip' }}
    >
      <style>{`
        @keyframes fc-title-in {
          0%   { opacity: 0; transform: translateY(60px); filter: blur(12px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes fc-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fc-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fc-dot-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.9); }
          70%  { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
        html { scroll-behavior: auto; }
      `}</style>

      {/* ═══════════════════════ HEADER ═══════════════════════════════════ */}
      <header
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 transition-[background,backdrop-filter,border-color] duration-500"
        style={{
          background: scrolled ? 'rgba(0,0,0,0.82)' : 'transparent',
          backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-black text-white shadow-[0_0_20px_-4px_var(--primary)]">
            FC
          </div>
          <span className="text-[17px] font-black tracking-tight text-white">
            26 <span className="text-xs font-normal tracking-wide text-white/30 uppercase">Manager</span>
          </span>
        </div>

        {/* mr reserves space for the fixed EN/RU LanguageSwitcher (app/layout.tsx),
            which renders at top-right for every logged-out page. */}
        <Button render={<Link href="/login" />} nativeButton={false} className="mr-24 rounded-full px-5 shadow-[0_0_18px_-4px_var(--primary)]">
          {t('common.login')}
        </Button>
      </header>

      {/* ═══════════════════════ HERO ═════════════════════════════════════ */}
      <section className="relative flex h-[100svh] min-h-[620px] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <CinematicCanvas />
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-1"
          style={{ background: 'radial-gradient(ellipse 85% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.65) 100%)' }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-2 h-[45%]"
          style={{ background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.6) 50%, transparent 100%)' }}
        />

        <div className="relative z-3 mt-[-40px] w-full max-w-[920px] px-5 text-center">
          <div className="mb-9 inline-flex animate-[fc-fade-in_1s_ease_both] items-center gap-3 opacity-0 [animation-delay:0.4s]">
            <span className="size-[7px] rounded-full bg-primary [animation:fc-dot-pulse_2s_ease-out_infinite]" />
            <span className="text-[10px] font-extrabold tracking-[0.24em] text-white/45 uppercase">FC26 · Manager · Season 2026</span>
            <span className="size-[7px] rounded-full bg-primary [animation:fc-dot-pulse_2s_ease-out_infinite_0.7s]" />
          </div>

          <h1
            className="m-0 font-heading font-black text-white uppercase"
            style={{ fontSize: 'clamp(40px, 12vw, 136px)', letterSpacing: '-0.035em', lineHeight: 0.88 }}
          >
            {[
              { text: 'Ultimate', primary: false },
              { text: 'FC', primary: true },
              { text: 'Championship', primary: false },
            ].map((word, i) => (
              <span
                key={word.text}
                className={`block animate-[fc-title-in_0.9s_cubic-bezier(0.16,1,0.3,1)_both] opacity-0 ${word.primary ? 'text-primary' : 'text-white'}`}
                style={{ animationDelay: `${0.5 + i * 0.18}s` }}
              >
                {word.text}
              </span>
            ))}
          </h1>

          <p
            className="mx-auto mt-8 max-w-[400px] animate-[fc-fade-up_0.9s_ease_both] text-[clamp(13px,1.6vw,16px)] text-white/40 opacity-0"
            style={{ animationDelay: '1.3s' }}
          >
            Compete, climb the rankings, and claim championship glory.
          </p>

          <div
            className="mt-10 flex animate-[fc-fade-up_0.9s_ease_both] flex-wrap justify-center gap-3 opacity-0"
            style={{ animationDelay: '1.6s' }}
          >
            <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="rounded-full px-9 shadow-[0_4px_28px_-4px_var(--primary)]">
              Enter the Arena
            </Button>
            <Button
              render={<a href="#arena" />}
              nativeButton={false}
              variant="outline"
              size="lg"
              className="rounded-full border-white/18 bg-transparent px-8 text-white/60 hover:bg-white/10 hover:text-white"
            >
              Explore ↓
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ LIVE STATS ═══════════════════════════════ */}
      <div id="arena">
        <LiveStatsStrip
          players={totalPlayers}
          matches={totalMatches}
          goals={totalGoals}
          labels={{ players: 'Players', matches: 'Matches', goals: 'Goals Scored' }}
        />
      </div>

      {/* ═══════════════════════ CHAMPIONS WALK ═══════════════════════════ */}
      {players.length > 0 && <ChampionsWalk players={players} />}

      {/* ═══════════════════════ STANDINGS ════════════════════════════════ */}
      {players.length > 0 && (
        <section className="bg-black px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <PublicSectionHeading eyebrow="Season Standings" title="Leaderboard" />
            <div className="overflow-hidden rounded-md border border-white/10 [&_th]:text-white/50 [&_td]:text-white [&_tr]:border-white/8 [&_tr:hover]:bg-white/[0.03]">
              <StandingsTable players={players.slice(0, 8)} />
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════ CHAMPIONSHIPS ════════════════════════════ */}
      {activeChamps.length > 0 && (
        <section className="bg-black px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <PublicSectionHeading eyebrow="The Trophies" title="Championships" accent="gold" />
            <div className="flex flex-col gap-2.5">
              {activeChamps.map((c) => (
                <PublicChampionshipRow key={c.championshipId} champ={c} ptsLabel="Pts" leaderLabel="Current Leader" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════ RIVALRIES ════════════════════════════════ */}
      {topRivalries.length > 0 && (
        <section className="bg-black px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <PublicSectionHeading eyebrow="Head to Head" title="Rivalries" />
            <div className="flex flex-col gap-2.5">
              {topRivalries.map((r) => (
                <PublicRivalryRow key={r.id} rivalry={r} bestOfLabel="Best of" playedLabel="played" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════ FINAL CTA ════════════════════════════════ */}
      <FinalCTA subtitle="Join the Competition" title="Ready to Compete?" cta="Enter the Arena →" />
    </div>
  )
}
