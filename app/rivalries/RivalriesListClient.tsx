'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CreateRivalryModal, type PlayerOption } from './CreateRivalryModal'
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
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = rivalries.filter((r) => filter === 'all' || r.status === filter)

  const myRivalryIds = new Set(
    rivalries
      .filter((r) => r.player1Id === currentUserId || r.player2Id === currentUserId)
      .map((r) => r.id)
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111827' }}>Rivalries</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {rivalries.length} rivalry{rivalries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '9px 18px', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          + Start Rivalry
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
              background: filter === f ? '#111827' : '#f3f4f6',
              color: filter === f ? '#fff' : '#6b7280',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 15 }}>
          No rivalries yet.{' '}
          <button
            onClick={() => setShowCreate(true)}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 15, padding: 0 }}
          >
            Start the first one.
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
                    border: `1px solid ${isMine ? '#bfdbfe' : '#e5e7eb'}`,
                    borderRadius: 12, padding: '14px 18px',
                    background: isMine ? '#eff6ff' : '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Players + score row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    {/* Player 1 */}
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: 15, fontWeight: 700, color: '#111827',
                          ...(r.winnerId === r.player1Id ? { color: '#d97706' } : {}),
                        }}
                      >
                        {r.player1Name}
                        {r.winnerId === r.player1Id && ' 🏆'}
                      </span>
                    </div>

                    {/* Score */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        minWidth: 80, justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#111827', minWidth: 24, textAlign: 'right' }}>
                        {r.player1Wins}
                      </span>
                      <span style={{ color: '#9ca3af', fontWeight: 700, fontSize: 16 }}>–</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#111827', minWidth: 24, textAlign: 'left' }}>
                        {r.player2Wins}
                      </span>
                    </div>

                    {/* Player 2 */}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <span
                        style={{
                          fontSize: 15, fontWeight: 700, color: '#111827',
                          ...(r.winnerId === r.player2Id ? { color: '#d97706' } : {}),
                        }}
                      >
                        {r.winnerId === r.player2Id && '🏆 '}
                        {r.player2Name}
                      </span>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: 12, color: '#6b7280',
                    }}
                  >
                    <span>Score to win: {r.bestOf} · {totalMatches} day{totalMatches !== 1 ? 's' : ''} played</span>
                    <span
                      style={{
                        padding: '2px 9px', borderRadius: 20, fontWeight: 700, fontSize: 11,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        background: '#dcfce7', color: '#16a34a',
                      }}
                    >
                      Active
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
