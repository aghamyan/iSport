'use client'

import Link from 'next/link'
import { Crown, Medal, Zap, Target, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useTranslation } from '@/lib/i18n/context'
import { PlayerAvatar, initialsFor } from './PlayerAvatar'
import { getTier, type Tier } from './homeHelpers'
import type { ActivePlayer } from '@/app/matches/CreateMatchModal'

const TIER_ICON: Record<string, typeof Crown> = {
  'home.tier.p4pNo1': Crown,
  'home.tier.runnerUp': Medal,
  'home.tier.thirdPlace': Medal,
  'home.tier.elite': Zap,
  'home.tier.contender': Target,
}

export function HeroIdentity({
  myName,
  myAvatarUrl,
  userId,
  players,
  heroBannerUrl,
  heroBannerPosition,
  stats,
  winRate,
  p4pRank,
  totalPlayers,
  streak,
  onRecordMatch,
}: {
  myName: string
  myAvatarUrl: string | null
  userId: string
  players: ActivePlayer[]
  heroBannerUrl?: string | null
  heroBannerPosition?: string | null
  stats: { wins: number; losses: number; draws: number; goalsFor: number }
  winRate: number
  p4pRank: number
  totalPlayers: number
  streak: { type: 'W' | 'L' | 'D' | null; count: number }
  onRecordMatch: () => void
}) {
  const { t } = useTranslation()
  const tier = getTier(p4pRank, totalPlayers)
  const TierIcon = tier ? TIER_ICON[tier.labelKey] : null
  const roster = players.filter((p) => p.id !== userId).slice(0, 5)

  return (
    <section>
      {/* Banner: admin-set photo, or a compact roster strip when none is set */}
      <div className="relative h-28 w-full overflow-hidden bg-foreground sm:h-36">
        {heroBannerUrl ? (
          <img
            src={heroBannerUrl}
            alt=""
            className="size-full object-cover"
            style={{ objectPosition: heroBannerPosition || 'center top' }}
          />
        ) : (
          <div className="grid size-full grid-cols-5 gap-px bg-border/20">
            {roster.length > 0 ? (
              roster.map((p) => (
                <div key={p.id} className="flex items-center justify-center overflow-hidden bg-foreground/90">
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.displayName} className="size-full object-cover opacity-70" />
                  ) : (
                    <span className="font-heading text-lg font-bold text-background/30">{initialsFor(p.displayName)}</span>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-5 bg-foreground" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute right-0 bottom-0 left-0 h-[3px] bg-primary" />
      </div>

      {/* Identity + stat strip */}
      <div className="bg-foreground px-4 pt-3 pb-5 text-background sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tier && TierIcon && (
            <Badge className={cn('gap-1 border bg-transparent px-1.5 py-0 font-semibold', tier.className)}>
              <TierIcon className="size-3" />
              {t(tier.labelKey)}
            </Badge>
          )}
          {p4pRank > 0 && (
            <span className="text-xs text-background/50">
              #{p4pRank} {t('lb.ofPlayers', { n: totalPlayers })}
            </span>
          )}
          {streak.type === 'W' && streak.count >= 2 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-win">
              {streak.count >= 3 && <Flame className="size-3" />}
              {t('home.streak.wStreak', { n: streak.count })}
            </span>
          )}
          {streak.type === 'L' && streak.count >= 2 && (
            <span className="text-xs font-medium text-loss">{t('home.streak.lStreak', { n: streak.count })}</span>
          )}
        </div>

        <div className="mb-4 flex items-center gap-3">
          <PlayerAvatar name={myName} avatarUrl={myAvatarUrl} size="lg" className="ring-2 ring-background/20" />
          <h1 className="truncate font-heading text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
            {myName}
          </h1>
        </div>

        <dl className="mb-4 grid grid-cols-4 divide-x divide-background/10 border-y border-background/10 py-2.5">
          {[
            { label: t('common.wins'), value: stats.wins, className: 'text-win' },
            { label: t('common.losses'), value: stats.losses, className: 'text-loss' },
            { label: t('common.draws'), value: stats.draws, className: 'text-draw' },
            { label: t('common.goals'), value: stats.goalsFor, className: 'text-background' },
          ].map(({ label, value, className }) => (
            <div key={label} className="text-center">
              <dd className={cn('font-heading text-2xl font-bold tabular-nums', className)}>{value}</dd>
              <dt className="mt-0.5 text-[10px] font-medium tracking-wide text-background/40 uppercase">{label}</dt>
            </div>
          ))}
        </dl>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium tracking-wide text-background/40 uppercase">
            <span>{t('common.winRate')}</span>
            <span className={cn('text-sm font-bold tabular-nums', winRate >= 60 ? 'text-win' : winRate >= 40 ? 'text-draw' : 'text-background/50')}>
              {winRate}%
            </span>
          </div>
          <Progress
            value={winRate}
            className={cn(
              'block',
              '[&_[data-slot=progress-track]]:h-1 [&_[data-slot=progress-track]]:bg-background/10',
              winRate >= 60
                ? '[&_[data-slot=progress-indicator]]:bg-win'
                : winRate >= 40
                  ? '[&_[data-slot=progress-indicator]]:bg-draw'
                  : '[&_[data-slot=progress-indicator]]:bg-background/40'
            )}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={onRecordMatch} className="flex-1" size="lg">
            {t('home.recordMatch')}
          </Button>
          <Button
            render={<Link href={`/players/${userId}`} />}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background"
          >
            {t('common.viewAll')}
          </Button>
        </div>
      </div>
    </section>
  )
}
