'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react'
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  ListFilter,
  Search,
  SlidersHorizontal,
  TimerReset,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react'
import supabase from '@/lib/supabase/client'
import {
  getActiveBetsAction,
  getBetHistoryAction,
  type BetHistoryLeg,
  type BetHistoryRow,
} from './bets/actions'
import { fmtAMD, getMarketLabel, getMarketShort } from '@/lib/betting/validation'
import { useBetSlip } from '@/lib/betting/BetSlipContext'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = '#050911'
const CARD   = '#0c1422'
const CARD2  = '#111d2e'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const TEXT   = '#f8fafc'
const TEXT2  = '#94a3b8'
const MUTED  = '#4b5a73'
const WIN    = '#10b981'
const LOSS   = '#ef4444'
const GOLD   = '#f59e0b'
const GRAY   = '#64748b'

type IconComponent = ComponentType<{
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
}>

type HistoryTab = 'active' | 'won' | 'lost' | 'cancelled'
type SortKey = 'date' | 'amount' | 'odds'
type BetTypeFilter = 'all' | 'single' | 'parlay'
type MatchTypeFilter = 'all' | 'friendly' | 'championship'

const STATUS_META: Record<string, { label: string; color: string; Icon: IconComponent }> = {
  PENDING:   { label: 'Active',    color: GOLD, Icon: Clock3 },
  WON:       { label: 'Won',       color: WIN,  Icon: CheckCircle2 },
  LOST:      { label: 'Lost',      color: LOSS, Icon: XCircle },
  RETURNED:  { label: 'Returned',  color: GRAY, Icon: Ban },
  CANCELLED: { label: 'Cancelled', color: GRAY, Icon: Ban },
}

const TAB_META: Record<HistoryTab, { label: string; Icon: IconComponent; color: string }> = {
  active:    { label: 'Active Bets', Icon: Clock3,       color: GOLD },
  won:       { label: 'Won',         Icon: CheckCircle2, color: WIN },
  lost:      { label: 'Lost',        Icon: XCircle,      color: LOSS },
  cancelled: { label: 'Cancelled',   Icon: Ban,          color: GRAY },
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const check = () => setDesktop(window.innerWidth >= 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return desktop
}

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortBetId(id: string) {
  return `BET-${id.replace(/-/g, '').slice(0, 5).toUpperCase()}`
}

function betTypeLabel(bet: BetHistoryRow) {
  return bet.betType === 'SINGLE' ? 'SINGLE' : `PARLAY ${bet.legs.length} LEGS`
}

function tabForStatus(status: string): HistoryTab {
  if (status === 'WON') return 'won'
  if (status === 'LOST') return 'lost'
  if (status === 'RETURNED' || status === 'CANCELLED') return 'cancelled'
  return 'active'
}

function matchTypeLabel(type: string | null | undefined) {
  if (type === 'championship') return 'Championship'
  if (type === 'friendly') return 'Friendly'
  return 'Match'
}

function hasMatchType(bet: BetHistoryRow, filter: MatchTypeFilter) {
  if (filter === 'all') return true
  return bet.legs.some(leg => leg.matchType === filter)
}

function searchableText(bet: BetHistoryRow) {
  return [
    bet.betId,
    shortBetId(bet.betId),
    bet.playerName,
    bet.status,
    bet.legs.map(leg => `${leg.matchTitle} ${leg.selectionLabel}`).join(' '),
  ].join(' ').toLowerCase()
}

function durationText(ms: number) {
  if (ms <= 0) return 'Settlement pending'
  const totalHours = Math.ceil(ms / 3_600_000)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0 && hours > 0) return `Settles in: ${days}d ${hours}h`
  if (days > 0) return `Settles in: ${days}d`
  return `Settles in: ${hours}h`
}

function matchStatusLabel(bet: BetHistoryRow) {
  const statuses = bet.legs
    .map(leg => (leg.matchStatus ?? '').toLowerCase())
    .filter(Boolean)

  if (statuses.some(s => s === 'playing' || s === 'live')) return 'Live'
  if (statuses.some(s => s === 'confirmed' || s === 'final' || s === 'finished')) {
    return bet.status === 'PENDING' ? 'Finished (awaiting settlement)' : 'Finished'
  }
  return 'Scheduled'
}

function settlementText(bet: BetHistoryRow, now: number) {
  if (bet.status !== 'PENDING') return bet.settledAt ? `Settled ${fmtDate(bet.settledAt)}` : 'Settlement complete'
  if (matchStatusLabel(bet).startsWith('Finished')) return 'Awaiting settlement'

  // The current schema has no scheduled kickoff/settlement field, so this is an SLA-style estimate.
  const estimate = new Date(bet.placedAt).getTime() + 3 * 24 * 60 * 60 * 1000
  return durationText(estimate - now)
}

function signedOdds(delta: number | null) {
  if (delta === null || Math.abs(delta) < 0.01) return 'No change'
  return `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`
}

function currentCombinedOdds(bet: BetHistoryRow) {
  if (bet.legs.length === 0 || bet.legs.some(leg => leg.currentOdds === null)) return null
  return bet.legs.reduce((acc, leg) => acc * (leg.currentOdds ?? 1), 1)
}

function outcomeAmountLabel(bet: BetHistoryRow) {
  if (bet.status === 'WON') return { label: 'Won',       value: fmtAMD(bet.actualWinnings), color: WIN }
  if (bet.status === 'LOST') return { label: 'Lost',      value: fmtAMD(bet.betAmount),      color: LOSS }
  if (bet.status === 'RETURNED' || bet.status === 'CANCELLED') {
    return { label: 'Refund', value: fmtAMD(bet.betAmount), color: GRAY }
  }
  return { label: 'Potential', value: fmtAMD(bet.actualWinnings), color: GOLD }
}

function resultMeta(result: BetHistoryLeg['result']) {
  if (result === 'WON')      return { label: 'Won',     color: WIN,  Icon: CheckCircle2 }
  if (result === 'LOST')     return { label: 'Lost',    color: LOSS, Icon: XCircle }
  if (result === 'RETURNED') return { label: 'Refund',  color: GRAY, Icon: Ban }
  return { label: 'Pending', color: GOLD, Icon: Clock3 }
}

function csvValue(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function exportCSV(bets: BetHistoryRow[], tab: HistoryTab) {
  const headers = [
    'Bet ID',
    'Player',
    'Type',
    'Status',
    'Amount',
    'Combined Odds',
    'Potential Winnings',
    'Actual Winnings',
    'Rake',
    'Placed At',
    'Settled At',
    'Selections',
    'Reason',
  ]

  const rows = bets.map(bet => [
    shortBetId(bet.betId),
    bet.playerName,
    betTypeLabel(bet),
    bet.status,
    bet.betAmount,
    bet.combinedOdds.toFixed(2),
    bet.potentialWinnings,
    bet.actualWinnings,
    bet.rakeAmount,
    fmtDate(bet.placedAt),
    bet.settledAt ? fmtDate(bet.settledAt) : '',
    bet.legs.map(leg => `${leg.matchTitle}: ${leg.selectionLabel} @ ${leg.oddsAtPlacement.toFixed(2)}`).join(' | '),
    bet.lostReason ?? bet.cancellationReason ?? bet.adminNotes ?? '',
  ])

  const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bet_history_${tab}_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function calculateStats(bets: BetHistoryRow[]) {
  const wins = bets.filter(b => b.status === 'WON')
  const losses = bets.filter(b => b.status === 'LOST')
  const settledForRate = wins.length + losses.length
  const totalWagered = bets.reduce((sum, b) => sum + b.betAmount, 0)
  const totalWon = wins.reduce((sum, b) => sum + b.actualWinnings, 0)
  const net = bets.reduce((sum, bet) => {
    if (bet.status === 'WON') return sum + (bet.actualWinnings - bet.betAmount)
    if (bet.status === 'LOST') return sum - bet.betAmount
    return sum
  }, 0)

  return {
    totalBets: bets.length,
    winRate: settledForRate > 0 ? Math.round((wins.length / settledForRate) * 100) : 0,
    totalWagered,
    totalWon,
    net,
  }
}

// ─── Small UI pieces ─────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, color: MUTED, display: 'block', marginBottom: 5 }}>
      {children}
    </span>
  )
}

function SelectControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label style={{ minWidth: 140, flex: '1 1 140px' }}>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        style={{
          width: '100%',
          height: 38,
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: CARD,
          color: TEXT,
          fontSize: 12,
          fontWeight: 700,
          padding: '0 10px',
          outline: 'none',
        }}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING
  const Icon = meta.Icon
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      minHeight: 24,
      padding: '3px 9px',
      borderRadius: 8,
      background: `${meta.color}18`,
      color: meta.color,
      fontSize: 11,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      <Icon size={13} strokeWidth={2.4} />
      {meta.label}
    </span>
  )
}

function Chip({ children, color }: { children: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 22,
      padding: '2px 8px',
      borderRadius: 8,
      background: `${color}18`,
      color,
      fontSize: 10,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function AmountBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color, fontWeight: 900, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

function DetailLine({
  label,
  value,
  color = TEXT2,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color, fontWeight: 700, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

// ─── Bet card ─────────────────────────────────────────────────────────────────

function SelectionRow({
  leg,
  settled,
}: {
  leg: BetHistoryLeg
  settled: boolean
}) {
  const meta = resultMeta(settled ? leg.result : 'PENDING')
  const Icon = meta.Icon

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '18px minmax(0, 1fr) auto',
      gap: 8,
      alignItems: 'start',
      padding: '7px 0',
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <Icon size={16} color={meta.color} strokeWidth={2.4} style={{ marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: TEXT, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {leg.matchTitle}
        </div>
        <div style={{ fontSize: 11, color: TEXT2, marginTop: 2, overflowWrap: 'anywhere' }}>
          {leg.selectionLabel} @ {leg.oddsAtPlacement.toFixed(2)}
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 72 }}>
        <Chip color={leg.matchType === 'championship' ? GOLD : ACCENT}>
          {matchTypeLabel(leg.matchType)}
        </Chip>
      </div>
    </div>
  )
}

function ActiveDetails({ bet, now }: { bet: BetHistoryRow; now: number }) {
  const combinedCurrent = currentCombinedOdds(bet)
  const combinedDelta = combinedCurrent === null
    ? null
    : Math.round((combinedCurrent - bet.combinedOdds) * 100) / 100
  const movedLegs = bet.legs.filter(leg => leg.oddsDelta !== null && Math.abs(leg.oddsDelta) >= 0.01)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
      gap: 10,
      marginBottom: 12,
    }}>
      <DetailLine label="Settlement" value={settlementText(bet, now)} color={GOLD} />
      <DetailLine label="Match Status" value={matchStatusLabel(bet)} />
      <DetailLine
        label="Current Odds"
        value={combinedCurrent === null
          ? 'Unavailable'
          : `${combinedCurrent.toFixed(2)} (${signedOdds(combinedDelta)})`}
        color={combinedDelta !== null && combinedDelta > 0 ? WIN : combinedDelta !== null && combinedDelta < 0 ? LOSS : TEXT2}
      />
      <DetailLine
        label="Odds Movement"
        value={movedLegs.length > 0 ? `${movedLegs.length} ${movedLegs.length === 1 ? 'selection moved' : 'selections moved'}` : 'No change'}
      />
    </div>
  )
}

function SettledDetails({ bet }: { bet: BetHistoryRow }) {
  if (bet.status === 'WON') {
    return (
      <div style={{
        border: `1px solid ${WIN}33`,
        background: `${WIN}10`,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: WIN, fontWeight: 900, marginBottom: 4 }}>Win</div>
        <div style={{ fontSize: 22, color: WIN, fontWeight: 950, marginBottom: 4 }}>
          {fmtAMD(bet.actualWinnings)}
        </div>
        <div style={{ fontSize: 12, color: TEXT2 }}>
          10% rake deducted: {fmtAMD(bet.rakeAmount)}
          {bet.settledAt && <> · Settled {fmtDate(bet.settledAt)}</>}
        </div>
      </div>
    )
  }

  if (bet.status === 'LOST') {
    return (
      <div style={{
        border: `1px solid ${LOSS}33`,
        background: `${LOSS}10`,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: LOSS, fontWeight: 900, marginBottom: 4 }}>Bet Lost</div>
        <div style={{ fontSize: 18, color: LOSS, fontWeight: 900, marginBottom: 4 }}>
          Lost: {fmtAMD(bet.betAmount)}
        </div>
        <div style={{ fontSize: 12, color: TEXT2 }}>
          {bet.lostReason ?? 'Your selection did not match the result.'}
          {bet.settledAt && <> · Settled {fmtDate(bet.settledAt)}</>}
        </div>
      </div>
    )
  }

  if (bet.status === 'RETURNED' || bet.status === 'CANCELLED') {
    return (
      <div style={{
        border: `1px solid ${GRAY}33`,
        background: `${GRAY}12`,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: GRAY, fontWeight: 900, marginBottom: 4 }}>
          {STATUS_META[bet.status].label}
        </div>
        <div style={{ fontSize: 18, color: TEXT, fontWeight: 900, marginBottom: 4 }}>
          Refunded: {fmtAMD(bet.betAmount)}
        </div>
        <div style={{ fontSize: 12, color: TEXT2 }}>
          Reason: {bet.cancellationReason ?? 'Bet refunded'}
          {bet.settledAt && <> · Settled {fmtDate(bet.settledAt)}</>}
        </div>
      </div>
    )
  }

  return null
}

function LegDetails({ leg }: { leg: BetHistoryLeg }) {
  const meta = resultMeta(leg.result)
  const Icon = meta.Icon
  const deltaColor = leg.oddsDelta !== null && leg.oddsDelta > 0
    ? WIN
    : leg.oddsDelta !== null && leg.oddsDelta < 0
      ? LOSS
      : TEXT2

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: 10,
      alignItems: 'center',
      padding: '9px 0',
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
          <Chip color={ACCENT}>{getMarketShort(leg.marketType)}</Chip>
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>
            {getMarketLabel(leg.marketType)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: TEXT, fontWeight: 800, overflowWrap: 'anywhere' }}>
          {leg.matchTitle}
        </div>
        <div style={{ fontSize: 11, color: TEXT2, marginTop: 2, overflowWrap: 'anywhere' }}>
          {leg.selectionLabel} @ {leg.oddsAtPlacement.toFixed(2)}
          {leg.currentOdds !== null && (
            <span style={{ color: deltaColor, fontWeight: 800 }}>
              {' '}→ {leg.currentOdds.toFixed(2)} ({signedOdds(leg.oddsDelta)})
            </span>
          )}
        </div>
        {leg.reason && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {leg.reason}
          </div>
        )}
      </div>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        color: meta.color,
        background: `${meta.color}18`,
        borderRadius: 8,
        padding: '4px 8px',
        fontSize: 10,
        fontWeight: 900,
        whiteSpace: 'nowrap',
      }}>
        <Icon size={13} strokeWidth={2.4} />
        {meta.label}
      </span>
    </div>
  )
}

function BetCard({
  bet,
  isDesktop,
  now,
}: {
  bet: BetHistoryRow
  isDesktop: boolean
  now: number
}) {
  const [expanded, setExpanded] = useState(false)
  const statusMeta = STATUS_META[bet.status] ?? STATUS_META.PENDING
  const amount = outcomeAmountLabel(bet)
  const settled = bet.status !== 'PENDING'

  return (
    <div style={{
      background: CARD,
      borderTop: `1px solid ${expanded ? statusMeta.color + '66' : BORDER}`,
      borderRight: `1px solid ${expanded ? statusMeta.color + '66' : BORDER}`,
      borderBottom: `1px solid ${expanded ? statusMeta.color + '66' : BORDER}`,
      borderLeft: `4px solid ${statusMeta.color}`,
      borderRadius: 12,
      marginBottom: 10,
      overflow: 'hidden',
      boxShadow: bet.status === 'WON'
        ? `0 0 0 1px ${WIN}12`
        : bet.status === 'LOST'
          ? `0 0 0 1px ${LOSS}12`
          : 'none',
    }}>
      <div style={{
        display: isDesktop ? 'grid' : 'block',
        gridTemplateColumns: isDesktop ? 'minmax(0, 1.7fr) 116px 98px 132px 132px 34px' : undefined,
        gap: isDesktop ? 14 : 0,
        alignItems: 'center',
        padding: '13px 14px',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
            <Chip color={TEXT2}>{shortBetId(bet.betId)}</Chip>
            <Chip color={bet.betType === 'PARLAY' ? GOLD : ACCENT}>{betTypeLabel(bet)}</Chip>
            <StatusPill status={bet.status} />
          </div>

          <div>
            {bet.legs.map(leg => (
              <SelectionRow key={leg.legId} leg={leg} settled={settled} />
            ))}
          </div>

          <div style={{ fontSize: 10, color: MUTED, marginTop: 8, fontWeight: 700 }}>
            Placed {fmtDate(bet.placedAt)}
            {bet.settledAt && <> · Settled {fmtDate(bet.settledAt)}</>}
          </div>
        </div>

        <div style={{
          display: isDesktop ? 'contents' : 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
          marginTop: isDesktop ? 0 : 12,
        }}>
          <AmountBlock label="Stake" value={fmtAMD(bet.betAmount)} color={TEXT} />
          <AmountBlock label="Odds" value={`${bet.combinedOdds.toFixed(2)}×`} color={ACCENT} />
          <AmountBlock label={amount.label} value={amount.value} color={amount.color} />
        </div>

        {isDesktop && (
          <div style={{ minWidth: 0 }}>
            <DetailLine label="Settlement" value={settlementText(bet, now)} color={statusMeta.color} />
          </div>
        )}

        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Hide details' : 'Show details'}
          style={{
            width: isDesktop ? 32 : '100%',
            height: isDesktop ? 32 : 34,
            marginTop: isDesktop ? 0 : 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 9,
            border: `1px solid ${BORDER}`,
            background: expanded ? `${statusMeta.color}12` : 'transparent',
            color: expanded ? statusMeta.color : TEXT2,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {!isDesktop && <span>{expanded ? 'Hide' : 'Details'}</span>}
        </button>
      </div>

      {expanded && (
        <div style={{
          borderTop: `1px solid ${BORDER}`,
          padding: '12px 14px 14px',
          animation: 'market-expand 0.18s ease',
        }}>
          {bet.status === 'PENDING' ? <ActiveDetails bet={bet} now={now} /> : <SettledDetails bet={bet} />}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 10,
            padding: '10px 0 2px',
          }}>
            <DetailLine label="Bet ID" value={bet.betId} />
            <DetailLine label="Player" value={bet.playerName} />
            <DetailLine label="Gross Win" value={fmtAMD(bet.potentialWinnings)} />
            <DetailLine label="Net Payout" value={fmtAMD(bet.actualWinnings)} color={bet.status === 'WON' ? WIN : TEXT2} />
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: MUTED, fontWeight: 900, marginBottom: 2 }}>
              Selections
            </div>
            {bet.legs.map(leg => <LegDetails key={leg.legId} leg={leg} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  userId: string
  showHistory?: boolean
}

export function ActiveBets({ userId, showHistory = false }: Props) {
  const [bets, setBets] = useState<BetHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<HistoryTab>('active')
  const [sort, setSort] = useState<SortKey>('date')
  const [betType, setBetType] = useState<BetTypeFilter>('all')
  const [matchType, setMatchType] = useState<MatchTypeFilter>('all')
  const [search, setSearch] = useState('')
  const { lastPlacedBetId } = useBetSlip()
  const isDesktop = useIsDesktop()
  const now = useNow()

  const load = useCallback(async () => {
    setLoading(true)
    const data = showHistory
      ? await getBetHistoryAction()
      : await getActiveBetsAction()
    setBets(data)
    setLoading(false)
  }, [showHistory])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (lastPlacedBetId) load()
  }, [lastPlacedBetId, load])

  useEffect(() => {
    const channel = supabase
      .channel(`bets:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bets',
        filter: `player_id=eq.${userId}`,
      }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  const counts = useMemo(() => ({
    active: bets.filter(b => tabForStatus(b.status) === 'active').length,
    won: bets.filter(b => tabForStatus(b.status) === 'won').length,
    lost: bets.filter(b => tabForStatus(b.status) === 'lost').length,
    cancelled: bets.filter(b => tabForStatus(b.status) === 'cancelled').length,
  }), [bets])

  const stats = useMemo(() => calculateStats(bets), [bets])

  const displayed = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return bets
      .filter(bet => tabForStatus(bet.status) === tab)
      .filter(bet => betType === 'all' || bet.betType.toLowerCase() === betType)
      .filter(bet => hasMatchType(bet, matchType))
      .filter(bet => !needle || searchableText(bet).includes(needle))
      .sort((a, b) => {
        if (sort === 'amount') return b.betAmount - a.betAmount
        if (sort === 'odds') return b.combinedOdds - a.combinedOdds
        return new Date(b.settledAt ?? b.placedAt).getTime() - new Date(a.settledAt ?? a.placedAt).getTime()
      })
  }, [bets, betType, matchType, search, sort, tab])

  if (!showHistory) {
    const activeBets = bets.filter(b => b.status === 'PENDING')
    return (
      <div>
        {activeBets.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, color: TEXT2, fontWeight: 800 }}>
              Active Bets
              <span style={{
                marginLeft: 6,
                background: GOLD,
                color: BG,
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: 10,
                fontWeight: 900,
              }}>
                {activeBets.length}
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ color: TEXT2, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
            Loading bets...
          </div>
        )}

        {!loading && activeBets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: MUTED, fontSize: 13 }}>
            No active bets.
          </div>
        )}

        {!loading && activeBets.map(bet => (
          <BetCard key={bet.betId} bet={bet} isDesktop={isDesktop} now={now} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        marginBottom: 14,
      }}>
        {(Object.keys(TAB_META) as HistoryTab[]).map(key => {
          const meta = TAB_META[key]
          const Icon = meta.Icon
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                minHeight: 42,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${active ? meta.color : BORDER}`,
                background: active ? `${meta.color}16` : CARD,
                color: active ? meta.color : TEXT2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <Icon size={15} strokeWidth={2.4} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.label}</span>
              </span>
              <span style={{
                minWidth: 24,
                textAlign: 'center',
                borderRadius: 8,
                padding: '1px 6px',
                background: active ? meta.color : BORDER,
                color: active ? BG : TEXT2,
                fontSize: 11,
                fontWeight: 900,
              }}>
                {counts[key]}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? 'repeat(5, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        marginBottom: 14,
      }}>
        <StatCard icon={ListFilter} label="Total Bets" value={String(stats.totalBets)} color={TEXT} />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? WIN : TEXT2} />
        <StatCard icon={Wallet} label="Total Wagered" value={fmtAMD(stats.totalWagered)} color={TEXT} />
        <StatCard icon={CheckCircle2} label="Total Won" value={fmtAMD(stats.totalWon)} color={WIN} />
        <StatCard icon={TimerReset} label="Net P&L" value={fmtAMD(stats.net)} color={stats.net >= 0 ? WIN : LOSS} />
      </div>

      <div style={{
        background: CARD2,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <SlidersHorizontal size={15} color={ACCENT} />
          <div style={{ fontSize: 12, color: TEXT, fontWeight: 900 }}>Filter History</div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ flex: '2 1 220px', minWidth: 180 }}>
            <FieldLabel>Search</FieldLabel>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                color={MUTED}
                style={{ position: 'absolute', left: 11, top: 12 }}
              />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Bet ID or player name"
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 10,
                  border: `1px solid ${BORDER}`,
                  background: CARD,
                  color: TEXT,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '0 10px 0 33px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </label>

          <SelectControl
            label="Sort By"
            value={sort}
            onChange={value => setSort(value as SortKey)}
            options={[
              { value: 'date',   label: 'Date (newest first)' },
              { value: 'amount', label: 'Stake amount' },
              { value: 'odds',   label: 'Combined odds' },
            ]}
          />

          <SelectControl
            label="Bet Type"
            value={betType}
            onChange={value => setBetType(value as BetTypeFilter)}
            options={[
              { value: 'all',    label: 'All types' },
              { value: 'single', label: 'Single' },
              { value: 'parlay', label: 'Parlay' },
            ]}
          />

          <SelectControl
            label="Match Type"
            value={matchType}
            onChange={value => setMatchType(value as MatchTypeFilter)}
            options={[
              { value: 'all',          label: 'All matches' },
              { value: 'friendly',     label: 'Friendly' },
              { value: 'championship', label: 'Championship' },
            ]}
          />

          <button
            onClick={() => exportCSV(displayed, tab)}
            disabled={displayed.length === 0}
            title="Export history to CSV"
            style={{
              height: 38,
              minWidth: 126,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '0 12px',
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: displayed.length === 0 ? CARD : `${ACCENT}18`,
              color: displayed.length === 0 ? MUTED : ACCENT,
              cursor: displayed.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            <Download size={14} strokeWidth={2.4} />
            Export CSV
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ color: TEXT2, fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
          Loading bets...
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '34px 0',
          color: MUTED,
          fontSize: 13,
          background: CARD,
          border: `1px dashed ${BORDER}`,
          borderRadius: 12,
        }}>
          No bets found.
        </div>
      )}

      {!loading && displayed.map(bet => (
        <BetCard key={bet.betId} bet={bet} isDesktop={isDesktop} now={now} />
      ))}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: IconComponent
  label: string
  value: string
  color: string
}) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: '11px 12px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: MUTED, marginBottom: 8 }}>
        <Icon size={14} strokeWidth={2.3} />
        <span style={{ fontSize: 10, fontWeight: 900 }}>{label}</span>
      </div>
      <div style={{ color, fontSize: 16, fontWeight: 950, overflowWrap: 'anywhere' }}>
        {value}
      </div>
    </div>
  )
}

// ─── Compact summary widget (for home page / profile) ────────────────────────

export function ActiveBetsSummary({ userId }: { userId: string }) {
  const [count, setCount] = useState(0)
  const [totalStake, setTotalStake] = useState(0)

  useEffect(() => {
    getActiveBetsAction().then(bets => {
      setCount(bets.length)
      setTotalStake(bets.reduce((sum, bet) => sum + bet.betAmount, 0))
    })
  }, [userId])

  if (count === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: CARD2,
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: '8px 14px',
    }}>
      <Clock3 size={17} color={GOLD} strokeWidth={2.4} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>
          {count} active {count !== 1 ? 'bets' : 'bet'}
        </div>
        <div style={{ fontSize: 11, color: TEXT2 }}>
          {fmtAMD(totalStake)} in play
        </div>
      </div>
    </div>
  )
}
