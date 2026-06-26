'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { NamedPlayerStats } from '@/lib/stats/types'

// ── 8 unique cinematic profiles ───────────────────────────────────────────────
const PROFILES = [
  { label: 'THE EMERGE',  bgR: 160, bgG: 10,  bgB: 10,  spotX: 50, spotY: 20, orbitX:  8, exitX: -1, light: '#fff5ee' },
  { label: 'THE TURN',    bgR: 10,  bgG: 20,  bgB: 160, spotX: 28, spotY: 32, orbitX: -14,exitX:  1, light: '#ccddff' },
  { label: 'THE DESCENT', bgR: 8,   bgG: 110, bgB: 40,  spotX: 60, spotY: 16, orbitX: 10, exitX: -1, light: '#ccffdd' },
  { label: 'THE CIRCLE',  bgR: 140, bgG: 60,  bgB: 0,   spotX: 50, spotY: 40, orbitX: 18, exitX:  1, light: '#ffeedd' },
  { label: 'THE PHANTOM', bgR: 90,  bgG: 0,   bgB: 150, spotX: 35, spotY: 22, orbitX: -10,exitX: -1, light: '#ddbfff' },
  { label: 'FLOODLIGHTS', bgR: 160, bgG: 110, bgB: 0,   spotX: 65, spotY: 14, orbitX: 12, exitX:  1, light: '#fffacc' },
  { label: 'THE TITAN',   bgR: 0,   bgG: 100, bgB: 160, spotX: 42, spotY: 28, orbitX: -8, exitX: -1, light: '#bbddff' },
  { label: 'THE LEGEND',  bgR: 180, bgG: 0,   bgB: 60,  spotX: 50, spotY: 25, orbitX: 14, exitX:  1, light: '#ffbbcc' },
] as const

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
/* cards stack inside sticky container */
.cw-card {
  position: absolute; inset: 0; overflow: hidden;
  background: #000;
  display: flex; align-items: center; justify-content: center;
}

/* atmospheric */
.cw-bg      { position: absolute; inset: 0; pointer-events: none; }
.cw-spot    { position: absolute; inset: 0; pointer-events: none; }
.cw-vig     { position: absolute; inset: 0; pointer-events: none;
              background: radial-gradient(ellipse 84% 90% at 50% 50%, transparent 20%, rgba(0,0,0,.72) 100%); }
.cw-fog     { position: absolute; inset: 0; pointer-events: none;
              background: linear-gradient(to bottom, rgba(0,0,0,.2) 28%, rgba(0,0,0,.55) 74%, rgba(0,0,0,1) 100%); }
.cw-edges   { position: absolute; inset: 0; pointer-events: none;
              background:
                linear-gradient(to right,  #000 0%, transparent 22%, transparent 78%, #000 100%),
                linear-gradient(to bottom, rgba(0,0,0,.5) 0%, transparent 20%, rgba(0,0,0,.8) 80%, #000 100%); z-index:4; }
.cw-flare   {
  position: absolute; border-radius: 50%; pointer-events: none;
  width: min(58vw, 640px); height: min(58vw, 640px);
  transform: translate(-50%, -50%);
  animation: cw-flare-pulse 3.6s ease-in-out infinite;
}

/* photo */
.cw-photo-wrap {
  position: absolute; inset: 0; z-index: 2;
  display: flex; align-items: center; justify-content: center;
}
.cw-photo {
  height: 82svh; max-height: 720px;
  width: auto; max-width: 58vw;
  object-fit: cover; object-position: top center;
  display: block; border-radius: 2px;
  transform-origin: center top;
}
.cw-initials-ph {
  height: 78svh; width: 42vw; max-width: 400px;
  background: linear-gradient(160deg, #1a1a1a, #070707);
  display: flex; align-items: center; justify-content: center;
  font-size: clamp(72px,14vw,180px); font-weight: 900;
  color: rgba(255,255,255,.06); letter-spacing: -.04em; border-radius: 2px;
  transform-origin: center top;
}

/* info */
.cw-info {
  position: absolute; bottom: 6svh; left: 0; right: 0; z-index: 6;
  text-align: center; padding: 0 clamp(20px, 7vw, 90px);
}
.cw-scene-badge {
  position: absolute; top: 36px; left: 50%; transform: translateX(-50%);
  font-size: 8px; font-weight: 800; letter-spacing: .3em;
  color: rgba(255,255,255,.12); text-transform: uppercase; z-index: 6; white-space: nowrap;
}
.cw-cinema-sub { font-size: clamp(7px,.85vw,9px); font-weight: 800; letter-spacing: .3em;
  color: rgba(255,255,255,.14); text-transform: uppercase; margin-bottom: 14px; }

/* rank line */
.cw-rank-line {
  display: flex; align-items: baseline; gap: 10px;
  justify-content: center; margin-bottom: 14px;
  opacity: 0; transform: translateY(18px);
  transition: opacity .55s ease, transform .55s ease;
}
.cw-card.cw-pn .cw-rank-line { opacity: 1; transform: none; }
.cw-rank-num { font-size: clamp(15px,2.4vw,28px); font-weight: 900; color: #DC2626; letter-spacing: -.02em; }
.cw-rank-txt { font-size: clamp(8px,.9vw,10px); font-weight: 800; color: rgba(255,255,255,.25); letter-spacing: .22em; text-transform: uppercase; }

/* name */
.cw-name { margin: 0 0 26px; font-size: clamp(30px,5.5vw,72px); font-weight: 900;
  letter-spacing: -.03em; text-transform: uppercase; line-height: .9; color: #fff; }
.cw-nw {
  display: inline-block; margin-right: .2em;
  opacity: 0; transform: translateY(50px);
  transition: opacity .72s cubic-bezier(.16,1,.3,1), transform .72s cubic-bezier(.16,1,.3,1);
}
.cw-card.cw-pn .cw-nw { opacity: 1; transform: none; }

/* stats */
.cw-stats { display: flex; gap: clamp(10px,2.5vw,38px); justify-content: center; flex-wrap: wrap; }
.cw-stat  { text-align: center; opacity: 0; transform: translateY(24px);
  transition: opacity .5s ease, transform .5s ease; min-width: 64px; }
.cw-card.cw-ps1 .cw-stat:nth-child(1) { opacity:1; transform:none; }
.cw-card.cw-ps2 .cw-stat:nth-child(2) { opacity:1; transform:none; transition-delay:.1s; }
.cw-card.cw-ps3 .cw-stat:nth-child(3) { opacity:1; transform:none; transition-delay:.2s; }
.cw-card.cw-ps4 .cw-stat:nth-child(4) { opacity:1; transform:none; transition-delay:.3s; }
.cw-sv { display:block; font-size:clamp(24px,3.8vw,48px); font-weight:900; color:#fff; letter-spacing:-.04em; line-height:1; }
.cw-sl { display:block; font-size:clamp(7px,.85vw,10px); font-weight:800; color:#DC2626; letter-spacing:.18em; text-transform:uppercase; margin-top:6px; }

/* dust */
@keyframes cw-da { 0%{transform:translateY(0) translateX(0);opacity:.7;} 100%{transform:translateY(-92px) translateX(10px);opacity:0;} }
@keyframes cw-db { 0%{transform:translateY(0);opacity:.45;} 55%{opacity:.7;} 100%{transform:translateY(-135px) translateX(-8px);opacity:0;} }
@keyframes cw-dc { 0%{transform:scale(0);opacity:0;} 16%{opacity:.9;} 100%{transform:scale(2.6) translateY(-55px);opacity:0;} }
@keyframes cw-dd { 0%{transform:translateY(0) rotate(0deg);opacity:.55;} 100%{transform:translateY(-108px) rotate(55deg);opacity:0;} }
.cw-dust { position:absolute; pointer-events:none; z-index:1; border-radius:50%;
  animation-iteration-count:infinite; animation-timing-function:ease-out; }

/* lens flare */
@keyframes cw-flare-pulse { 0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(1);}
  50%{opacity:.95;transform:translate(-50%,-50%) scale(1.22);} }

/* finale */
.cw-finale {
  position: absolute; inset: 0; overflow: hidden;
  background: #000; z-index: 10;
  flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center; padding: 0 24px;
}

@keyframes cw-trophy-rise { from{transform:translateY(70px) scale(.55);opacity:0;filter:blur(14px);} 65%{filter:blur(0);} to{transform:none;opacity:1;} }
@keyframes cw-fin-in      { from{opacity:0;transform:translateY(36px);} to{opacity:1;transform:none;} }
@keyframes cw-fin-blur    { from{opacity:0;filter:blur(10px);transform:translateY(44px);} 60%{filter:blur(0);} to{opacity:1;transform:none;} }
@keyframes cw-fall        { 0%{transform:translateY(-6vh) rotate(0) scale(1);opacity:1;} 100%{transform:translateY(108vh) rotate(720deg) scale(.5);opacity:.25;} }
@keyframes cw-fw          { 0%{transform:scale(0);opacity:1;} 100%{transform:scale(5);opacity:0;} }
@keyframes cw-glow        { 0%,100%{opacity:.05;} 50%{opacity:.14;} }

.cw-finale-trophy { font-size:clamp(56px,10vw,108px); animation:cw-trophy-rise 1.5s cubic-bezier(.16,1,.3,1) .2s both;
  margin-bottom:26px; filter:drop-shadow(0 0 44px rgba(245,158,11,.55)); }
.cw-finale-players { display:flex; gap:clamp(5px,1.2vw,14px); justify-content:center; flex-wrap:wrap;
  margin-bottom:34px; animation:cw-fin-in .8s ease 1.4s both; opacity:0; }
.cw-finale-av    { width:clamp(38px,5.5vw,62px); height:clamp(38px,5.5vw,62px); border-radius:50%;
  object-fit:cover; border:2px solid rgba(255,255,255,.18); display:block; }
.cw-finale-ini   { width:clamp(38px,5.5vw,62px); height:clamp(38px,5.5vw,62px); border-radius:50%;
  background:linear-gradient(135deg,#1a1a2e,#070707); border:2px solid rgba(255,255,255,.12);
  display:flex; align-items:center; justify-content:center;
  font-size:clamp(10px,1.5vw,17px); font-weight:900; color:rgba(255,255,255,.3); }
.cw-finale-eye   { font-size:clamp(8px,1vw,10px); font-weight:800; letter-spacing:.28em; color:#DC2626;
  text-transform:uppercase; animation:cw-fin-in .7s ease .95s both; opacity:0; margin-bottom:14px; }
.cw-finale-h1    { margin:0 0 18px; font-size:clamp(32px,8vw,90px); font-weight:900; letter-spacing:-.04em;
  text-transform:uppercase; line-height:.88; color:#fff; animation:cw-fin-blur 1.1s cubic-bezier(.16,1,.3,1) 1.1s both; opacity:0; }
.cw-finale-lines { display:flex; flex-direction:column; gap:5px; margin-bottom:42px; }
.cw-finale-line  { font-size:clamp(10px,1.3vw,14px); color:rgba(255,255,255,.32); font-weight:500;
  letter-spacing:.06em; animation:cw-fin-in .6s ease both; opacity:0; }
.cw-finale-line:nth-child(1) { animation-delay:1.72s; }
.cw-finale-line:nth-child(2) { animation-delay:1.92s; }
.cw-finale-line:nth-child(3) { animation-delay:2.12s; }
.cw-finale-cta   { animation:cw-fin-in .8s ease 2.4s both; opacity:0; }

.cw-confetti { position:absolute; pointer-events:none; border-radius:2px; animation:cw-fall linear infinite; }
.cw-fw-ring  { position:absolute; border-radius:50%; border:2px solid; pointer-events:none; animation:cw-fw ease-out both; }
.cw-glow-bg  { position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 68% 60% at 50% 50%, rgba(220,38,38,.08) 0%, transparent 70%);
  animation:cw-glow 4s ease-in-out infinite; }

/* ── Mobile: full-width player photos ──────────────────────────── */
@media (max-width: 768px) {
  /* Show the full player — switch from height-constrained to width-constrained */
  .cw-photo {
    width: 92vw;
    height: auto;
    max-height: 78svh;
    max-width: none;
    object-fit: cover;
    object-position: top center;
  }
  /* Initials placeholder: wider + less tall */
  .cw-initials-ph {
    width: 76vw;
    height: 52svh;
    max-width: none;
    font-size: clamp(52px, 16vw, 120px);
  }
  /* Narrower side edge fade so less of the photo is masked */
  .cw-edges {
    background:
      linear-gradient(to right,  #000 0%, transparent 6%, transparent 94%, #000 100%),
      linear-gradient(to bottom, rgba(0,0,0,.45) 0%, transparent 16%, rgba(0,0,0,.8) 80%, #000 100%);
  }
  /* Info bar: tighter padding */
  .cw-info { bottom: 3svh; padding: 0 14px; }
  /* Name: tighter on very narrow screens */
  .cw-name { font-size: clamp(24px, 7.5vw, 72px); }
  /* Finale players row: smaller avatars */
  .cw-finale-av  { width: clamp(32px,8vw,50px); height: clamp(32px,8vw,50px); }
  .cw-finale-ini { width: clamp(32px,8vw,50px); height: clamp(32px,8vw,50px); }
}

/* reduced motion */
@media (prefers-reduced-motion: reduce) {
  .cw-nw, .cw-rank-line, .cw-stat { transition: none !important; }
  .cw-flare, .cw-dust { animation: none !important; }
  .cw-finale-trophy, .cw-finale-players, .cw-finale-eye,
  .cw-finale-h1, .cw-finale-line, .cw-finale-cta { animation: none !important; opacity:1 !important; transform:none !important; }
  .cw-confetti, .cw-fw-ring { display: none !important; }
}
`

// ── Constants ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#DC2626','#ffffff','#F59E0B','#3B82F6','#10B981','#8B5CF6']
const FIREWORK_COLORS = ['#DC2626','#F59E0B','#ffffff','#3B82F6']
const PLAYER_ZONE = 0.82   // 0→0.82 = players, 0.82→1.0 = finale

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = { players: NamedPlayerStats[] }

// ── Main component ────────────────────────────────────────────────────────────
export function ChampionsWalk({ players }: Props) {
  const sectionRef      = useRef<HTMLElement>(null)
  const fixedRef2       = useRef<HTMLDivElement>(null)
  const finaleRef       = useRef<HTMLDivElement>(null)
  const cardRefs        = useRef<(HTMLDivElement | null)[]>([])
  const stateRef        = useRef({ playerIdx: -2, phase: -1 })
  const rafRef          = useRef<number | null>(null)
  const finaleShownRef  = useRef(false)
  const [finaleOn, setFinaleOn] = useState(false)

  const walkPlayers = players.slice(0, 8)
  const N = walkPlayers.length

  const update = useCallback(() => {
    const section = sectionRef.current
    if (!section || N === 0) return

    const { top, height } = section.getBoundingClientRect()
    const scrollable = height - window.innerHeight
    if (scrollable <= 0) return

    // Show/hide the fixed container based on whether section is in viewport range
    const inView = top <= 0 && -top <= scrollable
    if (fixedRef2.current) fixedRef2.current.style.display = inView ? 'block' : 'none'

    const raw = Math.max(0, Math.min(1, -top / scrollable))

    // ── Finale zone ──
    if (raw >= PLAYER_ZONE) {
      cardRefs.current.forEach(c => { if (c) { c.style.opacity = '0'; c.style.pointerEvents = 'none' } })
      if (finaleRef.current) finaleRef.current.style.display = 'flex'
      if (!finaleShownRef.current) {
        finaleShownRef.current = true
        setFinaleOn(true)
      }
      stateRef.current = { playerIdx: -1, phase: -1 }
      return
    }

    // ── Hide finale when scrolling back up ──
    if (finaleRef.current) finaleRef.current.style.display = 'none'

    // ── Compute player + phase ──
    const rawPlayer = (raw / PLAYER_ZONE) * N
    const playerIdx = Math.min(Math.floor(rawPlayer), N - 1)
    const phase     = rawPlayer - Math.floor(rawPlayer)

    const prev = stateRef.current
    if (prev.playerIdx === playerIdx && Math.abs(prev.phase - phase) < 0.0015) return
    stateRef.current = { playerIdx, phase }

    // ── Update each card ──
    cardRefs.current.forEach((card, i) => {
      if (!card) return
      if (i !== playerIdx) { card.style.opacity = '0'; card.style.pointerEvents = 'none'; return }
      card.style.opacity = '1'; card.style.pointerEvents = 'auto'

      const p = PROFILES[i % PROFILES.length]

      // Photo element (img or initials div)
      const photoEl = card.querySelector<HTMLElement>('.cw-photo, .cw-initials-ph')
      if (photoEl) {
        // Emerge: phase 0.04 → 0.28  (cubic ease-out)
        const eT  = Math.max(0, Math.min(1, (phase - 0.04) / 0.24))
        const eE  = 1 - Math.pow(1 - eT, 3)
        const sc  = 2.1 - 1.1 * eE
        const bl  = 16  * (1 - eE)

        // Orbit: phase 0.25 → 0.75 (sine arc so it swings and returns)
        const oT  = Math.max(0, Math.min(1, (phase - 0.25) / 0.5))
        const rY  = p.orbitX * Math.sin(oT * Math.PI)

        // Exit: phase 0.82 → 1.00
        const xT  = Math.max(0, Math.min(1, (phase - 0.82) / 0.18))
        const xE  = xT * xT * xT
        const tx  = p.exitX * xE * 75
        const op  = Math.min(eT * 4, 1) * (1 - xE)

        photoEl.style.transform = `scale(${sc.toFixed(3)}) perspective(1400px) rotateY(${rY.toFixed(2)}deg) translateX(${tx.toFixed(1)}vw)`
        photoEl.style.filter    = `blur(${bl.toFixed(1)}px)`
        photoEl.style.opacity   = op.toFixed(3)
      }

      // Background glow
      const bgEl = card.querySelector<HTMLElement>('.cw-bg')
      if (bgEl) {
        const g = Math.min(phase / 0.28, 1) * 0.22
        bgEl.style.background = `radial-gradient(ellipse at ${p.spotX}% ${p.spotY}%, rgba(${p.bgR},${p.bgG},${p.bgB},${(g * .9).toFixed(3)}) 0%, rgba(${p.bgR},${p.bgG},${p.bgB},${(g * .28).toFixed(3)}) 42%, transparent 68%)`
      }

      // Spotlight
      const spotEl = card.querySelector<HTMLElement>('.cw-spot')
      if (spotEl) spotEl.style.opacity = (Math.min(phase / 0.26, 1) * 0.6).toFixed(3)

      // Lens flare
      const flareEl = card.querySelector<HTMLElement>('.cw-flare')
      if (flareEl) flareEl.style.opacity = (Math.min(Math.max(phase - 0.08, 0) / 0.18, 1) * 0.8).toFixed(3)

      // Fog: thick → thin
      const fogEl = card.querySelector<HTMLElement>('.cw-fog')
      if (fogEl) fogEl.style.opacity = Math.max(0, 0.92 - phase * 1.35).toFixed(3)

      // Reveal classes
      card.classList.toggle('cw-pn',  phase > 0.26)
      card.classList.toggle('cw-ps1', phase > 0.50)
      card.classList.toggle('cw-ps2', phase > 0.57)
      card.classList.toggle('cw-ps3', phase > 0.64)
      card.classList.toggle('cw-ps4', phase > 0.71)
    })
  }, [N])

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [update])

  if (N === 0) return null

  return (
    <section
      ref={sectionRef}
      id="champions-walk"
      style={{ height: `${N * 110 + 60}svh`, position: 'relative' }}
    >
      <style>{STYLES}</style>

      <div ref={fixedRef2} style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100svh', overflow: 'hidden', display: 'none', zIndex: 50 }}>

        {/* ── Player cards (all pre-rendered, shown/hidden via JS) ── */}
        {walkPlayers.map((player, i) => {
          const prof  = PROFILES[i % PROFILES.length]
          const rank  = i + 1
          const ini   = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          const dustAnims = ['cw-da','cw-db','cw-dc','cw-dd']

          const stats = [
            { val: `${Math.round(player.winRate * 100)}%`, lbl: 'WIN RATE'  },
            { val: String(player.wins),                     lbl: 'VICTORIES' },
            { val: player.goalDiff >= 0 ? `+${player.goalDiff}` : String(player.goalDiff), lbl: 'GOAL DIFF' },
            { val: String(player.matchesPlayed),            lbl: 'MATCHES'   },
          ]

          return (
            <div
              key={player.id}
              ref={el => { cardRefs.current[i] = el }}
              className="cw-card"
              style={{ display: 'flex', opacity: i === 0 ? 1 : 0, pointerEvents: i === 0 ? 'auto' : 'none' }}
            >
              {/* Atmospheric */}
              <div className="cw-bg" />
              <div className="cw-fog" />
              <div className="cw-vig" />

              {/* Spotlight cone */}
              <div className="cw-spot" style={{
                opacity: 0,
                background: `conic-gradient(from ${prof.spotX * 3.4}deg at ${prof.spotX}% ${prof.spotY}%, rgba(255,255,255,.065) 0deg, transparent 22deg, transparent 338deg, rgba(255,255,255,.065) 360deg)`,
              }} />

              {/* Lens flare */}
              <div className="cw-flare" style={{
                left: `${prof.spotX}%`,
                top:  `${prof.spotY}%`,
                opacity: 0,
                background: `radial-gradient(ellipse at center, ${prof.light}55 0%, ${prof.light}22 35%, transparent 65%)`,
              }} />

              {/* Dust particles */}
              {Array.from({ length: 22 }).map((_, dp) => {
                const sz = 1.5 + (dp % 3) * 0.8
                return (
                  <div
                    key={dp}
                    className="cw-dust"
                    style={{
                      left:  `${5 + (dp * 19 + i * 7) % 90}%`,
                      top:   `${5 + (dp * 13 + i * 11) % 88}%`,
                      width: sz, height: sz,
                      animationName:     dustAnims[dp % 4],
                      animationDuration: `${3.5 + (dp % 6) * 0.65}s`,
                      animationDelay:    `${(dp % 8) * 0.38}s`,
                      background: dp % 8 === 0
                        ? `rgba(${prof.bgR},${prof.bgG},${prof.bgB},0.9)`
                        : `rgba(255,255,255,${(0.3 + (dp % 4) * 0.18).toFixed(2)})`,
                    }}
                  />
                )
              })}

              {/* Player photo */}
              <div className="cw-photo-wrap">
                {player.avatarUrl
                  ? <img src={player.avatarUrl} alt={player.name} className="cw-photo" style={{ opacity: 0 }} />
                  : <div className="cw-initials-ph" style={{ opacity: 0 }}>{ini}</div>
                }
              </div>

              {/* Edge fade over photo */}
              <div className="cw-edges" />

              {/* Scene badge */}
              <div className="cw-scene-badge">{prof.label}</div>

              {/* Info overlay */}
              <div className="cw-info">
                <div className="cw-cinema-sub">Champions Walk</div>

                <div className="cw-rank-line">
                  <span className="cw-rank-num">#{rank}</span>
                  <span className="cw-rank-txt">RANKED</span>
                </div>

                <h3 className="cw-name">
                  {player.name.split(' ').map((word, wi) => (
                    <span
                      key={wi}
                      className="cw-nw"
                      style={{ transitionDelay: `${wi * 0.13}s` }}
                    >
                      {word}
                    </span>
                  ))}
                </h3>

                <div className="cw-stats">
                  {stats.map((s, si) => (
                    <div key={si} className="cw-stat">
                      <span className="cw-sv">{s.val}</span>
                      <span className="cw-sl">{s.lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {/* ── Finale (always in DOM after first reveal, shown/hidden via ref) ── */}
        <div ref={finaleRef} className="cw-finale" style={{ display: 'none' }}>
          {finaleOn && <FinaleContent players={walkPlayers} />}
        </div>
      </div>
    </section>
  )
}

// ── Formation finale content (mounts once, CSS animations auto-play) ──────────
function FinaleContent({ players }: { players: NamedPlayerStats[] }) {
  return (
    <>
      {/* Ambient glow */}
      <div className="cw-glow-bg" />

      {/* Confetti */}
      {Array.from({ length: 28 }).map((_, ci) => (
        <div
          key={ci}
          className="cw-confetti"
          style={{
            left:              `${4 + (ci * 7) % 92}%`,
            top:               '-10px',
            width:             `${4 + ci % 6}px`,
            height:            `${8 + ci % 8}px`,
            background:        CONFETTI_COLORS[ci % CONFETTI_COLORS.length],
            animationDuration: `${3 + (ci % 8) * 0.4}s`,
            animationDelay:    `${(ci % 10) * 0.22}s`,
            opacity:           0,
            animationFillMode: 'both',
          }}
        />
      ))}

      {/* Firework bursts */}
      {Array.from({ length: 8 }).map((_, fi) => (
        <div
          key={fi}
          className="cw-fw-ring"
          style={{
            left:              `${10 + (fi * 14) % 80}%`,
            top:               `${8  + (fi * 11) % 55}%`,
            width:             `${20 + fi * 6}px`,
            height:            `${20 + fi * 6}px`,
            borderColor:       FIREWORK_COLORS[fi % FIREWORK_COLORS.length],
            animationDuration: `${0.8 + (fi % 4) * 0.3}s`,
            animationDelay:    `${0.3 + (fi % 6) * 0.18}s`,
            opacity:           0,
            animationFillMode: 'both',
          }}
        />
      ))}

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 24px', maxWidth: 900, width: '100%' }}>

        {/* Trophy */}
        <div className="cw-finale-trophy" role="img" aria-label="Championship Trophy">🏆</div>

        {/* Player formation */}
        <div className="cw-finale-players">
          {players.map((p, pi) => {
            const ini = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            return p.avatarUrl
              ? (
                <img
                  key={p.id}
                  src={p.avatarUrl}
                  alt={p.name}
                  className="cw-finale-av"
                  style={{ animationDelay: `${1.4 + pi * 0.07}s` }}
                  title={p.name}
                />
              )
              : (
                <div
                  key={p.id}
                  className="cw-finale-ini"
                  style={{ animationDelay: `${1.4 + pi * 0.07}s` }}
                  title={p.name}
                >
                  {ini}
                </div>
              )
          })}
        </div>

        {/* Eyebrow */}
        <div className="cw-finale-eye">The Road to Glory</div>

        {/* Headline */}
        <h2 className="cw-finale-h1">
          EVERY CHAMPION<br />EARNS IT
        </h2>

        {/* Taglines */}
        <div className="cw-finale-lines">
          <span className="cw-finale-line">Every Match Matters.</span>
          <span className="cw-finale-line">Every Rival Counts.</span>
          <span className="cw-finale-line">Every Champion Earns It.</span>
        </div>

        {/* CTA */}
        <div className="cw-finale-cta">
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              padding: '16px 52px',
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              color: '#fff',
              borderRadius: 100,
              fontWeight: 800,
              fontSize: 13,
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              boxShadow: '0 4px 36px rgba(220,38,38,0.5)',
            }}
          >
            Enter FC26 Manager →
          </Link>
        </div>
      </div>
    </>
  )
}
