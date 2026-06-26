'use client'

import { useState, useEffect, useCallback } from 'react'
import { getChampionshipWinnerOddsAction, type ChampionshipWinnerEntry } from './actions'
import { useTranslation } from '@/lib/i18n/context'

const ODDS_ANIMS = `
  @keyframes oddsBarGrow {
    from { width: 0 !important; }
  }
  @keyframes oddsFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes oddsPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
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

function MiniAvatar({ url, name, size = 32 }: { url: string | null | undefined; name: string; size?: number }) {
  const bg = nameToColor(name)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
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
            fontSize: Math.round(size * 0.36), fontWeight: 900, color: '#fff',
          }}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  )
}

export function ChampionshipWinnerOdds({
  championshipId,
  playerIds,
  playerMap,
  avatarMap,
  completedMatchCount,
}: {
  championshipId: string
  playerIds: string[]
  playerMap: Map<string, string>
  avatarMap: Map<string, string | null | undefined>
  completedMatchCount: number
}) {
  const { t } = useTranslation()
  const [data, setData] = useState<ChampionshipWinnerEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getChampionshipWinnerOddsAction(championshipId, playerIds)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [championshipId, playerIds])

  useEffect(() => {
    if (completedMatchCount > 0) load()
  }, [completedMatchCount]) // eslint-disable-line react-hooks/exhaustive-deps

  if (completedMatchCount === 0) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ODDS_ANIMS }} />
      <div
        style={{
          marginTop: 16,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          background: '#ffffff',
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
            <span style={{ fontSize: 14 }}>🏆</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#0f172a', textTransform: 'uppercase' }}>
              {t('champ.winnerOdds.title')}
            </span>
            {loading && (
              <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, animation: 'oddsPulse 1s ease infinite' }}>
                {t('champ.winnerOdds.updating')}
              </span>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              color: '#6b7280',
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              padding: '3px 9px',
              lineHeight: 1,
            }}
          >
            {loading ? '…' : '↻'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', color: '#dc2626', fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Player rows */}
        {data && data.length > 0 && (
          <div>
            {data.map((entry, rank) => {
              const name = playerMap.get(entry.playerId) ?? '?'
              const url = avatarMap.get(entry.playerId)
              const pct = Math.round(entry.winProbability * 100)
              const isLeader = rank === 0
              const isEliminated = entry.winProbability < 0.005

              return (
                <div
                  key={entry.playerId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '11px 14px',
                    gap: 10,
                    borderBottom: rank < data.length - 1 ? '1px solid #f3f4f6' : 'none',
                    background: isLeader ? '#fffbeb' : '#ffffff',
                    borderLeft: isLeader ? '3px solid #d97706' : '3px solid transparent',
                    animation: `oddsFadeIn 0.3s ease ${rank * 0.05}s both`,
                    opacity: isEliminated ? 0.45 : 1,
                  }}
                >
                  {/* Rank badge */}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: isLeader ? '#d97706' : '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 900,
                      color: isLeader ? '#fff' : '#6b7280',
                      flexShrink: 0,
                    }}
                  >
                    {rank + 1}
                  </div>

                  {/* Avatar */}
                  <MiniAvatar url={url} name={name} size={30} />

                  {/* Name + bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: isLeader ? 700 : 500,
                      color: isLeader ? '#0f172a' : '#374151',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: 5,
                    }}>
                      {name}
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: '#f3f4f6', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 2,
                          background: isLeader
                            ? '#d97706'
                            : isEliminated
                            ? '#e5e7eb'
                            : '#1d4ed8',
                          animation: 'oddsBarGrow 0.7s ease both',
                        }}
                      />
                    </div>
                  </div>

                  {/* % + odds */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{
                      fontSize: 16,
                      fontWeight: 900,
                      lineHeight: 1,
                      color: isLeader ? '#d97706' : isEliminated ? '#9ca3af' : '#1d4ed8',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {pct}%
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {isEliminated ? '—' : `× ${entry.impliedOdds.toFixed(2)}`}
                    </div>
                  </div>

                  {/* Points badge */}
                  <div
                    style={{
                      flexShrink: 0,
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '4px 8px',
                      textAlign: 'center',
                      minWidth: 36,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {entry.currentPoints}
                    </div>
                    <div style={{ fontSize: 8, color: '#9ca3af', fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>
                      PTS
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        {data && (
          <div style={{
            padding: '7px 14px',
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}>
            <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.06em' }}>
              {t('champ.winnerOdds.based').replace('{n}', String(completedMatchCount))}
            </span>
            <span style={{ fontSize: 9, color: '#d1d5db', fontWeight: 600 }}>
              {t('champ.winnerOdds.forecast')}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
