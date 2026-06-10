'use client'

import type { ReactNode } from 'react'
import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import type { FormEntry, ChampionshipResult } from '@/lib/stats/types'
import { H2HSection } from './H2HSection'
import { logoutAction } from '@/lib/auth/actions'
import { uploadAvatarAction } from '@/lib/auth/avatarAction'

type PlayerData = {
  id: string
  name: string
  avatarUrl: string | null
  isActive: boolean
  wins: number
  losses: number
  draws: number
  matchesPlayed: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
}

type BadgeData = {
  id: string
  name: string
  description: string | null
  badgeType: string
  iconUrl: string | null
  earnedAt: string
  sourceRivalryId: string | null
}

type RivalryData = {
  id: string
  opponentId: string
  opponentName: string
  bestOf: number
  myWins: number
  theirWins: number
  winnerId: string | null
  status: 'active' | 'completed'
}

type Props = {
  player: PlayerData
  badges: BadgeData[]
  rivalries: RivalryData[]
  recentMatches: FormEntry[]
  championshipPlacements: ChampionshipResult[]
  isOwnProfile: boolean
  isAdmin: boolean
}

const BADGE_ICONS: Record<string, string> = {
  rivalry_won: '🏆',
  streak:      '🔥',
  milestone:   '⭐',
}

function Avatar({
  url, name, size = 56, editable = false, onEditClick,
}: {
  url: string | null; name: string; size?: number; editable?: boolean; onEditClick?: () => void
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const base = url ? (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb', flexShrink: 0, display: 'block' }}
    />
  ) : (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.3, fontWeight: 800, color: '#fff', flexShrink: 0,
        border: '2px solid #e5e7eb',
      }}
    >
      {initials}
    </div>
  )

  if (!editable) return base

  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0, cursor: 'pointer' }}
      onClick={onEditClick}
      title="Change avatar"
    >
      {base}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0,
        transition: 'opacity 0.15s',
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0' }}
      >
        <span style={{ fontSize: size * 0.28, lineHeight: 1 }}>📷</span>
      </div>
    </div>
  )
}

function FormPip({ result }: { result: FormEntry['result'] }) {
  const colors = { W: '#16a34a', D: '#6b7280', L: '#dc2626' }
  return (
    <span
      title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 6,
        background: colors[result], color: '#fff',
        fontSize: 11, fontWeight: 800,
      }}
    >
      {result}
    </span>
  )
}

function RankBadge({ rank, total }: { rank: number; total: number }) {
  const color = rank === 1 ? '#d97706' : rank === 2 ? '#6b7280' : rank === 3 ? '#b45309' : '#374151'
  const bg    = rank === 1 ? '#fef3c7' : rank === 2 ? '#f3f4f6' : rank === 3 ? '#fff7ed' : '#f9fafb'
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
        background: bg, color,
      }}
    >
      #{rank} / {total}
    </span>
  )
}

export function PlayerProfile({
  player,
  badges,
  rivalries,
  recentMatches,
  championshipPlacements,
  isOwnProfile,
  isAdmin,
}: Props) {
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const winRate = player.matchesPlayed > 0
    ? Math.round((player.wins / player.matchesPlayed) * 100)
    : 0
  const wonRivalries    = rivalries.filter((r) => r.winnerId === player.id)
  const activeRivalries = rivalries.filter((r) => r.status === 'active')

  const h2hOpponents = rivalries.map((r) => ({ id: r.opponentId, name: r.opponentName }))

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setUploadError('Image must be under 3 MB')
      return
    }
    setUploadError(null)
    const fd = new FormData()
    fd.append('avatar', file)
    fd.append('targetUserId', player.id)
    startTransition(async () => {
      const result = await uploadAvatarAction(fd)
      if (result.error) {
        setUploadError(result.error)
      } else if (result.url) {
        setAvatarUrl(result.url)
      }
    })
    e.target.value = ''
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Breadcrumb + sign-out row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          <Link href="/leaderboard" style={{ color: '#6b7280', textDecoration: 'none' }}>Leaderboard</Link>
          {' / '}
          {player.name}
        </div>
        {isOwnProfile && (
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                fontSize: 12, color: '#6b7280', background: 'none',
                border: '1px solid #e5e7eb', borderRadius: 6,
                padding: '4px 12px', cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </form>
        )}
      </div>

      {/* ── Profile header ── */}
      <div
        style={{
          border: '1px solid #e5e7eb', borderRadius: 14,
          padding: '24px 28px', background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 20,
        }}
      >
        {/* Hidden file input — only rendered for admins */}
        {isAdmin && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        )}

        {uploadError && (
          <div style={{
            marginBottom: 12, padding: '8px 12px',
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, fontSize: 12, color: '#dc2626',
          }}>
            {uploadError}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              url={avatarUrl}
              name={player.name}
              size={64}
              editable={isAdmin}
              onEditClick={() => fileInputRef.current?.click()}
            />
            {isPending && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(255,255,255,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                ⏳
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>
                {player.name}
              </h1>
              {isOwnProfile && (
                <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', background: '#f3f4f6', borderRadius: 8, padding: '2px 8px' }}>
                  you
                </span>
              )}
              {!player.isActive && (
                <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', background: '#f9fafb', borderRadius: 8, padding: '2px 8px' }}>
                  inactive
                </span>
              )}
            </div>
            {badges.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {badges.map((b) => (
                  <span key={b.id} title={b.name} style={{ fontSize: 20 }}>
                    {BADGE_ICONS[b.badgeType] ?? '🎖️'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10, marginBottom: 12,
          }}
        >
          {[
            { label: 'Matches', value: player.matchesPlayed },
            { label: 'Wins',    value: player.wins,    color: '#16a34a' },
            { label: 'Draws',   value: player.draws,   color: '#6b7280' },
            { label: 'Losses',  value: player.losses,  color: '#dc2626' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: '#f9fafb', borderRadius: 10, padding: '12px 0',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: color ?? '#111827' }}>{value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: '#6b7280' }}>
          <span>GF: <strong style={{ color: '#111827' }}>{player.goalsFor}</strong></span>
          <span>GA: <strong style={{ color: '#111827' }}>{player.goalsAgainst}</strong></span>
          <span>
            GD:{' '}
            <strong style={{ color: player.goalDiff > 0 ? '#16a34a' : player.goalDiff < 0 ? '#dc2626' : '#6b7280' }}>
              {player.goalDiff > 0 ? `+${player.goalDiff}` : player.goalDiff}
            </strong>
          </span>
          <span>Win rate: <strong style={{ color: '#111827' }}>{winRate}%</strong></span>
        </div>
      </div>

      {/* ── Recent matches ── */}
      {recentMatches.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <SectionHeader>Recent Matches</SectionHeader>
          {/* Form strip */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {recentMatches.map((m) => (
              <FormPip key={m.matchId} result={m.result} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentMatches.map((m) => (
              <div
                key={m.matchId}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${m.result === 'W' ? '#dcfce7' : m.result === 'L' ? '#fee2e2' : '#f3f4f6'}`,
                  background: m.result === 'W' ? '#f0fdf4' : m.result === 'L' ? '#fef2f2' : '#fafafa',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FormPip result={m.result} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      vs{' '}
                      <Link href={`/players/${m.opponentId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                        {m.opponentName}
                      </Link>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      {m.matchType === 'championship' ? 'Championship' : 'Friendly'} ·{' '}
                      {new Date(m.playedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#111827', flexShrink: 0 }}>
                  {m.goalsFor} – {m.goalsAgainst}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Head-to-head (expandable per opponent) ── */}
      {h2hOpponents.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <SectionHeader>Head-to-Head</SectionHeader>
          <H2HSection playerId={player.id} opponents={h2hOpponents} />
        </section>
      )}

      {/* ── Championship placements ── */}
      {championshipPlacements.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <SectionHeader>Championships</SectionHeader>
          <div
            style={{
              border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden',
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 60px 60px 60px 60px 60px',
                padding: '8px 14px',
                background: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 10, fontWeight: 700, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.06em', gap: 4,
              }}
            >
              <span>Championship</span>
              <span style={{ textAlign: 'center' }}>Rank</span>
              <span style={{ textAlign: 'center' }}>Pts</span>
              <span style={{ textAlign: 'center' }}>W</span>
              <span style={{ textAlign: 'center' }}>D</span>
              <span style={{ textAlign: 'center' }}>L</span>
              <span style={{ textAlign: 'center' }}>GD</span>
            </div>
            {championshipPlacements.map((cp, i) => (
              <div
                key={cp.championshipId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 60px 60px 60px 60px 60px 60px',
                  padding: '10px 14px',
                  borderBottom: i < championshipPlacements.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: cp.rank === 1 ? '#fffbeb' : '#fff',
                  fontSize: 13, gap: 4, alignItems: 'center',
                }}
              >
                <div>
                  <Link
                    href={`/championships/${cp.championshipId}`}
                    style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}
                  >
                    {cp.championshipName}
                  </Link>
                  {cp.isActive && (
                    <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 8, textTransform: 'uppercase' }}>
                      active
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <RankBadge rank={cp.rank} total={cp.totalPlayers} />
                </div>
                <div style={{ textAlign: 'center', fontWeight: 700, color: cp.rank === 1 ? '#d97706' : '#111827' }}>
                  {cp.points}
                </div>
                <div style={{ textAlign: 'center', color: '#374151' }}>{cp.wins}</div>
                <div style={{ textAlign: 'center', color: '#374151' }}>{cp.draws}</div>
                <div style={{ textAlign: 'center', color: '#374151' }}>{cp.losses}</div>
                <div
                  style={{
                    textAlign: 'center', fontWeight: 600,
                    color: cp.goalDiff > 0 ? '#16a34a' : cp.goalDiff < 0 ? '#dc2626' : '#6b7280',
                  }}
                >
                  {cp.goalDiff > 0 ? `+${cp.goalDiff}` : cp.goalDiff}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Badges ── */}
      {badges.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <SectionHeader>
            Badges ({wonRivalries.length} rivalry win{wonRivalries.length !== 1 ? 's' : ''})
          </SectionHeader>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {badges.map((b) => (
              <div
                key={b.id}
                style={{
                  border: '1px solid #fbbf24', borderRadius: 10,
                  padding: '10px 16px', background: '#fffbeb',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 24 }}>{BADGE_ICONS[b.badgeType] ?? '🎖️'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{b.name}</div>
                  {b.description && (
                    <div style={{ fontSize: 11, color: '#b45309', marginTop: 1 }}>{b.description}</div>
                  )}
                  <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>
                    Earned {new Date(b.earnedAt).toLocaleDateString()}
                    {b.sourceRivalryId && (
                      <>
                        {' · '}
                        <Link href={`/rivalries/${b.sourceRivalryId}`} style={{ color: '#d97706' }}>
                          View rivalry →
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Rivalries ── */}
      {rivalries.length > 0 && (
        <section>
          <SectionHeader>
            Rivalries ({wonRivalries.length} won · {activeRivalries.length} active)
          </SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rivalries.map((r) => {
              const iWon   = r.winnerId === player.id
              const theyWon = r.winnerId !== null && r.winnerId !== player.id
              return (
                <Link key={r.id} href={`/rivalries/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div
                    style={{
                      border: `1px solid ${iWon ? '#fbbf24' : '#e5e7eb'}`,
                      borderRadius: 10, padding: '12px 16px',
                      background: iWon ? '#fffbeb' : '#fff',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {iWon && <span style={{ fontSize: 16 }}>🏆</span>}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                          vs {r.opponentName}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          First to {r.bestOf} wins
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: iWon ? '#d97706' : '#111827' }}>
                        {r.myWins} – {r.theirWins}
                      </div>
                      <span
                        style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 12, textTransform: 'uppercase',
                          background: r.status === 'active' ? '#dcfce7' : iWon ? '#fef3c7' : '#f3f4f6',
                          color: r.status === 'active' ? '#16a34a' : iWon ? '#92400e' : theyWon ? '#6b7280' : '#6b7280',
                        }}
                      >
                        {r.status === 'active' ? 'Active' : iWon ? 'Won' : 'Lost'}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {rivalries.length === 0 && badges.length === 0 && recentMatches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
          No match history yet.
        </div>
      )}
    </div>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      margin: '0 0 10px',
      fontSize: 13, fontWeight: 700, color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {children}
    </h2>
  )
}
