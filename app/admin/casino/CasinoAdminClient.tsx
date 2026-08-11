'use client'

import { useState, useTransition } from 'react'
import { updateCasinoConfigAction } from './actions'
import type { CasinoConfig } from '@/lib/casino/types'

type SessionRow = {
  id:               string
  gameSlug:         string
  playerName:       string
  avatarUrl:        string | null
  betAmount:        number
  payoutMultiplier: number
  winnings:         number
  netChange:        number
  createdAt:        string
}

// ─── Game Config Row ──────────────────────────────────────────────────────────

function ConfigRow({ config }: { config: CasinoConfig }) {
  const [editing, setEditing]     = useState(false)
  const [rtp, setRtp]             = useState(String(config.rtp))
  const [minBet, setMinBet]       = useState(String(config.minBet))
  const [maxBet, setMaxBet]       = useState(String(config.maxBet))
  const [jackpot, setJackpot]     = useState(String(config.jackpotAmount))
  const [active, setActive]       = useState(config.isActive)
  const [isPending, startTx]      = useTransition()
  const [error, setError]         = useState<string | null>(null)
  const [saved, setSaved]         = useState(false)

  async function save() {
    setError(null)
    startTx(async () => {
      try {
        await updateCasinoConfigAction(config.gameSlug, {
          isActive:      active,
          rtp:           Number(rtp),
          minBet:        Number(minBet),
          maxBet:        Number(maxBet),
          jackpotAmount: Number(jackpot),
        })
        setSaved(true)
        setTimeout(() => { setSaved(false); setEditing(false) }, 1200)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  const typeEmoji = { slot: '🎰', roulette: '🎡', dice: '🎲', blackjack: '🃏' }[config.gameType] ?? '🎮'

  return (
    <div style={{
      background: '#1f2937', borderRadius: 12, padding: 16,
      border: `1px solid ${active ? '#374151' : '#DC2626'}`,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: editing ? 16 : 0 }}>
        <span style={{ fontSize: 22 }}>{typeEmoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f9fafb' }}>{config.gameName}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{config.gameSlug}</div>
        </div>

        {/* Active toggle */}
        <button
          onClick={() => setActive(v => !v)}
          style={{
            padding: '4px 12px', borderRadius: 20,
            border: 'none',
            background: active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: active ? '#22C55E' : '#EF4444',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {active ? '✓ Active' : '✕ Disabled'}
        </button>

        <button
          onClick={() => setEditing(v => !v)}
          style={{
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid #374151',
            background: 'transparent', color: '#9ca3af',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {!editing && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8,
        }}>
          {[
            { label: 'RTP', value: `${config.rtp}%` },
            { label: 'Min', value: config.minBet.toLocaleString() },
            { label: 'Max', value: config.maxBet.toLocaleString() },
            { label: 'Jackpot', value: config.jackpotAmount.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: '#111827', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, color: '#9ca3af',
            }}>
              <span style={{ color: '#6b7280' }}>{label}: </span>
              <span style={{ color: '#f9fafb', fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { label: 'RTP (%)', state: rtp, setter: setRtp, step: '0.1', min: '0', max: '100' },
              { label: 'Min Bet', state: minBet, setter: setMinBet, step: '1', min: '1', max: '100000' },
              { label: 'Max Bet', state: maxBet, setter: setMaxBet, step: '1', min: '1', max: '1000000' },
              { label: 'Jackpot', state: jackpot, setter: setJackpot, step: '1000', min: '0', max: '10000000' },
            ] as const).map(({ label, state, setter, step, min, max }) => (
              <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>{label}</span>
                <input
                  type="number"
                  value={state}
                  step={step}
                  min={min}
                  max={max}
                  onChange={e => setter(e.target.value)}
                  style={{
                    padding: '8px 10px', borderRadius: 8,
                    border: '1px solid #374151',
                    background: '#111827', color: '#f9fafb',
                    fontSize: 14, outline: 'none',
                  }}
                />
              </label>
            ))}
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', color: '#EF4444',
              fontSize: 12, fontWeight: 700,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={save}
            disabled={isPending}
            style={{
              padding: '10px', borderRadius: 10, border: 'none',
              background: saved ? '#22C55E' : '#F59E0B',
              color: '#000', fontSize: 13, fontWeight: 800,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Recent Sessions Table ────────────────────────────────────────────────────

function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  if (!sessions.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280', fontSize: 13 }}>
        No casino sessions recorded yet.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #374151' }}>
            {['Time', 'Player', 'Game', 'Bet', 'Win', '×Multi', 'Net'].map(h => (
              <th key={h} style={{
                padding: '8px 10px', textAlign: 'left',
                color: '#6b7280', fontWeight: 700, fontSize: 11,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #1f2937' }}>
              <td style={{ padding: '8px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                {new Date(s.createdAt).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td style={{ padding: '8px 10px', color: '#f9fafb', fontWeight: 700 }}>
                {s.playerName}
              </td>
              <td style={{ padding: '8px 10px', color: '#9ca3af' }}>
                {s.gameSlug}
              </td>
              <td style={{ padding: '8px 10px', color: '#f9fafb' }}>
                {s.betAmount.toLocaleString()}
              </td>
              <td style={{ padding: '8px 10px', color: s.winnings > 0 ? '#22C55E' : '#6b7280', fontWeight: 700 }}>
                {s.winnings.toLocaleString()}
              </td>
              <td style={{ padding: '8px 10px', color: '#F59E0B', fontWeight: 700 }}>
                ×{s.payoutMultiplier.toFixed(s.payoutMultiplier >= 10 ? 0 : 1)}
              </td>
              <td style={{
                padding: '8px 10px',
                color: s.netChange >= 0 ? '#22C55E' : '#EF4444',
                fontWeight: 700,
              }}>
                {s.netChange >= 0 ? '+' : ''}{s.netChange.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Admin Client ────────────────────────────────────────────────────────

type Props = {
  configs:  CasinoConfig[]
  sessions: SessionRow[]
}

export function CasinoAdminClient({ configs, sessions }: Props) {
  const [tab, setTab] = useState<'config' | 'sessions'>('config')

  const totalBet      = sessions.reduce((s, r) => s + r.betAmount, 0)
  const totalWin      = sessions.reduce((s, r) => s + r.winnings, 0)
  const houseEdge     = totalBet - totalWin
  const winCount      = sessions.filter(s => s.winnings > 0).length

  return (
    <div className="admin-casino-page" style={{ padding: 24, color: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f9fafb', marginBottom: 4 }}>
        Casino Management
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 13 }}>
        Configure game parameters and review activity.
      </p>

      {/* Stats overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Sessions',  value: sessions.length, color: '#f9fafb' },
          { label: 'Total Wagered',   value: totalBet.toLocaleString(),   color: '#f9fafb' },
          { label: 'Total Paid Out',  value: totalWin.toLocaleString(),   color: '#22C55E' },
          { label: 'House Net',       value: houseEdge.toLocaleString(),  color: houseEdge >= 0 ? '#F59E0B' : '#EF4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#1f2937', borderRadius: 10, padding: '12px 16px',
            border: '1px solid #374151',
          }}>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['config', 'sessions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: tab === t ? '#F59E0B' : 'rgba(255,255,255,0.05)',
              color: tab === t ? '#000' : '#9ca3af',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t === 'config' ? 'Game Config' : 'Recent Sessions'}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {configs.map(c => <ConfigRow key={c.gameSlug} config={c} />)}
        </div>
      )}

      {tab === 'sessions' && (
        <div style={{
          background: '#1f2937', borderRadius: 12, padding: 16,
          border: '1px solid #374151',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>
            Last {sessions.length} sessions · {winCount} wins
          </div>
          <SessionsTable sessions={sessions} />
        </div>
      )}
    </div>
  )
}
