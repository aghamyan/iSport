'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { useTranslation } from '@/lib/i18n/context'
import { playCasinoRouletteAction } from '@/app/casino/actions'
import { WHEEL_ORDER, getNumberColor, wheelPositionOf } from '@/lib/casino/roulette'
import { WinOverlay } from './WinOverlay'
import type { RouletteBet, RouletteBetType } from '@/lib/casino/types'

// ─── Roulette Wheel (Canvas) ──────────────────────────────────────────────────

const POCKET_COUNT = 37
const POCKET_ANGLE = (Math.PI * 2) / POCKET_COUNT

function drawWheel(
  ctx:       CanvasRenderingContext2D,
  size:      number,
  rotation:  number,
  winNumber: number | null,
  animating: boolean
) {
  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 4
  const innerR = size / 2 - 48
  const numberR = (outerR + innerR) / 2

  ctx.clearRect(0, 0, size, size)

  // Outer ring
  ctx.beginPath()
  ctx.arc(cx, cy, outerR + 4, 0, Math.PI * 2)
  ctx.fillStyle = '#1a0a00'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, outerR + 2, 0, Math.PI * 2)
  ctx.strokeStyle = '#F59E0B'
  ctx.lineWidth = 3
  ctx.stroke()

  // Draw pockets
  for (let i = 0; i < POCKET_COUNT; i++) {
    const num   = WHEEL_ORDER[i]
    const color = getNumberColor(num)
    const start = rotation + i * POCKET_ANGLE - POCKET_ANGLE / 2
    const end   = rotation + i * POCKET_ANGLE + POCKET_ANGLE / 2

    // Fill pocket
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, outerR, start, end)
    ctx.closePath()
    ctx.fillStyle = color === 'green' ? '#15803D' : color === 'red' ? '#DC2626' : '#1a1a1a'
    ctx.fill()
    ctx.strokeStyle = '#3d3000'
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Highlight winning pocket
    if (!animating && winNumber !== null && num === winNumber) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, outerR, start, end)
      ctx.closePath()
      ctx.fillStyle = 'rgba(245,158,11,0.5)'
      ctx.fill()
    }

    // Number text
    const angle  = rotation + i * POCKET_ANGLE
    const tx     = cx + Math.cos(angle) * numberR
    const ty     = cy + Math.sin(angle) * numberR
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(angle + Math.PI / 2)
    ctx.font = `bold ${outerR < 140 ? 9 : 11}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(String(num), 0, 0)
    ctx.restore()
  }

  // Inner circle (hub)
  ctx.beginPath()
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR)
  grad.addColorStop(0, '#2d1f00')
  grad.addColorStop(1, '#1a0a00')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = '#F59E0B'
  ctx.lineWidth = 2
  ctx.stroke()

  // Centre decorative
  ctx.beginPath()
  ctx.arc(cx, cy, 20, 0, Math.PI * 2)
  ctx.fillStyle = '#F59E0B'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#1a0a00'
  ctx.fill()

  // Ball position (top dead-centre in world space = angle 0)
  // Ball sits just inside outer ring, at angle 0 relative to canvas (not wheel)
  const ballR = outerR - 14
  ctx.beginPath()
  ctx.arc(cx + Math.cos(-Math.PI / 2) * ballR, cy + Math.sin(-Math.PI / 2) * ballR, 7, 0, Math.PI * 2)
  const ballGrad = ctx.createRadialGradient(
    cx + Math.cos(-Math.PI / 2) * ballR - 2, cy + Math.sin(-Math.PI / 2) * ballR - 2, 1,
    cx + Math.cos(-Math.PI / 2) * ballR,     cy + Math.sin(-Math.PI / 2) * ballR,     7
  )
  ballGrad.addColorStop(0, '#fff')
  ballGrad.addColorStop(1, '#c0c0c0')
  ctx.fillStyle = ballGrad
  ctx.fill()
}

function RouletteWheel({
  spinning, winNumber, onSpinEnd,
}: {
  spinning:  boolean
  winNumber: number | null
  onSpinEnd: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const rotRef    = useRef(0)
  const velRef    = useRef(0)
  const doneRef   = useRef(false)
  const [size, setSize] = useState(300)

  // Responsive size
  useEffect(() => {
    function update() {
      setSize(Math.min(300, window.innerWidth - 48))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    if (spinning) {
      doneRef.current = false
      velRef.current  = 0.28  // radians per frame ~= fast spin

      const animate = () => {
        if (doneRef.current) return

        if (!spinning) {
          cancelAnimationFrame(rafRef.current)
          return
        }

        rotRef.current += velRef.current
        drawWheel(ctx, size, rotRef.current, null, true)
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(rafRef.current)

      if (winNumber !== null && !doneRef.current) {
        doneRef.current = true

        // Decelerate to target angle
        const targetPos     = wheelPositionOf(winNumber)
        // Angle of that pocket in current rotation frame
        const targetAngle   = targetPos * POCKET_ANGLE
        // We want pocket at top (-PI/2). Current rotation puts pocket at rotRef.current + targetAngle
        // We need: (rotRef.current + extra) + targetAngle ≡ -PI/2  (mod 2PI)
        // extra = (-PI/2 - targetAngle - rotRef.current) mod 2PI + 4*2PI (extra spins)
        const current   = rotRef.current % (Math.PI * 2)
        const desired   = -Math.PI / 2 - targetAngle
        let   delta     = ((desired - current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        delta          += Math.PI * 2 * 6  // 6 extra full rotations for effect

        const totalFrames = 90  // ~1.5s at 60fps
        let frame         = 0
        const startAngle  = rotRef.current  // capture once; use absolute lerp

        const decel = () => {
          frame++
          const t    = frame / totalFrames
          const ease = 1 - Math.pow(1 - t, 3)  // ease-out cubic
          rotRef.current = startAngle + delta * ease  // absolute interpolation → lands exactly on target

          drawWheel(ctx, size, rotRef.current, null, true)

          if (frame < totalFrames) {
            rafRef.current = requestAnimationFrame(decel)
          } else {
            rotRef.current = startAngle + delta  // snap exact (no floating-point drift)
            drawWheel(ctx, size, rotRef.current, winNumber, false)
            onSpinEnd()
          }
        }
        rafRef.current = requestAnimationFrame(decel)
      } else {
        drawWheel(ctx, size, rotRef.current, winNumber, false)
      }
    }

    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, winNumber, size])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 8 }}>
      {/* Pointer */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%',
          transform: 'translate(-50%, -8px)',
          width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '18px solid #F59E0B',
          zIndex: 2,
          filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.8))',
        }} />
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{ borderRadius: '50%', display: 'block' }}
        />
      </div>
    </div>
  )
}

// ─── Betting Table ─────────────────────────────────────────────────────────────

const OUTSIDE_BETS: Array<{ type: RouletteBetType; label: string; payout: string; color?: string }> = [
  { type: 'red',    label: '🔴 Red',    payout: '1:1', color: '#DC2626' },
  { type: 'black',  label: '⚫ Black',  payout: '1:1', color: '#374151' },
  { type: 'even',   label: 'Even',      payout: '1:1' },
  { type: 'odd',    label: 'Odd',       payout: '1:1' },
  { type: 'low',    label: '1–18',      payout: '1:1' },
  { type: 'high',   label: '19–36',     payout: '1:1' },
  { type: 'dozen_1',label: '1st 12',    payout: '2:1' },
  { type: 'dozen_2',label: '2nd 12',    payout: '2:1' },
  { type: 'dozen_3',label: '3rd 12',    payout: '2:1' },
  { type: 'col_1',  label: '1st Col',   payout: '2:1' },
  { type: 'col_2',  label: '2nd Col',   payout: '2:1' },
  { type: 'col_3',  label: '3rd Col',   payout: '2:1' },
]

function BettingTable({
  bets, chipAmount, onToggleBet, disabled, winNumber,
}: {
  bets:        Map<string, number>
  chipAmount:  number
  onToggleBet: (type: RouletteBetType, value?: number) => void
  disabled:    boolean
  winNumber:   number | null
}) {
  function isBetOn(type: RouletteBetType, value?: number): boolean {
    const key = value !== undefined ? `${type}:${value}` : type
    return bets.has(key)
  }

  function getBetAmount(type: RouletteBetType, value?: number): number {
    const key = value !== undefined ? `${type}:${value}` : type
    return bets.get(key) ?? 0
  }

  function isWinner(type: RouletteBetType, value?: number): boolean {
    if (winNumber === null) return false
    const color = getNumberColor(winNumber)
    switch (type) {
      case 'straight': return value === winNumber
      case 'red':      return color === 'red'
      case 'black':    return color === 'black'
      case 'even':     return winNumber !== 0 && winNumber % 2 === 0
      case 'odd':      return winNumber !== 0 && winNumber % 2 !== 0
      case 'low':      return winNumber >= 1 && winNumber <= 18
      case 'high':     return winNumber >= 19 && winNumber <= 36
      case 'dozen_1':  return winNumber >= 1 && winNumber <= 12
      case 'dozen_2':  return winNumber >= 13 && winNumber <= 24
      case 'dozen_3':  return winNumber >= 25 && winNumber <= 36
      case 'col_1':    return winNumber !== 0 && winNumber % 3 === 1
      case 'col_2':    return winNumber !== 0 && winNumber % 3 === 2
      case 'col_3':    return winNumber !== 0 && winNumber % 3 === 0
      default:         return false
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Zero */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[0].map(n => {
          const active = isBetOn('straight', n)
          const won    = isWinner('straight', n)
          return (
            <button
              key={n}
              onClick={() => onToggleBet('straight', n)}
              disabled={disabled}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8,
                border: `2px solid ${won ? '#F59E0B' : active ? '#22C55E' : 'rgba(255,255,255,0.15)'}`,
                background: won ? 'rgba(245,158,11,0.3)' : active ? 'rgba(34,197,94,0.2)' : '#15803D',
                color: '#fff', fontSize: 14, fontWeight: 800,
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: won ? '0 0 12px rgba(245,158,11,0.6)' : 'none',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              0
              {active && (
                <span style={{
                  position: 'absolute', top: -8, right: -8,
                  background: '#22C55E', borderRadius: '50%', width: 18, height: 18,
                  fontSize: 9, fontWeight: 800, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {getBetAmount('straight', n)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Number grid 1-36 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3,
      }}>
        {Array.from({ length: 36 }, (_, i) => i + 1).map(n => {
          const color  = getNumberColor(n)
          const active = isBetOn('straight', n)
          const won    = isWinner('straight', n)

          return (
            <button
              key={n}
              onClick={() => onToggleBet('straight', n)}
              disabled={disabled}
              style={{
                padding: '7px 0', borderRadius: 6,
                border: `1.5px solid ${won ? '#F59E0B' : active ? '#22C55E' : 'transparent'}`,
                background: won ? 'rgba(245,158,11,0.4)' : active ? 'rgba(34,197,94,0.3)' : color === 'red' ? '#DC2626' : '#1a1a2e',
                color: '#fff', fontSize: 11, fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: won ? '0 0 8px rgba(245,158,11,0.6)' : 'none',
                transition: 'all 0.12s',
                position: 'relative',
              }}
            >
              {n}
              {active && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#22C55E', borderRadius: '50%', width: 14, height: 14,
                  fontSize: 7, fontWeight: 800, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Outside bets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {OUTSIDE_BETS.map(({ type, label, payout, color }) => {
          const active = isBetOn(type)
          const won    = isWinner(type)
          const amt    = getBetAmount(type)

          return (
            <button
              key={type}
              onClick={() => onToggleBet(type)}
              disabled={disabled}
              style={{
                padding: '8px 6px', borderRadius: 8,
                border: `1.5px solid ${won ? '#F59E0B' : active ? '#22C55E' : 'rgba(255,255,255,0.12)'}`,
                background: won
                  ? 'rgba(245,158,11,0.25)'
                  : active
                    ? `${color ? color + '40' : 'rgba(34,197,94,0.2)'}`
                    : color
                      ? color + '30'
                      : 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: 11, fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: won ? '0 0 10px rgba(245,158,11,0.5)' : 'none',
                transition: 'all 0.12s',
                textAlign: 'center',
              }}
            >
              <div>{label}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{payout}</div>
              {active && amt > 0 && (
                <div style={{ fontSize: 9, color: '#22C55E', marginTop: 1, fontWeight: 900 }}>
                  {amt.toLocaleString()}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Roulette Game ───────────────────────────────────────────────────────

export function RouletteGame() {
  const { balance, setBalance } = useBetSlip()
  const { t } = useTranslation()
  const [chipAmount, setChipAmount] = useState(10)
  const [bets, setBets]             = useState<Map<string, number>>(new Map())
  const [spinning, setSpinning]     = useState(false)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [winNumber, setWinNumber]   = useState<number | null>(null)
  const [resultMsg, setResultMsg]   = useState<string | null>(null)
  const [showWin, setShowWin]       = useState(false)
  const [winAmount, setWinAmount]   = useState(0)
  const [winMultiplier, setWinMultiplier] = useState(0)
  const [error, setError]           = useState<string | null>(null)
  const pendingResult = useRef<{ totalPayout: number; payoutMultiplier: number } | null>(null)

  const totalBet = Array.from(bets.values()).reduce((s, v) => s + v, 0)

  function toggleBet(type: RouletteBetType, value?: number) {
    const key = value !== undefined ? `${type}:${value}` : type
    setBets(prev => {
      const next = new Map(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.set(key, chipAmount)
      }
      return next
    })
  }

  function clearBets() {
    setBets(new Map())
  }

  const handleSpin = useCallback(async () => {
    if (spinning || bets.size === 0) return
    if (balance < totalBet) { setError('Insufficient balance'); return }

    setError(null)
    setResultMsg(null)
    setWinNumber(null)

    const betsList = Array.from(bets.entries()).map(([key, amount]) => {
      const [type, val] = key.split(':')
      return {
        type:   type as RouletteBetType,
        value:  val !== undefined ? Number(val) : undefined,
        amount,
      }
    })

    setSpinning(true)
    setWheelSpinning(true)

    try {
      const result = await playCasinoRouletteAction(betsList)
      pendingResult.current = {
        totalPayout:     result.result.totalPayout,
        payoutMultiplier: result.result.payoutMultiplier,
      }
      setBalance(result.newBalance)

      // Stop wheel after 3s (enough for deceleration animation)
      setTimeout(() => {
        setWheelSpinning(false)
        setWinNumber(result.result.winningNumber)
        setSpinning(false)
      }, 3000)
    } catch (e) {
      setWheelSpinning(false)
      setSpinning(false)
      setError(e instanceof Error ? e.message : 'Spin failed')
    }
  }, [spinning, bets, balance, totalBet, setBalance])

  function handleSpinEnd() {
    if (!pendingResult.current) return
    const { totalPayout, payoutMultiplier } = pendingResult.current
    pendingResult.current = null

    if (totalPayout > 0) {
      setResultMsg(`Won ${totalPayout.toLocaleString()} coins!`)
      setWinAmount(totalPayout)
      setWinMultiplier(payoutMultiplier)
      setTimeout(() => setShowWin(true), 600)
    } else {
      setResultMsg(`Lost — better luck next time!`)
    }
  }

  const CHIP_AMOUNTS = [10, 25, 50, 100, 250, 500]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 50%, #071020 100%)',
      borderRadius: 20, padding: 20,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#F59E0B' }}>{t('casino.europeanRoulette')}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {t('casino.rtpInfo')}
        </div>
      </div>

      {/* Wheel */}
      <RouletteWheel
        spinning={wheelSpinning}
        winNumber={winNumber}
        onSpinEnd={handleSpinEnd}
      />

      {/* Win number display */}
      {winNumber !== null && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(0,0,0,0.4)',
            border: '2px solid rgba(245,158,11,0.4)',
            borderRadius: 12, padding: '8px 20px',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: getNumberColor(winNumber) === 'red' ? '#DC2626' : getNumberColor(winNumber) === 'black' ? '#1a1a2e' : '#15803D',
              fontSize: 18, fontWeight: 900, color: '#fff',
              border: '2px solid rgba(245,158,11,0.6)',
              boxShadow: '0 0 12px rgba(245,158,11,0.4)',
            }}>
              {winNumber}
            </div>
            {resultMsg && (
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: resultMsg.startsWith('Won') ? '#22C55E' : '#9CA3AF',
              }}>
                {resultMsg}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Chip selector */}
      <div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          {t('casino.chipValue')}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CHIP_AMOUNTS.map(amt => (
            <motion.button
              key={amt}
              whileTap={{ scale: 0.92 }}
              onClick={() => setChipAmount(amt)}
              disabled={spinning}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                border: `2.5px solid ${chipAmount === amt ? '#F59E0B' : 'rgba(255,255,255,0.2)'}`,
                background: chipAmount === amt ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.05)',
                color: chipAmount === amt ? '#F59E0B' : 'rgba(255,255,255,0.6)',
                fontSize: 10, fontWeight: 800, cursor: spinning ? 'not-allowed' : 'pointer',
                boxShadow: chipAmount === amt ? '0 0 12px rgba(245,158,11,0.4)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {amt >= 1000 ? `${amt / 1000}K` : amt}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Betting table */}
      <BettingTable
        bets={bets}
        chipAmount={chipAmount}
        onToggleBet={toggleBet}
        disabled={spinning}
        winNumber={winNumber}
      />

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 12px', borderRadius: 10,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, fontWeight: 700, color: '#EF4444', textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={clearBets}
          disabled={spinning || bets.size === 0}
          style={{
            flex: 1, padding: '12px', borderRadius: 12,
            border: '1.5px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700,
            cursor: (spinning || bets.size === 0) ? 'not-allowed' : 'pointer',
            opacity: (spinning || bets.size === 0) ? 0.5 : 1,
          }}
        >
          {t('casino.clearBets')}
        </button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSpin}
          disabled={spinning || bets.size === 0 || balance < totalBet}
          style={{
            flex: 3, padding: '12px',
            borderRadius: 12, border: 'none',
            background: (spinning || bets.size === 0 || balance < totalBet)
              ? 'rgba(255,255,255,0.1)'
              : 'linear-gradient(135deg, #F59E0B, #D97706)',
            color: (spinning || bets.size === 0) ? 'rgba(255,255,255,0.5)' : '#000',
            fontSize: 15, fontWeight: 900,
            cursor: (spinning || bets.size === 0 || balance < totalBet) ? 'not-allowed' : 'pointer',
            boxShadow: (!spinning && bets.size > 0 && balance >= totalBet) ? '0 4px 20px rgba(245,158,11,0.5)' : 'none',
          }}
        >
          {spinning ? `🎡 ${t('casino.spinning')}` : `🎡 ${t('casino.spinRoulette')} — ${totalBet.toLocaleString()}`}
        </motion.button>
      </div>

      {/* Balance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{t('casino.balance')}</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: '#F59E0B' }}>
          {balance.toLocaleString()} {t('casino.coins')}
        </span>
      </div>

      {/* Win overlay */}
      <WinOverlay
        multiplier={winMultiplier}
        winAmount={winAmount}
        visible={showWin}
        onDismiss={() => { setShowWin(false); setBets(new Map()) }}
      />
    </div>
  )
}
