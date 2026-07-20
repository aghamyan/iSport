import { cn } from '@/lib/utils'
import type { FormResult } from '@/lib/stats/types'

export type MatchOutcome = FormResult | 'pending' | 'disputed'

const OUTCOME_STYLES: Record<MatchOutcome, string> = {
  W: 'bg-win/15 text-win border-win/30',
  L: 'bg-loss/15 text-loss border-loss/30',
  D: 'bg-draw/15 text-draw border-draw/30',
  pending: 'bg-pending/15 text-pending border-pending/30',
  disputed: 'bg-disputed/15 text-disputed border-disputed/30',
}

/** Single-letter W/D/L (or status) chip — the same visual language everywhere
 *  a match outcome appears: form strips, standings rows, match cards. */
export function ResultChip({ outcome, className }: { outcome: MatchOutcome; className?: string }) {
  const label = outcome === 'pending' ? '•' : outcome === 'disputed' ? '!' : outcome
  return (
    <span
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded border font-heading text-[11px] font-bold leading-none',
        OUTCOME_STYLES[outcome],
        className
      )}
    >
      {label}
    </span>
  )
}
