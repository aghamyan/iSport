import type { ReactNode } from 'react'
import Link from 'next/link'
import { Trophy, Crown, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResultChip } from './ResultBadge'
import { PlayerAvatar } from './PlayerAvatar'
import type { ChampionshipResult, ChampionshipLeader, CurrentChampion, FormEntry } from '@/lib/stats/types'
import type { RivalryItem, GlobalStats } from '../HomeLoggedIn'

// ─── Recent-form strip — W/D/L chips with score + opponent ──────────────────

export function FormStrip({ form }: { form: FormEntry[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {form.slice(0, 8).map((entry) => (
        <div key={entry.matchId} className="flex shrink-0 flex-col items-center gap-1">
          <ResultChip outcome={entry.result} className="size-7 text-xs" />
          <div className="text-[10px] font-semibold tabular-nums text-foreground">
            {entry.goalsFor}–{entry.goalsAgainst}
          </div>
          <div className="max-w-14 truncate text-[9px] text-muted-foreground">{entry.opponentName.split(' ')[0]}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Section header — an eyebrow label + rule, not another card ──────────────

export function SectionHeader({ title, icon, action }: { title: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between border-b-2 border-primary pb-1.5">
      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
        {icon}
        {title}
      </span>
      {action}
    </div>
  )
}

export function SectionAction({ href, children, muted }: { href: string; children: ReactNode; muted?: boolean }) {
  return (
    <Link href={href} className={cn('text-xs font-medium hover:underline', muted ? 'text-muted-foreground' : 'text-primary')}>
      {children}
    </Link>
  )
}

// ─── Community pulse — 2-3 sitewide numbers, no card chrome ──────────────────

export function CommunityPulse({ stats, label }: { stats: GlobalStats; label: { matches: string; goals: string; topScorer: (n: number) => string } }) {
  if (stats.totalMatches === 0 && stats.totalGoals === 0) return null
  return (
    <div className="mb-5 flex divide-x rounded-md border">
      <div className="flex-1 px-3 py-2.5 text-center">
        <div className="font-heading text-xl font-bold tabular-nums">{stats.totalMatches}</div>
        <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label.matches}</div>
      </div>
      <div className="flex-1 px-3 py-2.5 text-center">
        <div className="font-heading text-xl font-bold tabular-nums">{stats.totalGoals}</div>
        <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label.goals}</div>
      </div>
      {stats.topScorerName && stats.topScorerGoals > 0 && (
        <div className="flex-[1.4] px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            {stats.topScorerAvatarUrl ? (
              <PlayerAvatar name={stats.topScorerName} avatarUrl={stats.topScorerAvatarUrl} size="sm" />
            ) : (
              <Trophy className="size-3.5 text-gold" />
            )}
            <span className="max-w-18 truncate font-heading text-sm font-bold text-gold">{stats.topScorerName.split(' ')[0]}</span>
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label.topScorer(stats.topScorerGoals)}</div>
        </div>
      )}
    </div>
  )
}

// ─── Current champion ────────────────────────────────────────────────────────

export function CurrentChampionBanner({ champion, ptsLabel }: { champion: CurrentChampion; ptsLabel: string }) {
  return (
    <Link href={`/championships/${champion.championshipId}`} className="mb-5 flex items-center gap-3 rounded-md border border-gold/30 bg-gold/5 p-3">
      <div className="relative shrink-0">
        <PlayerAvatar name={champion.playerName} avatarUrl={champion.avatarUrl} size="lg" />
        <div className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gold">
          <Trophy className="size-3 text-white" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-bold tracking-wide text-gold uppercase">{champion.championshipName}</div>
        <div className="truncate font-heading text-lg font-bold">{champion.playerName}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {champion.wins}W {champion.draws}D {champion.losses}L · {champion.goalDiff >= 0 ? '+' : ''}{champion.goalDiff} GD
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[9px] font-bold tracking-wide text-gold uppercase">{ptsLabel}</div>
        <div className="font-heading text-2xl font-bold text-gold tabular-nums">{champion.points}</div>
      </div>
    </Link>
  )
}

// ─── Active championship placement ───────────────────────────────────────────

export function ChampionshipRow({
  placement, leader, userId, ptsLabel, playedLabel, leadingLabel, currentLeaderLabel, positionLabel,
}: {
  placement: ChampionshipResult
  leader: ChampionshipLeader | null
  userId: string
  ptsLabel: string
  playedLabel: string
  leadingLabel: string
  currentLeaderLabel: string
  positionLabel: (n: number) => string
}) {
  const isLeading = leader?.playerId === userId
  const rankClass = placement.rank === 1 ? 'text-gold' : placement.rank === 2 ? 'text-muted-foreground' : placement.rank === 3 ? 'text-[#cd7c3a]' : 'text-muted-foreground'
  const estTotal = Math.max(placement.totalPlayers - 1, 1) * 2
  const progressPct = Math.min(100, Math.round((placement.played / estTotal) * 100))

  return (
    <Link
      href={`/championships/${placement.championshipId}`}
      className={cn('block rounded-md border p-3', placement.rank === 1 && 'border-gold/30 bg-gold/5')}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="truncate text-sm font-bold">{placement.championshipName}</span>
        <Badge variant="secondary" className="gap-1 text-[9px] font-bold text-win uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-win" />
          Live
        </Badge>
      </div>

      {leader ? (
        <div className="mb-2.5 flex items-center gap-3 rounded bg-secondary/60 px-3 py-2">
          <div className="relative shrink-0">
            <PlayerAvatar name={leader.playerName} avatarUrl={leader.avatarUrl} size="md" />
            {isLeading && (
              <div className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-gold">
                <Crown className="size-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 text-[9px] font-bold tracking-wide text-muted-foreground uppercase">
              {isLeading ? leadingLabel : currentLeaderLabel}
            </div>
            <div className={cn('truncate text-sm font-bold', isLeading && 'text-gold')}>{leader.playerName}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {leader.wins}W {leader.draws}D {leader.losses}L · GD {leader.goalDiff > 0 ? `+${leader.goalDiff}` : leader.goalDiff}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-heading text-xl font-bold tabular-nums">{leader.points}</div>
            <div className="text-[9px] text-muted-foreground uppercase">{ptsLabel}</div>
          </div>
        </div>
      ) : null}

      {(!isLeading || !leader) && (
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className={cn('flex size-8 shrink-0 items-center justify-center rounded bg-secondary text-sm font-bold', rankClass)}>
            {placement.rank === 1 ? <Trophy className="size-4" /> : placement.rank === 2 || placement.rank === 3 ? <Medal className="size-3.5" /> : `#${placement.rank}`}
          </div>
          <div className="min-w-0 flex-1 text-xs text-muted-foreground">{positionLabel(placement.rank)}</div>
          <div className="shrink-0 text-right">
            <span className="font-heading text-lg font-bold tabular-nums">{placement.points}</span>
            <span className="ml-1 text-[10px] text-muted-foreground uppercase">{ptsLabel}</span>
          </div>
        </div>
      )}

      {progressPct > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{placement.played} {playedLabel}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-secondary">
            <div
              className={cn('h-full rounded-full', placement.rank === 1 ? 'bg-gold' : 'bg-primary')}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  )
}

// ─── Rivalry ──────────────────────────────────────────────────────────────────

export function RivalryRow({
  rivalry, userId, youLabel, opponentLabel, leadingLabel, tiedLabel, aheadLabel,
}: {
  rivalry: RivalryItem
  userId: string
  youLabel: string
  opponentLabel: string
  leadingLabel: string
  tiedLabel: string
  aheadLabel: string
}) {
  const isP1 = rivalry.player1Id === userId
  const myWins = isP1 ? rivalry.player1Wins : rivalry.player2Wins
  const oppWins = isP1 ? rivalry.player2Wins : rivalry.player1Wins
  const myName = isP1 ? rivalry.player1Name : rivalry.player2Name
  const oppName = isP1 ? rivalry.player2Name : rivalry.player1Name
  const isAhead = myWins > oppWins
  const isTied = myWins === oppWins
  const total = myWins + oppWins
  const myBarPct = total > 0 ? (myWins / total) * 100 : 50
  const statusClass = isAhead ? 'text-win' : isTied ? 'text-draw' : 'text-loss'
  const barClass = isAhead ? 'bg-win' : isTied ? 'bg-draw' : 'bg-loss'

  return (
    <Link href={`/rivalries/${rivalry.id}`} className="block rounded-md border p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex-1 text-right">
          <div className="truncate text-sm font-bold">{myName.split(' ')[0]}</div>
          <div className="text-[10px] text-muted-foreground">{youLabel}</div>
        </div>
        <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">VS</span>
        <div className="flex-1">
          <div className="truncate text-sm font-bold">{oppName.split(' ')[0]}</div>
          <div className="text-[10px] text-muted-foreground">{opponentLabel}</div>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className={cn('min-w-7 text-right font-heading text-2xl font-bold tabular-nums', isAhead && 'text-win')}>{myWins}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className={cn('h-full rounded-full', barClass)} style={{ width: `${total > 0 ? myBarPct : 50}%` }} />
        </div>
        <span className={cn('min-w-7 font-heading text-2xl font-bold tabular-nums', !isAhead && !isTied && 'text-loss')}>{oppWins}</span>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className={cn('font-semibold', statusClass)}>{isAhead ? leadingLabel : isTied ? tiedLabel : aheadLabel}</span>
        <span className="text-muted-foreground">BO{rivalry.bestOf} · {total} played</span>
      </div>
    </Link>
  )
}

// ─── Past championship (compact row) ─────────────────────────────────────────

export function PastChampionshipRow({ result, ptsLabel }: { result: ChampionshipResult; ptsLabel: string }) {
  const rankClass = result.rank === 1 ? 'text-gold' : result.rank <= 3 ? 'text-foreground' : 'text-muted-foreground'
  return (
    <Link href={`/championships/${result.championshipId}`} className="flex items-center gap-3 rounded-md border p-2.5">
      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded text-xs font-bold', result.rank === 1 ? 'bg-gold/15 text-gold' : 'bg-secondary text-muted-foreground')}>
        {result.rank === 1 ? <Trophy className="size-4" /> : result.rank === 2 || result.rank === 3 ? <Medal className="size-3.5" /> : `#${result.rank}`}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{result.championshipName}</div>
        <div className="text-[11px] text-muted-foreground">{result.played} played · {result.wins}W {result.draws}D {result.losses}L</div>
      </div>
      <div className={cn('shrink-0 font-heading text-base font-bold tabular-nums', rankClass)}>
        {result.points} <span className="text-[10px] font-medium text-muted-foreground uppercase">{ptsLabel}</span>
      </div>
    </Link>
  )
}
