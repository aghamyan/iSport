'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useAnimate } from 'motion/react'
import Image from 'next/image'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { useTranslation } from '@/lib/i18n/context'
import { playCasinoSpinAction } from '@/app/casino/actions'
import { WinOverlay } from './WinOverlay'
import { SLOT_GAMES, BASE_SYMBOLS, PAYLINES } from '@/lib/casino/slotGames'
import type { SlotSymbol, SlotGame, SpinResult } from '@/lib/casino/types'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const SYMBOL_H  = 80    // px per symbol cell
const REEL_ROWS = 3     // visible rows
const REEL_W    = 100   // px per reel

// ─── Symbol Cell ──────────────────────────────────────────────────────────────

function SymbolCell({
  symbol, highlight, size = SYMBOL_H,
}: {
  symbol:    SlotSymbol | null
  highlight: boolean
  size?:     number
}) {
  if (!symbol) {
    return (
      <div style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: size * 0.45 }}>❓</div>
      </div>
    )
  }

  return (
    <div style={{
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      borderRadius: 12,
      background: highlight
        ? 'rgba(245,158,11,0.15)'
        : symbol.isPlayer ? 'rgba(245,158,11,0.06)' : 'transparent',
      boxShadow: highlight
        ? '0 0 20px rgba(245,158,11,0.6), inset 0 0 12px rgba(245,158,11,0.2)'
        : 'none',
      transition: 'box-shadow 0.3s, background 0.3s',
    }}>
      {symbol.imageUrl && symbol.isPlayer ? (
        <div style={{
          width: size * 0.7, height: size * 0.7,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `2px solid ${highlight ? '#F59E0B' : 'rgba(245,158,11,0.3)'}`,
          boxShadow: highlight ? '0 0 12px rgba(245,158,11,0.8)' : 'none',
        }}>
          <Image
            src={symbol.imageUrl}
            alt={symbol.label}
            width={Math.round(size * 0.7)}
            height={Math.round(size * 0.7)}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div style={{
          fontSize: size * 0.48,
          filter: highlight ? 'drop-shadow(0 0 8px rgba(245,158,11,0.9))' : 'none',
          transition: 'filter 0.3s',
        }}>
          {symbol.emoji}
        </div>
      )}

      {/* Highlight border */}
      {highlight && (
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: 12,
            border: '2px solid #F59E0B',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

// ─── Single Reel ──────────────────────────────────────────────────────────────

const STRIP_REPEAT = 20

function SlotReel({
  symbols, targetStop, isSpinning, delay, onStopped, winningRows,
}: {
  symbols:     SlotSymbol[]
  targetStop:  number[] | null  // [topIdx, midIdx, bottomIdx] from server
  isSpinning:  boolean
  delay:       number
  onStopped:   () => void
  winningRows: Set<number>
}) {
  const [scope, animate] = useAnimate()
  const stopCalled  = useRef(false)
  const [localStopped, setLocalStopped] = useState(false)
  const stripLen    = symbols.length * STRIP_REPEAT

  const strip = Array.from({ length: stripLen }, (_, i) => symbols[i % symbols.length])

  // Start fast spin when isSpinning becomes true
  useEffect(() => {
    if (!isSpinning || !scope.current) return
    stopCalled.current = false
    setLocalStopped(false)

    const startSpin = async () => {
      await animate(scope.current, { y: 0 }, { duration: 0 })
      const fastTarget = -(symbols.length * (STRIP_REPEAT - 6)) * SYMBOL_H
      await animate(scope.current, { y: fastTarget }, {
        duration: 1.8 + delay * 0.3,
        ease: 'easeIn',
      })
    }

    startSpin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning])

  // Each reel stops independently when its targetStop is set (regardless of global isSpinning)
  useEffect(() => {
    if (targetStop === null || stopCalled.current) return
    if (!scope.current) return
    stopCalled.current = true

    const stopReel = async () => {
      // targetStop[1] = server-computed middle-row symbol index
      const midStop   = targetStop[1]
      const targetPos = (STRIP_REPEAT - 3) * symbols.length + midStop
      const targetY   = -(targetPos - 1) * SYMBOL_H

      await animate(scope.current, { y: targetY }, {
        duration: 0.8,
        ease: [0.05, 0.9, 0.1, 1.0],
      })
      await animate(scope.current, { y: targetY + 6 }, { duration: 0.08 })
      await animate(scope.current, { y: targetY },     { duration: 0.12 })

      setLocalStopped(true)
      onStopped()
    }

    stopReel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStop])

  // Show the server-computed symbols exactly — top/mid/bottom as returned by the RNG
  const visibleSymbols: (SlotSymbol | null)[] = targetStop !== null
    ? [symbols[targetStop[0]], symbols[targetStop[1]], symbols[targetStop[2]]]
    : [null, null, null]

  return (
    <div style={{
      width: REEL_W, overflow: 'hidden',
      height: REEL_ROWS * SYMBOL_H,
      position: 'relative',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Spinning strip */}
      <div ref={scope} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        {strip.map((sym, i) => (
          <div key={i} style={{ height: SYMBOL_H }}>
            <SymbolCell symbol={sym} highlight={false} />
          </div>
        ))}
      </div>

      {/* Static overlay when stopped — shows the exact server-computed symbols */}
      {localStopped && targetStop !== null && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          {visibleSymbols.map((sym, row) => (
            <div key={row} style={{ height: SYMBOL_H }}>
              <SymbolCell
                symbol={sym}
                highlight={winningRows.has(row)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Top/bottom fade masks */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 20, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 20, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
      }} />
    </div>
  )
}

// ─── Bet Amount Selector ──────────────────────────────────────────────────────

function BetSelector({
  value, onChange, min, max, disabled,
}: {
  value:    number
  onChange: (n: number) => void
  min:      number
  max:      number
  disabled: boolean
}) {
  const { t } = useTranslation()
  const PRESETS = [10, 25, 50, 100, 250, 500, 1000]
  const filtered = PRESETS.filter(p => p >= min && p <= max)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {t('casino.betAmount')}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {filtered.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            disabled={disabled}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1.5px solid ${value === p ? '#F59E0B' : 'rgba(255,255,255,0.12)'}`,
              background: value === p ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
              color: value === p ? '#F59E0B' : 'rgba(255,255,255,0.7)',
              fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.15s',
            }}
          >
            {p.toLocaleString()}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={e => {
            const v = Math.max(min, Math.min(max, Number(e.target.value)))
            onChange(v)
          }}
          style={{
            width: 100, padding: '8px 12px',
            borderRadius: 8,
            border: '1.5px solid rgba(245,158,11,0.3)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          min {min.toLocaleString()} · max {max.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

// ─── Payout Table ─────────────────────────────────────────────────────────────

function PayTable({ symbols }: { symbols: SlotSymbol[] }) {
  const { t } = useTranslation()
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '12px 16px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {t('casino.payTable')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...symbols].reverse().map(sym => (
          <div key={sym.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {sym.imageUrl ? (
              <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <Image src={sym.imageUrl} alt={sym.label} width={22} height={22} style={{ objectFit: 'cover' }} />
              </div>
            ) : (
              <span style={{ fontSize: 18, lineHeight: 1 }}>{sym.emoji}</span>
            )}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', flex: 1, minWidth: 0 }}>{sym.label}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[3,4,5].map(n => {
                const mul = sym.multipliers[n] ?? 0
                if (!mul) return null
                return (
                  <span key={n} style={{
                    fontSize: 10, fontWeight: 700,
                    color: '#F59E0B',
                    background: 'rgba(245,158,11,0.1)',
                    borderRadius: 4, padding: '2px 5px',
                  }}>
                    {n}× = ×{mul}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Game Card ────────────────────────────────────────────────────────────────

export function SlotGameCard({
  game, onSelect,
}: {
  game:     SlotGame
  onSelect: (game: SlotGame) => void
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)

  const volatilityColor = {
    low:       '#22C55E',
    medium:    '#F59E0B',
    high:      '#EF4444',
    very_high: '#EC4899',
  }[game.volatility]

  const volatilityLabel = {
    low:       'Low',
    medium:    'Medium',
    high:      'High',
    very_high: 'Very High',
  }[game.volatility]

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => game.status === 'active' && onSelect(game)}
      style={{
        background: game.theme,
        borderRadius: 20,
        padding: 20,
        cursor: game.status === 'active' ? 'pointer' : 'default',
        border: `1px solid rgba(255,255,255,0.1)`,
        boxShadow: hovered
          ? `0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px ${game.accentColor}40`
          : '0 4px 16px rgba(0,0,0,0.3)',
        transition: 'box-shadow 0.2s',
        position: 'relative', overflow: 'hidden',
        opacity: game.status !== 'active' ? 0.6 : 1,
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 120, height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${game.accentColor}30 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Coming Soon badge */}
      {game.status === 'coming_soon' && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 20, padding: '3px 10px',
          fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {t('casino.comingSoon')}
        </div>
      )}

      <div style={{ fontSize: 28, marginBottom: 8 }}>🎰</div>

      <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
        {game.name}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
        {game.tagline}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{
          background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 10px',
          fontSize: 11, fontWeight: 700,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>RTP </span>
          <span style={{ color: game.accentColor }}>{game.rtp}%</span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 10px',
          fontSize: 11, fontWeight: 700,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Vol </span>
          <span style={{ color: volatilityColor }}>{volatilityLabel}</span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 10px',
          fontSize: 11, fontWeight: 700,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Min </span>
          <span style={{ color: '#fff' }}>{game.minBet.toLocaleString()}</span>
        </div>
      </div>

      {/* Jackpot */}
      <div style={{
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 10, padding: '8px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase' }}>{t('casino.jackpot')}</span>
        <span style={{
          fontSize: 16, fontWeight: 900, color: '#F59E0B',
          filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.6))',
        }}>
          🏆 {game.jackpot.toLocaleString()}
        </span>
      </div>

      {/* CTA */}
      {game.status === 'active' && (
        <div style={{
          width: '100%', padding: '10px',
          borderRadius: 12, textAlign: 'center',
          background: `linear-gradient(135deg, ${game.accentColor}, ${game.accentColor}cc)`,
          fontSize: 13, fontWeight: 800, color: '#000',
          boxShadow: `0 4px 16px ${game.accentColor}50`,
        }}>
          {t('casino.playNow')}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Slot Machine ────────────────────────────────────────────────────────

type Props = {
  game:    SlotGame
  symbols: SlotSymbol[]
  onBack:  () => void
}

export function SlotMachine({ game, symbols, onBack }: Props) {
  const { balance, setBalance } = useBetSlip()
  const { t } = useTranslation()
  const [betAmount, setBetAmount]     = useState(Math.max(10, game.minBet))
  const [isSpinning, setIsSpinning]   = useState(false)
  const [reelStops, setReelStops]     = useState<(number[] | null)[]>([null, null, null, null, null])
  const [stoppedCount, setStoppedCount] = useState(0)
  const [lastSpin, setLastSpin]       = useState<SpinResult | null>(null)
  const [winAmount, setWinAmount]     = useState(0)
  const [showWin, setShowWin]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [lastWinnings, setLastWinnings] = useState<number | null>(null)
  const pendingResult = useRef<SpinResult | null>(null)
  const [showPayTable, setShowPayTable] = useState(false)

  // Reset stopped count when spinning starts
  useEffect(() => {
    if (isSpinning) setStoppedCount(0)
  }, [isSpinning])

  // Check if all reels stopped — each reel stops independently
  useEffect(() => {
    if (stoppedCount === 5 && pendingResult.current) {
      setIsSpinning(false)
      const spin = pendingResult.current
      pendingResult.current = null
      setLastSpin(spin)

      const winnings = spin.totalWin
      if (winnings > 0) {
        setWinAmount(winnings)
        setTimeout(() => setShowWin(true), 400)
      }
    }
  }, [stoppedCount])

  const handleSpin = useCallback(async () => {
    if (isSpinning) return
    if (balance < betAmount) { setError(t('casino.insufficientBalance')); return }

    setError(null)
    setLastSpin(null)
    setLastWinnings(null)
    setReelStops([null, null, null, null, null])
    setIsSpinning(true)

    try {
      const result = await playCasinoSpinAction(game.slug, betAmount)
      pendingResult.current = result.spin
      setBalance(result.newBalance)
      setLastWinnings(result.winnings)

      // Stagger reel stops (left-to-right, 300ms apart after 1.8s spin)
      // Pass the full [top, mid, bottom] array per reel — no discarding of rows
      const stopDelays = [1800, 2100, 2400, 2700, 3000]
      for (let i = 0; i < 5; i++) {
        const reelResult = result.spin.reelStops[i]
        setTimeout(() => {
          setReelStops(prev => {
            const next = [...prev]
            next[i] = reelResult
            return next
          })
        }, stopDelays[i])
      }
    } catch (e) {
      setIsSpinning(false)
      setError(e instanceof Error ? e.message : 'Spin failed')
    }
  }, [isSpinning, balance, betAmount, game.slug, setBalance])

  // Compute winning rows per reel from last spin result
  const winningHighlights = (() => {
    if (!lastSpin?.paylines.length) return []
    const highlights: Array<{ reel: number; row: number }> = []
    for (const pl of lastSpin.paylines) {
      const payline = PAYLINES[pl.lineIndex]
      if (payline) {
        for (const [reel, row] of payline.slice(0, pl.matchCount)) {
          highlights.push({ reel, row })
        }
      }
    }
    return highlights
  })()

  const winningRowsPerReel = Array.from({ length: 5 }, (_, reelIdx) => {
    return new Set(winningHighlights.filter(h => h.reel === reelIdx).map(h => h.row))
  })

  return (
    <div style={{
      minHeight: '100%',
      background: game.theme,
      borderRadius: 20,
      padding: 20,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none',
            borderRadius: 10, padding: '8px 12px',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('casino.back')}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{game.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{game.tagline}</div>
        </div>
        <button
          onClick={() => setShowPayTable(v => !v)}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none',
            borderRadius: 10, padding: '8px 12px',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('casino.payTable')}
        </button>
      </div>

      {/* Reel window */}
      <div style={{
        background: 'rgba(0,0,0,0.4)',
        borderRadius: 16,
        padding: '20px 12px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Payline markers */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: '50%', transform: 'translateY(-50%)',
          height: SYMBOL_H, pointerEvents: 'none', zIndex: 2,
        }}>
          <div style={{
            position: 'absolute', left: 0, width: 6, top: 0, bottom: 0,
            background: `linear-gradient(to right, ${game.accentColor}60, transparent)`,
          }} />
          <div style={{
            position: 'absolute', right: 0, width: 6, top: 0, bottom: 0,
            background: `linear-gradient(to left, ${game.accentColor}60, transparent)`,
          }} />
        </div>

        {/* Camera shake on win */}
        <motion.div
          animate={showWin ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : {}}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', justifyContent: 'center', gap: 6 }}
        >
          {Array.from({ length: 5 }, (_, reelIdx) => (
            <SlotReel
              key={reelIdx}
              symbols={symbols}
              targetStop={reelStops[reelIdx]}
              isSpinning={isSpinning}
              delay={reelIdx * 0.15}
              onStopped={() => setStoppedCount(c => c + 1)}
              winningRows={winningRowsPerReel[reelIdx]}
            />
          ))}
        </motion.div>
      </div>

      {/* Paylines display */}
      {lastSpin && lastSpin.paylines.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 12, padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 800, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('casino.winningLines')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {lastSpin.paylines.map((pl, i) => (
              <span key={i} style={{
                background: 'rgba(245,158,11,0.2)',
                border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: 6, padding: '3px 10px',
                fontSize: 11, fontWeight: 700, color: '#F59E0B',
              }}>
                {symbols.find(s => s.id === pl.symbolId)?.emoji ?? '?'} ×{pl.matchCount} → ×{pl.multiplier}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Last win / loss */}
      {lastWinnings !== null && !showWin && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            textAlign: 'center', padding: '8px',
            borderRadius: 10,
            background: lastWinnings > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${lastWinnings > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          <span style={{
            fontSize: 15, fontWeight: 800,
            color: lastWinnings > 0 ? '#22C55E' : '#EF4444',
          }}>
            {lastWinnings > 0
              ? t('casino.wonCoins', { n: lastWinnings.toLocaleString() })
              : t('casino.betLost')}
          </span>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          textAlign: 'center', padding: '8px',
          borderRadius: 10,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, fontWeight: 700, color: '#EF4444',
        }}>
          {error}
        </div>
      )}

      {/* Bet + Spin */}
      <BetSelector
        value={betAmount}
        onChange={setBetAmount}
        min={game.minBet}
        max={Math.min(game.maxBet, balance)}
        disabled={isSpinning}
      />

      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={handleSpin}
        disabled={isSpinning || balance < betAmount}
        style={{
          padding: '18px',
          borderRadius: 16,
          border: 'none',
          background: isSpinning
            ? 'rgba(255,255,255,0.1)'
            : `linear-gradient(135deg, ${game.accentColor}, ${game.accentColor}cc)`,
          color: isSpinning ? 'rgba(255,255,255,0.5)' : '#000',
          fontSize: 17, fontWeight: 900, cursor: isSpinning ? 'not-allowed' : 'pointer',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          boxShadow: isSpinning ? 'none' : `0 6px 24px ${game.accentColor}60`,
          transition: 'all 0.2s',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {isSpinning ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            style={{ display: 'inline-block', marginRight: 8, fontSize: 18 }}
          >
            🎰
          </motion.div>
        ) : '🎰 '}
        {isSpinning ? t('casino.spinning') : `${t('casino.spin')} — ${betAmount.toLocaleString()}`}
      </motion.button>

      {/* Balance display */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{t('casino.balance')}</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: '#F59E0B' }}>
          {balance.toLocaleString()} {t('casino.coins')}
        </span>
      </div>

      {/* Pay table */}
      <AnimatePresence>
        {showPayTable && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <PayTable symbols={symbols} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win overlay */}
      <WinOverlay
        multiplier={lastSpin?.payoutMultiplier ?? 0}
        winAmount={winAmount}
        visible={showWin}
        onDismiss={() => setShowWin(false)}
      />
    </div>
  )
}

// ─── Slots Browser ────────────────────────────────────────────────────────────

export function SlotsBrowser({ symbols }: { symbols: SlotSymbol[] }) {
  const { t } = useTranslation()
  const [activeGame, setActiveGame] = useState<SlotGame | null>(null)

  if (activeGame) {
    return (
      <SlotMachine
        game={activeGame}
        symbols={symbols}
        onBack={() => setActiveGame(null)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>
        {t('casino.chooseSlot')}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {SLOT_GAMES.map(game => (
          <SlotGameCard key={game.slug} game={game} onSelect={setActiveGame} />
        ))}
      </div>
    </div>
  )
}
