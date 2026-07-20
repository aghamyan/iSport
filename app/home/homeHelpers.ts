import type { FormEntry } from '@/lib/stats/types'

export function computeStreak(form: FormEntry[]): { type: 'W' | 'L' | 'D' | null; count: number } {
  if (!form.length) return { type: null, count: 0 }
  const latest = form[0].result
  let count = 0
  for (const f of form) {
    if (f.result === latest) count++
    else break
  }
  return { type: latest, count }
}

export type Tier = { labelKey: string; className: string }

export function getTier(rank: number, total: number): Tier | null {
  if (rank <= 0 || total <= 0) return null
  if (rank === 1) return { labelKey: 'home.tier.p4pNo1', className: 'text-gold border-gold/30 bg-gold/10' }
  if (rank === 2) return { labelKey: 'home.tier.runnerUp', className: 'text-muted-foreground border-border bg-secondary' }
  if (rank === 3) return { labelKey: 'home.tier.thirdPlace', className: 'text-[#cd7c3a] border-[#cd7c3a]/30 bg-[#cd7c3a]/10' }
  if (rank <= Math.max(4, Math.ceil(total * 0.4))) return { labelKey: 'home.tier.elite', className: 'text-primary border-primary/30 bg-primary/10' }
  return { labelKey: 'home.tier.contender', className: 'text-muted-foreground border-border bg-secondary' }
}
