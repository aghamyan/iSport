'use client'

import { useState, useEffect, useCallback } from 'react'
import { getChampionshipWinnerOddsAction, type ChampionshipWinnerEntry } from './actions'
import { useTranslation } from '@/lib/i18n/context'

const ODDS_ANIMS = `
  @keyframes oddsBarGrow {
    from { width: 0 !important; }
  }
  @keyframes oddsFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes oddsPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.55; }
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
        border: '1.5px solid rgba(255,255,255,0.08)',
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
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getChampionshipWinnerOddsAction(championshipId, playerIds)
      setData(result)
      setLastUpdated(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [championshipId, playerIds])

  // Auto-load when there are completed matches
  useEffect(() => {
    if (completedMatchCount > 0) load()
  }, [completedMatchCount]) // eslint-disable-line react-hooks/exhaustive-deps

  if (completedMatchCount === 0) return null

  const leader = data?.[0]
  const totalPct = data?.reduce((s, d) => s + d.winProbability, 0) ?? 1

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ODDS_ANIMS }} />
      <div
        style={{
          marginTop: 16,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid #1a2840',
          background: '#080f1c',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid #0f1a2e',
            background: 'linear-gradient(90deg, rgba(251,191,36,0.06), transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13 }}>🏆</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: '#fbbf24',
                textTransform: 'uppercase',
              }}
            >
              {t('champ.winnerOdds.title')}
            </span>
            {loading && (
              <span
                style={{
                  fontSize: 9,
                  color: '#475569',
                  fontWeight: 600,
                  animation: 'oddsPulse 1s ease infinite',
                }}
              >
                {t('champ.winnerOdds.updating')}
              </span>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: 'none',
              border: '1px solid #1a2840',
              borderRadius: 6,
              color: '#475569',
              fontSize: 10,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              padding: '3px 8px',
              letterSpacing: '0.06em',
            }}
          >
            {loading ? '…' : '↻'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', color: '#f87171', fontSize: 12 }}>
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
                    padding: '9px 14px',
                    gap: 10,
                    borderBottom: rank < data.length - 1 ? '1px solid #0a1220' : 'none',
                    background: isLeader
                      ? 'linear-gradient(90deg, rgba(251,191,36,0.05), transparent)'
                      : 'transparent',
                    animation: `oddsFadeIn 0.3s ease ${rank * 0.05}s both`,
                    opacity: isEliminated ? 0.45 : 1,
                  }}
                >
                  {/* Rank */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: isLeader
                        ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                        : '#0f1a2e',
                      border: isLeader ? 'none' : '1px solid #1a2840',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 900,
                      color: isLeader ? '#fff' : '#475569',
                      flexShrink: 0,
                    }}
                  >
                    {rank + 1}
                  </div>

                  {/* Avatar */}
                  <MiniAvatar url={url} name={name} size={30} />

                  {/* Name + bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isLeader ? '#f8fafc' : '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: 4,
                      }}
                    >
                      {name}
                    </div>
                    {/* Probability bar */}
                    <div
                      style={{
                        height: 4,
                        borderRadius: 2,
                        background: '#0f1a2e',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 2,
                          background: isLeader
                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            : isEliminated
                            ? '#1a2840'
                            : 'linear-gradient(90deg, #1d4ed8, #3b82f6)',
                          animation: 'oddsBarGrow 0.7s ease both',
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        lineHeight: 1,
                        color: isLeader ? '#fbbf24' : isEliminated ? '#334155' : '#60a5fa',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {pct}%
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#334155',
                        marginTop: 2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isEliminated ? '—' : `× ${entry.impliedOdds.toFixed(2)}`}
                    </div>
                  </div>

                  {/* Points badge */}
                  <div
                    style={{
                      flexShrink: 0,
                      background: '#0c1422',
                      border: '1px solid #1a2840',
                      borderRadius: 6,
                      padding: '3px 7px',
                      textAlign: 'center',
                      minWidth: 36,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#e2e8f0', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {entry.currentPoints}
                    </div>
                    <div style={{ fontSize: 8, color: '#334155', fontWeight: 700, letterSpacing: '0.05em', marginTop: 1 }}>
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
          <div
            style={{
              padding: '7px 14px',
              borderTop: '1px solid #0a1220',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 9, color: '#334155', fontWeight: 600, letterSpacing: '0.06em' }}>
              {t('champ.winnerOdds.based').replace('{n}', String(completedMatchCount))}
            </span>
            <span style={{ fontSize: 9, color: '#1a2840', fontWeight: 600 }}>
              {t('champ.winnerOdds.forecast')}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
