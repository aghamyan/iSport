'use client'

import { useState, useEffect, useTransition } from 'react'
import supabase from '@/lib/supabase/client'
import { confirmMatchAction } from './actions'
import { EditMatchModal } from './EditMatchModal'
import { useOddsFormat } from '@/lib/hooks/useOddsFormat'
import { formatOdds, FORMAT_LABELS, type OddsFactor } from '@/lib/odds'
import { useTranslation } from '@/lib/i18n/context'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchOdds = {
  homeWinOdds:  number | null
  drawOdds:     number | null
  awayWinOdds:  number | null
  homeHandicap: number | null
  awayHandicap: number | null
  homeFactors?: OddsFactor[]
  awayFactors?: OddsFactor[]
}

export type FriendlyMatch = {
  id:              string
  homePlayerId:    string
  homePlayerName:  string
  awayPlayerId:    string
  awayPlayerName:  string
  homeScore:       number | null
  awayScore:       number | null
  notes:           string | null
  status:          'pending' | 'confirmed' | 'final'
  editDeadline:    string | null
  confirmedAt:     string | null
  createdBy:       string
  odds:            MatchOdds | null
}

type Props = {
  match:         FriendlyMatch
  currentUserId: string
  isAdmin:       boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  confirmed: '#22c55e',
  final:     '#6b7280',
}

function handicapLabel(h: number): string {
  return h === 0 ? '0' : h > 0 ? `+${h}` : `${h}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MatchCard({ match: initial, currentUserId, isAdmin }: Props) {
  const { t } = useTranslation()
  const [match, setMatch]               = useState(initial)
  const [showEdit, setShowEdit]         = useState(false)
  const [showConfirmForm, setShowCF]    = useState(false)
  const [showBreakdown, setBreakdown]   = useState(false)
  const [confirmHome, setConfirmHome]   = useState('')
  const [confirmAway, setConfirmAway]   = useState('')
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()
  const { format, cycleFormat }         = useOddsFormat()

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`match-${match.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friendly_matches', filter: `id=eq.${match.id}` },
        (payload) => {
          const r = payload.new as Record<string, unknown>
          setMatch((prev) => ({
            ...prev,
            status:       r.status as FriendlyMatch['status'],
            homeScore:    r.home_score as number | null,
            awayScore:    r.away_score as number | null,
            notes:        r.notes as string | null,
            confirmedAt:  r.confirmed_at as string | null,
            editDeadline: r.edit_deadline as string | null,
          }))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [match.id])

  const canConfirm =
    match.status === 'pending' &&
    (match.homePlayerId === currentUserId || match.awayPlayerId === currentUserId)
  const canEdit    =
    match.status === 'confirmed' &&
    (match.homePlayerId === currentUserId || match.awayPlayerId === currentUserId || isAdmin)

  function handleConfirmSubmit() {
    const h = parseFloat(confirmHome)
    const a = parseFloat(confirmAway)
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      setConfirmError(t('home.err.invalidScores'))
      return
    }
    setConfirmError(null)
    startTransition(async () => {
      try {
        await confirmMatchAction(match.id, h, a)
        setShowCF(false)
      } catch (e) {
        setConfirmError(e instanceof Error ? e.message : t('match.errFailed'))
      }
    })
  }

  const fmt = (decimal: number | null) =>
    decimal !== null ? formatOdds(decimal, format) : '—'

  const hasOdds = match.odds &&
    match.odds.homeWinOdds !== null &&
    match.odds.drawOdds !== null &&
    match.odds.awayWinOdds !== null

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        background: 'var(--card)',
        boxShadow: '0 1px 4px rgba(var(--rgb-overlay),0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* ── Status bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: STATUS_COLOR[match.status] ?? '#6b7280' }}>
          {match.status}
        </span>
      </div>

      {/* ── Score row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>{match.homePlayerName}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{match.homeScore ?? '–'}</div>
        </div>
        <div style={{ fontSize: 16, color: '#d1d5db', fontWeight: 700 }}>VS</div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>{match.awayPlayerName}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{match.awayScore ?? '–'}</div>
        </div>
      </div>

      {/* ── Odds section ── */}
      {hasOdds && match.odds && (
        <div>
          {/* Chips row with format toggle */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <OddsChipSmall label="1"   value={fmt(match.odds.homeWinOdds)} color="#dbeafe" />
            <OddsChipSmall label="X"   value={fmt(match.odds.drawOdds)}    color="#f0fdf4" />
            <OddsChipSmall label="2"   value={fmt(match.odds.awayWinOdds)} color="#dbeafe" />
            {match.odds.homeHandicap !== null && (
              <OddsChipSmall
                label="HDP"
                value={handicapLabel(match.odds.homeHandicap)}
                color="#ede9fe"
              />
            )}
            <button
              onClick={cycleFormat}
              title={`Format: ${format} — click to change`}
              style={{
                marginLeft: 'auto',
                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                borderRadius: 4, border: '1px solid var(--border)',
                background: '#f9fafb', color: 'var(--muted)', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {FORMAT_LABELS[format]}
            </button>
          </div>

          {/* Breakdown toggle (only when snapshot factors are available) */}
          {(match.odds.homeFactors?.length || match.odds.awayFactors?.length) ? (
            <>
              <button
                onClick={() => setBreakdown((v) => !v)}
                style={{
                  marginTop: 6, fontSize: 11, color: '#6366f1',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, textDecoration: 'underline',
                }}
              >
                {showBreakdown ? t('odds.hideBreakdown') : t('odds.whyOdds')}
              </button>

              {showBreakdown && (
                <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <FactorsColumn
                    name={match.homePlayerName}
                    factors={match.odds.homeFactors ?? []}
                    side="home"
                  />
                  <FactorsColumn
                    name={match.awayPlayerName}
                    factors={match.odds.awayFactors ?? []}
                    side="away"
                  />
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── Notes ── */}
      {match.notes && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{match.notes}</p>
      )}

      {/* ── Action buttons ── */}
      {(canConfirm || canEdit) && (
        <div style={{ display: 'flex', gap: 6 }}>
          {canConfirm && !showConfirmForm && (
            <button
              onClick={() => setShowCF(true)}
              style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {t('home.setScore')}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowEdit(true)}
              style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {match.homeScore === null && match.awayScore === null ? t('home.setScore') : t('common.editScore')}
            </button>
          )}
        </div>
      )}

      {/* ── Inline confirm form ── */}
      {showConfirmForm && (
        <div style={{ padding: '12px', background: '#f9fafb', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>{t('match.enterScoresToConfirm')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="number" min={0} max={99} placeholder={t('common.homeLabel')}
              value={confirmHome} onChange={(e) => setConfirmHome(e.target.value)}
              style={{ width: 60, padding: '6px', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center', fontSize: 16, fontWeight: 700 }}
            />
            <span style={{ color: '#9ca3af', fontWeight: 700 }}>:</span>
            <input
              type="number" min={0} max={99} placeholder={t('common.awayLabel')}
              value={confirmAway} onChange={(e) => setConfirmAway(e.target.value)}
              style={{ width: 60, padding: '6px', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center', fontSize: 16, fontWeight: 700 }}
            />
            <button
              onClick={handleConfirmSubmit} disabled={isPending}
              style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              {isPending ? '…' : t('match.confirm')}
            </button>
            <button
              onClick={() => { setShowCF(false); setConfirmError(null) }}
              style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', cursor: 'pointer', fontSize: 13 }}
            >
              {t('common.cancel')}
            </button>
          </div>
          {confirmError && <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: 12 }}>{confirmError}</p>}
        </div>
      )}

      {/* ── Edit modal ── */}
      {showEdit && (
        <EditMatchModal
          match={{ id: match.id, homeScore: match.homeScore, awayScore: match.awayScore, notes: match.notes, editDeadline: match.editDeadline, status: match.status }}
          homePlayerName={match.homePlayerName}
          awayPlayerName={match.awayPlayerName}
          isAdmin={isAdmin}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function OddsChipSmall({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '5px 4px', background: color, borderRadius: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function FactorsColumn({ name, factors, side }: { name: string; factors: OddsFactor[]; side: 'home' | 'away' }) {
  const accent = side === 'home' ? '#3b82f6' : '#ef4444'
  if (!factors.length) return null
  return (
    <div style={{ flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 5 }}>
        {name.length > 14 ? name.slice(0, 13) + '…' : name}
      </div>
      {factors.map((f, i) => (
        <div key={i} style={{ marginBottom: 5, paddingLeft: 8, borderLeft: `2px solid ${f.impact === 'positive' ? '#22c55e' : f.impact === 'negative' ? '#ef4444' : '#d1d5db'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{f.label}</span>
            {f.ratingDelta !== 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: f.ratingDelta > 0 ? '#16a34a' : '#dc2626' }}>
                {f.ratingDelta > 0 ? `+${f.ratingDelta}` : f.ratingDelta} Elo
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{f.description}</div>
        </div>
      ))}
    </div>
  )
}
