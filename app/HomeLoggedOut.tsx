'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { NamedPlayerStats, ChampionshipLeader } from '@/lib/stats/types'
import type { RivalryItem } from './HomeLoggedIn'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  players: NamedPlayerStats[]
  champLeaders: ChampionshipLeader[]
  rivalries: RivalryItem[]
}

type Tab = 'stats' | 'rivalries'

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG     = '#070c18'
const CARD   = '#0f1828'
const BORDER = '#1e2d45'
const ACCENT = '#3b82f6'
const TEXT   = '#f1f5f9'
const MUTED  = '#4b5a73'
const WIN    = '#16a34a'
const LOSS   = '#dc2626'

// ─── Root component ───────────────────────────────────────────────────────────

export function HomeLoggedOut({ players, champLeaders, rivalries }: Props) {
  const [tab, setTab] = useState<Tab>('stats')

  const top        = players.slice(0, 8)
  const activeChamps = champLeaders.filter((c) => c.isActive)

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: 'system-ui, sans-serif', color: TEXT }}>

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: CARD, borderBottom: `1px solid ${BORDER}`,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>
          <span style={{ color: TEXT }}>i</span><span style={{ color: ACCENT }}>Sport</span>
        </div>
        <Link href="/login" style={{
          padding: '8px 18px', background: ACCENT, color: '#fff',
          borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          Login
        </Link>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '36px 20px 32px',
        background: 'linear-gradient(160deg, #0f2545 0%, #1a0a3e 55%, #0d1a35 100%)',
        borderBottom: `1px solid ${BORDER}`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 10, lineHeight: 1 }}>⚽</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', color: TEXT }}>
          FC26 Tracker
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 15, color: '#94a3b8', maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
          Track matches, championships &amp; rivalries with your squad
        </p>
        <Link href="/login" style={{
          display: 'inline-block',
          padding: '13px 36px',
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: '#fff', borderRadius: 12, fontWeight: 800, fontSize: 16,
          textDecoration: 'none', boxShadow: '0 4px 24px rgba(37,99,235,0.45)',
        }}>
          Get Started →
        </Link>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        background: CARD, borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 57, zIndex: 30,
      }}>
        {([['stats', 'Stats'], ['rivalries', 'Rivalries']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '13px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === id ? ACCENT : 'transparent'}`,
            marginBottom: -1, cursor: 'pointer',
            fontSize: 14, fontWeight: 700,
            color: tab === id ? ACCENT : MUTED,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 60px' }}>

        {/* ══ Stats tab ══════════════════════════════════════════════ */}
        {tab === 'stats' && (
          <>
            {/* Leaderboard */}
            <SectionHeader label="Leaderboard" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
              {top.length === 0 && (
                <Empty text="No players yet." />
              )}
              {top.map((p, i) => (
                <div key={p.id} style={{
                  ...(i === 0
                    ? { background: '#150e00', border: '1px solid #f59e0b44' }
                    : { background: CARD, border: `1px solid ${BORDER}` }),
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <RankBadge rank={i + 1} />
                  <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED }}>
                      {p.matchesPlayed} matches
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                    <MiniStat label="W" value={p.wins} color={WIN} />
                    <MiniStat
                      label="GD"
                      value={p.goalDiff > 0 ? `+${p.goalDiff}` : p.goalDiff}
                      color={p.goalDiff > 0 ? WIN : p.goalDiff < 0 ? LOSS : MUTED}
                    />
                    <MiniStat label="Win%" value={`${Math.round(p.winRate * 100)}%`} color={TEXT} />
                  </div>
                </div>
              ))}
            </div>

            {/* Active championships */}
            {activeChamps.length > 0 && (
              <>
                <SectionHeader label="Active Championships" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                  {activeChamps.map((c) => (
                    <div key={c.championshipId} style={{
                      background: '#150e00', border: '1px solid #f59e0b33',
                      borderRadius: 10, padding: '14px 16px',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', marginBottom: 10 }}>
                        {c.championshipName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>🏆</span>
                        <PlayerAvatar name={c.playerName} avatarUrl={c.avatarUrl} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.playerName}
                          </div>
                          <div style={{ fontSize: 11, color: '#b45309' }}>Current leader</div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                          <MiniStat label="Pts" value={c.points}   color="#f59e0b" />
                          <MiniStat label="W"   value={c.wins}     color={WIN} />
                          <MiniStat label="Pld" value={c.played}   color={TEXT} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ══ Rivalries tab ══════════════════════════════════════════ */}
        {tab === 'rivalries' && (
          <>
            <SectionHeader label="Active Rivalries" />
            {rivalries.length === 0 && <Empty text="No active rivalries." />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rivalries.map((r) => (
                <div key={r.id} style={{
                  background: CARD, border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: TEXT, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.player1Name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 70, justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: TEXT }}>{r.player1Wins}</span>
                      <span style={{ color: MUTED, fontWeight: 700 }}>–</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: TEXT }}>{r.player2Wins}</span>
                    </div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.player2Name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: MUTED }}>
                    First to {r.bestOf} · {r.player1Wins + r.player2Wins} played
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Sticky bottom CTA ─────────────────────────────────────── */}
      <div style={{
        position: 'sticky', bottom: 0,
        background: CARD, borderTop: `1px solid ${BORDER}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <span style={{ fontSize: 13, color: MUTED }}>Join the league</span>
        <Link href="/login" style={{
          padding: '9px 22px', background: ACCENT, color: '#fff',
          borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          Login →
        </Link>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: MUTED,
      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
    }}>
      {label}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
      {text}
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const label = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank
  const color = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7c3a' : MUTED
  return (
    <div style={{ minWidth: 22, textAlign: 'center', fontSize: rank <= 3 ? 18 : 12, fontWeight: 800, color, flexShrink: 0 }}>
      {label}
    </div>
  )
}

function PlayerAvatar({ name, avatarUrl, size }: { name: string; avatarUrl: string | null; size: number }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 900, color: '#fff',
    }}>
      {initials}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
    </div>
  )
}
