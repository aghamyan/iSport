'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n/context'
import { confirmMatchAction, deleteMatchAction } from '@/app/matches/actions'
import { OddsMarketModal } from '@/app/betting/OddsMarketModal'
import { PlayerAvatar } from './PlayerAvatar'
import type { HomeMatchItem } from '../HomeLoggedIn'

function hdpLabel(h: number) {
  return h === 0 ? '±0' : h > 0 ? `+${h}` : `${h}`
}

export function PendingMatches({ matches, userId }: { matches: HomeMatchItem[]; userId: string }) {
  const { t } = useTranslation()
  if (matches.length === 0) return null
  return (
    <div className="mb-5 overflow-hidden rounded-lg border bg-foreground text-background">
      <div className="flex items-center gap-2 border-b border-background/10 px-4 py-2.5">
        <span className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
        <span className="text-[11px] font-semibold tracking-wide text-background/50 uppercase">
          {t('home.matchesLabel', { n: matches.length })}
        </span>
      </div>
      <div className={cn('grid', matches.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        {matches.map((match, i) => (
          <PendingMatchCard key={match.id} match={match} userId={userId} isLast={i === matches.length - 1} colIndex={i} />
        ))}
      </div>
    </div>
  )
}

function PendingMatchCard({ match, userId, isLast, colIndex }: { match: HomeMatchItem; userId: string; isLast: boolean; colIndex: number }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [mode, setMode] = useState<'idle' | 'score' | 'delete'>('idle')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [showBetModal, setShowBetModal] = useState(false)

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteMatchAction(match.id)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('home.err.failedDelete'))
        setMode('idle')
      }
    })
  }

  function handleConfirm() {
    const h = parseInt(homeScore, 10)
    const a = parseInt(awayScore, 10)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError(t('home.err.invalidScores'))
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await confirmMatchAction(match.id, h, a)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('home.err.failedScore'))
      }
    })
  }

  const isHome = match.homePlayerId === userId
  const myShort = (isHome ? match.homePlayerName : match.awayPlayerName).slice(0, 10)
  const oppShort = (isHome ? match.awayPlayerName : match.homePlayerName).slice(0, 10)
  const isRightCol = colIndex % 2 === 1

  return (
    <div className={cn('border-background/10', !isRightCol && 'sm:border-r', !isLast && 'border-b')}>
      <div className="flex items-start gap-2 px-3 pt-3">
        <div className="flex flex-1 flex-col items-center gap-1">
          <PlayerAvatar name={match.homePlayerName} avatarUrl={match.homePlayerAvatarUrl} size="md" />
          <span className={cn('max-w-16 truncate text-[10px] font-semibold uppercase', match.homePlayerId === userId ? 'text-primary' : 'text-background/55')}>
            {match.homePlayerId === userId ? t('common.you') : match.homePlayerName.split(' ')[0]}
          </span>
        </div>
        <div className="pt-3 text-[10px] font-bold text-background/25">VS</div>
        <div className="flex flex-1 flex-col items-center gap-1">
          <PlayerAvatar name={match.awayPlayerName} avatarUrl={match.awayPlayerAvatarUrl} size="md" />
          <span className={cn('max-w-16 truncate text-[10px] font-semibold uppercase', match.awayPlayerId === userId ? 'text-primary' : 'text-background/55')}>
            {match.awayPlayerId === userId ? t('common.you') : match.awayPlayerName.split(' ')[0]}
          </span>
        </div>
      </div>

      <div className="flex h-0.5 gap-px px-3 mt-2.5">
        <div className="rounded-l-full bg-win/70" style={{ width: `${match.homeWinPct}%` }} />
        <div className="bg-background/15" style={{ width: `${match.drawPct}%` }} />
        <div className="rounded-r-full bg-primary/70" style={{ width: `${match.awayWinPct}%` }} />
      </div>

      <div className="flex gap-1 px-3 pt-2">
        {[
          { label: '1', value: match.homeWinOdds.toFixed(2) },
          { label: 'X', value: match.drawOdds.toFixed(2) },
          { label: '2', value: match.awayWinOdds.toFixed(2) },
          { label: 'HDP', value: hdpLabel(match.homeHandicap) },
          ...(match.ouLine ? [{ label: 'O/U', value: match.ouLine }] : []),
        ].map((chip) => (
          <div key={chip.label} className="flex-1 rounded bg-background/5 py-1 text-center">
            <div className="text-[8px] font-semibold text-background/30 uppercase">{chip.label}</div>
            <div className="text-[11px] font-bold tabular-nums">{chip.value}</div>
          </div>
        ))}
      </div>

      {mode === 'idle' && (
        <div className="flex gap-1.5 p-3">
          <Button size="sm" className="flex-1 bg-win text-white hover:bg-win/85" onClick={() => setMode('score')}>
            {t('home.setScore')}
          </Button>
          <Button size="sm" variant="outline" className="border-background/20 bg-transparent text-background hover:bg-background/10" onClick={() => setShowBetModal(true)}>
            Bet
          </Button>
          <Button size="icon-sm" variant="outline" className="border-loss/30 bg-transparent text-loss hover:bg-loss/10" onClick={() => setMode('delete')}>
            <X />
          </Button>
        </div>
      )}

      {showBetModal && (
        <OddsMarketModal
          matchId={match.id}
          matchType="friendly"
          homeName={match.homePlayerName}
          awayName={match.awayPlayerName}
          matchDateTime={match.createdAt}
          matchStatus={match.status}
          onClose={() => setShowBetModal(false)}
        />
      )}

      {mode === 'delete' && (
        <div className="border-t border-loss/20 bg-loss/10 p-3">
          <p className="mb-1 text-center text-xs font-semibold">{t('home.removeMatchTitle')}</p>
          <p className="mb-3 text-center text-[10px] text-background/45">{t('home.removeMatchDesc')}</p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" disabled={isDeleting} className="flex-1 border-background/15 bg-transparent text-background/70" onClick={() => setMode('idle')}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" disabled={isDeleting} className="flex-1 bg-loss text-white hover:bg-loss/85" onClick={handleDelete}>
              {isDeleting ? t('common.deleting') : t('home.yesDelete')}
            </Button>
          </div>
        </div>
      )}

      {mode === 'score' && (
        <div className="border-t border-background/10 bg-background/5 p-3">
          <div className="mb-2.5 text-center text-[10px] font-semibold tracking-wide text-background/40 uppercase">
            {t('home.enterFinalScore')}
          </div>
          <div className="mb-2.5 flex items-center justify-center gap-2">
            <div className="text-center">
              <div className="mb-1 text-[8px] font-semibold text-background/30 uppercase">{myShort}</div>
              <Input
                type="number"
                min={0}
                max={99}
                value={isHome ? homeScore : awayScore}
                onChange={(e) => (isHome ? setHomeScore(e.target.value) : setAwayScore(e.target.value))}
                className="h-11 w-13 border-background/15 bg-background/10 text-center font-heading text-xl font-bold text-primary"
              />
            </div>
            <span className="mt-4 text-lg text-background/20">:</span>
            <div className="text-center">
              <div className="mb-1 text-[8px] font-semibold text-background/30 uppercase">{oppShort}</div>
              <Input
                type="number"
                min={0}
                max={99}
                value={isHome ? awayScore : homeScore}
                onChange={(e) => (isHome ? setAwayScore(e.target.value) : setHomeScore(e.target.value))}
                className="h-11 w-13 border-background/15 bg-background/10 text-center font-heading text-xl font-bold text-loss"
              />
            </div>
          </div>
          {error && <p className="mb-2 text-center text-[11px] text-loss">{error}</p>}
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-background/15 bg-transparent text-background/70"
              onClick={() => { setMode('idle'); setError(null); setHomeScore(''); setAwayScore('') }}
            >
              {t('common.cancel')}
            </Button>
            <Button size="sm" disabled={isPending} className="flex-[2] bg-win text-white hover:bg-win/85" onClick={handleConfirm}>
              {isPending ? t('common.saving') : t('home.confirmScore')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
