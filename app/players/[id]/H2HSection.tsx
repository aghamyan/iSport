'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { fetchH2HAction, fetchH2HMatchesAction } from '../actions'
import type { H2HRecord, H2HMatchEntry } from '@/lib/stats/types'
import { useTranslation } from '@/lib/i18n/context'

type Player = { id: string; name: string }

type Props = {
  playerId: string
  playerName: string
  allPlayers: Player[]
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; record: H2HRecord | null; matches: H2HMatchEntry[] }

function FormPip({ result }: { result: 'W' | 'D' | 'L' }) {
  const colors = { W: '#16a34a', D: '#6b7280', L: '#dc2626' }
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 5,
        background: colors[result], color: '#fff',
        fontSize: 10, fontWeight: 800, flexShrink: 0,
      }}
    >
      {result}
    </span>
  )
}

function H2HStats({
  record,
  playerName,
  opponentName,
}: {
  record: H2HRecord
  playerName: string
  opponentName: string
}) {
  const { t } = useTranslation()
  const { player1Wins: myWins, player2Wins: theirWins, draws, totalMatches: total,
          player1Goals: myGoals, player2Goals: theirGoals } = record

  const myPct    = total > 0 ? Math.round((myWins / total) * 100) : 0
  const theirPct = total > 0 ? Math.round((theirWins / total) * 100) : 0

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Name labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
        <span>{playerName}</span>
        <span>{opponentName}</span>
      </div>

      {/* Win bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', width: 28, textAlign: 'right' }}>
          {myWins}W
        </div>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden', display: 'flex' }}>
          {total > 0 && (
            <>
              <div style={{ width: `${myPct}%`, background: '#16a34a', transition: 'width 0.3s' }} />
              {draws > 0 && (
                <div style={{ width: `${Math.round((draws / total) * 100)}%`, background: '#d1d5db' }} />
              )}
              <div style={{ width: `${theirPct}%`, background: '#dc2626', transition: 'width 0.3s' }} />
            </>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', width: 28 }}>
          {theirWins}W
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', fontSize: 13 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#111827' }}>{myWins}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{t('h2h.wins')}</div>
        </div>
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: '#6b7280', fontSize: 13 }}>{draws}</div>
          <div>{t('h2h.draws')}</div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#111827' }}>{theirWins}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{t('h2h.opponentWins', { name: opponentName })}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        {t(total !== 1 ? 'h2h.goalsLine.many' : 'h2h.goalsLine.one', { a: myGoals, b: theirGoals, n: total })}
      </div>
    </div>
  )
}

function MatchHistoryList({
  matches,
  playerName,
  opponentName,
  playerId,
}: {
  matches: H2HMatchEntry[]
  playerName: string
  opponentName: string
  playerId: string
}) {
  const { t } = useTranslation()

  if (matches.length === 0) {
    return (
      <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
        {t('h2h.noMatches')}
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {t('h2h.matchHistory')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {matches.map((m) => {
          const result: 'W' | 'D' | 'L' =
            m.p1Score > m.p2Score ? 'W' : m.p1Score < m.p2Score ? 'L' : 'D'
          return (
            <div
              key={m.matchId}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${result === 'W' ? '#dcfce7' : result === 'L' ? '#fee2e2' : '#f3f4f6'}`,
                background: result === 'W' ? '#f0fdf4' : result === 'L' ? '#fef2f2' : '#fafafa',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FormPip result={result} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    {playerName} vs {opponentName}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                    {m.matchType === 'championship'
                      ? `${t('player.matchType.championship')}${m.championshipName ? ` · ${m.championshipName}` : ''}`
                      : t('home.friendly')}
                    {' · '}
                    {new Date(m.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#111827', flexShrink: 0 }}>
                {m.p1Score} – {m.p2Score}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function H2HSection({ playerId, playerName, allPlayers }: Props) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string>('')
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [isPending, startTransition] = useTransition()

  function handleSelect(opponentId: string) {
    setSelectedId(opponentId)
    if (!opponentId) {
      setState({ status: 'idle' })
      return
    }
    setState({ status: 'loading' })
    startTransition(async () => {
      const [record, matches] = await Promise.all([
        fetchH2HAction(playerId, opponentId),
        fetchH2HMatchesAction(playerId, opponentId),
      ])
      setState({ status: 'done', record, matches })
    })
  }

  const selectedOpponent = allPlayers.find((p) => p.id === selectedId)

  return (
    <div>
      {/* Player picker */}
      <select
        value={selectedId}
        onChange={(e) => handleSelect(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          border: '1px solid #e5e7eb', background: '#fff',
          fontSize: 14, color: '#111827', cursor: 'pointer',
          marginBottom: state.status !== 'idle' ? 12 : 0,
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: 32,
        }}
      >
        <option value="">{t('h2h.selectOpponent')}</option>
        {allPlayers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Results panel */}
      {(state.status === 'loading' || isPending) && (
        <div style={{
          border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '20px 16px', background: '#fafafa',
          fontSize: 13, color: '#9ca3af', textAlign: 'center',
        }}>
          {t('common.loading')}
        </div>
      )}

      {state.status === 'done' && selectedOpponent && (
        <div style={{
          border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '14px 16px', background: '#fafafa',
        }}>
          {state.record ? (
            <>
              <H2HStats
                record={state.record}
                playerName={playerName}
                opponentName={selectedOpponent.name}
              />
              <MatchHistoryList
                matches={state.matches}
                playerName={playerName}
                opponentName={selectedOpponent.name}
                playerId={playerId}
              />
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
              {t('h2h.noMatches')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
