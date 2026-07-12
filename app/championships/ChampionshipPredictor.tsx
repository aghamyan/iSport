'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMyPredictionsAction, submitPredictionsAction, type PredictionPick } from './predictorActions'
import { useTranslation } from '@/lib/i18n/context'

const PREDICTOR_ANIMS = `
  @keyframes predictorFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#84cc16',
]

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function MiniAvatar({ url, name, size = 22 }: { url: string | null | undefined; name: string; size?: number }) {
  const bg = nameToColor(name)
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        border: '1.5px solid #e5e7eb',
      }}
    >
      {url ? (
        <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div
          style={{
            width: '100%', height: '100%', background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(size * 0.4), fontWeight: 900, color: '#fff',
          }}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  )
}

export type PredictorMatch = {
  id: string
  homePlayerId: string
  awayPlayerId: string
  homeScore: number | null
  awayScore: number | null
  status: 'pending' | 'confirmed' | 'final'
  round: string | null
}

// Penalty shootouts can't meaningfully end in a draw, and the qualifier decider
// doesn't affect standings — forcing a pick on either would block submission on
// a nonsensical choice, so they never appear in the predictor.
const EXCLUDED_ROUNDS = new Set(['penalty', 'final_penalty', 'qualifier_decider'])

function outcomeOf(m: PredictorMatch): PredictionPick | null {
  if (m.homeScore === null || m.awayScore === null) return null
  if (m.homeScore === m.awayScore) return 'draw'
  return m.homeScore > m.awayScore ? 'home' : 'away'
}

type TFunc = (key: string, params?: Record<string, string | number>) => string

function OptionButton({
  option, label, displayPick, isOpen, isCorrect, isWrong, disabled, onPick,
}: {
  option: PredictionPick
  label: string
  displayPick: PredictionPick | null
  isOpen: boolean
  isCorrect: boolean
  isWrong: boolean
  disabled: boolean
  onPick: (pick: PredictionPick) => void
}) {
  const selected = displayPick === option
  const clickable = isOpen && !disabled

  const bg = selected
    ? (isCorrect ? '#16a34a' : isWrong ? '#dc2626' : 'var(--accent)')
    : 'var(--card)'

  return (
    <button
      onClick={() => clickable && onPick(option)}
      disabled={!clickable}
      style={{
        flex: 1,
        padding: '8px 6px',
        borderRadius: 6,
        border: selected ? '1.5px solid transparent' : '1px solid #e5e7eb',
        background: bg,
        color: selected ? '#fff' : 'var(--text)',
        fontSize: 11.5,
        fontWeight: 700,
        cursor: clickable ? 'pointer' : 'default',
        opacity: !isOpen && !selected ? 0.45 : 1,
        minHeight: 36,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function PredictorRow({
  match, homeName, awayName, homeAvatar, awayAvatar, displayPick, isOpen, isSubmittedPending, disabled, onPick, isLast, delay, t,
}: {
  match: PredictorMatch
  homeName: string
  awayName: string
  homeAvatar: string | null | undefined
  awayAvatar: string | null | undefined
  displayPick: PredictionPick | null
  isOpen: boolean
  isSubmittedPending: boolean
  disabled: boolean
  onPick: (pick: PredictionPick) => void
  isLast: boolean
  delay: number
  t: TFunc
}) {
  const isDecided = match.status !== 'pending'
  const outcome = outcomeOf(match)
  const isCorrect = isDecided && displayPick !== null && outcome !== null && displayPick === outcome
  const isWrong = isDecided && displayPick !== null && outcome !== null && displayPick !== outcome

  const homeShort = homeName.split(' ')[0]
  const awayShort = awayName.split(' ')[0]

  return (
    <div
      style={{
        padding: '10px 14px',
        borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
        animation: `predictorFadeIn 0.25s ease ${delay}s both`,
      }}
    >
      {/* Identity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <MiniAvatar url={homeAvatar} name={homeName} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {homeName}
        </span>

        {isDecided ? (
          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {match.homeScore} : {match.awayScore}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--muted2)', fontWeight: 700, flexShrink: 0 }}>vs</span>
        )}

        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
          {awayName}
        </span>
        <MiniAvatar url={awayAvatar} name={awayName} />
      </div>

      {/* Pick row */}
      <div style={{ display: 'flex', gap: 6 }}>
        <OptionButton option="home" label={homeShort} displayPick={displayPick} isOpen={isOpen} isCorrect={isCorrect} isWrong={isWrong} disabled={disabled} onPick={onPick} />
        <OptionButton option="draw" label={t('champ.draw')} displayPick={displayPick} isOpen={isOpen} isCorrect={isCorrect} isWrong={isWrong} disabled={disabled} onPick={onPick} />
        <OptionButton option="away" label={awayShort} displayPick={displayPick} isOpen={isOpen} isCorrect={isCorrect} isWrong={isWrong} disabled={disabled} onPick={onPick} />
      </div>

      {/* Status line */}
      {isDecided && (
        <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 700, color: isCorrect ? '#16a34a' : isWrong ? '#dc2626' : 'var(--muted2)' }}>
          {displayPick === null ? t('champ.predictor.notPredicted') : isCorrect ? `✓ ${t('champ.predictor.correct')} +1` : `✗ ${t('champ.predictor.wrong')}`}
        </div>
      )}
      {isSubmittedPending && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
          🔒 {t('champ.predictor.lockedIn')}
        </div>
      )}
      {isOpen && !displayPick && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#d97706', fontWeight: 600 }}>
          {t('champ.predictor.pickHint')}
        </div>
      )}
      {isOpen && displayPick && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted2)', fontWeight: 600 }}>
          {t('champ.predictor.selectedHint')}
        </div>
      )}
    </div>
  )
}

export function ChampionshipPredictor({
  matches,
  playerMap,
  avatarMap,
}: {
  matches: PredictorMatch[]
  playerMap: Map<string, string>
  avatarMap: Map<string, string | null | undefined>
}) {
  const { t } = useTranslation()
  const [submitted, setSubmitted] = useState<Record<string, PredictionPick>>({})
  const [draft, setDraft] = useState<Record<string, PredictionPick>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedIdsRef = useRef<string>('')

  const predictable = matches.filter((m) => !EXCLUDED_ROUNDS.has(m.round ?? ''))
  const matchIds = predictable.map((m) => m.id)
  const idsKey = matchIds.join(',')

  useEffect(() => {
    if (matchIds.length === 0 || idsKey === loadedIdsRef.current) return
    loadedIdsRef.current = idsKey
    getMyPredictionsAction(matchIds)
      .then((data) => setSubmitted((prev) => ({ ...data, ...prev })))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const handleDraftPick = useCallback((matchId: string, pick: PredictionPick) => {
    setError(null)
    setDraft((d) => ({ ...d, [matchId]: pick }))
  }, [])

  if (predictable.length === 0) return null

  const pendingMatches = predictable.filter((m) => m.status === 'pending')
  const openMatches = pendingMatches.filter((m) => submitted[m.id] === undefined)
  const submittedPendingMatches = pendingMatches.filter((m) => submitted[m.id] !== undefined)
  const decidedMatches = predictable.filter((m) => m.status !== 'pending' && m.homeScore !== null && m.awayScore !== null)
  const correctCount = decidedMatches.filter((m) => submitted[m.id] && submitted[m.id] === outcomeOf(m)).length

  const draftedCount = openMatches.filter((m) => draft[m.id]).length
  const allDrafted = openMatches.length > 0 && draftedCount === openMatches.length

  function handleSubmit() {
    if (!allDrafted || isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    const submissions = openMatches.map((m) => ({ matchId: m.id, pick: draft[m.id] }))
    submitPredictionsAction(submissions)
      .then(() => {
        setSubmitted((prev) => {
          const next = { ...prev }
          for (const s of submissions) next[s.matchId] = s.pick
          return next
        })
        setDraft((d) => {
          const next = { ...d }
          for (const s of submissions) delete next[s.matchId]
          return next
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('champ.predictor.submitError')))
      .finally(() => setIsSubmitting(false))
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PREDICTOR_ANIMS }} />
      <div
        style={{
          marginTop: 16,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          background: 'var(--card)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '11px 14px',
            borderBottom: '1px solid #f3f4f6',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>🎯</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#0f172a', textTransform: 'uppercase' }}>
              {t('champ.predictor.title')}
            </span>
          </div>
          {openMatches.length > 0 ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: allDrafted ? '#16a34a' : '#d97706',
                background: allDrafted ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                padding: '3px 8px',
                borderRadius: 20,
              }}
            >
              {t('champ.predictor.progress', { done: draftedCount, total: openMatches.length })}
            </span>
          ) : decidedMatches.length > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)' }}>
              {correctCount}/{decidedMatches.length} {t('champ.predictor.correct')}
            </span>
          ) : submittedPendingMatches.length > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
              🔒 {t('champ.predictor.lockedIn')}
            </span>
          ) : null}
        </div>

        {error && (
          <div style={{ padding: '8px 14px 0', color: '#dc2626', fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Match rows */}
        <div>
          {predictable.map((m, i) => {
            const isOpen = m.status === 'pending' && submitted[m.id] === undefined
            const isSubmittedPending = m.status === 'pending' && submitted[m.id] !== undefined
            const displayPick = isOpen ? draft[m.id] ?? null : submitted[m.id] ?? null
            return (
              <PredictorRow
                key={m.id}
                match={m}
                homeName={playerMap.get(m.homePlayerId) ?? '?'}
                awayName={playerMap.get(m.awayPlayerId) ?? '?'}
                homeAvatar={avatarMap.get(m.homePlayerId)}
                awayAvatar={avatarMap.get(m.awayPlayerId)}
                displayPick={displayPick}
                isOpen={isOpen}
                isSubmittedPending={isSubmittedPending}
                disabled={isSubmitting}
                onPick={(pick) => handleDraftPick(m.id, pick)}
                isLast={i === predictable.length - 1}
                delay={i * 0.03}
                t={t}
              />
            )
          })}
        </div>

        {/* Submit */}
        {openMatches.length > 0 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid #f3f4f6' }}>
            <button
              onClick={handleSubmit}
              disabled={!allDrafted || isSubmitting}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: allDrafted ? 'var(--accent)' : '#e5e7eb',
                color: allDrafted ? '#fff' : '#9ca3af',
                fontSize: 13,
                fontWeight: 800,
                cursor: allDrafted && !isSubmitting ? 'pointer' : 'default',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {isSubmitting
                ? t('champ.predictor.submitting')
                : allDrafted
                ? t('champ.predictor.submit')
                : t('champ.predictor.submitHint', { done: draftedCount, total: openMatches.length })}
            </button>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '9px 14px',
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.06em' }}>
            {t('champ.predictor.subtitle')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
              {correctCount}
            </span>
            <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, letterSpacing: '0.05em' }}>PTS</span>
          </div>
        </div>
      </div>
    </>
  )
}
