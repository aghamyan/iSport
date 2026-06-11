'use client'

import { useState, useTransition } from 'react'
import { fetchH2HAction } from '../actions'
import type { H2HRecord } from '@/lib/stats/types'
import { useTranslation } from '@/lib/i18n/context'

type Opponent = { id: string; name: string }

type Props = {
  playerId: string
  opponents: Opponent[]
}

type LoadState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; data: H2HRecord | null }

function H2HRow({ playerId, opponent }: { playerId: string; opponent: Opponent }) {
  const { t } = useTranslation()
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [isPending, startTransition] = useTransition()

  function toggle() {
    if (state.status !== 'idle') {
      setState({ status: 'idle' })
      return
    }
    setState({ status: 'loading' })
    startTransition(async () => {
      const data = await fetchH2HAction(playerId, opponent.id)
      setState({ status: 'done', data })
    })
  }

  const isOpen = state.status === 'loading' || state.status === 'done'

  return (
    <div
      style={{
        border: '1px solid #e5e7eb', borderRadius: 10,
        overflow: 'hidden', background: '#fff',
      }}
    >
      <button
        onClick={toggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '11px 14px',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', gap: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
          vs {opponent.name}
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af', transition: 'transform 0.15s' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            borderTop: '1px solid #f3f4f6',
            padding: '14px 16px',
            background: '#fafafa',
          }}
        >
          {state.status === 'loading' || isPending ? (
            <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
              {t('common.loading')}
            </div>
          ) : state.status === 'done' && state.data ? (
            <H2HStats playerId={playerId} record={state.data} opponentName={opponent.name} />
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

function H2HStats({
  playerId,
  record,
  opponentName,
}: {
  playerId: string
  record: H2HRecord
  opponentName: string
}) {
  const { t } = useTranslation()
  // player1 in the record is whoever was passed as player1Id (= our player)
  const myWins    = record.player1Wins
  const theirWins = record.player2Wins
  const draws     = record.draws
  const total     = record.totalMatches
  const myGoals   = record.player1Goals
  const theirGoals = record.player2Goals

  const myPct   = total > 0 ? Math.round((myWins / total) * 100) : 0
  const theirPct = total > 0 ? Math.round((theirWins / total) * 100) : 0

  return (
    <div>
      {/* Win bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
          gap: 8, alignItems: 'center', fontSize: 13,
        }}
      >
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

      <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        {t(total !== 1 ? 'h2h.goalsLine.many' : 'h2h.goalsLine.one', { a: myGoals, b: theirGoals, n: total })}
      </div>
    </div>
  )
}

export function H2HSection({ playerId, opponents }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {opponents.map((opp) => (
        <H2HRow key={opp.id} playerId={playerId} opponent={opp} />
      ))}
    </div>
  )
}
