'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { CreateRivalryModal, type PlayerOption } from './CreateRivalryModal'
import { useTranslation } from '@/lib/i18n/context'
import { BottomNav } from '@/app/components/BottomNav'

type RivalryItem = {
  id: string
  bestOf: number
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
  player1Wins: number
  player2Wins: number
  draws: number
  winnerId: string | null
  winnerName: string | null
  status: 'active' | 'completed'
  createdAt: string
  completedAt: string | null
}

type Props = {
  rivalries: RivalryItem[]
  players: PlayerOption[]
  currentUserId: string
  isAdmin: boolean
}

type Filter = 'all' | 'active' | 'completed'

export function RivalriesListClient({ rivalries, players, currentUserId, isAdmin }: Props) {
  const { t } = useTranslation()
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = rivalries.filter((r) => filter === 'all' || r.status === filter)

  const myRivalryIds = new Set(
    rivalries
      .filter((r) => r.player1Id === currentUserId || r.player2Id === currentUserId)
      .map((r) => r.id)
  )

  return (
    <div className="app-page page-content-wide" style={{ padding: '32px 16px', paddingBottom: 'var(--nav-h)', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{t('rivalry.title')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            {t(rivalries.length !== 1 ? 'rivalry.count.many' : 'rivalry.count.one', { n: rivalries.length })}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '9px 18px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          {t('rivalry.start')}
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'active', 'completed'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: filter === f ? 'var(--text)' : 'var(--card3)',
              color: filter === f ? 'var(--card)' : 'var(--muted)',
            }}
          >
            {t(`rivalry.filter.${f}` as 'rivalry.filter.all' | 'rivalry.filter.active' | 'rivalry.filter.completed')}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted2)', fontSize: 15 }}>
          {t('rivalry.noRivalriesYet')}{' '}
          <button
            onClick={() => setShowCreate(true)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 15, padding: 0 }}
          >
            {t('rivalry.startFirst')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((r) => {
            const isMine = myRivalryIds.has(r.id)
            const totalMatches = r.player1Wins + r.player2Wins + r.draws
            return (
              <Link key={r.id} href={`/rivalries/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div
                  style={{
                    border: `1px solid ${isMine ? 'rgba(var(--rgb-accent),0.25)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '14px 18px',
                    background: isMine ? 'rgba(var(--rgb-accent),0.06)' : 'var(--card)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Players + score row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    {/* Player 1 */}
                    <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 15, fontWeight: 700, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'block',
                          ...(r.winnerId === r.player1Id ? { color: 'var(--gold)' } : {}),
                        }}
                      >
                        {r.winnerId === r.player1Id && <Trophy size={13} style={{ color: 'var(--gold)', marginRight: 4, verticalAlign: 'middle' }} />}
                        {r.player1Name}
                      </span>
                    </div>

                    {/* Score */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        minWidth: 80, justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', minWidth: 24, textAlign: 'right' }}>
                        {r.player1Wins}
                      </span>
                      <span style={{ color: 'var(--muted2)', fontWeight: 700, fontSize: 16 }}>–</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', minWidth: 24, textAlign: 'left' }}>
                        {r.player2Wins}
                      </span>
                    </div>

                    {/* Player 2 */}
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 15, fontWeight: 700, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'block',
                          ...(r.winnerId === r.player2Id ? { color: 'var(--gold)' } : {}),
                        }}
                      >
                        {r.winnerId === r.player2Id && <Trophy size={13} style={{ color: 'var(--gold)', marginRight: 4, verticalAlign: 'middle' }} />}
                        {r.player2Name}
                      </span>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: 12, color: 'var(--muted)',
                    }}
                  >
                    <span>{t('rivalry.scoreMeta', { target: r.bestOf, played: totalMatches })}</span>
                    <span
                      style={{
                        padding: '2px 9px', borderRadius: 20, fontWeight: 700, fontSize: 11,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        background: 'rgba(34,197,94,0.12)', color: 'var(--win)',
                      }}
                    >
                      {t('rivalry.activeBadge')}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateRivalryModal players={players} onClose={() => setShowCreate(false)} />
      )}
      <BottomNav userId={currentUserId} />
    </div>
  )
}
