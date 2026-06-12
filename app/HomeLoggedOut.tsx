'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy, Medal } from 'lucide-react'
import { AnimatedShinyText } from '@/app/components/magicui/animated-shiny-text'
import { Meteors } from '@/app/components/magicui/meteors'
import type { NamedPlayerStats, ChampionshipLeader } from '@/lib/stats/types'
import type { RivalryItem } from './HomeLoggedIn'
import { useTranslation } from '@/lib/i18n/context'

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
  const { t } = useTranslation()

  const top        = players.slice(0, 8)
  const activeChamps = champLeaders.filter((c) => c.isActive)

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: 'system-ui, sans-serif', color: TEXT }}>

      <style>{`
        .lo-leaderboard-row { transition: background .15s ease; cursor: default; }
        .lo-leaderboard-row:hover { background: rgba(30,45,69,0.75) !important; }
        .lo-leaderboard-row-gold:hover { background: rgba(25,18,2,0.9) !important; }
        .lo-champ-card { transition: background .15s ease, border-color .15s ease; }
        .lo-champ-card:hover { border-color: rgba(245,158,11,0.5) !important; }
        .lo-rivalry-card { transition: background .15s ease, border-color .15s ease; }
        .lo-rivalry-card:hover { background: rgba(22,36,60,0.9) !important; border-color: rgba(59,130,246,0.3) !important; }
        .lo-tab-btn { transition: color .15s ease; }
      `}</style>

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
          {t('common.login')}
        </Link>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '36px 20px 32px',
        background: 'linear-gradient(160deg, #0f2545 0%, #1a0a3e 55%, #0d1a35 100%)',
        borderBottom: `1px solid ${BORDER}`,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Meteors number={10} />
        <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
          <Trophy size={52} style={{ color: ACCENT }} />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', color: TEXT }}>
          <AnimatedShinyText style={{ color: TEXT }}>FC26 Tracker</AnimatedShinyText>
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 15, color: '#94a3b8', maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
          {t('out.tagline')}
        </p>
        <Link href="/login" style={{
          display: 'inline-block',
          padding: '13px 36px',
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: '#fff', borderRadius: 12, fontWeight: 800, fontSize: 16,
          textDecoration: 'none', boxShadow: '0 4px 24px rgba(37,99,235,0.45)',
        }}>
          {t('out.getStarted')}
        </Link>
        </div>{/* /relative z-1 */}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        background: CARD, borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 57, zIndex: 30,
      }}>
        {([['stats', t('out.tab.stats')], ['rivalries', t('out.tab.rivalries')]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="lo-tab-btn" style={{
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
            <SectionHeader label={t('out.leaderboard')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
              {top.length === 0 && (
                <Empty text={t('out.noPlayers')} />
              )}
              {top.map((p, i) => (
                <div key={p.id} className={i === 0 ? 'lo-leaderboard-row lo-leaderboard-row-gold' : 'lo-leaderboard-row'} style={{
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
                      {p.matchesPlayed} {t('common.matches')}
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
                <SectionHeader label={t('out.activeChamps')} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                  {activeChamps.map((c) => (
                    <div key={c.championshipId} className="lo-champ-card" style={{
                      background: '#150e00', border: '1px solid #f59e0b33',
                      borderRadius: 10, padding: '14px 16px',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', marginBottom: 10 }}>
                        {c.championshipName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Trophy size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                        <PlayerAvatar name={c.playerName} avatarUrl={c.avatarUrl} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.playerName}
                          </div>
                          <div style={{ fontSize: 11, color: '#b45309' }}>{t('out.currentLeader')}</div>
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
            <SectionHeader label={t('out.activeRivalries')} />
            {rivalries.length === 0 && <Empty text={t('out.noRivalries')} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rivalries.map((r) => (
                <div key={r.id} className="lo-rivalry-card" style={{
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
                    {t('out.firstTo', { n: r.bestOf, played: r.player1Wins + r.player2Wins })}
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
        <span style={{ fontSize: 13, color: MUTED }}>{t('out.joinLeague')}</span>
        <Link href="/login" style={{
          padding: '9px 22px', background: ACCENT, color: '#fff',
          borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          {t('out.loginArrow')}
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
  if (rank === 1) return (
    <div style={{ minWidth: 22, textAlign: 'center', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
      <Trophy size={18} style={{ color: '#f59e0b' }} />
    </div>
  )
  if (rank === 2) return (
    <div style={{ minWidth: 22, textAlign: 'center', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
      <Medal size={18} style={{ color: '#94a3b8' }} />
    </div>
  )
  if (rank === 3) return (
    <div style={{ minWidth: 22, textAlign: 'center', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
      <Medal size={18} style={{ color: '#cd7c3a' }} />
    </div>
  )
  return (
    <div style={{ minWidth: 22, textAlign: 'center', fontSize: 12, fontWeight: 800, color: MUTED, flexShrink: 0 }}>
      {rank}
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
