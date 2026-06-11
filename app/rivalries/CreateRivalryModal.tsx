'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createRivalryAction } from './actions'
import { useTranslation } from '@/lib/i18n/context'

export type PlayerOption = { id: string; name: string }

type Props = {
  players: PlayerOption[]
  onClose: () => void
}

export function CreateRivalryModal({ players, onClose }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [opponentId, setOpponentId] = useState('')
  const [bestOf, setBestOf] = useState(5)
  const [withHistory, setWithHistory] = useState(false)
  const [myWins, setMyWins] = useState(0)
  const [draws, setDraws] = useState(0)
  const [opponentWins, setOpponentWins] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!opponentId) { setError(t('rivalry.create.errSelectOpponent')); return }
    if (withHistory) {
      if (myWins < 0 || opponentWins < 0 || draws < 0) {
        setError(t('rivalry.create.errNegative')); return
      }
    }
    setError(null)
    startTransition(async () => {
      try {
        const { id } = await createRivalryAction(opponentId, bestOf, withHistory ? {
          myWins,
          opponentWins,
          draws,
        } : undefined)
        router.push(`/rivalries/${id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('rivalry.create.errFailed'))
      }
    })
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 7,
    border: '1px solid #d1d5db', fontSize: 14, color: '#111827',
    background: '#fff', boxSizing: 'border-box' as const,
  }

  const numInputStyle = {
    width: 72, padding: '8px 10px', borderRadius: 7,
    border: '1px solid #d1d5db', fontSize: 16, color: '#111827',
    textAlign: 'center' as const, fontWeight: 700,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14, padding: 28,
          width: 420, maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
          {t('rivalry.create.title')}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Opponent */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {t('rivalry.create.opponentLabel')}
            </label>
            <select
              value={opponentId}
              onChange={(e) => setOpponentId(e.target.value)}
              style={inputStyle}
            >
              <option value="">{t('rivalry.create.opponentPlaceholder')}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Target score */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {t('rivalry.create.scoreLabel')}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={1}
                max={999}
                value={bestOf}
                onChange={(e) => setBestOf(Number(e.target.value))}
                style={{ width: 80, padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', textAlign: 'center' }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                {t('rivalry.create.scoreSub')}
              </span>
            </div>
          </div>

          {/* Prior history toggle */}
          <div
            style={{
              marginBottom: withHistory ? 16 : 20,
              padding: '12px 14px',
              borderRadius: 10,
              background: withHistory ? '#eff6ff' : '#f9fafb',
              border: `1px solid ${withHistory ? '#bfdbfe' : '#e5e7eb'}`,
              cursor: 'pointer',
            }}
            onClick={() => setWithHistory((v) => !v)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  {t('rivalry.create.alreadyPlayed')}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {t('rivalry.create.importH2H')}
                </div>
              </div>
              {/* Toggle switch */}
              <div
                style={{
                  width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                  background: withHistory ? '#2563eb' : '#d1d5db',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div
                  style={{
                    position: 'absolute', top: 3,
                    left: withHistory ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Pre-existing scores */}
          {withHistory && opponentId && (
            <div
              style={{
                marginBottom: 20, padding: '16px 14px',
                border: '1px solid #bfdbfe', borderRadius: 10, background: '#f0f7ff',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('rivalry.create.existingRecord')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {/* My wins */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>
                    {t('rivalry.create.youLabel')}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={myWins}
                    onChange={(e) => setMyWins(Math.max(0, Number(e.target.value)))}
                    onClick={(e) => e.stopPropagation()}
                    style={numInputStyle}
                  />
                </div>

                <span style={{ color: '#9ca3af', fontWeight: 700, fontSize: 18, marginTop: 18 }}>–</span>

                {/* Draws */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>
                    {t('rivalry.create.drawsLabel')}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={draws}
                    onChange={(e) => setDraws(Math.max(0, Number(e.target.value)))}
                    onClick={(e) => e.stopPropagation()}
                    style={numInputStyle}
                  />
                </div>

                <span style={{ color: '#9ca3af', fontWeight: 700, fontSize: 18, marginTop: 18 }}>–</span>

                {/* Opponent wins */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>
                    {players.find((p) => p.id === opponentId)?.name ?? 'Opponent'}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={opponentWins}
                    onChange={(e) => setOpponentWins(Math.max(0, Number(e.target.value)))}
                    onClick={(e) => e.stopPropagation()}
                    style={numInputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: '#3b82f6', textAlign: 'center' }}>
                {(() => {
                  const total = myWins + draws + opponentWins
                  return total === 1
                    ? t('rivalry.create.gamesPlayed.one')
                    : t('rivalry.create.gamesPlayed.many', { n: total })
                })()}
              </div>
            </div>
          )}

          {withHistory && !opponentId && (
            <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: '#fafafa', border: '1px dashed #d1d5db', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
              {t('rivalry.create.selectOpponent')}
            </div>
          )}

          {error && (
            <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 14px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: '8px 18px', border: '1px solid #d1d5db',
                borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14,
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '8px 20px',
                background: isPending ? '#93c5fd' : '#2563eb',
                color: '#fff', border: 'none', borderRadius: 7,
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
              }}
            >
              {isPending ? t('rivalry.create.creating') : t('rivalry.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
