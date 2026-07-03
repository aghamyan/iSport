'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import Image from 'next/image'
import { getCasinoLeaderboardAction, getPlayerCasinoStatsAction } from '@/app/casino/actions'
import type { CasinoLeaderboardEntry, CasinoPlayerStats } from '@/lib/casino/types'

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export function CasinoLeaderboard() {
  const [entries, setEntries] = useState<CasinoLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCasinoLeaderboardAction(20)
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [])

  function fmt(n: number) { return n.toLocaleString() }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        Loading leaderboard…
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        No big wins recorded yet — be the first! 🏆
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 80px 80px 64px',
        gap: 8, padding: '8px 12px',
        fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        <div>#</div>
        <div>Player</div>
        <div style={{ textAlign: 'right' }}>Won</div>
        <div style={{ textAlign: 'right' }}>Bet</div>
        <div style={{ textAlign: 'right' }}>×Multi</div>
      </div>

      {entries.map((e, i) => {
        const rankColor = i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.2)'
        const rankBg    = i === 0 ? 'rgba(245,158,11,0.15)' : i === 1 ? 'rgba(156,163,175,0.1)' : i === 2 ? 'rgba(205,127,50,0.1)' : 'rgba(255,255,255,0.03)'

        return (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 80px 80px 64px',
              gap: 8, padding: '10px 12px',
              background: rankBg,
              border: `1px solid ${rankColor}30`,
              borderRadius: 12, alignItems: 'center',
            }}
          >
            {/* Rank */}
            <div style={{
              fontSize: 14, fontWeight: 900, color: rankColor,
              textAlign: 'center',
            }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </div>

            {/* Player */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {e.avatarUrl ? (
                <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                  <Image src={e.avatarUrl} alt={e.playerName} width={30} height={30} style={{ objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>
                  🎰
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: '#fff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {e.playerName}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  {e.gameName}
                </div>
              </div>
            </div>

            {/* Winnings */}
            <div style={{
              fontSize: 12, fontWeight: 800, color: '#22C55E',
              textAlign: 'right',
            }}>
              +{fmt(e.winnings)}
            </div>

            {/* Bet */}
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.5)',
              textAlign: 'right',
            }}>
              {fmt(e.betAmount)}
            </div>

            {/* Multiplier */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#F59E0B',
              textAlign: 'right',
            }}>
              ×{e.payoutMultiplier >= 10 ? Math.round(e.payoutMultiplier) : e.payoutMultiplier.toFixed(1)}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Player Stats ─────────────────────────────────────────────────────────────

export function PlayerCasinoStats({ userId }: { userId: string }) {
  const [stats, setStats]   = useState<CasinoPlayerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlayerCasinoStatsAction(userId)
      .then(setStats)
      .finally(() => setLoading(false))
  }, [userId])

  function fmt(n: number) { return n.toLocaleString() }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        Loading stats…
      </div>
    )
  }

  if (!stats || stats.gamesPlayed === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        No casino games played yet.
      </div>
    )
  }

  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.winCount / stats.gamesPlayed) * 100) : 0
  const netColor = stats.netChange >= 0 ? '#22C55E' : '#EF4444'

  const STAT_GRID = [
    { label: 'Games Played',   value: fmt(stats.gamesPlayed),  color: '#fff' },
    { label: 'Win Rate',       value: `${winRate}%`,           color: winRate >= 40 ? '#22C55E' : '#EF4444' },
    { label: 'Total Wagered',  value: fmt(stats.totalWagered), color: '#fff' },
    { label: 'Total Won',      value: fmt(stats.totalWon),     color: '#22C55E' },
    { label: 'Net Change',     value: `${stats.netChange >= 0 ? '+' : ''}${fmt(stats.netChange)}`, color: netColor },
    { label: 'Biggest Win',    value: fmt(stats.biggestWin),   color: '#F59E0B' },
    { label: 'Best Multiplier',value: `×${stats.biggestMulti >= 10 ? Math.round(stats.biggestMulti) : stats.biggestMulti.toFixed(1)}`, color: '#F59E0B' },
    { label: 'Jackpots Won',   value: fmt(stats.jackpotsWon),  color: '#A78BFA' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {stats.favoriteGame && (
        <div style={{
          padding: '8px 14px', borderRadius: 10,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
          fontSize: 12, color: 'rgba(255,255,255,0.7)',
        }}>
          🎰 Favorite game: <strong style={{ color: '#F59E0B' }}>{stats.favoriteGame}</strong>
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
      }}>
        {STAT_GRID.map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
