'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

type WinTier = 'small' | 'big' | 'huge' | 'mega'

function getWinTier(multiplier: number): WinTier {
  if (multiplier >= 100) return 'mega'
  if (multiplier >= 20)  return 'huge'
  if (multiplier >= 5)   return 'big'
  return 'small'
}

function getWinLabel(tier: WinTier): string {
  if (tier === 'mega') return 'MEGA WIN'
  if (tier === 'huge') return 'HUGE WIN'
  if (tier === 'big')  return 'GREAT WIN'
  return 'WIN!'
}

// Canvas confetti
function useConfetti(canvasRef: React.RefObject<HTMLCanvasElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !canvasRef.current) return

    const canvas  = canvasRef.current
    const ctx     = canvas.getContext('2d')!
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#F59E0B','#EF4444','#22C55E','#3B82F6','#A78BFA','#EC4899','#fff']
    const particles = Array.from({ length: 120 }, () => ({
      x:      Math.random() * canvas.width,
      y:      Math.random() * canvas.height * 0.4 - canvas.height * 0.2,
      w:      6 + Math.random() * 8,
      h:      4 + Math.random() * 4,
      angle:  Math.random() * Math.PI * 2,
      vx:     (Math.random() - 0.5) * 5,
      vy:     2 + Math.random() * 4,
      va:     (Math.random() - 0.5) * 0.15,
      color:  COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha:  1,
    }))

    let raf: number
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      for (const p of particles) {
        p.x     += p.vx
        p.y     += p.vy
        p.angle += p.va
        p.vy    += 0.1
        if (p.y < canvas.height + 20) alive = true
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      if (alive) raf = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [active, canvasRef])
}

export function WinOverlay({
  multiplier,
  winAmount,
  visible,
  onDismiss,
}: {
  multiplier: number
  winAmount:  number
  visible:    boolean
  onDismiss:  () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tier      = getWinTier(multiplier)
  const isBig     = tier !== 'small'

  useConfetti(canvasRef, visible && isBig)

  // Auto-dismiss after delay
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onDismiss, isBig ? 4000 : 2000)
    return () => clearTimeout(t)
  }, [visible, isBig, onDismiss])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isBig ? 'rgba(0,0,0,0.85)' : 'transparent',
            cursor: 'pointer',
            pointerEvents: visible ? 'auto' : 'none',
          }}
        >
          {/* Confetti canvas */}
          {isBig && (
            <canvas
              ref={canvasRef}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
            />
          )}

          {/* Win card */}
          <motion.div
            initial={{ scale: 0.4, y: 60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            style={{
              position: 'relative', zIndex: 2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              padding: '40px 56px',
              borderRadius: 24,
              background: isBig
                ? 'linear-gradient(135deg, #1a0f00 0%, #2d1f00 50%, #1a1200 100%)'
                : 'linear-gradient(135deg, rgba(26,15,0,0.9) 0%, rgba(45,31,0,0.9) 100%)',
              border: `2px solid #F59E0B`,
              boxShadow: `0 0 60px rgba(245,158,11,0.5), 0 0 120px rgba(245,158,11,0.2)`,
            }}
          >
            {/* Glow rings for mega/huge */}
            {(tier === 'mega' || tier === 'huge') && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{
                    position: 'absolute', inset: -20,
                    borderRadius: 36,
                    border: '3px solid #F59E0B',
                    pointerEvents: 'none',
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                  style={{
                    position: 'absolute', inset: -40,
                    borderRadius: 48,
                    border: '2px solid #F59E0B',
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}

            {/* Label */}
            <motion.div
              animate={isBig ? { scale: [1, 1.08, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.8 }}
              style={{
                fontSize: isBig ? 52 : 36,
                fontWeight: 900,
                letterSpacing: '0.06em',
                background: 'linear-gradient(135deg, #F59E0B, #FDE68A, #F59E0B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: 'none',
                filter: `drop-shadow(0 0 20px rgba(245,158,11,0.8))`,
              }}
            >
              {getWinLabel(tier)}
            </motion.div>

            {/* Win amount */}
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 280 }}
              style={{
                fontSize: isBig ? 42 : 32,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '0.02em',
              }}
            >
              +{winAmount.toLocaleString()} coins
            </motion.div>

            {/* Multiplier badge */}
            <div style={{
              background: 'rgba(245,158,11,0.2)',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 999,
              padding: '4px 16px',
              fontSize: 16,
              fontWeight: 700,
              color: '#F59E0B',
            }}>
              ×{multiplier.toFixed(multiplier >= 10 ? 0 : 1)}
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              Tap to continue
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
