import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerAvatar } from './PlayerAvatar'
import type { ChampionshipLeader } from '@/lib/stats/types'
import type { RivalryItem } from '../HomeLoggedIn'

// ─── Live stats strip — three sitewide numbers, no counting animation ────────

export function LiveStatsStrip({ players, matches, goals, labels }: {
  players: number
  matches: number
  goals: number
  labels: { players: string; matches: string; goals: string }
}) {
  const stats = [
    { label: labels.players, value: players },
    { label: labels.matches, value: matches },
    { label: labels.goals, value: goals },
  ]
  return (
    <div className="grid grid-cols-3 divide-x divide-white/8 border-y border-white/8 bg-black">
      {stats.map((s) => (
        <div key={s.label} className="px-4 py-8 text-center">
          <div className="font-heading text-4xl font-bold tabular-nums text-white sm:text-5xl">{s.value.toLocaleString()}</div>
          <div className="mt-2 text-[10px] font-bold tracking-[0.16em] text-primary uppercase">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Section heading — eyebrow + title, matches the dashboard's rule style ───

export function PublicSectionHeading({ eyebrow, title, accent = 'primary' }: { eyebrow: string; title: string; accent?: 'primary' | 'gold' }) {
  return (
    <div className={cn('mb-8 flex items-center gap-4 border-l-2 pl-4', accent === 'gold' ? 'border-gold' : 'border-primary')}>
      <div>
        <div className={cn('mb-1.5 text-[10px] font-bold tracking-[0.2em] uppercase', accent === 'gold' ? 'text-gold' : 'text-primary')}>
          {eyebrow}
        </div>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-white uppercase sm:text-4xl">{title}</h2>
      </div>
    </div>
  )
}

// ─── Public championship leader row ───────────────────────────────────────────

export function PublicChampionshipRow({ champ, ptsLabel, leaderLabel }: { champ: ChampionshipLeader; ptsLabel: string; leaderLabel: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-gold/15 bg-gold/5 p-3">
      <PlayerAvatar name={champ.playerName} avatarUrl={champ.avatarUrl} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-bold tracking-wide text-gold uppercase">{champ.championshipName}</div>
        <div className="truncate text-sm font-bold text-white">{champ.playerName}</div>
        <div className="mt-0.5 text-[11px] text-white/40">{leaderLabel}</div>
      </div>
      <div className="flex shrink-0 gap-4 text-center">
        <div>
          <div className="font-heading text-lg font-bold text-gold tabular-nums">{champ.points}</div>
          <div className="text-[9px] font-semibold text-white/30 uppercase">{ptsLabel}</div>
        </div>
        <div>
          <div className="font-heading text-lg font-bold text-win tabular-nums">{champ.wins}</div>
          <div className="text-[9px] font-semibold text-white/30 uppercase">W</div>
        </div>
        <div>
          <div className="font-heading text-lg font-bold text-white tabular-nums">{champ.played}</div>
          <div className="text-[9px] font-semibold text-white/30 uppercase">Pld</div>
        </div>
      </div>
    </div>
  )
}

// ─── Public rivalry row ──────────────────────────────────────────────────────

export function PublicRivalryRow({ rivalry, bestOfLabel, playedLabel }: { rivalry: RivalryItem; bestOfLabel: string; playedLabel: string }) {
  const total = rivalry.player1Wins + rivalry.player2Wins
  const pct1 = total > 0 ? (rivalry.player1Wins / total) * 100 : 50
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 truncate text-right text-sm font-bold text-white">{rivalry.player1Name}</div>
        <div className="flex shrink-0 items-center gap-2 tabular-nums">
          <span className={cn('font-heading text-2xl font-bold', rivalry.player1Wins >= rivalry.player2Wins ? 'text-white' : 'text-white/30')}>
            {rivalry.player1Wins}
          </span>
          <span className="text-white/20">—</span>
          <span className={cn('font-heading text-2xl font-bold', rivalry.player2Wins >= rivalry.player1Wins ? 'text-white' : 'text-white/30')}>
            {rivalry.player2Wins}
          </span>
        </div>
        <div className="min-w-0 flex-1 truncate text-sm font-bold text-white">{rivalry.player2Name}</div>
      </div>
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct1}%` }} />
      </div>
      <div className="mt-2 text-center text-[9px] font-bold tracking-[0.12em] text-white/25 uppercase">
        {bestOfLabel} {rivalry.bestOf} · {total} {playedLabel}
      </div>
    </div>
  )
}

// ─── Final CTA — one closing prompt, no scroll-reveal choreography ───────────

export function FinalCTA({ title, subtitle, cta }: { title: string; subtitle: string; cta: string }) {
  return (
    <section className="border-t border-white/8 bg-black px-6 py-20 text-center">
      <div className="mb-3 text-[10px] font-bold tracking-[0.22em] text-primary uppercase">
        <Trophy className="mr-1.5 inline size-3" />
        {subtitle}
      </div>
      <h2 className="mx-auto mb-8 max-w-lg font-heading text-4xl font-bold tracking-tight text-white uppercase sm:text-5xl">{title}</h2>
      <Link
        href="/login"
        className="inline-block rounded-full bg-primary px-10 py-4 text-sm font-bold tracking-[0.1em] text-primary-foreground uppercase shadow-[0_4px_28px_-4px_var(--primary)] transition-transform hover:scale-[1.03]"
      >
        {cta}
      </Link>
    </section>
  )
}
