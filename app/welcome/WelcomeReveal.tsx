'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { P4PBreakdown } from '@/lib/stats/p4p'

export type RankedChamp = {
  id:            string
  name:          string
  avatarUrl:     string | null
  wins:          number
  matchesPlayed: number
  p4p:           P4PBreakdown
}

// ─── Keyframes ──────────────────────────────────────────────────────────────────

const ANIMS = `
  @keyframes starRise {
    0%   { transform: translateY(0) scale(1); opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 0.85; }
    100% { transform: translateY(-110vh) scale(0.3); opacity: 0; }
  }
  @keyframes crownDrop {
    0%   { transform: translateY(-50px) rotate(-12deg) scale(0.5); opacity: 0; }
    55%  { transform: translateY(7px) rotate(3deg) scale(1.06); opacity: 1; }
    75%  { transform: translateY(-3px) rotate(-1deg) scale(1); }
    100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
  }
  @keyframes heroReveal {
    0%   { transform: scale(0.2) rotate(-18deg); opacity: 0; filter: blur(24px); }
    55%  { transform: scale(1.08) rotate(2deg); opacity: 1; filter: blur(0); }
    75%  { transform: scale(0.97) rotate(-1deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes slideLeft {
    from { transform: translateX(-50px) scale(0.8); opacity: 0; }
    to   { transform: translateX(0) scale(1); opacity: 1; }
  }
  @keyframes slideRight {
    from { transform: translateX(50px) scale(0.8); opacity: 0; }
    to   { transform: translateX(0) scale(1); opacity: 1; }
  }
  @keyframes nameReveal {
    0%   { opacity: 0; transform: translateY(18px) scaleX(0.88); letter-spacing: 0.35em; }
    100% { opacity: 1; transform: translateY(0) scaleX(1);       letter-spacing: -0.01em; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmerText {
    0%   { background-position: -300% center; }
    100% { background-position: 300% center; }
  }
  @keyframes goldGlow {
    0%,100% {
      box-shadow: 0 0 0 3px #f59e0b, 0 0 40px 8px rgba(245,158,11,0.55), 0 0 80px 20px rgba(245,158,11,0.25);
    }
    50% {
      box-shadow: 0 0 0 3px #fcd34d, 0 0 60px 18px rgba(245,158,11,0.78), 0 0 120px 36px rgba(245,158,11,0.42);
    }
  }
  @keyframes silverGlow {
    0%,100% { box-shadow: 0 0 0 2.5px #94a3b8, 0 0 22px 6px rgba(148,163,184,0.4); }
    50%     { box-shadow: 0 0 0 2.5px #cbd5e1, 0 0 36px 12px rgba(148,163,184,0.6); }
  }
  @keyframes bronzeGlow {
    0%,100% { box-shadow: 0 0 0 2.5px #cd7f32, 0 0 22px 6px rgba(205,127,50,0.4); }
    50%     { box-shadow: 0 0 0 2.5px #e8a04a, 0 0 36px 12px rgba(205,127,50,0.6); }
  }
  @keyframes ringPulse {
    0%   { transform: scale(1);   opacity: 0.5; }
    100% { transform: scale(1.55); opacity: 0; }
  }
  @keyframes floatHero {
    0%,100% { transform: translateY(0px); }
    50%     { transform: translateY(-8px); }
  }
  @keyframes sparkle {
    0%,100% { transform: scale(0) rotate(0deg);    opacity: 0; }
    45%     { transform: scale(1.1) rotate(160deg); opacity: 1; }
    55%     { transform: scale(0.9) rotate(180deg); opacity: 1; }
  }
  @keyframes neonCyan {
    0%,100% { box-shadow: 0 0 0 2.5px #22d3ee, 0 0 20px 5px rgba(34,211,238,0.45), 0 0 50px 15px rgba(34,211,238,0.18); }
    50%     { box-shadow: 0 0 0 2.5px #67e8f9, 0 0 38px 12px rgba(34,211,238,0.75), 0 0 90px 28px rgba(34,211,238,0.32); }
  }
  @keyframes neonPurple {
    0%,100% { box-shadow: 0 0 0 2.5px #a855f7, 0 0 20px 5px rgba(168,85,247,0.45), 0 0 50px 15px rgba(168,85,247,0.18); }
    50%     { box-shadow: 0 0 0 2.5px #c084fc, 0 0 38px 12px rgba(168,85,247,0.75), 0 0 90px 28px rgba(168,85,247,0.32); }
  }
  @keyframes riseUp {
    0%   { transform: translateY(32px) scale(0.8); opacity: 0; filter: blur(6px); }
    60%  { transform: translateY(-6px) scale(1.04); opacity: 1; filter: blur(0); }
    80%  { transform: translateY(2px) scale(0.99); }
    100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
  }
  @keyframes scanLine {
    0%   { top: -35%; opacity: 0; }
    18%  { opacity: 1; }
    82%  { opacity: 1; }
    100% { top: 135%; opacity: 0; }
  }
  @keyframes countdownShrink {
    from { width: 100%; }
    to   { width: 0%; }
  }
  @keyframes bgBreath {
    0%,100% { opacity: 0.32; }
    50%     { opacity: 0.62; }
  }
`

const AUTO_MS   = 60000
const STAR_N    = 65
const SPARK_N   = 8

const GOLD   = '#f59e0b'
const SILVER = '#94a3b8'
const BRONZE = '#cd7f32'
const MUTED  = 'rgba(255,255,255,0.35)'

// ─── Stars ──────────────────────────────────────────────────────────────────────

function Stars() {
  const items = Array.from({ length: STAR_N }, (_, i) => ({
    id:  i,
    x:   Math.random() * 100,
    sz:  Math.random() * 2.5 + 0.7,
    del: Math.random() * 10,
    dur: Math.random() * 7 + 5,
    op:  Math.random() * 0.55 + 0.25,
    col: Math.random() > 0.82 ? '#fcd34d' : '#fff',
  }))
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {items.map((s) => (
        <div key={s.id} style={{
          position: 'absolute', left: `${s.x}%`, bottom: -6,
          width: s.sz, height: s.sz, borderRadius: '50%',
          background: s.col, opacity: s.op,
          animation: `starRise ${s.dur}s ${s.del}s linear infinite`,
        }} />
      ))}
    </div>
  )
}

// ─── Sparkle orbit (hero only) ───────────────────────────────────────────────────

function SparkleOrbit({ size }: { size: number }) {
  const r = size / 2 + 22
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: SPARK_N }, (_, i) => {
        const a = (360 / SPARK_N) * i
        const x = Math.cos((a * Math.PI) / 180) * r
        const y = Math.sin((a * Math.PI) / 180) * r
        return (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 6, height: 6, marginTop: -3, marginLeft: -3,
            transform: `translate(${x}px,${y}px)`,
            animation: `sparkle ${1.5 + i * 0.22}s ${i * 0.2}s ease-in-out infinite`,
          }}>
            <svg width="6" height="6" viewBox="0 0 8 8" fill="#fcd34d">
              <path d="M4 0L4.9 3.1L8 4L4.9 4.9L4 8L3.1 4.9L0 4L3.1 3.1Z"/>
            </svg>
          </div>
        )
      })}
    </div>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────────

type AvatarProps = { url: string | null; name: string; size: number; rank: 1 | 2 | 3 }

function RankAvatar({ url, name, size, rank }: AvatarProps) {
  const glowAnim  = rank === 1 ? 'goldGlow 2.6s ease-in-out infinite' : rank === 2 ? 'silverGlow 3s ease-in-out infinite' : 'bronzeGlow 3s ease-in-out infinite'
  const ringColor = rank === 1 ? 'rgba(245,158,11,' : rank === 2 ? 'rgba(148,163,184,' : 'rgba(205,127,50,'
  const initials  = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const bgGrad    = rank === 1 ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)' : 'linear-gradient(135deg,#cd7f32,#92400e)'

  return (
    <div style={{
      position: 'relative', width: size, height: size,
      animation: rank === 1 ? 'floatHero 4s ease-in-out infinite' : 'none',
    }}>
      {rank === 1 && (
        <>
          {[1.5, 1.22].map((sc, i) => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: size * sc, height: size * sc,
              marginTop: -(size * sc) / 2, marginLeft: -(size * sc) / 2,
              borderRadius: '50%',
              border: `1.5px solid ${ringColor}${0.45 - i * 0.15})`,
              animation: `ringPulse ${2.2 + i * 0.8}s ${i * 0.5}s ease-out infinite`,
            }} />
          ))}
          <SparkleOrbit size={size} />
        </>
      )}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        animation: glowAnim, overflow: 'hidden', position: 'relative', zIndex: 1,
      }}>
        {url
          ? <img src={url} alt={name} width={size} height={size}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          : (
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: bgGrad, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: size * 0.34, fontWeight: 900, color: '#fff',
            }}>
              {initials}
            </div>
          )}
      </div>
    </div>
  )
}

// ─── Challenger avatar ───────────────────────────────────────────────────────────

function ChallengerAvatar({ url, name, size, color }: { url: string | null; name: string; size: number; color: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  if (url) {
    return (
      <img src={url} alt={name} width={size} height={size}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%' }} />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}55 0%, ${color}22 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 900, color: '#fff',
    }}>
      {initials}
    </div>
  )
}

// ─── Score badge ─────────────────────────────────────────────────────────────────

function ScoreBadge({ score, rank }: { score: number; rank: 1 | 2 | 3 }) {
  const color = rank === 1 ? GOLD : rank === 2 ? SILVER : BRONZE
  return (
    <div style={{
      background: `rgba(${rank === 1 ? '245,158,11' : rank === 2 ? '148,163,184' : '205,127,50'},0.15)`,
      border: `1px solid ${color}55`,
      borderRadius: 8, padding: '4px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: rank === 1 ? 22 : 17, fontWeight: 900, color, lineHeight: 1 }}>
        {score.toFixed(1)}
      </div>
      <div style={{ fontSize: 8, color: `${color}99`, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        P4P
      </div>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────────

export function WelcomeReveal({ top5 }: { top5: RankedChamp[] }) {
  const router   = useRouter()
  const [phase, setPhase]     = useState(0)
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200)   // crown + label
    const t2 = setTimeout(() => setPhase(2), 750)   // #1 avatar
    const t3 = setTimeout(() => setPhase(3), 1350)  // #2 + #3 slide in
    const t4 = setTimeout(() => setPhase(4), 1850)  // #1 name
    const t5 = setTimeout(() => setPhase(5), 2250)  // all scores
    const t6 = setTimeout(() => setPhase(6), 2650)  // bars
    const t7 = setTimeout(() => setPhase(7), 3150)  // button
    timerRef.current = setTimeout(go, AUTO_MS)
    return () => {
      [t1,t2,t3,t4,t5,t6,t7].forEach(clearTimeout)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function go() {
    if (leaving) return
    setLeaving(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    router.push('/')
  }

  const hero    = top5[0]
  const second  = top5[1] ?? null
  const third   = top5[2] ?? null
  const fourth  = top5[3] ?? null
  const fifth   = top5[4] ?? null

  // Visual order in the podium row: 2nd | 1st | 3rd
  type Slot = { champ: RankedChamp; rank: 1 | 2 | 3; avSize: number; stepH: number; slideAnim: string }
  const slots: Slot[] = [
    ...(second ? [{ champ: second, rank: 2 as const, avSize: 82,  stepH: 56, slideAnim: 'slideLeft 0.55s cubic-bezier(0.34,1.56,0.64,1) both' }] : []),
    {              champ: hero,   rank: 1 as const, avSize: 118, stepH: 82, slideAnim: 'heroReveal 0.75s cubic-bezier(0.34,1.56,0.64,1) both' },
    ...(third  ? [{ champ: third,  rank: 3 as const, avSize: 70,  stepH: 42, slideAnim: 'slideRight 0.55s cubic-bezier(0.34,1.56,0.64,1) both' }] : []),
  ]

  const rankColor = (r: 1 | 2 | 3) => r === 1 ? GOLD : r === 2 ? SILVER : BRONZE
  const rankMedal = (r: 1 | 2 | 3) => r === 1 ? '👑' : r === 2 ? '🥈' : '🥉'

  return (
    <div
      onClick={go}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, cursor: 'pointer',
        background: 'radial-gradient(ellipse 80% 55% at 50% 30%, #1c0900 0%, #0e0718 45%, #050911 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        opacity: leaving ? 0 : 1, transition: 'opacity 0.55s ease',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: ANIMS }} />

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 70%)',
        animation: 'bgBreath 3.5s ease-in-out infinite', pointerEvents: 'none',
      }} />

      <Stars />

      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 16px', maxWidth: 440, width: '100%',
      }}>

        {/* Crown */}
        {phase >= 1 && (
          <div style={{
            fontSize: 52, lineHeight: 1, marginBottom: 24,
            animation: 'crownDrop 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
            filter: 'drop-shadow(0 0 16px rgba(245,158,11,0.85))',
          }}>👑</div>
        )}

        {/* Podium row */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: 10, marginBottom: 20, width: '100%',
        }}>
          {slots.map(({ champ, rank, avSize, stepH, slideAnim }) => {
            const color  = rankColor(rank)
            const medal  = rankMedal(rank)
            const isHero = rank === 1
            const show   = isHero ? phase >= 2 : phase >= 3

            if (!show) {
              // Reserve space so layout doesn't jump
              return <div key={rank} style={{ width: avSize, flexShrink: 0 }} />
            }

            return (
              <div key={rank} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                flexShrink: 0,
                animation: slideAnim,
              }}>
                {/* Medal above avatar */}
                <span style={{
                  fontSize: isHero ? 22 : 16, marginBottom: 8,
                  filter: `drop-shadow(0 0 8px ${color}88)`,
                }}>{medal}</span>

                {/* Avatar */}
                <RankAvatar url={champ.avatarUrl} name={champ.name} size={avSize} rank={rank} />

                {/* Name */}
                {isHero
                  ? phase >= 4 && (
                    <div style={{
                      fontSize: 26, fontWeight: 900, textAlign: 'center',
                      marginTop: 14, marginBottom: 4,
                      background: 'linear-gradient(90deg,#f59e0b,#fcd34d,#f97316,#fbbf24,#f59e0b)',
                      backgroundSize: '300% auto',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      animation: 'nameReveal 0.55s ease both, shimmerText 4s linear 0.55s infinite',
                      maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{champ.name}</div>
                  )
                  : phase >= 4 && (
                    <div style={{
                      fontSize: 12, fontWeight: 700, color, textAlign: 'center',
                      marginTop: 8, maxWidth: avSize + 16,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      animation: 'fadeUp 0.4s ease both',
                    }}>{champ.name}</div>
                  )
                }

                {/* Score badge */}
                {phase >= 5 && (
                  <div style={{ marginTop: 6, animation: 'fadeUp 0.35s ease both' }}>
                    <ScoreBadge score={champ.p4p.score} rank={rank} />
                  </div>
                )}

                {/* Podium step */}
                <div style={{
                  width: avSize + (isHero ? 20 : 10),
                  height: stepH,
                  marginTop: 12,
                  background: `linear-gradient(180deg, ${color}22, transparent)`,
                  border: `1px solid ${color}33`, borderBottom: 'none',
                  borderRadius: '6px 6px 0 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: isHero ? 26 : 18, opacity: 0.12 }}>{medal}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Challengers — #4 & #5 */}
        {phase >= 6 && (fourth || fifth) && (
          <div style={{ width: '100%', marginBottom: 20, animation: 'fadeUp 0.45s ease both' }}>
            <div style={{
              fontSize: 8, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase',
              textAlign: 'center', marginBottom: 10,
              color: 'rgba(255,255,255,0.22)',
            }}>— Challengers —</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                { champ: fourth, rank: 4, color: '#22d3ee', glow: 'neonCyan 2.6s ease-in-out infinite',   scanDelay: '0s'   },
                { champ: fifth,  rank: 5, color: '#a855f7', glow: 'neonPurple 2.6s ease-in-out infinite', scanDelay: '2s'   },
              ] as const).filter(({ champ }) => !!champ).map(({ champ, rank, color, glow, scanDelay }) => {
                const c = champ!
                const entryDelay = rank === 4 ? '0s' : '0.14s'
                return (
                  <div key={rank} style={{
                    flex: 1, position: 'relative', overflow: 'hidden',
                    background: `radial-gradient(ellipse 100% 60% at 50% 0%, ${color}0e 0%, transparent 75%)`,
                    border: `1px solid ${color}2e`,
                    borderRadius: 18, padding: '22px 10px 16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    animation: `riseUp 0.65s cubic-bezier(0.34,1.56,0.64,1) ${entryDelay} both`,
                  }}>
                    {/* Scan line sweep */}
                    <div style={{
                      position: 'absolute', left: 0, right: 0, height: '38%',
                      background: `linear-gradient(180deg, transparent, ${color}14, transparent)`,
                      animation: `scanLine 4.2s ${scanDelay} linear infinite`,
                      pointerEvents: 'none', zIndex: 0,
                    }} />

                    {/* Rank pill tab */}
                    <div style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      background: `linear-gradient(90deg, ${color}ee, ${color}aa)`,
                      fontSize: 9, fontWeight: 900,
                      color: rank === 4 ? '#061018' : '#fff',
                      padding: '3px 14px', borderRadius: '0 0 10px 10px',
                      letterSpacing: '0.1em',
                      boxShadow: `0 4px 16px ${color}55`,
                      zIndex: 2,
                    }}>#{rank}</div>

                    {/* Avatar with neon glow */}
                    <div style={{ borderRadius: '50%', animation: glow, zIndex: 1, marginTop: 2 }}>
                      <ChallengerAvatar url={c.avatarUrl} name={c.name} size={62} color={color} />
                    </div>

                    {/* Name */}
                    <div style={{
                      fontSize: 12, fontWeight: 800, color: '#fff', textAlign: 'center',
                      width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      padding: '0 6px', zIndex: 1,
                    }}>{c.name.split(' ')[0]}</div>

                    {/* P4P score badge */}
                    <div style={{
                      background: `${color}18`, border: `1px solid ${color}44`,
                      borderRadius: 10, padding: '6px 14px', textAlign: 'center',
                      boxShadow: `0 0 18px ${color}2a`, zIndex: 1,
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>
                        {c.p4p.score.toFixed(1)}
                      </div>
                      <div style={{
                        fontSize: 8, color: `${color}88`, fontWeight: 700,
                        letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2,
                      }}>P4P</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Enter button */}
        {phase >= 7 && (
          <div style={{ animation: 'fadeUp 0.4s ease both', textAlign: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); go() }}
              style={{
                padding: '12px 36px', border: 'none', borderRadius: 100,
                background: 'linear-gradient(135deg,#f59e0b,#f97316)',
                fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer',
                letterSpacing: '0.05em',
                boxShadow: '0 4px 26px rgba(245,158,11,0.42)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.boxShadow = '0 6px 36px rgba(245,158,11,0.65)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 26px rgba(245,158,11,0.42)'
              }}
            >
              Enter →
            </button>
          </div>
        )}
      </div>

      {/* Countdown bar */}
      {phase >= 1 && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg,#f59e0b,#f97316)',
            animation: `countdownShrink ${AUTO_MS}ms linear both`,
          }} />
        </div>
      )}
    </div>
  )
}
