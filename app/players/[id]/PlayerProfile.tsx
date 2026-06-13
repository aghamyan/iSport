'use client'

import type { ReactNode } from 'react'
import { useRef, useState, useTransition, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Trophy, Flame, Star, Award } from 'lucide-react'
import type { FormEntry, ChampionshipResult } from '@/lib/stats/types'
import { H2HSection } from './H2HSection'
import { fetchMoreMatchesAction } from '../actions'
import { logoutAction } from '@/lib/auth/actions'
import { uploadAvatarAction } from '@/lib/auth/avatarAction'
import { getSignedUploadUrlAction, finalizeVideoUploadAction, removeIntroVideoAction } from '@/lib/auth/introVideoAction'
import { BottomNav } from '@/app/components/BottomNav'
import { useTranslation } from '@/lib/i18n/context'

type PlayerData = {
  id: string
  name: string
  avatarUrl: string | null
  introVideoUrl: string | null
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
  allPlayers: { id: string; name: string }[]
  isOwnProfile: boolean
  isAdmin: boolean
  viewerId: string
}

const BADGE_ICONS: Record<string, ReactNode> = {
  rivalry_won: <Trophy size={24} style={{ color: '#d97706' }} />,
  streak:      <Flame   size={24} style={{ color: '#f97316' }} />,
  milestone:   <Star    size={24} style={{ color: '#f59e0b' }} />,
}

// ── CSS keyframes injected once ──────────────────────────────
function IntroStyles() {
  return (
    <style>{`
      @keyframes intro-sparkle {
        0%, 100% { opacity: 0.12; transform: scale(0.6); }
        50%       { opacity: 1;    transform: scale(1.4); }
      }
      @keyframes intro-avatar-in {
        0%   { transform: scale(0.25); opacity: 0; filter: blur(14px); }
        65%  { transform: scale(1.08); opacity: 1; filter: blur(0); }
        100% { transform: scale(1);    opacity: 1; }
      }
      @keyframes intro-ring-pulse {
        0%, 100% {
          box-shadow:
            0 0 0 4px rgba(251,191,36,0.45),
            0 0 35px 8px rgba(251,191,36,0.2),
            0 0 70px 20px rgba(139,92,246,0.1);
        }
        50% {
          box-shadow:
            0 0 0 10px rgba(251,191,36,0.12),
            0 0 55px 18px rgba(251,191,36,0.32),
            0 0 100px 30px rgba(139,92,246,0.18);
        }
      }
      @keyframes intro-name-in {
        0%   { opacity: 0; transform: translateY(26px); letter-spacing: 0.28em; }
        100% { opacity: 1; transform: translateY(0);    letter-spacing: 0.06em; }
      }
      @keyframes intro-line-expand {
        from { transform: scaleX(0); opacity: 0; }
        to   { transform: scaleX(1); opacity: 1; }
      }
      @keyframes intro-subtitle-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 0.45; transform: translateY(0); }
      }
      @keyframes intro-letterbox-top {
        from { transform: translateY(-100%); }
        to   { transform: translateY(0); }
      }
      @keyframes intro-letterbox-bottom {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
      }
      @keyframes intro-video-name {
        0%   { opacity: 0; transform: translateY(10px) scale(1.05); }
        100% { opacity: 1; transform: translateY(0)    scale(1); }
      }
      @keyframes flash-in {
        0%   { opacity: 0.25; }
        40%  { opacity: 0; }
        100% { opacity: 0; }
      }
      @keyframes scan-sweep {
        0%   { transform: translateY(0);    opacity: 0.9; }
        100% { transform: translateY(100vh); opacity: 0; }
      }
      @keyframes video-border-glow {
        0%, 100% {
          box-shadow:
            inset 0 0 0 1px rgba(251,191,36,0.22),
            inset 0 0 50px 0 rgba(251,191,36,0.04);
        }
        50% {
          box-shadow:
            inset 0 0 0 1px rgba(251,191,36,0.55),
            inset 0 0 70px 12px rgba(251,191,36,0.10);
        }
      }
      @keyframes corner-in-tl {
        0%   { opacity: 0; transform: translate(-14px, -14px); }
        100% { opacity: 1; transform: translate(0, 0); }
      }
      @keyframes corner-in-tr {
        0%   { opacity: 0; transform: translate(14px, -14px); }
        100% { opacity: 1; transform: translate(0, 0); }
      }
      @keyframes corner-in-bl {
        0%   { opacity: 0; transform: translate(-14px, 14px); }
        100% { opacity: 1; transform: translate(0, 0); }
      }
      @keyframes corner-in-br {
        0%   { opacity: 0; transform: translate(14px, 14px); }
        100% { opacity: 1; transform: translate(0, 0); }
      }
      @keyframes diamond-pulse {
        0%, 100% { opacity: 0.5;  transform: rotate(45deg) scale(1);   }
        50%       { opacity: 1;    transform: rotate(45deg) scale(1.5); }
      }
      @keyframes name-glow-pulse {
        0%, 100% { text-shadow: 0 0 18px rgba(251,191,36,0.4), 0 0 6px rgba(251,191,36,0.15); }
        50%       { text-shadow: 0 0 32px rgba(251,191,36,0.85), 0 0 14px rgba(251,191,36,0.4), 0 0 55px rgba(251,191,36,0.18); }
      }
      @keyframes eyebrow-in {
        from { opacity: 0; letter-spacing: 0.55em; }
        to   { opacity: 0.65; letter-spacing: 0.28em; }
      }
      @keyframes gold-particle-float {
        0%   { transform: translateY(0)     scale(1);   opacity: 0; }
        15%  {                                           opacity: 1; }
        85%  {                                           opacity: 0.8; }
        100% { transform: translateY(-90px) scale(0.2); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
      }
    `}</style>
  )
}

// Deterministic sparkle positions — spread at the edges, away from the center
const SPARKLES = [
  { top:  '7%', left: '11%', delay: '0.0s', dur: '2.2s', size: 5 },
  { top: '13%', left: '83%', delay: '0.4s', dur: '1.9s', size: 3 },
  { top: '23%', left:  '4%', delay: '0.7s', dur: '2.4s', size: 4 },
  { top: '19%', left: '92%', delay: '0.2s', dur: '2.0s', size: 5 },
  { top: '42%', left:  '2%', delay: '1.0s', dur: '2.1s', size: 3 },
  { top: '40%', left: '95%', delay: '0.6s', dur: '1.8s', size: 4 },
  { top: '63%', left:  '7%', delay: '0.3s', dur: '2.3s', size: 5 },
  { top: '67%', left: '90%', delay: '0.9s', dur: '2.0s', size: 3 },
  { top: '78%', left: '20%', delay: '0.1s', dur: '2.2s', size: 4 },
  { top: '81%', left: '74%', delay: '0.5s', dur: '1.9s', size: 5 },
  { top: '88%', left: '46%', delay: '1.2s', dur: '2.1s', size: 3 },
  { top:  '6%', left: '49%', delay: '0.8s', dur: '2.3s', size: 4 },
]

// ── Avatar-based magical intro (no video) ───────────────────
function AvatarIntroOverlay({
  avatarUrl,
  playerName,
  onDismiss,
}: {
  avatarUrl: string | null
  playerName: string
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => setOpacity(0), 3700)
    return () => clearTimeout(timer)
  }, [])

  function dismiss() { setOpacity(0) }

  function handleTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && opacity === 0) onDismiss()
  }

  const initials = playerName
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background:
          'radial-gradient(ellipse at 50% 36%, #1e0a4a 0%, #07000e 55%, #000 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        opacity, transition: 'opacity 0.65s ease',
      }}
    >
      {/* Sparkle particles */}
      {SPARKLES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', top: s.top, left: s.left,
            width: s.size, height: s.size, borderRadius: '50%',
            background: '#fff',
            boxShadow: `0 0 ${s.size * 2}px ${s.size}px rgba(251,191,36,0.75)`,
            animation: `intro-sparkle ${s.dur} ${s.delay} ease-in-out infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Soft purple glow behind avatar */}
      <div
        style={{
          position: 'absolute',
          width: 300, height: 300, borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Avatar */}
      <div style={{
        animation: 'intro-avatar-in 0.9s 0.05s both cubic-bezier(0.34,1.45,0.64,1)',
        position: 'relative', zIndex: 1,
      }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={playerName}
            style={{
              width: 134, height: 134, borderRadius: '50%',
              objectFit: 'cover', display: 'block',
              border: '3px solid rgba(251,191,36,0.9)',
              animation: 'intro-ring-pulse 2.3s 0.95s ease-in-out infinite',
            }}
          />
        ) : (
          <div style={{
            width: 134, height: 134, borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 46, fontWeight: 800, color: '#fff',
            border: '3px solid rgba(251,191,36,0.9)',
            animation: 'intro-ring-pulse 2.3s 0.95s ease-in-out infinite',
          }}>
            {initials}
          </div>
        )}
      </div>

      {/* Name + flanking lines */}
      <div style={{
        marginTop: 30, textAlign: 'center', zIndex: 1,
        animation: 'intro-name-in 0.75s 0.65s both ease-out',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 14,
        }}>
          <div style={{
            height: 1, width: 46,
            background: 'linear-gradient(to right, transparent, rgba(251,191,36,0.85))',
            animation: 'intro-line-expand 0.55s 1.1s both',
            transformOrigin: 'right center',
          }} />
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 900,
            color: '#fff', letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textShadow:
              '0 0 40px rgba(251,191,36,0.6), 0 0 12px rgba(251,191,36,0.3), 0 2px 28px rgba(0,0,0,0.9)',
          }}>
            {playerName}
          </h1>
          <div style={{
            height: 1, width: 46,
            background: 'linear-gradient(to left, transparent, rgba(251,191,36,0.85))',
            animation: 'intro-line-expand 0.55s 1.1s both',
            transformOrigin: 'left center',
          }} />
        </div>
        <p style={{
          margin: '10px 0 0', fontSize: 10, fontWeight: 700,
          color: '#fff', letterSpacing: '0.24em', textTransform: 'uppercase',
          animation: 'intro-subtitle-in 0.5s 1.35s both',
        }}>
          {t('player.subtitle')}
        </p>
      </div>

      {/* Skip */}
      <button
        onClick={dismiss}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 20, color: 'rgba(255,255,255,0.8)',
          fontSize: 12, fontWeight: 600,
          padding: '6px 16px', cursor: 'pointer', letterSpacing: '0.04em',
        }}
      >
        {t('player.skip')}
      </button>
    </div>
  )
}

// ── Cinematic video intro ────────────────────────────────────
const VIDEO_PARTICLES = [
  { top: '28%', left:  '7%', delay: '0.2s', dur: '2.8s', size: 3 },
  { top: '38%', left: '91%', delay: '1.1s', dur: '3.2s', size: 2 },
  { top: '53%', left:  '5%', delay: '0.7s', dur: '2.5s', size: 4 },
  { top: '62%', left: '92%', delay: '1.5s', dur: '3.0s', size: 2 },
  { top: '72%', left: '13%', delay: '0.0s', dur: '2.7s', size: 3 },
  { top: '45%', left: '94%', delay: '2.0s', dur: '3.5s', size: 2 },
  { top: '22%', left: '87%', delay: '0.5s', dur: '2.9s', size: 3 },
  { top: '76%', left: '79%', delay: '1.8s', dur: '2.6s', size: 2 },
]

function VideoIntroOverlay({
  videoUrl,
  playerName,
  onDismiss,
}: {
  videoUrl: string
  playerName: string
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const [opacity, setOpacity] = useState(1)
  const [isForcedMuted, setIsForcedMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      const video = videoRef.current
      if (!video) return
      try {
        video.muted = false
        await video.play()
      } catch {
        video.muted = true
        setIsForcedMuted(true)
        video.play().catch(() => {})
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  function dismiss() { setOpacity(0) }

  function handleTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && opacity === 0) onDismiss()
  }

  function unmuteVideo() {
    if (videoRef.current) {
      videoRef.current.muted = false
      setIsForcedMuted(false)
    }
  }

  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: '#000',
        opacity, transition: 'opacity 0.6s ease',
      }}
    >
      {/* Gold flash reveal */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
        background: 'rgba(251,191,36,0.10)',
        animation: 'flash-in 0.85s ease-out both',
      }} />

      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        playsInline
        onEnded={dismiss}
        style={{
          position: 'absolute', inset: 0, zIndex: 1,
          width: '100%', height: '100%', objectFit: 'contain',
        }}
      />

      {/* CRT scanlines */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.045) 3px, rgba(0,0,0,0.045) 4px)',
      }} />

      {/* Cinematic scan sweep line */}
      <div style={{
        position: 'absolute', top: 58, left: 0, right: 0,
        height: 2, zIndex: 4, pointerEvents: 'none',
        background:
          'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.55) 25%, rgba(255,255,255,0.85) 50%, rgba(251,191,36,0.55) 75%, transparent 100%)',
        animation: 'scan-sweep 1.1s 0.25s ease-out both',
      }} />

      {/* Pulsing border frame */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
        animation: 'video-border-glow 2.8s 1.2s ease-in-out infinite',
      }} />

      {/* Gold particles */}
      {VIDEO_PARTICLES.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', top: p.top, left: p.left, zIndex: 6,
          width: p.size, height: p.size, borderRadius: '50%',
          background: '#fbbf24',
          boxShadow: `0 0 ${p.size * 3}px ${p.size + 1}px rgba(251,191,36,0.65)`,
          animation: `gold-particle-float ${p.dur} ${p.delay} ease-in-out infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Side + bottom vignettes */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.6) 40%, transparent 100%)',
        pointerEvents: 'none', zIndex: 7,
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 7, pointerEvents: 'none',
        background:
          'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.6) 100%)',
      }} />

      {/* Top letterbox */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 58,
        background: '#000', zIndex: 8,
        animation: 'intro-letterbox-top 0.38s cubic-bezier(0.4,0,0.2,1) both',
      }}>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(251,191,36,0.65) 20%, rgba(251,191,36,0.65) 80%, transparent)',
        }} />
      </div>

      {/* Bottom nameplate */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 92,
        background: 'linear-gradient(to top, #000 65%, rgba(0,0,0,0.88) 100%)',
        zIndex: 8,
        animation: 'intro-letterbox-bottom 0.38s cubic-bezier(0.4,0,0.2,1) both',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 5,
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(251,191,36,0.65) 20%, rgba(251,191,36,0.65) 80%, transparent)',
        }} />

        {/* Eyebrow */}
        <div style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(251,191,36,0.7)',
          letterSpacing: '0.28em', textTransform: 'uppercase',
          animation: 'eyebrow-in 0.5s 0.55s both ease-out',
        }}>
          PLAYER
        </div>

        {/* Name row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          animation: 'intro-video-name 0.55s 0.35s both ease-out',
        }}>
          <div style={{
            flex: '0 0 52px', height: 1,
            background: 'linear-gradient(to right, transparent, rgba(251,191,36,0.75))',
          }} />
          <div style={{
            width: 5, height: 5, background: 'rgba(251,191,36,0.9)',
            flexShrink: 0,
            animation: 'diamond-pulse 2s 1.1s ease-in-out infinite',
            transform: 'rotate(45deg)',
          }} />
          <h2 style={{
            margin: 0, fontSize: 18, fontWeight: 900, color: '#fff',
            letterSpacing: '0.2em', textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            animation: 'name-glow-pulse 2.8s 1.3s ease-in-out infinite',
          }}>
            {playerName}
          </h2>
          <div style={{
            width: 5, height: 5, background: 'rgba(251,191,36,0.9)',
            flexShrink: 0,
            animation: 'diamond-pulse 2s 1.4s ease-in-out infinite',
            transform: 'rotate(45deg)',
          }} />
          <div style={{
            flex: '0 0 52px', height: 1,
            background: 'linear-gradient(to left, transparent, rgba(251,191,36,0.75))',
          }} />
        </div>
      </div>

      {/* Corner brackets */}
      <div style={{ position: 'absolute', top: 66, left: 12, zIndex: 9, pointerEvents: 'none', animation: 'corner-in-tl 0.5s 0.18s cubic-bezier(0.34,1.45,0.64,1) both' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M 46 2 L 2 2 L 2 46" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ position: 'absolute', top: 66, right: 12, zIndex: 9, pointerEvents: 'none', animation: 'corner-in-tr 0.5s 0.28s cubic-bezier(0.34,1.45,0.64,1) both' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M 2 2 L 46 2 L 46 46" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ position: 'absolute', bottom: 100, left: 12, zIndex: 9, pointerEvents: 'none', animation: 'corner-in-bl 0.5s 0.38s cubic-bezier(0.34,1.45,0.64,1) both' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M 46 46 L 2 46 L 2 2" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ position: 'absolute', bottom: 100, right: 12, zIndex: 9, pointerEvents: 'none', animation: 'corner-in-br 0.5s 0.48s cubic-bezier(0.34,1.45,0.64,1) both' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M 2 46 L 46 46 L 46 2" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Skip */}
      <button
        onClick={dismiss}
        style={{
          position: 'absolute', top: 15, right: 20, zIndex: 15,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 20, color: 'rgba(255,255,255,0.75)',
          fontSize: 11, fontWeight: 600,
          padding: '5px 14px', cursor: 'pointer', letterSpacing: '0.06em',
        }}
      >
        {t('player.skip')}
      </button>

      {/* Tap for sound fallback */}
      {isForcedMuted && (
        <button
          onClick={unmuteVideo}
          style={{
            position: 'absolute', bottom: 102, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(251,191,36,0.55)',
            borderRadius: 24, color: '#fbbf24',
            fontSize: 11, fontWeight: 700,
            padding: '8px 20px', cursor: 'pointer', letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          TAP FOR SOUND
        </button>
      )}
    </div>
  )
}

// ── Avatar helper ────────────────────────────────────────────
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
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity 0.15s',
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
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: bg, color }}>
      #{rank} / {total}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────
export function PlayerProfile({
  player,
  badges,
  rivalries,
  recentMatches,
  championshipPlacements,
  allPlayers,
  isOwnProfile,
  isAdmin,
  viewerId,
}: Props) {
  const { t } = useTranslation()
  const [avatarUrl, setAvatarUrl]           = useState(player.avatarUrl)
  const [introVideoUrl, setIntroVideoUrl]   = useState(player.introVideoUrl)
  const [showIntro, setShowIntro]           = useState(true)

  const [uploadError, setUploadError]       = useState<string | null>(null)
  const [videoError, setVideoError]         = useState<string | null>(null)

  const [isPending, startTransition]        = useTransition()
  const [isVideoPending, startVideoTrans]   = useTransition()
  const [isMorePending, startMoreTrans]     = useTransition()

  const [displayedMatches, setDisplayedMatches] = useState<FormEntry[]>(recentMatches)
  const [allMatchesLoaded, setAllMatchesLoaded] = useState(false)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const handleShowMore = useCallback(() => {
    startMoreTrans(async () => {
      const more = await fetchMoreMatchesAction(player.id, 50)
      setDisplayedMatches(more)
      setAllMatchesLoaded(true)
    })
  }, [player.id])

  function handleShowLess() {
    setDisplayedMatches(recentMatches)
    setAllMatchesLoaded(false)
  }

  const winRate = player.matchesPlayed > 0
    ? Math.round((player.wins / player.matchesPlayed) * 100)
    : 0
  const wonRivalries    = rivalries.filter((r) => r.winnerId === player.id)
  const activeRivalries = rivalries.filter((r) => r.status === 'active')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setUploadError(t('player.err.imageSize')); return }
    setUploadError(null)
    const fd = new FormData()
    fd.append('avatar', file)
    fd.append('targetUserId', player.id)
    startTransition(async () => {
      const result = await uploadAvatarAction(fd)
      if (result.error) setUploadError(result.error)
      else if (result.url) setAvatarUrl(result.url)
    })
    e.target.value = ''
  }

  function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { setVideoError(t('player.err.videoSize')); return }
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      setVideoError(t('player.err.videoFormat'))
      return
    }
    setVideoError(null)
    const ext = (file.type === 'video/webm' ? 'webm' : 'mp4') as 'mp4' | 'webm'
    e.target.value = ''
    startVideoTrans(async () => {
      // 1. Get a signed upload URL (tiny request, no binary through Next.js)
      const signed = await getSignedUploadUrlAction(player.id, ext)
      if (signed.error) { setVideoError(signed.error); return }

      // 2. PUT file directly from browser → Supabase Storage (bypasses Next.js body limit)
      const uploadRes = await fetch(signed.signedUrl!, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) {
        setVideoError('Upload failed. Please try again.')
        return
      }

      // 3. Save public URL to the database
      const result = await finalizeVideoUploadAction(player.id, signed.storagePath!)
      if (result.error) setVideoError(result.error)
      else if (result.url) setIntroVideoUrl(result.url)
    })
  }

  function handleRemoveVideo() {
    setVideoError(null)
    startVideoTrans(async () => {
      const result = await removeIntroVideoAction(player.id)
      if (result.error) setVideoError(result.error)
      else setIntroVideoUrl(null)
    })
  }

  const STATS = [
    { label: t('common.matches'), value: player.matchesPlayed },
    { label: t('common.wins'),    value: player.wins,    color: '#16a34a' },
    { label: t('common.draws'),   value: player.draws,   color: '#6b7280' },
    { label: t('common.losses'),  value: player.losses,  color: '#dc2626' },
  ]

  return (
    <>
      <IntroStyles />

      {/* ── Intro overlay — always shows; type depends on whether video exists ── */}
      {showIntro && (
        introVideoUrl
          ? <VideoIntroOverlay
              videoUrl={introVideoUrl}
              playerName={player.name}
              onDismiss={() => setShowIntro(false)}
            />
          : <AvatarIntroOverlay
              avatarUrl={avatarUrl}
              playerName={player.name}
              onDismiss={() => setShowIntro(false)}
            />
      )}

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
        {/* Breadcrumb + sign-out row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            <Link href="/leaderboard" style={{ color: '#6b7280', textDecoration: 'none' }}>{t('lb.title')}</Link>
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
                {t('common.signOut')}
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
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm"
                style={{ display: 'none' }}
                onChange={handleVideoFileChange}
              />
            </>
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
          {videoError && (
            <div style={{
              marginBottom: 12, padding: '8px 12px',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, fontSize: 12, color: '#dc2626',
            }}>
              {videoError}
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
                    {t('common.youSmall')}
                  </span>
                )}
                {!player.isActive && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', background: '#f9fafb', borderRadius: 8, padding: '2px 8px' }}>
                    {t('player.inactive')}
                  </span>
                )}
              </div>

              {badges.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {badges.map((b) => (
                    <span key={b.id} title={b.name} style={{ display: 'inline-flex' }}>
                      {BADGE_ICONS[b.badgeType] ?? <Award size={20} style={{ color: '#d97706' }} />}
                    </span>
                  ))}
                </div>
              )}

              {/* Admin: intro video controls */}
              {isAdmin && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isVideoPending}
                    style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid #d1d5db',
                      background: introVideoUrl ? '#f0fdf4' : '#f9fafb',
                      color: introVideoUrl ? '#15803d' : '#374151',
                      display: 'flex', alignItems: 'center', gap: 4,
                      opacity: isVideoPending ? 0.6 : 1,
                    }}
                  >
                    🎬 {isVideoPending ? t('player.uploading') : introVideoUrl ? t('player.changeIntroVideo') : t('player.uploadIntroVideo')}
                  </button>
                  {introVideoUrl && !isVideoPending && (
                    <button
                      onClick={handleRemoveVideo}
                      style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                        border: '1px solid #fecaca',
                        background: '#fef2f2', color: '#dc2626',
                      }}
                    >
                      {t('player.removeVideo')}
                    </button>
                  )}
                  {introVideoUrl && (
                    <button
                      onClick={() => setShowIntro(true)}
                      style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                        border: '1px solid #dbeafe',
                        background: '#eff6ff', color: '#2563eb',
                      }}
                    >
                      {t('player.previewVideo')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
            {STATS.map(({ label, value, color }) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 0', textAlign: 'center' }}>
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
            <span>{t('common.winRate')}: <strong style={{ color: '#111827' }}>{winRate}%</strong></span>
          </div>
        </div>

        {/* ── Recent matches ── */}
        {displayedMatches.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <SectionHeader>{t('player.recentMatches')}</SectionHeader>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
              {displayedMatches.map((m) => <FormPip key={m.matchId} result={m.result} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {displayedMatches.map((m) => (
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
                        {m.matchType === 'championship' ? t('player.matchType.championship') : t('home.friendly')} ·{' '}
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
            {/* Show more / show less */}
            {!allMatchesLoaded ? (
              <button
                onClick={handleShowMore}
                disabled={isMorePending}
                style={{
                  marginTop: 10, width: '100%',
                  padding: '9px 0', borderRadius: 10,
                  border: '1px solid #e5e7eb', background: '#f9fafb',
                  fontSize: 13, fontWeight: 600, color: '#374151',
                  cursor: isMorePending ? 'default' : 'pointer',
                  opacity: isMorePending ? 0.6 : 1,
                }}
              >
                {isMorePending ? t('common.loading') : t('player.showMore')}
              </button>
            ) : (
              <button
                onClick={handleShowLess}
                style={{
                  marginTop: 10, width: '100%',
                  padding: '9px 0', borderRadius: 10,
                  border: '1px solid #e5e7eb', background: '#f9fafb',
                  fontSize: 13, fontWeight: 600, color: '#374151',
                  cursor: 'pointer',
                }}
              >
                {t('player.showLess')}
              </button>
            )}
          </section>
        )}

        {/* ── Head-to-head ── */}
        {allPlayers.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <SectionHeader>{t('player.h2h')}</SectionHeader>
            <H2HSection playerId={player.id} allPlayers={allPlayers} playerName={player.name} />
          </section>
        )}

        {/* ── Championship placements ── */}
        {championshipPlacements.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <SectionHeader>{t('player.champSection')}</SectionHeader>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 60px 60px 60px 60px 60px',
                padding: '8px 14px', background: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 10, fontWeight: 700, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.06em', gap: 4,
              }}>
                <span>{t('player.matchType.championship')}</span>
                <span style={{ textAlign: 'center' }}>{t('player.rank')}</span>
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
                    <Link href={`/championships/${cp.championshipId}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                      {cp.championshipName}
                    </Link>
                    {cp.isActive && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 8, textTransform: 'uppercase' }}>
                        {t('common.active')}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}><RankBadge rank={cp.rank} total={cp.totalPlayers} /></div>
                  <div style={{ textAlign: 'center', fontWeight: 700, color: cp.rank === 1 ? '#d97706' : '#111827' }}>{cp.points}</div>
                  <div style={{ textAlign: 'center', color: '#374151' }}>{cp.wins}</div>
                  <div style={{ textAlign: 'center', color: '#374151' }}>{cp.draws}</div>
                  <div style={{ textAlign: 'center', color: '#374151' }}>{cp.losses}</div>
                  <div style={{ textAlign: 'center', fontWeight: 600, color: cp.goalDiff > 0 ? '#16a34a' : cp.goalDiff < 0 ? '#dc2626' : '#6b7280' }}>
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
              {t('player.badges')} ({wonRivalries.length} {t(wonRivalries.length !== 1 ? 'player.rivalryWins.many' : 'player.rivalryWins.one')})
            </SectionHeader>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {badges.map((b) => (
                <div key={b.id} style={{ border: '1px solid #fbbf24', borderRadius: 10, padding: '10px 16px', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex' }}>{BADGE_ICONS[b.badgeType] ?? <Award size={24} style={{ color: '#d97706' }} />}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{b.name}</div>
                    {b.description && (
                      <div style={{ fontSize: 11, color: '#b45309', marginTop: 1 }}>{b.description}</div>
                    )}
                    <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>
                      {t('player.earned', { date: new Date(b.earnedAt).toLocaleDateString() })}
                      {b.sourceRivalryId && (
                        <> · <Link href={`/rivalries/${b.sourceRivalryId}`} style={{ color: '#d97706' }}>{t('player.viewRivalry')}</Link></>
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
              {t('player.rivalriesTitle', { won: wonRivalries.length, active: activeRivalries.length })}
            </SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rivalries.map((r) => {
                const iWon    = r.winnerId === player.id
                const theyWon = r.winnerId !== null && r.winnerId !== player.id
                return (
                  <Link key={r.id} href={`/rivalries/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                      border: `1px solid ${iWon ? '#fbbf24' : '#e5e7eb'}`,
                      borderRadius: 10, padding: '12px 16px',
                      background: iWon ? '#fffbeb' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {iWon && <Trophy size={16} style={{ color: '#d97706', flexShrink: 0 }} />}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>vs {r.opponentName}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{t('player.firstTo', { n: r.bestOf })}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: iWon ? '#d97706' : '#111827' }}>
                          {r.myWins} – {r.theirWins}
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 12, textTransform: 'uppercase',
                          background: r.status === 'active' ? '#dcfce7' : iWon ? '#fef3c7' : '#f3f4f6',
                          color: r.status === 'active' ? '#16a34a' : iWon ? '#92400e' : theyWon ? '#6b7280' : '#6b7280',
                        }}>
                          {r.status === 'active' ? t('common.active') : iWon ? t('player.won') : t('player.lost')}
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
            {t('player.noHistory')}
          </div>
        )}

        <BottomNav userId={viewerId} />
      </div>
    </>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {children}
    </h2>
  )
}
