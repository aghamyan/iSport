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
import { getSignedHeroPhotoUrlAction, finalizeHeroPhotoUploadAction, removeHeroPhotoAction, updateHeroPhotoPositionAction } from '@/lib/auth/heroPhotoAction'
import { getSignedAudioUploadUrlAction, finalizeAudioUploadAction, updateAudioTrimAction, removeIntroAudioAction } from '@/lib/auth/introAudioAction'
import { useTranslation } from '@/lib/i18n/context'
import { BottomNav } from '@/app/components/BottomNav'

type PlayerData = {
  id: string
  name: string
  avatarUrl: string | null
  introVideoUrl: string | null
  heroPhotoUrl: string | null
  heroPhotoPosition: string
  introAudioUrl: string | null
  introAudioTrimStart: number
  introAudioTrimEnd: number | null
  instagramUrl: string | null
  naviCoords: string | null
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

const RED   = 'var(--accent)'
const DARK  = '#0a0a0a'

function nameToColor(name: string): string {
  const palette = ['#1d4ed8', '#7c3aed', '#059669', '#b45309', '#0891b2', '#9333ea', '#0f766e']
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(hash) % palette.length]
}

// ── All CSS ──────────────────────────────────────────────────
function AllStyles() {
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
        0%, 100% { box-shadow: 0 0 0 4px rgba(251,191,36,0.45), 0 0 35px 8px rgba(251,191,36,0.2); }
        50%       { box-shadow: 0 0 0 10px rgba(251,191,36,0.12), 0 0 55px 18px rgba(251,191,36,0.32); }
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
      @keyframes intro-letterbox-top  { from { transform: translateY(-100%); } to { transform: translateY(0); } }
      @keyframes intro-letterbox-bottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes intro-video-name {
        0%   { opacity: 0; transform: translateY(10px) scale(1.05); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes flash-in   { 0% { opacity: 0.25; } 40% { opacity: 0; } 100% { opacity: 0; } }
      @keyframes scan-sweep { 0% { transform: translateY(0); opacity: 0.9; } 100% { transform: translateY(100vh); opacity: 0; } }
      @keyframes video-border-glow {
        0%, 100% { box-shadow: inset 0 0 0 1px rgba(251,191,36,0.22), inset 0 0 50px 0 rgba(251,191,36,0.04); }
        50%       { box-shadow: inset 0 0 0 1px rgba(251,191,36,0.55), inset 0 0 70px 12px rgba(251,191,36,0.10); }
      }
      @keyframes corner-in-tl { 0% { opacity:0;transform:translate(-14px,-14px);} 100%{opacity:1;transform:translate(0,0);} }
      @keyframes corner-in-tr { 0% { opacity:0;transform:translate(14px,-14px); } 100%{opacity:1;transform:translate(0,0);} }
      @keyframes corner-in-bl { 0% { opacity:0;transform:translate(-14px,14px); } 100%{opacity:1;transform:translate(0,0);} }
      @keyframes corner-in-br { 0% { opacity:0;transform:translate(14px,14px);  } 100%{opacity:1;transform:translate(0,0);} }
      @keyframes diamond-pulse   { 0%,100%{opacity:.5;transform:rotate(45deg) scale(1);} 50%{opacity:1;transform:rotate(45deg) scale(1.5);} }
      @keyframes name-glow-pulse { 0%,100%{text-shadow:0 0 18px rgba(251,191,36,.4);} 50%{text-shadow:0 0 32px rgba(251,191,36,.85);} }
      @keyframes eyebrow-in { from{opacity:0;letter-spacing:.55em;} to{opacity:.65;letter-spacing:.28em;} }
      @keyframes gold-particle-float {
        0%  { transform:translateY(0) scale(1);   opacity:0; }
        15% {                                       opacity:1; }
        85% {                                       opacity:.8; }
        100%{ transform:translateY(-90px) scale(.2); opacity:0; }
      }

      /* ── Hero photo intro ── */
      @keyframes hero-ken-burns {
        0%   { transform: scale(1.12); }
        100% { transform: scale(1.0); }
      }
      @keyframes hero-spotlight {
        0%,100% { background: radial-gradient(ellipse 70% 60% at 50% 38%, rgba(251,191,36,0.07) 0%, transparent 70%); }
        50%      { background: radial-gradient(ellipse 70% 60% at 50% 38%, rgba(251,191,36,0.16) 0%, transparent 70%); }
      }
      @keyframes hero-meteor {
        0%   { transform: translate(0, -60px); opacity:0; }
        6%   { opacity:1; }
        88%  { opacity:0.7; }
        100% { transform: translate(220px, 700px); opacity:0; }
      }
      @keyframes hero-name-reveal {
        0%   { opacity:0; transform: translateY(22px) scaleX(0.88); letter-spacing:0.45em; filter:blur(6px); }
        100% { opacity:1; transform: translateY(0)    scaleX(1);    letter-spacing:0.22em; filter:blur(0); }
      }
      @keyframes hero-eyebrow-in {
        0%   { opacity:0; letter-spacing:0.65em; transform:translateY(8px); }
        100% { opacity:0.72; letter-spacing:0.32em; transform:translateY(0); }
      }
      @keyframes hero-line-grow {
        from { transform: scaleX(0); opacity:0; }
        to   { transform: scaleX(1); opacity:1; }
      }
      @keyframes hero-shimmer-sweep {
        0%   { background-position: -300% center; }
        100% { background-position: 300% center; }
      }
      @keyframes hero-vignette-in {
        from { opacity:0; }
        to   { opacity:1; }
      }
      @keyframes hero-bottom-bar-in {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
      }

      /* ── Audio ── */
      @keyframes audio-wave-bar {
        0%, 100% { transform: scaleY(0.3); opacity: 0.45; }
        50%       { transform: scaleY(1.0); opacity: 1.0;  }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes hero-top-bar-in {
        from { transform: translateY(-100%); }
        to   { transform: translateY(0); }
      }

      /* ── Hero ── */
      .pp-hero {
        position: relative; overflow: hidden; background: ${DARK};
        min-height: 720px;
        display: flex; flex-direction: column;
      }
      .pp-hero-content {
        position: relative; z-index: 2;
        width: 46%; min-width: 300px;
        padding: 0 40px 72px 48px;
        margin-top: auto;
      }
      .pp-hero-name {
        font-size: clamp(48px, 5.5vw, 92px);
        font-weight: 900;
        color: #fff;
        text-transform: uppercase;
        line-height: 0.9;
        letter-spacing: -0.02em;
        margin: 14px 0 20px;
        font-family: system-ui, sans-serif;
      }
      .pp-hero-stat-row { display:flex; align-items:flex-start; gap:0; margin-top:40px; }
      .pp-hero-stat-divider { width:1px; background:rgba(255,255,255,0.22); margin:0 32px; align-self:stretch; min-height:100px; }

      /* ── Photo frame ── */
      .pp-hero-photo-frame {
        position: absolute;
        right: 0; top: 0; bottom: 0;
        width: 62%;
        z-index: 1;
      }
      .pp-hero-photo-frame img {
        width: 100%; height: 100%;
        object-fit: cover;
        object-position: top center;
        display: block;
      }
      /* Dark fade from left covering ~38% of the hero width */
      .pp-hero-photo-left-fade {
        position: absolute; left: 0; top: 0; bottom: 0; width: 68%;
        background: linear-gradient(to right,
          ${DARK} 0%,
          ${DARK} 22%,
          rgba(10,10,10,0.95) 35%,
          rgba(10,10,10,0.80) 48%,
          rgba(10,10,10,0.40) 62%,
          rgba(10,10,10,0.10) 78%,
          transparent 100%
        );
        z-index: 2; pointer-events: none;
      }
      /* Thin bottom shadow to ground the section */
      .pp-hero-photo-bottom-fade {
        position: absolute; left: 0; right: 0; bottom: 0; height: 10%;
        background: linear-gradient(to top, ${DARK} 0%, transparent 100%);
        z-index: 2; pointer-events: none;
      }
      .pp-hero-photo-upload-zone {
        position: absolute; right: 0; top: 0; bottom: 0; width: 62%;
        z-index: 1; display: flex; align-items: center; justify-content: center; cursor: pointer;
      }
      .pp-hero-photo-upload-zone:hover .pp-hero-upload-inner { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.04); }

      /* ── Sections / body ── */
      .pp-stat-donut-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; margin-bottom:0; }
      .pp-detail-grid     { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
      .pp-match-row       { display:flex; align-items:center; gap:16px; padding:16px 0; border-bottom:1px solid #f3f4f6; }
      .pp-match-actions   { display:flex; flex-direction:column; align-items:flex-end; gap:6px; margin-left:auto; flex-shrink:0; }
      .pp-champ-grid      { display:grid; grid-template-columns:1fr 60px 60px 60px 60px 60px 60px; gap:4px; }

      @media (max-width: 900px) {
        .pp-hero { min-height: 560px; }
        .pp-hero-content { width: 52%; padding: 0 28px 52px 28px; }
        .pp-hero-name { font-size: clamp(36px, 7vw, 60px); }
        .pp-hero-stat-divider { margin: 0 20px; min-height: 80px; }
        .pp-hero-photo-frame { width: 58%; }
        .pp-hero-photo-upload-zone { width: 58%; }
      }

      @media (max-width: 600px) {
        .pp-hero { min-height: 0; }
        .pp-hero-photo-frame,
        .pp-hero-photo-upload-zone { display: none !important; }
        /* push name below the fixed 58px nav + give breathing room */
        .pp-hero-content { padding: calc(var(--fixed-nav-h) + 14px) 16px 20px; width: 100%; min-width: unset; }
        .pp-hero-stat-row { display: none; }
        .pp-hero-name { font-size: 30px; margin: 6px 0 0; }
        .pp-section-title { font-size: 22px !important; }
        .pp-stat-donut-grid { grid-template-columns: 1fr; }
        .pp-detail-grid     { grid-template-columns: repeat(2,1fr); }
        .pp-detail-grid > div { padding: 14px 16px; }
        .pp-match-row       { flex-wrap: wrap; gap: 10px; }
        .pp-match-actions   { flex-direction: row; margin-left: 0; }
        .pp-champ-grid      { grid-template-columns: 1fr 32px 32px 32px 32px 32px 32px; font-size: 10px; gap: 2px; }
      }

      @media (max-width: 430px) {
        .pp-hero { min-height: 0; }
        .pp-hero-content { padding: calc(var(--fixed-nav-h) + 12px) 14px 18px; }
        .pp-hero-name { font-size: 26px; margin: 4px 0 0; }
        .pp-section-title { font-size: 20px !important; }
        .pp-champ-grid { grid-template-columns: 1fr 28px 28px 28px 28px 28px 28px; gap: 1px; font-size: 9px; }
        .pp-detail-grid > div { padding: 12px 14px; }
      }

      /* ── Mobile hero photo banner (below hero text on mobile) ── */
      .pp-hero-photo-mobile-banner {
        display: none;
        position: relative;
        overflow: hidden;
        height: 320px;
        background: #111827;
        flex-shrink: 0;
      }
      .pp-hero-photo-mobile-banner img {
        width: 100%; height: 100%;
        object-fit: cover;
        display: block;
      }
      @media (max-width: 600px) {
        .pp-hero-photo-mobile-banner { display: block; }
      }
      @media (max-width: 430px) {
        .pp-hero-photo-mobile-banner { height: 290px; }
      }

      /* hero+photo already clear the nav — kill redundant app-page overrides */
      .pp-body { padding-top: 0 !important; padding-left: 20px !important; }

      @media (max-width: 600px) {
        .pp-section-title-wrap { padding-top: 14px; padding-bottom: 10px; }
      }

      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
      }
    `}</style>
  )
}

// ── Sparkles / intro overlay constants ───────────────────────
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

const HERO_METEORS = [
  { top: '-4%', left: '78%', delay: '0.3s',  dur: '2.6s', size: 1.5 },
  { top: '-4%', left: '52%', delay: '1.5s',  dur: '2.9s', size: 2   },
  { top: '-4%', left: '31%', delay: '3.0s',  dur: '2.3s', size: 1.5 },
  { top: '-4%', left: '65%', delay: '0.8s',  dur: '3.2s', size: 1   },
  { top: '-4%', left: '18%', delay: '4.2s',  dur: '2.7s', size: 2   },
  { top: '-4%', left: '88%', delay: '2.1s',  dur: '2.5s', size: 1.5 },
  { top: '-4%', left: '42%', delay: '5.0s',  dur: '2.8s', size: 1   },
]

// ── Hero photo intro overlay ──────────────────────────────────
function HeroPhotoIntroOverlay({
  photoUrl, playerName, onDismiss,
  audioUrl, trimStart = 0, trimEnd,
}: {
  photoUrl: string; playerName: string; onDismiss: () => void
  audioUrl?: string | null; trimStart?: number; trimEnd?: number | null
}) {
  const { t } = useTranslation()
  const [opacity,       setOpacity]       = useState(1)
  const [isForcedMuted, setIsForcedMuted] = useState(false)
  const audioRef      = useRef<HTMLAudioElement>(null)
  const progressRef   = useRef<HTMLDivElement>(null)

  // Auto-dismiss only when no audio
  useEffect(() => {
    if (audioUrl) return
    const id = setTimeout(() => setOpacity(0), 4800)
    return () => clearTimeout(id)
  }, [audioUrl])

  // Start audio playback
  useEffect(() => {
    if (!audioUrl) return
    const id = setTimeout(async () => {
      const a = audioRef.current; if (!a) return
      try { a.currentTime = trimStart; a.muted = false; await a.play() }
      catch { a.muted = true; setIsForcedMuted(true); a.play().catch(() => {}) }
    }, 120)
    return () => clearTimeout(id)
  }, [audioUrl, trimStart])

  function dismiss() { setOpacity(0) }
  function handleTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && opacity === 0) onDismiss()
  }

  function handleTimeUpdate() {
    const a = audioRef.current; if (!a) return
    const te = (trimEnd != null) ? trimEnd : a.duration
    if (isFinite(te) && a.currentTime >= te - 0.05) { dismiss(); return }
    const elapsed  = a.currentTime - trimStart
    const selDur   = Math.max((isFinite(te) ? te : a.duration) - trimStart, 0.001)
    const pct      = Math.max(0, Math.min(1, elapsed / selDur))
    if (progressRef.current) progressRef.current.style.width = `${pct * 100}%`
  }

  function handleAudioEnded() { dismiss() }
  function unmute() { const a = audioRef.current; if (a) { a.muted = false; setIsForcedMuted(false) } }

  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      onClick={dismiss}
      style={{ position:'fixed',inset:0,zIndex:9999,background:'#000',opacity,transition:'opacity 0.75s ease',cursor:'default' }}
    >
      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef} src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleAudioEnded}
          preload="auto"
          style={{ display:'none' }}
        />
      )}

      {/* Ken Burns hero photo */}
      <img
        src={photoUrl} alt={playerName}
        style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'top center',animation:'hero-ken-burns 6s ease-out both',filter:'brightness(0.72) contrast(1.08) saturate(1.12)',zIndex:1 }}
      />

      {/* Vignette */}
      <div style={{ position:'absolute',inset:0,zIndex:2,pointerEvents:'none',animation:'hero-vignette-in 1.2s 0.3s both',background:'radial-gradient(ellipse at 50% 40%, transparent 28%, rgba(0,0,0,0.5) 68%, rgba(0,0,0,0.88) 100%)' }} />

      {/* Scanlines */}
      <div style={{ position:'absolute',inset:0,zIndex:3,pointerEvents:'none',backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)' }} />

      {/* Flash burst on open */}
      <div style={{ position:'absolute',inset:0,zIndex:4,pointerEvents:'none',background:'rgba(255,255,255,0.18)',animation:'flash-in 0.65s ease-out both' }} />

      {/* Gold scan sweep */}
      <div style={{ position:'absolute',top:58,left:0,right:0,height:2,zIndex:5,pointerEvents:'none',background:'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.55) 25%, rgba(255,255,255,0.9) 50%, rgba(251,191,36,0.55) 75%, transparent 100%)',animation:'scan-sweep 1.05s 0.15s ease-out both' }} />

      {/* Spotlight pulse */}
      <div style={{ position:'absolute',inset:0,zIndex:4,pointerEvents:'none',animation:'hero-spotlight 3.2s 1.2s ease-in-out infinite' }} />

      {/* Border glow */}
      <div style={{ position:'absolute',inset:0,zIndex:6,pointerEvents:'none',animation:'video-border-glow 2.8s 1.0s ease-in-out infinite' }} />

      {/* Meteor shower */}
      {HERO_METEORS.map((m, i) => (
        <div key={i} style={{ position:'absolute',top:m.top,left:m.left,zIndex:5,pointerEvents:'none',animation:`hero-meteor ${m.dur} ${m.delay} linear infinite` }}>
          <div style={{ width:m.size,height:m.size*52,background:'linear-gradient(to bottom, transparent 0%, rgba(251,191,36,0.85) 45%, rgba(255,255,255,0.9) 55%, transparent 100%)',borderRadius:m.size,transform:'rotate(-28deg)' }} />
        </div>
      ))}

      {/* Gold floating particles */}
      {VIDEO_PARTICLES.map((p, i) => (
        <div key={i} style={{ position:'absolute',top:p.top,left:p.left,zIndex:6,width:p.size,height:p.size,borderRadius:'50%',background:'#fbbf24',boxShadow:`0 0 ${p.size*3}px ${p.size+1}px rgba(251,191,36,0.65)`,animation:`gold-particle-float ${p.dur} ${p.delay} ease-in-out infinite`,pointerEvents:'none' }} />
      ))}

      {/* Letterbox — top */}
      <div style={{ position:'absolute',top:0,left:0,right:0,height:58,background:'#000',zIndex:8,animation:'hero-top-bar-in 0.35s cubic-bezier(0.4,0,0.2,1) both',pointerEvents:'none' }}>
        <div style={{ position:'absolute',bottom:0,left:0,right:0,height:1,background:'linear-gradient(90deg, transparent, rgba(251,191,36,0.65) 20%, rgba(251,191,36,0.65) 80%, transparent)' }} />
      </div>

      {/* Letterbox — bottom with name + audio progress */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,zIndex:8,animation:'hero-bottom-bar-in 0.35s cubic-bezier(0.4,0,0.2,1) both',background:'linear-gradient(to top, #000 60%, rgba(0,0,0,0.92) 100%)' }}>
        {/* Gold accent line */}
        <div style={{ height:1,background:'linear-gradient(90deg, transparent, rgba(251,191,36,0.65) 20%, rgba(251,191,36,0.65) 80%, transparent)' }} />

        {/* Audio progress bar — fills as track plays */}
        {audioUrl && (
          <div style={{ height:3,background:'rgba(255,255,255,0.06)',position:'relative',overflow:'hidden' }}>
            <div
              ref={progressRef}
              style={{ position:'absolute',inset:'0 auto 0 0',width:'0%',background:'linear-gradient(90deg, rgba(251,191,36,0.7), rgba(255,255,255,0.95) 50%, rgba(251,191,36,0.7))',boxShadow:'2px 0 10px rgba(251,191,36,0.8)' }}
            />
          </div>
        )}

        <div style={{ padding:'16px 0 32px',display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
          {/* Eyebrow — "NOW PLAYING" with animated bars when audio, "PLAYER" otherwise */}
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {audioUrl && (
              <div style={{ display:'flex',alignItems:'center',gap:2,height:12 }}>
                {[1.0,0.55,0.85,0.65,1.0].map((h,i) => (
                  <div key={i} style={{ width:2,height:h*12,background:'rgba(251,191,36,0.75)',borderRadius:1,animation:`audio-wave-bar 0.7s ${i*0.13}s ease-in-out infinite` }} />
                ))}
              </div>
            )}
            <div style={{ fontSize:9,fontWeight:700,color:'rgba(251,191,36,0.78)',letterSpacing:'0.32em',textTransform:'uppercase',animation:'hero-eyebrow-in 0.6s 0.55s both ease-out' }}>
              {audioUrl ? 'NOW PLAYING' : 'PLAYER'}
            </div>
            {audioUrl && (
              <div style={{ display:'flex',alignItems:'center',gap:2,height:12 }}>
                {[0.65,1.0,0.55,0.9,0.7].map((h,i) => (
                  <div key={i} style={{ width:2,height:h*12,background:'rgba(251,191,36,0.75)',borderRadius:1,animation:`audio-wave-bar 0.7s ${i*0.16+0.05}s ease-in-out infinite` }} />
                ))}
              </div>
            )}
          </div>

          {/* Name row with gold shimmer */}
          <div style={{ display:'flex',alignItems:'center',gap:14,animation:'hero-name-reveal 0.7s 0.4s both cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ flex:'0 0 56px',height:1,background:'linear-gradient(to right, transparent, rgba(251,191,36,0.8))',animation:'hero-line-grow 0.55s 1.0s both',transformOrigin:'right center' }} />
            <div style={{ width:5,height:5,background:'rgba(251,191,36,0.9)',flexShrink:0,transform:'rotate(45deg)',animation:'diamond-pulse 2s 1.2s ease-in-out infinite' }} />
            <h2 style={{
              margin:0,fontSize:22,fontWeight:900,color:'transparent',letterSpacing:'0.22em',textTransform:'uppercase',whiteSpace:'nowrap',
              backgroundImage:'linear-gradient(90deg, #fff 20%, #fbbf24 40%, #fff 55%, #fde68a 70%, #fff 85%)',
              backgroundSize:'300% auto',WebkitBackgroundClip:'text',backgroundClip:'text',
              animation:'hero-shimmer-sweep 3.5s 1.0s ease-in-out infinite, name-glow-pulse 2.8s 1.3s ease-in-out infinite',
            }}>
              {playerName}
            </h2>
            <div style={{ width:5,height:5,background:'rgba(251,191,36,0.9)',flexShrink:0,transform:'rotate(45deg)',animation:'diamond-pulse 2s 1.5s ease-in-out infinite' }} />
            <div style={{ flex:'0 0 56px',height:1,background:'linear-gradient(to left, transparent, rgba(251,191,36,0.8))',animation:'hero-line-grow 0.55s 1.0s both',transformOrigin:'left center' }} />
          </div>

          {/* Hint */}
          <div style={{ fontSize:9,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em',textTransform:'uppercase',animation:'intro-subtitle-in 0.5s 1.8s both' }}>
            {audioUrl ? 'MUSIC ENDS · STATS APPEAR' : 'TAP ANYWHERE TO DISMISS'}
          </div>
        </div>
      </div>

      {/* Corner brackets */}
      <div style={{ position:'absolute',top:66,left:12,zIndex:9,pointerEvents:'none',animation:'corner-in-tl 0.5s 0.2s cubic-bezier(0.34,1.45,0.64,1) both' }}><svg width="44" height="44" viewBox="0 0 48 48" fill="none"><path d="M 46 2 L 2 2 L 2 46" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
      <div style={{ position:'absolute',top:66,right:12,zIndex:9,pointerEvents:'none',animation:'corner-in-tr 0.5s 0.3s cubic-bezier(0.34,1.45,0.64,1) both' }}><svg width="44" height="44" viewBox="0 0 48 48" fill="none"><path d="M 2 2 L 46 2 L 46 46" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
      <div style={{ position:'absolute',bottom:145,left:12,zIndex:9,pointerEvents:'none',animation:'corner-in-bl 0.5s 0.4s cubic-bezier(0.34,1.45,0.64,1) both' }}><svg width="44" height="44" viewBox="0 0 48 48" fill="none"><path d="M 46 46 L 2 46 L 2 2" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
      <div style={{ position:'absolute',bottom:145,right:12,zIndex:9,pointerEvents:'none',animation:'corner-in-br 0.5s 0.5s cubic-bezier(0.34,1.45,0.64,1) both' }}><svg width="44" height="44" viewBox="0 0 48 48" fill="none"><path d="M 2 46 L 46 46 L 46 2" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>

      {/* Skip button */}
      <button
        onClick={(e) => { e.stopPropagation(); dismiss() }}
        style={{ position:'absolute',top:15,right:20,zIndex:15,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(251,191,36,0.35)',borderRadius:20,color:'rgba(255,255,255,0.75)',fontSize:11,fontWeight:600,padding:'5px 14px',cursor:'pointer',letterSpacing:'0.06em' }}
      >
        {t('player.skip')}
      </button>

      {/* Unmute button (shown when browser forced mute) */}
      {isForcedMuted && (
        <button
          onClick={(e) => { e.stopPropagation(); unmute() }}
          style={{ position:'absolute',bottom:168,left:'50%',transform:'translateX(-50%)',zIndex:15,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(10px)',border:'1px solid rgba(251,191,36,0.55)',borderRadius:24,color:'#fbbf24',fontSize:11,fontWeight:700,padding:'8px 20px',cursor:'pointer',letterSpacing:'0.1em',display:'flex',alignItems:'center',gap:8,whiteSpace:'nowrap' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          TAP FOR SOUND
        </button>
      )}
    </div>
  )
}

// ── Audio waveform trimmer modal ──────────────────────────────
function AudioTrimmerModal({
  audioUrl, initialStart, initialEnd, playerId, onApply, onClose,
}: {
  audioUrl: string
  initialStart: number
  initialEnd: number | null
  playerId: string
  onApply: (start: number, end: number | null) => void
  onClose: () => void
}) {
  const [duration,     setDuration]     = useState(0)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [trimStart,    setTrimStart]    = useState(initialStart)
  const [trimEnd,      setTrimEnd]      = useState(initialEnd ?? 0)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [playheadPct,  setPlayheadPct]  = useState(0)
  const [isSaving,     setIsSaving]     = useState(false)
  const [loadError,    setLoadError]    = useState<string|null>(null)

  const audioRef     = useRef<HTMLAudioElement>(null)
  const timelineRef  = useRef<HTMLDivElement>(null)
  const isPlayRef    = useRef(false)
  const trimStartRef = useRef(initialStart)
  const trimEndRef   = useRef(initialEnd ?? 0)
  const animRef      = useRef(0)

  useEffect(() => { trimStartRef.current = trimStart }, [trimStart])
  useEffect(() => { trimEndRef.current   = trimEnd   }, [trimEnd])

  // Analyse waveform via Web Audio API
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const Ctx = (window.AudioContext ?? (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)
        const ctx = new Ctx()
        const ab  = await (await fetch(audioUrl)).arrayBuffer()
        const buf = await ctx.decodeAudioData(ab)
        ctx.close()
        if (cancelled) return
        const dur = buf.duration
        setDuration(dur)
        setTrimEnd(prev => (initialEnd === null || prev === 0) ? dur : prev)
        trimEndRef.current = (initialEnd === null || trimEndRef.current === 0) ? dur : trimEndRef.current
        const ch = buf.getChannelData(0)
        const N  = 120
        const bs = Math.floor(ch.length / N)
        const raw: number[] = []
        for (let i = 0; i < N; i++) {
          const s = i * bs; let sum = 0
          for (let j = s; j < s + bs; j++) sum += Math.abs(ch[j])
          raw.push(sum / bs)
        }
        const mx = Math.max(...raw, 0.001)
        setWaveformData(raw.map(v => v / mx))
      } catch { setLoadError('Could not decode audio — try another format.') }
    }
    load()
    return () => { cancelled = true }
  }, [audioUrl, initialEnd])

  // Fallback: duration from <audio> element + seeded fake waveform
  function handleAudioMeta() {
    const a = audioRef.current; if (!a || duration > 0) return
    const dur = a.duration
    setDuration(dur)
    const end = initialEnd ?? dur
    setTrimEnd(end); trimEndRef.current = end
    if (waveformData.length === 0) {
      let s = audioUrl.length * 1337
      setWaveformData(Array.from({length:120}, () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return 0.15 + (s / 0xffffffff) * 0.85
      }))
    }
  }

  function getTimeAt(clientX: number) {
    const r = timelineRef.current?.getBoundingClientRect()
    if (!r || duration <= 0) return 0
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration))
  }

  function makeDrag(which: 'start'|'end') {
    return (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      const move = (ev: MouseEvent | TouchEvent) => {
        const x = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX
        const t = getTimeAt(x)
        if (which === 'start') {
          const v = Math.max(0, Math.min(t, trimEndRef.current - 0.5))
          trimStartRef.current = v; setTrimStart(v)
        } else {
          const v = Math.max(trimStartRef.current + 0.5, Math.min(t, duration))
          trimEndRef.current = v; setTrimEnd(v)
        }
      }
      const up = () => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('touchmove', move)
        document.removeEventListener('mouseup',   up)
        document.removeEventListener('touchend',  up)
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('touchmove', move, {passive:false})
      document.addEventListener('mouseup',  up)
      document.addEventListener('touchend', up)
    }
  }

  function rafTick() {
    const a = audioRef.current
    if (!a || !isPlayRef.current) return
    const elapsed = a.currentTime - trimStartRef.current
    const selDur  = Math.max(trimEndRef.current - trimStartRef.current, 0.001)
    const pct = (trimStartRef.current / duration) * 100 + (elapsed / selDur) * ((trimEndRef.current - trimStartRef.current) / duration) * 100
    setPlayheadPct(Math.min(pct, (trimEndRef.current / duration) * 100))
    if (a.currentTime >= trimEndRef.current - 0.05 || a.ended) {
      a.pause(); isPlayRef.current = false; setIsPlaying(false)
      setPlayheadPct((trimEndRef.current / duration) * 100)
      return
    }
    animRef.current = requestAnimationFrame(rafTick)
  }

  function playPreview() {
    const a = audioRef.current; if (!a || duration <= 0) return
    a.currentTime = trimStartRef.current
    a.play().then(() => { isPlayRef.current = true; setIsPlaying(true); animRef.current = requestAnimationFrame(rafTick) }).catch(() => {})
  }
  function pausePreview() {
    audioRef.current?.pause(); isPlayRef.current = false; setIsPlaying(false); cancelAnimationFrame(animRef.current)
  }

  useEffect(() => () => { cancelAnimationFrame(animRef.current); audioRef.current?.pause() }, [])

  async function handleApply() {
    setIsSaving(true)
    const end = (duration > 0 && trimEnd >= duration - 0.1) ? null : trimEnd
    const r = await updateAudioTrimAction(playerId, trimStart, end)
    setIsSaving(false)
    if (!r.error) onApply(trimStart, end)
    onClose()
  }

  const fmt = (s: number) => isFinite(s) && !isNaN(s)
    ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
    : '–:––'

  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0
  const endPct   = duration > 0 ? (trimEnd   / duration) * 100 : 100
  const selSec   = Math.max(0, trimEnd - trimStart)

  return (
    <div
      style={{ position:'fixed',inset:0,zIndex:10000,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width:'100%',maxWidth:620,background:'#111',border:'1px solid rgba(251,191,36,0.28)',borderRadius:16,overflow:'visible',boxShadow:'0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(251,191,36,0.08)' }}>

        {/* Header */}
        <div style={{ padding:'18px 22px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <span style={{ fontSize:17 }}>🎵</span>
            <div>
              <div style={{ fontSize:13,fontWeight:800,color:'#fff',textTransform:'uppercase',letterSpacing:'0.07em' }}>Trim Intro Audio</div>
              {duration > 0 && <div style={{ fontSize:11,color:'rgba(255,255,255,0.38)',marginTop:1 }}>Full track: {fmt(duration)}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:19,cursor:'pointer',padding:'2px 6px',lineHeight:1 }}>✕</button>
        </div>

        {/* Waveform */}
        <div style={{ padding:'24px 22px 10px' }}>
          {loadError && <div style={{ fontSize:11,color:'#fca5a5',marginBottom:8,padding:'6px 10px',background:'rgba(220,38,38,0.12)',borderRadius:6 }}>{loadError}</div>}

          <div style={{ position:'relative', userSelect:'none' }}>

            {/* Bars */}
            <div
              ref={timelineRef}
              style={{ display:'flex',alignItems:'center',gap:1.5,height:92,background:'rgba(255,255,255,0.025)',borderRadius:10,padding:'6px 4px',overflow:'hidden',cursor:'crosshair' }}
            >
              {waveformData.length === 0 ? (
                <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.22)',fontSize:12,gap:9 }}>
                  <span style={{ display:'inline-block',width:13,height:13,border:'2px solid rgba(251,191,36,0.45)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
                  Analysing audio…
                </div>
              ) : waveformData.map((amp, i) => {
                const pct = (i / waveformData.length) * 100
                const inSel = pct >= startPct && pct <= endPct
                return (
                  <div key={i} style={{ flex:'1 0 0',minWidth:2,height:Math.max(3, amp*80),borderRadius:2,background:inSel ? `rgba(251,191,36,${0.38+amp*0.62})` : `rgba(255,255,255,${0.04+amp*0.09})`,boxShadow:inSel&&amp>0.65?`0 0 4px rgba(251,191,36,0.28)`:'none' }} />
                )
              })}
            </div>

            {/* Playhead */}
            {playheadPct > 0 && (
              <div style={{ position:'absolute',top:0,bottom:0,left:`${playheadPct}%`,width:2,background:'rgba(255,255,255,0.85)',boxShadow:'0 0 6px rgba(255,255,255,0.5)',pointerEvents:'none',zIndex:10,transform:'translateX(-1px)' }} />
            )}

            {/* Dim outside-selection overlay */}
            <div style={{ position:'absolute',top:0,bottom:0,left:0,width:`${startPct}%`,background:'rgba(0,0,0,0.52)',pointerEvents:'none',zIndex:3,borderRadius:'10px 0 0 10px' }} />
            <div style={{ position:'absolute',top:0,bottom:0,left:`${endPct}%`,right:0,background:'rgba(0,0,0,0.52)',pointerEvents:'none',zIndex:3,borderRadius:'0 10px 10px 0' }} />

            {/* Start handle */}
            <div
              onMouseDown={makeDrag('start')}
              onTouchStart={makeDrag('start')}
              style={{ position:'absolute',top:0,bottom:0,left:`${startPct}%`,width:3,background:'#fbbf24',cursor:'ew-resize',zIndex:5,transform:'translateX(-1.5px)',touchAction:'none' }}
            >
              <div style={{ position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',width:19,height:19,borderRadius:'50%',background:'#fbbf24',boxShadow:'0 0 12px rgba(251,191,36,0.9)',border:'2.5px solid #fff',cursor:'ew-resize' }} />
              <div style={{ position:'absolute',bottom:-9,left:'50%',transform:'translateX(-50%)',width:13,height:13,borderRadius:'50%',background:'#fbbf24',boxShadow:'0 0 8px rgba(251,191,36,0.6)',cursor:'ew-resize' }} />
            </div>

            {/* End handle */}
            <div
              onMouseDown={makeDrag('end')}
              onTouchStart={makeDrag('end')}
              style={{ position:'absolute',top:0,bottom:0,left:`${endPct}%`,width:3,background:'#fbbf24',cursor:'ew-resize',zIndex:5,transform:'translateX(-1.5px)',touchAction:'none' }}
            >
              <div style={{ position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',width:19,height:19,borderRadius:'50%',background:'#fbbf24',boxShadow:'0 0 12px rgba(251,191,36,0.9)',border:'2.5px solid #fff',cursor:'ew-resize' }} />
              <div style={{ position:'absolute',bottom:-9,left:'50%',transform:'translateX(-50%)',width:13,height:13,borderRadius:'50%',background:'#fbbf24',boxShadow:'0 0 8px rgba(251,191,36,0.6)',cursor:'ew-resize' }} />
            </div>
          </div>

          {/* Time stamps */}
          {duration > 0 && (
            <div style={{ position:'relative',height:26,marginTop:6 }}>
              <div style={{ position:'absolute',left:`${startPct}%`,transform:'translateX(-50%)',fontSize:11,fontWeight:700,color:'#fbbf24',whiteSpace:'nowrap' }}>{fmt(trimStart)}</div>
              <div style={{ position:'absolute',left:`${endPct}%`,transform:'translateX(-50%)',fontSize:11,fontWeight:700,color:'#fbbf24',whiteSpace:'nowrap' }}>{fmt(trimEnd)}</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding:'10px 22px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <button
              onClick={isPlaying ? pausePreview : playPreview}
              disabled={duration <= 0}
              style={{ display:'flex',alignItems:'center',gap:7,background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.38)',borderRadius:8,color:'#fbbf24',fontSize:12,fontWeight:700,padding:'8px 16px',cursor:duration<=0?'default':'pointer',letterSpacing:'0.06em',opacity:duration<=0?0.4:1 }}
            >
              {isPlaying ? '⏸ PAUSE' : '▶ PREVIEW'}
            </button>
            {selSec > 0 && (
              <span style={{ fontSize:11,color:'rgba(255,255,255,0.35)',fontWeight:600 }}>{fmt(selSec)} selected</span>
            )}
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'rgba(255,255,255,0.55)',fontSize:12,fontWeight:600,padding:'8px 16px',cursor:'pointer' }}>
              CANCEL
            </button>
            <button
              onClick={handleApply}
              disabled={isSaving||duration<=0}
              style={{ background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.48)',borderRadius:8,color:'#fbbf24',fontSize:12,fontWeight:700,padding:'8px 18px',cursor:isSaving||duration<=0?'default':'pointer',letterSpacing:'0.05em',opacity:duration<=0?0.4:1 }}
            >
              {isSaving ? 'SAVING…' : '✓ APPLY TRIM'}
            </button>
          </div>
        </div>

        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={handleAudioMeta} preload="auto" style={{ display:'none' }} />
      </div>
    </div>
  )
}

// ── Avatar-based intro overlay ────────────────────────────────
function AvatarIntroOverlay({ avatarUrl, playerName, onDismiss }: { avatarUrl: string | null; playerName: string; onDismiss: () => void }) {
  const { t } = useTranslation()
  const [opacity, setOpacity] = useState(1)
  useEffect(() => { const id = setTimeout(() => setOpacity(0), 3700); return () => clearTimeout(id) }, [])
  function dismiss() { setOpacity(0) }
  function handleTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) { if (e.target === e.currentTarget && opacity === 0) onDismiss() }
  const initials = playerName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div onTransitionEnd={handleTransitionEnd} style={{ position:'fixed',inset:0,zIndex:9999,background:'radial-gradient(ellipse at 50% 36%, #1e0a4a 0%, #07000e 55%, #000 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',opacity,transition:'opacity 0.65s ease' }}>
      {SPARKLES.map((s, i) => (
        <div key={i} style={{ position:'absolute',top:s.top,left:s.left,width:s.size,height:s.size,borderRadius:'50%',background:'var(--card)',boxShadow:`0 0 ${s.size*2}px ${s.size}px rgba(251,191,36,0.75)`,animation:`intro-sparkle ${s.dur} ${s.delay} ease-in-out infinite`,pointerEvents:'none' }} />
      ))}
      <div style={{ position:'absolute',width:300,height:300,borderRadius:'50%',background:'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',pointerEvents:'none' }} />
      <div style={{ animation:'intro-avatar-in 0.9s 0.05s both cubic-bezier(0.34,1.45,0.64,1)',position:'relative',zIndex:1 }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={playerName} style={{ width:134,height:134,borderRadius:'50%',objectFit:'cover',display:'block',border:'3px solid rgba(251,191,36,0.9)',animation:'intro-ring-pulse 2.3s 0.95s ease-in-out infinite' }} />
        ) : (
          <div style={{ width:134,height:134,borderRadius:'50%',background:`linear-gradient(135deg, ${nameToColor(playerName)} 0%, ${nameToColor(playerName+'x')} 100%)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:46,fontWeight:800,color:'#fff',border:'3px solid rgba(251,191,36,0.9)',animation:'intro-ring-pulse 2.3s 0.95s ease-in-out infinite' }}>{initials}</div>
        )}
      </div>
      <div style={{ marginTop:30,textAlign:'center',zIndex:1,animation:'intro-name-in 0.75s 0.65s both ease-out' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:14 }}>
          <div style={{ height:1,width:46,background:'linear-gradient(to right, transparent, rgba(251,191,36,0.85))',animation:'intro-line-expand 0.55s 1.1s both',transformOrigin:'right center' }} />
          <h1 style={{ margin:0,fontSize:28,fontWeight:900,color:'#fff',letterSpacing:'0.06em',textTransform:'uppercase',textShadow:'0 0 40px rgba(251,191,36,0.6)' }}>{playerName}</h1>
          <div style={{ height:1,width:46,background:'linear-gradient(to left, transparent, rgba(251,191,36,0.85))',animation:'intro-line-expand 0.55s 1.1s both',transformOrigin:'left center' }} />
        </div>
        <p style={{ margin:'10px 0 0',fontSize:10,fontWeight:700,color:'#fff',letterSpacing:'0.24em',textTransform:'uppercase',animation:'intro-subtitle-in 0.5s 1.35s both' }}>{t('player.subtitle')}</p>
      </div>
      <button onClick={dismiss} style={{ position:'absolute',top:20,right:20,background:'rgba(255,255,255,0.1)',backdropFilter:'blur(6px)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:20,color:'rgba(255,255,255,0.8)',fontSize:12,fontWeight:600,padding:'6px 16px',cursor:'pointer',letterSpacing:'0.04em' }}>{t('player.skip')}</button>
    </div>
  )
}

// ── Video intro overlay ───────────────────────────────────────
function VideoIntroOverlay({ videoUrl, playerName, onDismiss }: { videoUrl: string; playerName: string; onDismiss: () => void }) {
  const { t } = useTranslation()
  const [opacity, setOpacity] = useState(1)
  const [isForcedMuted, setIsForcedMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const id = setTimeout(async () => {
      const v = videoRef.current; if (!v) return
      try { v.muted = false; await v.play() } catch { v.muted = true; setIsForcedMuted(true); v.play().catch(() => {}) }
    }, 100)
    return () => clearTimeout(id)
  }, [])
  function dismiss() { setOpacity(0) }
  function handleTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) { if (e.target === e.currentTarget && opacity === 0) onDismiss() }
  function unmuteVideo() { if (videoRef.current) { videoRef.current.muted = false; setIsForcedMuted(false) } }
  return (
    <div onTransitionEnd={handleTransitionEnd} style={{ position:'fixed',inset:0,zIndex:9999,background:'#000',opacity,transition:'opacity 0.6s ease' }}>
      <div style={{ position:'absolute',inset:0,zIndex:20,pointerEvents:'none',background:'rgba(251,191,36,0.10)',animation:'flash-in 0.85s ease-out both' }} />
      <video ref={videoRef} src={videoUrl} playsInline onEnded={dismiss} style={{ position:'absolute',inset:0,zIndex:1,width:'100%',height:'100%',objectFit:'contain' }} />
      <div style={{ position:'absolute',inset:0,zIndex:3,pointerEvents:'none',backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.045) 3px, rgba(0,0,0,0.045) 4px)' }} />
      <div style={{ position:'absolute',top:58,left:0,right:0,height:2,zIndex:4,pointerEvents:'none',background:'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.55) 25%, rgba(255,255,255,0.85) 50%, rgba(251,191,36,0.55) 75%, transparent 100%)',animation:'scan-sweep 1.1s 0.25s ease-out both' }} />
      <div style={{ position:'absolute',inset:0,zIndex:5,pointerEvents:'none',animation:'video-border-glow 2.8s 1.2s ease-in-out infinite' }} />
      {VIDEO_PARTICLES.map((p, i) => (
        <div key={i} style={{ position:'absolute',top:p.top,left:p.left,zIndex:6,width:p.size,height:p.size,borderRadius:'50%',background:'#fbbf24',boxShadow:`0 0 ${p.size*3}px ${p.size+1}px rgba(251,191,36,0.65)`,animation:`gold-particle-float ${p.dur} ${p.delay} ease-in-out infinite`,pointerEvents:'none' }} />
      ))}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:'42%',background:'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.6) 40%, transparent 100%)',pointerEvents:'none',zIndex:7 }} />
      <div style={{ position:'absolute',inset:0,zIndex:7,pointerEvents:'none',background:'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.6) 100%)' }} />
      <div style={{ position:'absolute',top:0,left:0,right:0,height:58,background:'#000',zIndex:8,animation:'intro-letterbox-top 0.38s cubic-bezier(0.4,0,0.2,1) both' }}>
        <div style={{ position:'absolute',bottom:0,left:0,right:0,height:1,background:'linear-gradient(90deg, transparent, rgba(251,191,36,0.65) 20%, rgba(251,191,36,0.65) 80%, transparent)' }} />
      </div>
      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:92,background:'linear-gradient(to top, #000 65%, rgba(0,0,0,0.88) 100%)',zIndex:8,animation:'intro-letterbox-bottom 0.38s cubic-bezier(0.4,0,0.2,1) both',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5 }}>
        <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg, transparent, rgba(251,191,36,0.65) 20%, rgba(251,191,36,0.65) 80%, transparent)' }} />
        <div style={{ fontSize:9,fontWeight:700,color:'rgba(251,191,36,0.7)',letterSpacing:'0.28em',textTransform:'uppercase',animation:'eyebrow-in 0.5s 0.55s both ease-out' }}>PLAYER</div>
        <div style={{ display:'flex',alignItems:'center',gap:14,animation:'intro-video-name 0.55s 0.35s both ease-out' }}>
          <div style={{ flex:'0 0 52px',height:1,background:'linear-gradient(to right, transparent, rgba(251,191,36,0.75))' }} />
          <div style={{ width:5,height:5,background:'rgba(251,191,36,0.9)',flexShrink:0,animation:'diamond-pulse 2s 1.1s ease-in-out infinite',transform:'rotate(45deg)' }} />
          <h2 style={{ margin:0,fontSize:18,fontWeight:900,color:'#fff',letterSpacing:'0.2em',textTransform:'uppercase',whiteSpace:'nowrap',animation:'name-glow-pulse 2.8s 1.3s ease-in-out infinite' }}>{playerName}</h2>
          <div style={{ width:5,height:5,background:'rgba(251,191,36,0.9)',flexShrink:0,animation:'diamond-pulse 2s 1.4s ease-in-out infinite',transform:'rotate(45deg)' }} />
          <div style={{ flex:'0 0 52px',height:1,background:'linear-gradient(to left, transparent, rgba(251,191,36,0.75))' }} />
        </div>
      </div>
      <div style={{ position:'absolute',top:66,left:12,zIndex:9,pointerEvents:'none',animation:'corner-in-tl 0.5s 0.18s cubic-bezier(0.34,1.45,0.64,1) both' }}><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M 46 2 L 2 2 L 2 46" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
      <div style={{ position:'absolute',top:66,right:12,zIndex:9,pointerEvents:'none',animation:'corner-in-tr 0.5s 0.28s cubic-bezier(0.34,1.45,0.64,1) both' }}><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M 2 2 L 46 2 L 46 46" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
      <div style={{ position:'absolute',bottom:100,left:12,zIndex:9,pointerEvents:'none',animation:'corner-in-bl 0.5s 0.38s cubic-bezier(0.34,1.45,0.64,1) both' }}><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M 46 46 L 2 46 L 2 2" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
      <div style={{ position:'absolute',bottom:100,right:12,zIndex:9,pointerEvents:'none',animation:'corner-in-br 0.5s 0.48s cubic-bezier(0.34,1.45,0.64,1) both' }}><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M 2 46 L 46 46 L 46 2" stroke="rgba(251,191,36,0.85)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
      <button onClick={dismiss} style={{ position:'absolute',top:15,right:20,zIndex:15,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(251,191,36,0.35)',borderRadius:20,color:'rgba(255,255,255,0.75)',fontSize:11,fontWeight:600,padding:'5px 14px',cursor:'pointer',letterSpacing:'0.06em' }}>{t('player.skip')}</button>
      {isForcedMuted && (
        <button onClick={unmuteVideo} style={{ position:'absolute',bottom:102,left:'50%',transform:'translateX(-50%)',zIndex:15,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(10px)',border:'1px solid rgba(251,191,36,0.55)',borderRadius:24,color:'#fbbf24',fontSize:11,fontWeight:700,padding:'8px 20px',cursor:'pointer',letterSpacing:'0.1em',display:'flex',alignItems:'center',gap:8,whiteSpace:'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          TAP FOR SOUND
        </button>
      )}
    </div>
  )
}

// ── Circular avatar (used in match rows / H2H only) ───────────
function Avatar({ url, name, size = 56, editable = false, onEditClick }: {
  url: string | null; name: string; size?: number; editable?: boolean; onEditClick?: () => void
}) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const base = url ? (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--card)', border: '2px solid rgba(var(--rgb-overlay),0.08)', overflow: 'hidden', flexShrink: 0 }}>
      <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: nameToColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{initials}</div>
  )
  if (!editable) return base
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, cursor: 'pointer' }} onClick={onEditClick} title="Change avatar">
      {base}
      <div style={{ position:'absolute',inset:0,borderRadius:'50%',background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.15s' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0' }}>
        <span style={{ fontSize: size * 0.28, lineHeight: 1 }}>📷</span>
      </div>
    </div>
  )
}

// ── SVG donut chart ───────────────────────────────────────────
function DonutChart({ pct, color, size = 110 }: { pct: number; color: string; size?: number }) {
  const sw = 11
  const r  = (size - sw * 2) / 2
  const c  = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${(pct/100)*c} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  )
}

// ── Mini fight card in hero ───────────────────────────────────
function HeroCard({ label, playerName, playerAvatar, opponentName, result, score, meta, href }: {
  label: string; playerName: string; playerAvatar: string | null
  opponentName: string; result?: 'W'|'L'|'D'|null; score?: string; meta?: string; href?: string
}) {
  const Mini = ({ url, name, winner }: { url: string|null; name: string; winner?: boolean }) => {
    const initials = name.split(' ').map((w)=>w[0]).join('').slice(0,2).toUpperCase()
    return (
      <div style={{ position:'relative',flexShrink:0 }}>
        {url
          ? <img src={url} alt={name} style={{ width:46,height:46,borderRadius:'50%',objectFit:'cover',border:`2px solid ${winner?'#fff':'rgba(255,255,255,0.25)'}`,display:'block',opacity:winner===false?0.5:1 }} />
          : <div style={{ width:46,height:46,borderRadius:'50%',background:nameToColor(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#fff',border:`2px solid ${winner?'#fff':'rgba(255,255,255,0.25)'}`,opacity:winner===false?0.5:1 }}>{initials}</div>
        }
        {winner && <div style={{ position:'absolute',bottom:-4,left:'50%',transform:'translateX(-50%)',background:RED,color:'#fff',fontSize:8,fontWeight:900,padding:'1px 5px',borderRadius:3,letterSpacing:'0.05em',whiteSpace:'nowrap' }}>WIN</div>}
      </div>
    )
  }
  const inner = (
    <div style={{ background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:10,padding:'10px 12px',cursor:href?'pointer':'default' }}>
      <div style={{ fontSize:8,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:8 }}>{label}</div>
      <div style={{ display:'flex',alignItems:'center',gap:8 }}>
        <Mini url={playerAvatar} name={playerName} winner={result?result==='W':undefined} />
        <Mini url={null} name={opponentName} winner={result?result==='L':undefined} />
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:11,fontWeight:800,color:'#fff',textTransform:'uppercase',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
            {playerName} <span style={{ color:'rgba(255,255,255,0.4)' }}>VS</span> {opponentName}
          </div>
          {score && <div style={{ fontSize:13,fontWeight:900,color:'#fff',marginTop:1 }}>{score}</div>}
          {meta  && <div style={{ fontSize:9,color:'rgba(255,255,255,0.4)',marginTop:1 }}>{meta}</div>}
        </div>
      </div>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration:'none' }}>{inner}</Link> : inner
}

// ── Match row (MATCH RECORD section) ─────────────────────────
function MatchRow({ match, playerName, playerAvatar }: { match: FormEntry; playerName: string; playerAvatar: string | null }) {
  const won  = match.result === 'W'
  const drew = match.result === 'D'
  const resultColor = won ? '#16a34a' : drew ? '#6b7280' : RED
  const resultLabel = won ? 'WIN' : drew ? 'DRAW' : 'LOSS'

  const Av = ({ url, name, winner }: { url: string|null; name: string; winner: boolean }) => {
    const initials = name.split(' ').map((w)=>w[0]).join('').slice(0,2).toUpperCase()
    return (
      <div style={{ position:'relative',flexShrink:0 }}>
        {url
          ? <img src={url} alt={name} style={{ width:54,height:54,borderRadius:'50%',objectFit:'cover',border:`3px solid ${winner?resultColor:'#e5e7eb'}`,display:'block',filter:winner?'none':'grayscale(30%)' }} />
          : <div style={{ width:54,height:54,borderRadius:'50%',background:nameToColor(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:800,color:'#fff',border:`3px solid ${winner?resultColor:'#e5e7eb'}`,filter:winner?'none':'grayscale(30%)' }}>{initials}</div>
        }
        {winner && !drew && (
          <div style={{ position:'absolute',bottom:-5,left:'50%',transform:'translateX(-50%)',background:resultColor,color:'#fff',fontSize:8,fontWeight:900,padding:'2px 6px',borderRadius:4,letterSpacing:'0.05em',whiteSpace:'nowrap' }}>{resultLabel}</div>
        )}
      </div>
    )
  }

  return (
    <div className="pp-match-row">
      <div style={{ display:'flex',alignItems:'center',flexShrink:0 }}>
        <Av url={playerAvatar} name={playerName} winner={won} />
        <div style={{ marginLeft:-10,zIndex:1 }}>
          <Av url={null} name={match.opponentName} winner={match.result==='L'} />
        </div>
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:14,fontWeight:800,color:'var(--text)',textTransform:'uppercase',letterSpacing:'0.02em' }}>
          {playerName} <span style={{ color:'var(--muted2)',fontWeight:600 }}>VS</span>{' '}
          <Link href={`/players/${match.opponentId}`} style={{ color:'var(--text)',textDecoration:'none' }}>{match.opponentName}</Link>
        </div>
        <div style={{ fontSize:11,color:'var(--muted)',marginTop:3,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
          <span>{new Date(match.playedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
          <span style={{ color:'#d1d5db' }}>·</span>
          <span><span style={{ fontWeight:900,fontSize:13,color:'var(--text)' }}>{match.goalsFor} – {match.goalsAgainst}</span></span>
          <span style={{ color:'#d1d5db' }}>·</span>
          <span>{match.matchType==='championship'?'Championship':'Friendly'}</span>
        </div>
      </div>
      <div className="pp-match-actions">
        <Link href={`/players/${match.opponentId}`} style={{ fontSize:11,fontWeight:700,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'0.08em',display:'flex',alignItems:'center',gap:4,textDecoration:'none',whiteSpace:'nowrap' }}>
          VIEW PROFILE
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </div>
    </div>
  )
}

// ── Hero photo crop / position modal ─────────────────────────
function HeroPhotoCropModal({
  previewSrc,
  initialPosition,
  onConfirm,
  onCancel,
}: {
  previewSrc: string
  initialPosition: string
  onConfirm: (position: string) => void
  onCancel: () => void
}) {
  const parse = (s: string): [number, number] => {
    const [x, y] = s.split(' ').map(parseFloat)
    return [isNaN(x) ? 50 : x, isNaN(y) ? 15 : y]
  }
  const [init] = useState(() => parse(initialPosition))
  const [posX, setPosX] = useState(init[0])
  const [posY, setPosY] = useState(init[1])
  const [nat, setNat]   = useState({ w: 0, h: 0 })
  const [frame, setFrame] = useState({ w: 640, h: 480 })

  const isDragging  = useRef(false)
  const lastMouse   = useRef({ x: 0, y: 0 })
  const maxDragRef  = useRef({ x: 0, y: 0 })

  // Responsive frame size
  useEffect(() => {
    function calc() {
      const vw = Math.min(window.innerWidth - 48, 720)
      const vh = window.innerHeight - 240
      // Matches the actual hero photo frame aspect ratio (~62% width × 720px height)
      // We scale to a sensible preview size
      const w = Math.round(vw)
      const h = Math.min(Math.round(w * 0.73), vh)
      setFrame({ w, h })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Recompute maxDrag whenever frame or image size changes
  useEffect(() => {
    if (nat.w === 0) return
    const scale = Math.max(frame.w / nat.w, frame.h / nat.h)
    maxDragRef.current = {
      x: Math.max(0, nat.w * scale - frame.w),
      y: Math.max(0, nat.h * scale - frame.h),
    }
  }, [nat, frame])

  // Shared delta applicator (uses refs — safe in event listeners)
  const applyDelta = useCallback((dx: number, dy: number) => {
    const { x: mX, y: mY } = maxDragRef.current
    if (mX > 0) {
      setPosX(p => {
        const newOff = -(p / 100) * mX + dx
        return Math.max(0, Math.min(100, (-newOff / mX) * 100))
      })
    }
    if (mY > 0) {
      setPosY(p => {
        const newOff = -(p / 100) * mY + dy
        return Math.max(0, Math.min(100, (-newOff / mY) * 100))
      })
    }
  }, [])

  // Mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      lastMouse.current = { x: e.clientX, y: e.clientY }
      applyDelta(dx, dy)
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [applyDelta])

  // Touch
  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true
    lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - lastMouse.current.x
    const dy = t.clientY - lastMouse.current.y
    lastMouse.current = { x: t.clientX, y: t.clientY }
    applyDelta(dx, dy)
  }
  const handleTouchEnd = () => { isDragging.current = false }

  // Computed image layout
  const scale  = nat.w > 0 ? Math.max(frame.w / nat.w, frame.h / nat.h) : 1
  const sw     = nat.w * scale
  const sh     = nat.h * scale
  const { x: mX, y: mY } = maxDragRef.current
  const imgL   = -(posX / 100) * mX
  const imgT   = -(posY / 100) * mY

  const posStr = `${Math.round(posX)}% ${Math.round(posY)}%`

  return (
    <div style={{ position:'fixed',inset:0,zIndex:9998,background:'rgba(0,0,0,0.96)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,padding:24 }}>
      {/* Header */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:14,fontWeight:800,color:'#fff',textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:8 }}>
          Position Hero Photo
        </div>
        <div style={{ fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em' }}>
          Drag to choose which area is shown · Gradient preview included
        </div>
      </div>

      {/* Preview frame */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: frame.w, height: frame.h, flexShrink: 0,
          overflow: 'hidden', position: 'relative',
          cursor: 'grab', userSelect: 'none', touchAction: 'none',
          borderRadius: 6,
          boxShadow: `0 0 0 2px ${RED}, 0 0 32px 0 rgba(210,10,10,0.25)`,
          background: DARK,
        }}
      >
        {/* Photo — absolutely positioned for smooth drag */}
        <img
          src={previewSrc}
          alt="preview"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget
            setNat({ w: img.naturalWidth, h: img.naturalHeight })
          }}
          style={{
            position: 'absolute',
            width: sw > 0 ? sw : '100%',
            height: sw > 0 ? sh : '100%',
            left: imgL, top: imgT,
            pointerEvents: 'none', userSelect: 'none',
            objectFit: sw > 0 ? 'unset' : 'cover',
          }}
        />

        {/* Gradient overlay — mirrors the real hero fade */}
        <div style={{ position:'absolute',inset:0,pointerEvents:'none',
          background:`linear-gradient(to right, ${DARK} 0%, ${DARK} 18%, rgba(10,10,10,0.92) 32%, rgba(10,10,10,0.65) 48%, rgba(10,10,10,0.20) 68%, transparent 100%)` }} />

        {/* Rule-of-thirds grid */}
        <div style={{ position:'absolute',inset:0,pointerEvents:'none',opacity:0.1 }}>
          {['33.3%','66.6%'].map((v) => (
            <div key={`v${v}`} style={{ position:'absolute',left:v,top:0,bottom:0,width:1,background:'var(--card)' }} />
          ))}
          {['33.3%','66.6%'].map((v) => (
            <div key={`h${v}`} style={{ position:'absolute',top:v,left:0,right:0,height:1,background:'var(--card)' }} />
          ))}
        </div>

        {/* Loading state */}
        {nat.w === 0 && (
          <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.4)',fontSize:13,letterSpacing:'0.06em' }}>
            Loading…
          </div>
        )}

        {/* Drag hint overlay — fades once user starts dragging */}
        {nat.w > 0 && (
          <div style={{ position:'absolute',bottom:10,left:0,right:0,display:'flex',justifyContent:'center',pointerEvents:'none' }}>
            <div style={{ background:'rgba(0,0,0,0.6)',backdropFilter:'blur(6px)',borderRadius:20,padding:'5px 14px',fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.55)',letterSpacing:'0.1em',textTransform:'uppercase' }}>
              ↕ Drag to reposition
            </div>
          </div>
        )}
      </div>

      {/* Slider for fine vertical control */}
      {nat.w > 0 && mY > 0 && (
        <div style={{ display:'flex',alignItems:'center',gap:14,width:frame.w,maxWidth:'100%' }}>
          <span style={{ fontSize:10,color:'rgba(255,255,255,0.35)',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',whiteSpace:'nowrap' }}>Top</span>
          <input
            type="range" min={0} max={100} value={Math.round(posY)}
            onChange={(e) => setPosY(Number(e.target.value))}
            style={{ flex:1,accentColor:RED,height:3,cursor:'pointer' }}
          />
          <span style={{ fontSize:10,color:'rgba(255,255,255,0.35)',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',whiteSpace:'nowrap' }}>Bottom</span>
        </div>
      )}
      {nat.w > 0 && mX > 0 && (
        <div style={{ display:'flex',alignItems:'center',gap:14,width:frame.w,maxWidth:'100%' }}>
          <span style={{ fontSize:10,color:'rgba(255,255,255,0.35)',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',whiteSpace:'nowrap' }}>Left</span>
          <input
            type="range" min={0} max={100} value={Math.round(posX)}
            onChange={(e) => setPosX(Number(e.target.value))}
            style={{ flex:1,accentColor:RED,height:3,cursor:'pointer' }}
          />
          <span style={{ fontSize:10,color:'rgba(255,255,255,0.35)',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',whiteSpace:'nowrap' }}>Right</span>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display:'flex',gap:12 }}>
        <button
          onClick={onCancel}
          style={{ padding:'10px 28px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,color:'rgba(255,255,255,0.7)',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em' }}
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(posStr)}
          style={{ padding:'10px 36px',background:RED,border:'none',borderRadius:6,color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.1em' }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="pp-section-title-wrap" style={{ paddingTop:28,paddingBottom:16 }}>
      <h2 className="pp-section-title" style={{ margin:0,fontSize:28,fontWeight:900,color:'var(--text)',textTransform:'uppercase',letterSpacing:'-0.01em',fontFamily:'system-ui, sans-serif' }}>
        {children}
      </h2>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export function PlayerProfile({ player, badges, rivalries, recentMatches, championshipPlacements, allPlayers, isOwnProfile, isAdmin, viewerId }: Props) {
  const { t } = useTranslation()

  const [avatarUrl,           setAvatarUrl]           = useState(player.avatarUrl)
  const [introVideoUrl,       setIntroVideoUrl]       = useState(player.introVideoUrl)
  const [heroPhotoUrl,        setHeroPhotoUrl]        = useState(player.heroPhotoUrl)
  const [heroPhotoPosition,   setHeroPhotoPosition]   = useState(player.heroPhotoPosition)
  const [introAudioUrl,       setIntroAudioUrl]       = useState(player.introAudioUrl)
  const [introAudioTrimStart, setIntroAudioTrimStart] = useState(player.introAudioTrimStart)
  const [introAudioTrimEnd,   setIntroAudioTrimEnd]   = useState(player.introAudioTrimEnd)
  const [showIntro,           setShowIntro]           = useState(true)
  const [showAudioTrimmer,    setShowAudioTrimmer]    = useState(false)
  const [showAdminPanel,      setShowAdminPanel]      = useState(false)

  // Crop modal state
  const [cropFile,     setCropFile]     = useState<File | null>(null)     // null = reposition only
  const [cropSrc,      setCropSrc]      = useState<string>('')
  const [showCrop,     setShowCrop]     = useState(false)

  const [uploadError,   setUploadError]   = useState<string|null>(null)
  const [videoError,    setVideoError]    = useState<string|null>(null)
  const [heroError,     setHeroError]     = useState<string|null>(null)
  const [audioError,    setAudioError]    = useState<string|null>(null)

  const [isPending,      startTransition] = useTransition()
  const [isVideoPending, startVideoTrans] = useTransition()
  const [isHeroPending,  startHeroTrans]  = useTransition()
  const [isAudioPending, startAudioTrans] = useTransition()
  const [isMorePending,  startMoreTrans]  = useTransition()

  const [displayedMatches,  setDisplayedMatches]  = useState<FormEntry[]>(recentMatches)
  const [allMatchesLoaded,  setAllMatchesLoaded]  = useState(false)

  const fileInputRef      = useRef<HTMLInputElement>(null)
  const videoInputRef     = useRef<HTMLInputElement>(null)
  const heroPhotoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef     = useRef<HTMLInputElement>(null)

  const handleShowMore = useCallback(() => {
    startMoreTrans(async () => {
      const more = await fetchMoreMatchesAction(player.id, 50)
      setDisplayedMatches(more)
      setAllMatchesLoaded(true)
    })
  }, [player.id])
  function handleShowLess() { setDisplayedMatches(recentMatches); setAllMatchesLoaded(false) }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 3*1024*1024) { setUploadError(t('player.err.imageSize')); return }
    setUploadError(null)
    const fd = new FormData(); fd.append('avatar', file); fd.append('targetUserId', player.id)
    startTransition(async () => {
      const r = await uploadAvatarAction(fd)
      if (r.error) setUploadError(r.error); else if (r.url) setAvatarUrl(r.url)
    })
    e.target.value = ''
  }

  function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 50*1024*1024) { setVideoError(t('player.err.videoSize')); return }
    if (!['video/mp4','video/webm'].includes(file.type)) { setVideoError(t('player.err.videoFormat')); return }
    setVideoError(null)
    const ext = (file.type === 'video/webm' ? 'webm' : 'mp4') as 'mp4'|'webm'
    e.target.value = ''
    startVideoTrans(async () => {
      const signed = await getSignedUploadUrlAction(player.id, ext)
      if (signed.error) { setVideoError(signed.error); return }
      const res = await fetch(signed.signedUrl!, { method:'PUT', body:file, headers:{'Content-Type':file.type} })
      if (!res.ok) { setVideoError('Upload failed. Please try again.'); return }
      const result = await finalizeVideoUploadAction(player.id, signed.storagePath!)
      if (result.error) setVideoError(result.error); else if (result.url) setIntroVideoUrl(result.url)
    })
  }
  function handleRemoveVideo() {
    setVideoError(null)
    startVideoTrans(async () => {
      const r = await removeIntroVideoAction(player.id)
      if (r.error) setVideoError(r.error); else setIntroVideoUrl(null)
    })
  }

  function handleHeroPhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 10*1024*1024) { setHeroError('Image must be under 10 MB'); return }
    const validTypes = ['image/jpeg','image/jpg','image/png','image/webp']
    if (!validTypes.includes(file.type)) { setHeroError('Use JPG, PNG or WebP'); return }
    setHeroError(null)
    e.target.value = ''
    // Show crop/position modal before uploading
    const objUrl = URL.createObjectURL(file)
    setCropFile(file)
    setCropSrc(objUrl)
    setShowCrop(true)
  }

  function handleOpenReposition() {
    if (!heroPhotoUrl) return
    setCropFile(null)
    setCropSrc(heroPhotoUrl)
    setShowCrop(true)
  }

  function handleCropCancel() {
    setShowCrop(false)
    if (cropFile) URL.revokeObjectURL(cropSrc)
    setCropFile(null)
    setCropSrc('')
  }

  function handleCropConfirm(position: string) {
    setShowCrop(false)
    if (cropFile) {
      // New upload
      const file = cropFile
      URL.revokeObjectURL(cropSrc)
      setCropFile(null); setCropSrc('')
      const ext = (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg') as 'jpg'|'png'|'webp'
      startHeroTrans(async () => {
        const signed = await getSignedHeroPhotoUrlAction(player.id, ext)
        if (signed.error) { setHeroError(signed.error); return }
        const res = await fetch(signed.signedUrl!, { method:'PUT', body:file, headers:{'Content-Type':file.type} })
        if (!res.ok) { setHeroError('Upload failed. Please try again.'); return }
        const result = await finalizeHeroPhotoUploadAction(player.id, signed.storagePath!, position)
        if (result.error) setHeroError(result.error)
        else { if (result.url) setHeroPhotoUrl(result.url); setHeroPhotoPosition(position) }
      })
    } else {
      // Reposition only — no upload
      setCropSrc('')
      startHeroTrans(async () => {
        const r = await updateHeroPhotoPositionAction(player.id, position)
        if (r.error) setHeroError(r.error); else setHeroPhotoPosition(position)
      })
    }
  }

  function handleRemoveHeroPhoto() {
    setHeroError(null)
    startHeroTrans(async () => {
      const r = await removeHeroPhotoAction(player.id)
      if (r.error) setHeroError(r.error); else { setHeroPhotoUrl(null); setHeroPhotoPosition('50% 15%') }
    })
  }

  function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 25 * 1024 * 1024) { setAudioError('Audio must be under 25 MB'); return }
    if (!file.type.startsWith('audio/')) { setAudioError('Please select an audio file (MP3, AAC, OGG, WAV)'); return }
    setAudioError(null)
    const ext = file.type.includes('ogg') ? 'ogg' : file.type.includes('wav') ? 'wav' : file.type.includes('aac') || file.type.includes('mp4') ? 'aac' : 'mp3'
    e.target.value = ''
    startAudioTrans(async () => {
      const signed = await getSignedAudioUploadUrlAction(player.id, ext as 'mp3'|'aac'|'ogg'|'wav')
      if (signed.error) { setAudioError(signed.error); return }
      const res = await fetch(signed.signedUrl!, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!res.ok) { setAudioError('Upload failed. Please try again.'); return }
      const result = await finalizeAudioUploadAction(player.id, signed.storagePath!, 0, null)
      if (result.error) { setAudioError(result.error); return }
      if (result.url) {
        setIntroAudioUrl(result.url)
        setIntroAudioTrimStart(0)
        setIntroAudioTrimEnd(null)
        setShowAudioTrimmer(true)
      }
    })
  }

  function handleRemoveAudio() {
    setAudioError(null)
    startAudioTrans(async () => {
      const r = await removeIntroAudioAction(player.id)
      if (r.error) setAudioError(r.error)
      else { setIntroAudioUrl(null); setIntroAudioTrimStart(0); setIntroAudioTrimEnd(null) }
    })
  }

  // ── Computed stats ────────────────────────────────────────
  const winRate  = player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0
  const goalShare = (player.goalsFor + player.goalsAgainst) > 0 ? Math.round((player.goalsFor / (player.goalsFor + player.goalsAgainst)) * 100) : 0
  const avgGoalsScored   = player.matchesPlayed > 0 ? (player.goalsFor   / player.matchesPlayed).toFixed(2) : '0.00'
  const avgGoalsConceded = player.matchesPlayed > 0 ? (player.goalsAgainst / player.matchesPlayed).toFixed(2) : '0.00'

  const winStreak = (() => { let s=0; for (const m of displayedMatches) { if (m.result==='W') s++; else break }; return s })()
  const cleanSheets = displayedMatches.filter((m) => m.goalsAgainst === 0).length
  const biggestWinMargin = displayedMatches.filter((m) => m.result==='W').reduce((mx,m) => Math.max(mx, m.goalsFor-m.goalsAgainst), 0)

  const wonRivalries    = rivalries.filter((r) => r.winnerId === player.id)
  const activeRivalries = rivalries.filter((r) => r.status === 'active')
  const lastMatch       = displayedMatches[0] ?? null
  const activeRivalry   = activeRivalries[0] ?? null

  const cupWins = championshipPlacements.filter((cp) => cp.rank === 1 && !cp.isActive).length

  // Hero stat chips (UFC underline style)
  const heroStats = [
    { val: winStreak,                                      line1: 'WIN',     line2: 'STREAK' },
    { val: cleanSheets,                                    line1: 'CLEAN',   line2: 'SHEETS' },
    { val: biggestWinMargin > 0 ? `+${biggestWinMargin}` : '0', line1: 'BIGGEST', line2: 'WIN MARGIN' },
  ]

  return (
    <>
      <AllStyles />

      {/* Intro overlay */}
      {showIntro && (
        introVideoUrl
          ? <VideoIntroOverlay videoUrl={introVideoUrl} playerName={player.name} onDismiss={() => setShowIntro(false)} />
          : heroPhotoUrl
            ? <HeroPhotoIntroOverlay
                photoUrl={heroPhotoUrl}
                playerName={player.name}
                onDismiss={() => setShowIntro(false)}
                audioUrl={introAudioUrl}
                trimStart={introAudioTrimStart}
                trimEnd={introAudioTrimEnd}
              />
            : <AvatarIntroOverlay avatarUrl={avatarUrl} playerName={player.name} onDismiss={() => setShowIntro(false)} />
      )}

      {/* Hero photo crop/position modal */}
      {showCrop && cropSrc && (
        <HeroPhotoCropModal
          previewSrc={cropSrc}
          initialPosition={heroPhotoPosition}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {/* Hidden file inputs */}
      <input ref={fileInputRef}      type="file" accept="image/jpeg,image/png,image/webp"          style={{ display:'none' }} onChange={handleFileChange} />
      <input ref={videoInputRef}     type="file" accept="video/mp4,video/webm"                      style={{ display:'none' }} onChange={handleVideoFileChange} />
      <input ref={heroPhotoInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display:'none' }} onChange={handleHeroPhotoFileChange} />
      <input ref={audioInputRef}     type="file" accept="audio/*"                                   style={{ display:'none' }} onChange={handleAudioFileChange} />

      {/* Audio trimmer modal */}
      {showAudioTrimmer && introAudioUrl && (
        <AudioTrimmerModal
          audioUrl={introAudioUrl}
          initialStart={introAudioTrimStart}
          initialEnd={introAudioTrimEnd}
          playerId={player.id}
          onApply={(start, end) => { setIntroAudioTrimStart(start); setIntroAudioTrimEnd(end) }}
          onClose={() => setShowAudioTrimmer(false)}
        />
      )}

      {/* ════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════ */}
      <div className="pp-hero">

        {/* Red accent bar — always at very top */}
        <div style={{ height:4, background:RED, position:'relative', zIndex:3, flexShrink:0 }} />

        {/* Admin toolbar — absolute so it floats over the hero content */}
        <div style={{ position:'absolute',top:'calc(4px + var(--fixed-nav-h))',left:0,right:0,zIndex:10,maxWidth:'100%',padding:'10px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10 }}>
          <div />
          {isAdmin && (
            <div
              style={{ position:'relative' }}
              onMouseEnter={() => setShowAdminPanel(true)}
              onMouseLeave={() => setShowAdminPanel(false)}
            >
              {/* Compact toggle — always visible */}
              <button
                onClick={() => setShowAdminPanel(p => !p)}
                style={{ fontSize:10,fontWeight:700,padding:'4px 10px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(255,255,255,0.18)',background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.65)',letterSpacing:'0.04em',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',gap:5 }}
              >
                ⚙ ADMIN {showAdminPanel ? '▲' : '▼'}
              </button>

              {/* Dropdown panel */}
              {showAdminPanel && (
                <div style={{ position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:20,background:'rgba(10,10,10,0.92)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'10px',display:'flex',flexDirection:'column',gap:6,minWidth:160,boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
                  <div style={{ fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2,paddingBottom:6,borderBottom:'1px solid rgba(255,255,255,0.07)' }}>Media</div>

                  {/* Avatar */}
                  <button onClick={() => fileInputRef.current?.click()} disabled={isPending} style={{ fontSize:10,fontWeight:700,padding:'5px 10px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.75)',opacity:isPending?0.5:1,letterSpacing:'0.04em',textAlign:'left' }}>
                    📷 AVATAR{isPending?' …':''}
                  </button>

                  {/* Hero photo */}
                  <button onClick={() => heroPhotoInputRef.current?.click()} disabled={isHeroPending} style={{ fontSize:10,fontWeight:700,padding:'5px 10px',borderRadius:6,cursor:'pointer',border:`1px solid ${heroPhotoUrl?'rgba(34,197,94,0.4)':'rgba(255,255,255,0.12)'}`,background:heroPhotoUrl?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.06)',color:heroPhotoUrl?'#86efac':'rgba(255,255,255,0.75)',opacity:isHeroPending?0.5:1,letterSpacing:'0.04em',textAlign:'left' }}>
                    🖼️ {isHeroPending?'UPLOADING…':heroPhotoUrl?'HERO PHOTO ✓':'HERO PHOTO'}
                  </button>
                  {heroPhotoUrl && !isHeroPending && (
                    <div style={{ display:'flex',gap:4 }}>
                      <button onClick={handleOpenReposition} style={{ flex:1,fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(251,191,36,0.35)',background:'rgba(251,191,36,0.08)',color:'#fbbf24',letterSpacing:'0.04em' }}>
                        ✥ REPOSITION
                      </button>
                      <button onClick={handleRemoveHeroPhoto} style={{ fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,cursor:'pointer',border:`1px solid ${RED}44`,background:`${RED}18`,color:'#ff6b6b',letterSpacing:'0.04em' }}>
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Intro audio */}
                  <button onClick={() => audioInputRef.current?.click()} disabled={isAudioPending} style={{ fontSize:10,fontWeight:700,padding:'5px 10px',borderRadius:6,cursor:'pointer',border:`1px solid ${introAudioUrl?'rgba(168,85,247,0.4)':'rgba(255,255,255,0.12)'}`,background:introAudioUrl?'rgba(168,85,247,0.1)':'rgba(255,255,255,0.06)',color:introAudioUrl?'#c4b5fd':'rgba(255,255,255,0.75)',opacity:isAudioPending?0.5:1,letterSpacing:'0.04em',textAlign:'left' }}>
                    🎵 {isAudioPending?'UPLOADING…':introAudioUrl?'AUDIO ✓':'INTRO AUDIO'}
                  </button>
                  {introAudioUrl && !isAudioPending && (
                    <div style={{ display:'flex',gap:4 }}>
                      <button onClick={() => setShowAudioTrimmer(true)} style={{ flex:1,fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(168,85,247,0.35)',background:'rgba(168,85,247,0.08)',color:'#c4b5fd',letterSpacing:'0.04em' }}>
                        ✂️ TRIM
                      </button>
                      <button onClick={handleRemoveAudio} style={{ fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,cursor:'pointer',border:`1px solid ${RED}44`,background:`${RED}18`,color:'#ff6b6b',letterSpacing:'0.04em' }}>
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Intro video */}
                  <button onClick={() => videoInputRef.current?.click()} disabled={isVideoPending} style={{ fontSize:10,fontWeight:700,padding:'5px 10px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.75)',opacity:isVideoPending?0.5:1,letterSpacing:'0.04em',textAlign:'left' }}>
                    🎬 {isVideoPending?'UPLOADING…':introVideoUrl?'VIDEO ✓':'INTRO VIDEO'}
                  </button>
                  {introVideoUrl && !isVideoPending && (
                    <div style={{ display:'flex',gap:4 }}>
                      <button onClick={() => setShowIntro(true)} style={{ flex:1,fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(59,130,246,0.35)',background:'rgba(59,130,246,0.1)',color:'#93c5fd',letterSpacing:'0.04em' }}>
                        ▶ PREVIEW
                      </button>
                      <button onClick={handleRemoveVideo} style={{ fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,cursor:'pointer',border:`1px solid ${RED}44`,background:`${RED}18`,color:'#ff6b6b',letterSpacing:'0.04em' }}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error messages */}
        {(uploadError || videoError || heroError || audioError) && (
          <div style={{ position:'absolute',top:48,left:0,right:0,zIndex:9,padding:'0 24px 8px' }}>
            {uploadError && <div style={{ padding:'8px 14px',background:'rgba(220,38,38,0.15)',border:`1px solid ${RED}55`,borderRadius:8,fontSize:12,color:'#fca5a5',marginBottom:6 }}>{uploadError}</div>}
            {videoError  && <div style={{ padding:'8px 14px',background:'rgba(220,38,38,0.15)',border:`1px solid ${RED}55`,borderRadius:8,fontSize:12,color:'#fca5a5',marginBottom:6 }}>{videoError}</div>}
            {heroError   && <div style={{ padding:'8px 14px',background:'rgba(220,38,38,0.15)',border:`1px solid ${RED}55`,borderRadius:8,fontSize:12,color:'#fca5a5',marginBottom:6 }}>{heroError}</div>}
            {audioError  && <div style={{ padding:'8px 14px',background:'rgba(220,38,38,0.15)',border:`1px solid ${RED}55`,borderRadius:8,fontSize:12,color:'#fca5a5' }}>{audioError}</div>}
          </div>
        )}

        {/* ── Hero photo (right side, absolute) ── */}
        {heroPhotoUrl ? (
          <div className="pp-hero-photo-frame">
            <img src={heroPhotoUrl} alt={player.name} style={{ objectPosition: heroPhotoPosition }} />
            <div className="pp-hero-photo-left-fade" />
            <div className="pp-hero-photo-bottom-fade" />
            {/* Admin re-upload overlay on hover */}
            {isAdmin && (
              <button
                onClick={() => heroPhotoInputRef.current?.click()}
                disabled={isHeroPending}
                style={{ position:'absolute',top:12,right:12,zIndex:10,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(6px)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,color:'rgba(255,255,255,0.8)',fontSize:10,fontWeight:700,padding:'5px 12px',cursor:'pointer',letterSpacing:'0.06em',opacity:isHeroPending?0.5:1 }}
              >
                🔄 REPLACE
              </button>
            )}
          </div>
        ) : isAdmin ? (
          /* Placeholder upload zone when no photo set */
          <div className="pp-hero-photo-upload-zone" onClick={() => heroPhotoInputRef.current?.click()}>
            <div className="pp-hero-upload-inner" style={{ textAlign:'center',color:'rgba(255,255,255,0.18)',border:'2px dashed rgba(255,255,255,0.1)',borderRadius:16,padding:'48px 64px',transition:'all 0.2s' }}>
              <div style={{ fontSize:48,marginBottom:14,opacity:0.7 }}>🖼️</div>
              <div style={{ fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.12em',lineHeight:1.6 }}>
                CLICK TO ADD<br/>HERO PHOTO
              </div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.1)',marginTop:8,fontWeight:600 }}>
                JPG · PNG · WebP · max 10 MB
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Left content ── */}
        <div className="pp-hero-content">

          {/* Status chips */}
          <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:4 }}>
            {isOwnProfile && (
              <span style={{ fontSize:11,fontWeight:800,padding:'3px 11px',borderRadius:4,background:'rgba(59,130,246,0.2)',color:'#93c5fd',border:'1px solid rgba(59,130,246,0.35)',textTransform:'uppercase',letterSpacing:'0.1em' }}>
                You
              </span>
            )}
            {badges.length > 0 && badges.slice(0,3).map((b) => (
              <span key={b.id} title={b.name}>{BADGE_ICONS[b.badgeType] ?? <Award size={16} style={{ color:'#fbbf24' }} />}</span>
            ))}
            {cupWins > 0 && (
              <div style={{ display:'flex',alignItems:'center',gap:3 }} title={`${cupWins} Championship${cupWins !== 1 ? 's' : ''} Won`}>
                {Array.from({ length: cupWins }).map((_, i) => (
                  <Trophy key={i} size={18} style={{ color:'#fbbf24',filter:'drop-shadow(0 0 4px rgba(251,191,36,0.7))' }} />
                ))}
              </div>
            )}
          </div>

          {/* HUGE player name — no circular avatar */}
          <h1 className="pp-hero-name">{player.name}</h1>

          {/* UFC-style stat chips with red underline */}
          <div className="pp-hero-stat-row">
            {heroStats.map(({ val, line1, line2 }, i) => (
              <div key={line1} style={{ display:'flex',alignItems:'flex-start',gap:0 }}>
                {i > 0 && <div className="pp-hero-stat-divider" />}
                <div>
                  <div className="pp-hero-stat-val" style={{ fontSize:'clamp(56px, 7.5vw, 88px)',fontWeight:900,color:'#fff',lineHeight:1,fontFamily:'system-ui, sans-serif' }}>
                    {val}
                  </div>
                  {/* Red underline bar — UFC exact style */}
                  <div style={{ height:4,background:RED,width:44,margin:'12px 0 12px' }} />
                  <div style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.1em',lineHeight:1.6 }}>
                    {line1}<br/>{line2}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Fight cards (bottom-right of hero, on top of photo) ── */}
        {(lastMatch || activeRivalry) && (
          <div style={{ position:'absolute',bottom:32,right:28,zIndex:4,display:'flex',flexDirection:'column',gap:10,width:210 }} className="pp-hero-fight-cards">
            {lastMatch && (
              <HeroCard label="LAST MATCH" playerName={player.name} playerAvatar={avatarUrl} opponentName={lastMatch.opponentName} result={lastMatch.result} score={`${lastMatch.goalsFor} – ${lastMatch.goalsAgainst}`} meta={new Date(lastMatch.playedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} href={`/players/${lastMatch.opponentId}`} />
            )}
            {activeRivalry && (
              <HeroCard label="ACTIVE RIVALRY" playerName={player.name} playerAvatar={avatarUrl} opponentName={activeRivalry.opponentName} score={`${activeRivalry.myWins} – ${activeRivalry.theirWins}`} meta={`Best of ${activeRivalry.bestOf}`} href={`/rivalries/${activeRivalry.id}`} />
            )}
          </div>
        )}
      </div>
      {/* hide fight cards on mobile via CSS in the hero */}
      <style>{`@media(max-width:700px){.pp-hero-fight-cards{display:none!important}}`}</style>

      {/* Mobile-only hero photo with stats overlay */}
      {heroPhotoUrl && (
        <div className="pp-hero-photo-mobile-banner">
          <img src={heroPhotoUrl} alt={player.name} style={{ objectPosition: heroPhotoPosition }} />
          {/* Soft bottom gradient — photo stays prominent */}
          <div style={{ position:'absolute',inset:0,pointerEvents:'none',background:'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 38%, transparent 65%)' }} />
          {/* Compact stats row overlaid at bottom */}
          <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 18px 14px',display:'flex',alignItems:'flex-end' }}>
            {heroStats.map(({ val, line1, line2 }, i) => (
              <div key={line1} style={{ display:'flex',alignItems:'flex-start' }}>
                {i > 0 && <div style={{ width:1,background:'rgba(255,255,255,0.18)',margin:'0 14px',alignSelf:'stretch',minHeight:34 }} />}
                <div>
                  <div style={{ fontSize:24,fontWeight:900,color:'#fff',lineHeight:1 }}>{val}</div>
                  <div style={{ height:2,background:RED,width:22,margin:'5px 0 5px' }} />
                  <div style={{ fontSize:8,fontWeight:700,color:'rgba(255,255,255,0.45)',textTransform:'uppercase',letterSpacing:'0.09em',lineHeight:1.5 }}>
                    {line1}<br/>{line2}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Social buttons ── */}
      {(player.instagramUrl || player.naviCoords) && (
        <div style={{ display:'flex', gap:10, padding:'12px 20px 0', justifyContent:'center' }}>
          {player.instagramUrl && (
            <a
              href={player.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'9px 18px', borderRadius:24,
                background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
                color:'#fff', textDecoration:'none',
                fontSize:13, fontWeight:700, letterSpacing:'0.04em',
                boxShadow:'0 2px 12px rgba(220,39,67,0.35)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </a>
          )}
          {player.naviCoords && (() => {
            const [lat, lon] = player.naviCoords.split(',').map((s) => s.trim())
            const naviUrl = `https://yandex.ru/maps/?rtext=~${lat},${lon}&rtt=auto`
            return (
              <a
                href={naviUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'9px 18px', borderRadius:24,
                  background:'linear-gradient(135deg,#fc3f1d,#e02e12)',
                  color:'#fff', textDecoration:'none',
                  fontSize:13, fontWeight:700, letterSpacing:'0.04em',
                  boxShadow:'0 2px 12px rgba(252,63,29,0.35)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Navi
              </a>
            )
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          PAGE BODY
      ════════════════════════════════════════════════════════ */}
      <div className="app-page page-content-wide pp-body" style={{ padding:'0 20px', paddingBottom:'var(--nav-h)', fontFamily:'system-ui, sans-serif' }}>

        {/* ── STATS & RECORDS ── */}
        <SectionTitle>Stats &amp; Records</SectionTitle>

        {/* Top highlights */}
        <div className="pp-highlights" style={{ border:'2px solid #111827',borderBottom:'none',padding:'14px 16px',marginBottom:0,display:'flex',gap:20,flexWrap:'wrap',alignItems:'center' }}>
          {[
            { val:player.wins,   label:'WINS' },
            { val:player.losses, label:'LOSSES' },
            { val:player.draws,  label:'DRAWS' },
            { val:`${winRate}%`, label:'WIN RATE' },
          ].map(({ val, label }) => (
            <div key={label} style={{ display:'flex',alignItems:'baseline',gap:8 }}>
              <span style={{ fontSize:36,fontWeight:900,color:'var(--text)',lineHeight:1 }}>{val}</span>
              <span style={{ fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Donut charts */}
        <div className="pp-stat-donut-grid">
          {[
            { pct:winRate,   label:'Win Rate',   sub1:`${player.wins} Wins`,   sub2:`${player.matchesPlayed} Matches Played` },
            { pct:goalShare, label:'Goal Share', sub1:`${player.goalsFor} Goals Scored`, sub2:`${player.goalsAgainst} Goals Conceded` },
          ].map(({ pct, label, sub1, sub2 }) => (
            <div key={label} style={{ border:'1px solid #e5e7eb',padding:'16px 18px',background:'var(--card)',display:'flex',alignItems:'center',gap:16 }}>
              <div style={{ position:'relative',flexShrink:0 }}>
                <DonutChart pct={pct} color={RED} size={96} />
                <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <span style={{ fontSize:18,fontWeight:900,color:'var(--text)' }}>{pct}%</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize:14,fontWeight:900,color:'var(--text)',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:10 }}>{label}</div>
                <div style={{ fontSize:12,color:'var(--muted)',display:'flex',flexDirection:'column',gap:4 }}>
                  <div><span style={{ fontWeight:700,color:'var(--text)' }}>{sub1.split(' ')[0]}</span> {sub1.split(' ').slice(1).join(' ')}</div>
                  <div style={{ borderTop:'1px solid #f3f4f6',paddingTop:4 }}><span style={{ fontWeight:700,color:'var(--text)' }}>{sub2.split(' ')[0]}</span> {sub2.split(' ').slice(1).join(' ')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed stats grid */}
        <div className="pp-detail-grid" style={{ border:'1px solid #e5e7eb',overflow:'hidden',background:'var(--card)' }}>
          {([
            { val:avgGoalsScored,   sub:'PER MATCH',  label:'GOALS SCORED AVG' },
            { val:avgGoalsConceded, sub:'PER MATCH',  label:'GOALS CONCEDED AVG' },
            { val:player.goalDiff>0?`+${player.goalDiff}`:`${player.goalDiff}`, sub:'', label:'GOAL DIFF' },
            { val:`${cleanSheets}`, sub:'RECENT',     label:'CLEAN SHEETS' },
            { val:`${winStreak}`,   sub:'CURRENT',    label:'WIN STREAK' },
            { val:biggestWinMargin>0?`+${biggestWinMargin}`:'0', sub:'RECENT', label:'BEST WIN MARGIN' },
            { val:`${player.goalsFor}`,     sub:'TOTAL', label:'GOALS FOR' },
            { val:`${player.goalsAgainst}`, sub:'TOTAL', label:'GOALS AGAINST' },
          ] as const).map(({ val, sub, label }, i, arr) => (
            <div key={label} style={{ padding:'18px 20px',borderRight:(i+1)%4!==0?'1px solid #f3f4f6':'none',borderBottom:i<arr.length-4?'1px solid #f3f4f6':'none' }}>
              <div style={{ display:'flex',alignItems:'baseline',gap:3 }}>
                <span style={{ fontSize:26,fontWeight:900,color:'var(--text)',lineHeight:1 }}>{val}</span>
                {sub && <span style={{ fontSize:9,color:'var(--muted2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em' }}>{sub}</span>}
              </div>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--muted2)',textTransform:'uppercase',letterSpacing:'0.08em',marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── MATCH RECORD ── */}
        {displayedMatches.length > 0 && (
          <>
            <SectionTitle>Match Record</SectionTitle>
            <div>
              {displayedMatches.map((m) => (
                <MatchRow key={m.matchId} match={m} playerName={player.name} playerAvatar={avatarUrl} />
              ))}
            </div>
            <div style={{ marginTop:16 }}>
              {!allMatchesLoaded ? (
                <button onClick={handleShowMore} disabled={isMorePending} style={{ width:'100%',padding:'12px 0',border:'2px solid #111827',background:'transparent',fontSize:12,fontWeight:800,color:'var(--text)',cursor:isMorePending?'default':'pointer',textTransform:'uppercase',letterSpacing:'0.08em',opacity:isMorePending?0.5:1 }}>
                  {isMorePending?'Loading…':'View Full History'}
                </button>
              ) : (
                <button onClick={handleShowLess} style={{ width:'100%',padding:'12px 0',border:'2px solid #111827',background:'transparent',fontSize:12,fontWeight:800,color:'var(--text)',cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em' }}>
                  Show Less
                </button>
              )}
            </div>
          </>
        )}

        {/* ── HEAD TO HEAD ── */}
        {allPlayers.length > 0 && (
          <>
            <SectionTitle>Head to Head</SectionTitle>
            <H2HSection playerId={player.id} allPlayers={allPlayers} playerName={player.name} isAdmin={isAdmin} />
          </>
        )}

        {/* ── CHAMPIONSHIPS ── */}
        {championshipPlacements.length > 0 && (
          <>
            <SectionTitle>Championship History</SectionTitle>
            <div style={{ border:'1px solid #e5e7eb',overflow:'hidden',background:'var(--card)' }}>
              <div className="pp-champ-grid" style={{ padding:'10px 16px',background:'#111827' }}>
                <span style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Championship</span>
                {['Rank','Pts','W','D','L','GD'].map((h) => (
                  <span key={h} style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',textAlign:'center' }}>{h}</span>
                ))}
              </div>
              {championshipPlacements.map((cp, i) => (
                <div key={cp.championshipId} className="pp-champ-grid" style={{ padding:'12px 16px',borderBottom:i<championshipPlacements.length-1?'1px solid #f3f4f6':'none',background:cp.rank===1?'#fffbeb':'#fff',alignItems:'center' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    {cp.rank===1 && <Trophy size={14} style={{ color:'var(--gold)',flexShrink:0 }} />}
                    <Link href={`/championships/${cp.championshipId}`} style={{ color:'var(--text)',textDecoration:'none',fontWeight:700,fontSize:13 }}>{cp.championshipName}</Link>
                    {cp.isActive && <span style={{ fontSize:9,fontWeight:700,background:'rgba(var(--rgb-accent),0.1)',color:'var(--accent)',padding:'1px 5px',borderRadius:4,textTransform:'uppercase' }}>LIVE</span>}
                  </div>
                  <div style={{ textAlign:'center' }}><span style={{ fontSize:12,fontWeight:800,padding:'2px 6px',background:cp.rank===1?'#fef3c7':cp.rank<=3?'#f3f4f6':'transparent',color:cp.rank===1?'#d97706':'#374151',borderRadius:4 }}>#{cp.rank}</span></div>
                  <div style={{ textAlign:'center',fontWeight:800,color:cp.rank===1?'var(--gold)':'var(--text)',fontSize:14 }}>{cp.points}</div>
                  <div style={{ textAlign:'center',color:'var(--win)',fontWeight:700,fontSize:13 }}>{cp.wins}</div>
                  <div style={{ textAlign:'center',color:'var(--muted)',fontSize:13 }}>{cp.draws}</div>
                  <div style={{ textAlign:'center',color:RED,fontWeight:700,fontSize:13 }}>{cp.losses}</div>
                  <div style={{ textAlign:'center',fontWeight:700,color:cp.goalDiff>0?'var(--win)':cp.goalDiff<0?RED:'var(--muted)',fontSize:13 }}>{cp.goalDiff>0?`+${cp.goalDiff}`:cp.goalDiff}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── BADGES ── */}
        {badges.length > 0 && (
          <>
            <SectionTitle>Achievements ({wonRivalries.length} {wonRivalries.length!==1?t('player.rivalryWins.many'):t('player.rivalryWins.one')})</SectionTitle>
            <div style={{ display:'flex',flexWrap:'wrap',gap:10 }}>
              {badges.map((b) => (
                <div key={b.id} style={{ border:'1px solid #fbbf24',borderRadius:8,padding:'12px 18px',background:'rgba(245,158,11,0.08)',display:'flex',alignItems:'center',gap:12 }}>
                  <span>{BADGE_ICONS[b.badgeType] ?? <Award size={24} style={{ color:'var(--gold)' }} />}</span>
                  <div>
                    <div style={{ fontSize:13,fontWeight:800,color:'#92400e',textTransform:'uppercase',letterSpacing:'0.04em' }}>{b.name}</div>
                    {b.description && <div style={{ fontSize:11,color:'#b45309',marginTop:1 }}>{b.description}</div>}
                    <div style={{ fontSize:10,color:'var(--gold)',marginTop:2 }}>
                      {t('player.earned', { date:new Date(b.earnedAt).toLocaleDateString() })}
                      {b.sourceRivalryId && <> · <Link href={`/rivalries/${b.sourceRivalryId}`} style={{ color:'var(--gold)',fontWeight:700 }}>{t('player.viewRivalry')}</Link></>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── RIVALRIES ── */}
        {rivalries.length > 0 && (
          <>
            <SectionTitle>{t('player.rivalriesTitle', { won:wonRivalries.length, active:activeRivalries.length })}</SectionTitle>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {rivalries.map((r) => {
                const iWon    = r.winnerId === player.id
                const theyWon = r.winnerId !== null && r.winnerId !== player.id
                return (
                  <Link key={r.id} href={`/rivalries/${r.id}`} style={{ textDecoration:'none',color:'inherit' }}>
                    <div style={{ border:`2px solid ${iWon?'#fbbf24':r.status==='active'?'var(--text)':'var(--border)'}`,padding:'14px 18px',background:iWon?'rgba(245,158,11,0.08)':'var(--card)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        {iWon && <Trophy size={18} style={{ color:'var(--gold)',flexShrink:0 }} />}
                        <div>
                          <div style={{ fontSize:14,fontWeight:800,color:'var(--text)',textTransform:'uppercase',letterSpacing:'0.02em' }}>vs {r.opponentName}</div>
                          <div style={{ fontSize:11,color:'var(--muted)',marginTop:2 }}>{t('player.firstTo', { n:r.bestOf })}</div>
                        </div>
                      </div>
                      <div style={{ display:'flex',alignItems:'center',gap:12,flexShrink:0 }}>
                        <div style={{ fontSize:22,fontWeight:900,color:iWon?'var(--gold)':'var(--text)' }}>{r.myWins} – {r.theirWins}</div>
                        <span style={{ fontSize:10,fontWeight:800,padding:'3px 10px',textTransform:'uppercase',letterSpacing:'0.06em',background:r.status==='active'?'var(--card)':iWon?'rgba(245,158,11,0.12)':'var(--card3)',color:r.status==='active'?'var(--text)':iWon?'var(--gold)':'var(--muted)' }}>
                          {r.status==='active'?t('common.active'):iWon?t('player.won'):t('player.lost')}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}

        {rivalries.length===0 && badges.length===0 && recentMatches.length===0 && (
          <div style={{ textAlign:'center',padding:'60px 0',color:'var(--muted2)',fontSize:14 }}>{t('player.noHistory')}</div>
        )}
      </div>

      <BottomNav userId={viewerId} />
    </>
  )
}
