'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { fetchH2HAction, fetchH2HMatchesAction } from '../actions'
import {
  getH2HPhotoAction,
  getSignedH2HPhotoUrlAction,
  finalizeH2HPhotoUploadAction,
  removeH2HPhotoAction,
} from '../h2hPhotoAction'
import type { H2HRecord, H2HMatchEntry } from '@/lib/stats/types'
import { useTranslation } from '@/lib/i18n/context'

const RED = '#d20a0a'

type Player = { id: string; name: string }

type Props = {
  playerId: string
  playerName: string
  allPlayers: Player[]   // excludes profile player — we re-add them inside
  isAdmin: boolean
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; record: H2HRecord | null; matches: H2HMatchEntry[]; photoUrl: string | null }

function nameToColor(name: string): string {
  const palette = ['#1d4ed8', '#7c3aed', '#059669', '#b45309', '#0891b2', '#9333ea', '#0f766e']
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(hash) % palette.length]
}

function MiniAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: nameToColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function PlayerSelect({
  value,
  onChange,
  players,
  placeholder,
}: {
  value: string
  onChange: (id: string) => void
  players: Player[]
  placeholder: string
}) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '13px 36px 13px 14px',
          border: '2px solid #111827', borderRadius: 4,
          background: 'var(--card)', fontSize: 12, fontWeight: 700, color: 'var(--text)',
          cursor: 'pointer', appearance: 'none',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}
      >
        <option value="">{placeholder}</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <svg width="10" height="7" viewBox="0 0 12 8" fill="none"><path d="M1 1l5 5 5-5" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </div>
  )
}

function H2HPhotoBanner({
  playerAName,
  playerBName,
  playerAId,
  playerBId,
  photoUrl: initialPhotoUrl,
  isAdmin,
}: {
  playerAName: string
  playerBName: string
  playerAId: string
  playerBId: string
  photoUrl: string | null
  isAdmin: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl)
  const [uploading, setUploading] = useState(false)
  const [, startTransition] = useTransition()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() as 'jpg' | 'jpeg' | 'png' | 'webp'
    setUploading(true)
    try {
      const { signedUrl, storagePath, error } = await getSignedH2HPhotoUrlAction(playerAId, playerBId, ext)
      if (error || !signedUrl || !storagePath) {
        alert(error ?? 'Upload failed')
        return
      }
      const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!res.ok) { alert('Upload failed'); return }
      const { url, error: finalErr } = await finalizeH2HPhotoUploadAction(playerAId, playerBId, storagePath)
      if (finalErr || !url) { alert(finalErr ?? 'Finalize failed'); return }
      setPhotoUrl(url)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleRemove() {
    startTransition(async () => {
      const { error } = await removeH2HPhotoAction(playerAId, playerBId)
      if (error) { alert(error); return }
      setPhotoUrl(null)
    })
  }

  return (
    <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', marginBottom: 12, background: '#111827', height: 220 }}>
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={`${playerAName} vs ${playerBName}`}
          fill
          style={{ objectFit: 'cover', objectPosition: 'center center' }}
          unoptimized
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
          <MiniAvatar name={playerAName} size={56} />
          <div style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>VS</div>
          <MiniAvatar name={playerBName} size={56} />
        </div>
      )}

      {/* Gradient + player name labels */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }} />
      <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{playerAName}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{playerBName}</span>
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload H2H photo"
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          >
            {uploading ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            )}
          </button>
          {photoUrl && (
            <button
              onClick={handleRemove}
              title="Remove photo"
              style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(210,10,10,0.85)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  )
}

function H2HStats({
  record,
  playerAName,
  playerBName,
}: {
  record: H2HRecord
  playerAName: string
  playerBName: string
}) {
  const { t } = useTranslation()
  const { player1Wins: aWins, player2Wins: bWins, draws, totalMatches: total,
          player1Goals: aGoals, player2Goals: bGoals } = record

  const aPct    = total > 0 ? Math.round((aWins / total) * 100) : 0
  const bPct    = total > 0 ? Math.round((bWins / total) * 100) : 0
  const drawPct = total > 0 ? Math.round((draws / total) * 100) : 0

  return (
    <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {/* Player A */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <MiniAvatar name={playerAName} size={48} />
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerAName}</div>
        </div>

        {/* 3-column score */}
        <div style={{ flex: 1, display: 'flex' }}>
          <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#16a34a', lineHeight: 1 }}>{aWins}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3, opacity: 0.75 }}>W</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#6b7280', lineHeight: 1 }}>{draws}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>D</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: RED, lineHeight: 1 }}>{bWins}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3, opacity: 0.75 }}>W</div>
          </div>
        </div>

        {/* Player B */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <MiniAvatar name={playerBName} size={48} />
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerBName}</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 14 }}>
        {t(total === 1 ? 'h2h.goalsLine.one' : 'h2h.goalsLine.many', { a: aGoals, b: bGoals, n: total })}
      </div>

      {total > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            <span style={{ color: '#16a34a' }}>{aPct}%</span>
            {drawPct > 0 && <span>{drawPct}% Draw</span>}
            <span style={{ color: RED }}>{bPct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${aPct}%`, background: '#16a34a', transition: 'width 0.5s' }} />
            {draws > 0 && <div style={{ width: `${drawPct}%`, background: '#d1d5db' }} />}
            <div style={{ width: `${bPct}%`, background: RED, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function MatchHistoryList({
  matches,
  playerAName,
  playerBName,
}: {
  matches: H2HMatchEntry[]
  playerAName: string
  playerBName: string
}) {
  const { t } = useTranslation()

  if (matches.length === 0) {
    return (
      <div style={{ padding: '20px 24px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
        {t('h2h.noMatches')}
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: '12px 24px 0', fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {t('h2h.matchHistory')}
      </div>
      {matches.map((m) => {
        const result: 'W' | 'D' | 'L' = m.p1Score > m.p2Score ? 'W' : m.p1Score < m.p2Score ? 'L' : 'D'
        const won  = result === 'W'
        const drew = result === 'D'
        const resultColor = won ? '#16a34a' : drew ? '#6b7280' : RED
        const resultLabel = won ? 'WIN' : drew ? 'DRAW' : 'LOSS'

        return (
          <div key={m.matchId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <MiniAvatar name={playerAName} size={42} />
                {!drew && <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', background: won ? '#16a34a' : '#e5e7eb', width: 6, height: 6, borderRadius: '50%' }} />}
              </div>
              <div style={{ position: 'relative', marginLeft: -8, zIndex: 1 }}>
                <MiniAvatar name={playerBName} size={42} />
                {!drew && <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', background: !won ? RED : '#e5e7eb', width: 6, height: 6, borderRadius: '50%' }} />}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {playerAName} <span style={{ color: '#9ca3af', fontWeight: 600 }}>VS</span> {playerBName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {m.matchType === 'championship'
                  ? `${t('player.matchType.championship')}${m.championshipName ? ` · ${m.championshipName}` : ''}`
                  : t('home.friendly')}
                {' · '}
                {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{m.p1Score} – {m.p2Score}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: resultColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{resultLabel}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function H2HSection({ playerId, playerName, allPlayers, isAdmin }: Props) {
  const { t } = useTranslation()

  // Full player list including the profile player
  const allWithSelf: Player[] = [{ id: playerId, name: playerName }, ...allPlayers]

  const [playerAId, setPlayerAId] = useState<string>(playerId)
  const [playerBId, setPlayerBId] = useState<string>('')
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [isPending, startTransition] = useTransition()

  function load(aId: string, bId: string) {
    if (!aId || !bId) { setState({ status: 'idle' }); return }
    setState({ status: 'loading' })
    startTransition(async () => {
      const [record, matches, photoResult] = await Promise.all([
        fetchH2HAction(aId, bId),
        fetchH2HMatchesAction(aId, bId),
        getH2HPhotoAction(aId, bId),
      ])
      setState({ status: 'done', record, matches, photoUrl: photoResult.photoUrl })
    })
  }

  function handlePlayerAChange(id: string) {
    setPlayerAId(id)
    if (id === playerBId) { setPlayerBId(''); setState({ status: 'idle' }); return }
    load(id, playerBId)
  }

  function handlePlayerBChange(id: string) {
    setPlayerBId(id)
    load(playerAId, id)
  }

  const selectedA = allWithSelf.find((p) => p.id === playerAId)
  const selectedB = allWithSelf.find((p) => p.id === playerBId)

  // Each dropdown excludes the other selected player
  const optionsForA = allWithSelf.filter((p) => p.id !== playerBId)
  const optionsForB = allWithSelf.filter((p) => p.id !== playerAId)

  return (
    <div>
      {/* Two-player selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <PlayerSelect
          value={playerAId}
          onChange={handlePlayerAChange}
          players={optionsForA}
          placeholder={t('h2h.selectOpponent')}
        />
        <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.06em' }}>VS</div>
        <PlayerSelect
          value={playerBId}
          onChange={handlePlayerBChange}
          players={optionsForB}
          placeholder={t('h2h.selectOpponent')}
        />
      </div>

      {/* Loading */}
      {(state.status === 'loading' || isPending) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          {t('common.loading')}
        </div>
      )}

      {/* Results */}
      {state.status === 'done' && selectedA && selectedB && (
        <>
          <H2HPhotoBanner
            playerAName={selectedA.name}
            playerBName={selectedB.name}
            playerAId={selectedA.id}
            playerBId={selectedB.id}
            photoUrl={state.photoUrl}
            isAdmin={isAdmin}
          />

          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', background: 'var(--card)' }}>
            {state.record ? (
              <>
                <H2HStats record={state.record} playerAName={selectedA.name} playerBName={selectedB.name} />
                <MatchHistoryList matches={state.matches} playerAName={selectedA.name} playerBName={selectedB.name} />
              </>
            ) : (
              <div style={{ padding: '32px 0', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                {t('h2h.noMatches')}
              </div>
            )}

            {/* Links to both profiles */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', gap: 20 }}>
              {[selectedA, selectedB].map((p) => (
                <Link key={p.id} href={`/players/${p.id}`} style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                  {p.name.split(' ')[0]}&apos;S PROFILE
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
