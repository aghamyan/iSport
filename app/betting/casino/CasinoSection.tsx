'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SlotsBrowser } from './SlotMachine'
import { RouletteGame } from './RouletteGame'
import { CasinoLeaderboard, PlayerCasinoStats } from './CasinoLeaderboard'
import { useTranslation } from '@/lib/i18n/context'
import type { SlotSymbol } from '@/lib/casino/types'

// ─── Design tokens (dark luxury) ──────────────────────────────────────────────
const BG    = 'var(--bg)'
const CARD  = 'var(--card)'
const GOLD  = 'var(--gold)'
const MUTED = 'var(--muted)'

// ─── Tab type ─────────────────────────────────────────────────────────────────

type CasinoTab = 'slots' | 'roulette' | 'dice' | 'blackjack' | 'leaderboard' | 'stats'

type TabDef = {
  key:          CasinoTab
  emoji:        string
  i18nKey:      string
  comingSoon?:  boolean
}

const TABS: TabDef[] = [
  { key: 'slots',        emoji: '🎰', i18nKey: 'casino.slots' },
  { key: 'roulette',    emoji: '🎡', i18nKey: 'casino.roulette' },
  { key: 'dice',        emoji: '🎲', i18nKey: 'casino.dice',      comingSoon: true },
  { key: 'blackjack',   emoji: '🃏', i18nKey: 'casino.blackjack', comingSoon: true },
  { key: 'leaderboard', emoji: '🏆', i18nKey: 'casino.topWins' },
  { key: 'stats',       emoji: '📊', i18nKey: 'casino.myStats' },
]

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  const { t } = useTranslation()
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, padding: '80px 24px',
        background: 'linear-gradient(135deg, rgba(26,10,46,0.8) 0%, rgba(16,33,62,0.8) 100%)',
        borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        style={{ fontSize: 56 }}
      >
        🚧
      </motion.div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', textAlign: 'center' }}>
        {label} — {t('casino.comingSoon')}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 300 }}>
        We&apos;re crafting something special. Check back soon for an epic experience.
      </div>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 999, padding: '8px 20px',
        fontSize: 13, fontWeight: 700, color: '#F59E0B',
      }}>
        <motion.div
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          ⚡
        </motion.div>
        {t('casino.inDevelopment')}
      </div>
    </motion.div>
  )
}

// ─── Casino Header ────────────────────────────────────────────────────────────

function CasinoHeader() {
  const { t } = useTranslation()
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 40%, #0d1628 100%)',
      borderRadius: 16, padding: '20px 20px 16px',
      border: '1px solid rgba(245,158,11,0.15)',
    }}>
      {/* Animated glow */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 4 }}
        style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <motion.div
        animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.15, 1] }}
        transition={{ repeat: Infinity, duration: 5, delay: 1 }}
        style={{
          position: 'absolute', bottom: -40, left: -40,
          width: 160, height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            style={{ fontSize: 28 }}
          >
            🎰
          </motion.div>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              background: 'linear-gradient(135deg, #F59E0B, #FDE68A, #F59E0B)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.02em',
            }}>
              {t('casino.title')}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {t('casino.tagline')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[
            { icon: '⚡', label: t('casino.instantPay') },
            { icon: '🔐', label: t('casino.fairPlay') },
            { icon: '💰', label: t('casino.realCoins') },
          ].map(({ icon, label }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 999, padding: '4px 10px',
              fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {icon} {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: CasinoTab; onChange: (t: CasinoTab) => void }) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex', gap: 4,
      overflowX: 'auto', scrollbarWidth: 'none',
      padding: '2px 0',
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.key
        return (
          <motion.button
            key={tab.key}
            whileTap={{ scale: 0.94 }}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 14px',
              borderRadius: 10, border: 'none',
              background: isActive ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
              color: isActive ? '#F59E0B' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: isActive ? 800 : 600,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              boxShadow: isActive ? '0 0 12px rgba(245,158,11,0.25), inset 0 0 0 1px rgba(245,158,11,0.3)' : 'none',
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 14 }}>{tab.emoji}</span>
            {t(tab.i18nKey)}
            {tab.comingSoon && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: '#7C3AED', borderRadius: 999,
                fontSize: 7, fontWeight: 800, color: '#fff',
                padding: '2px 5px', lineHeight: 1,
              }}>
                SOON
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Main CasinoSection ───────────────────────────────────────────────────────

type Props = {
  userId:  string
  symbols: SlotSymbol[]
}

export function CasinoSection({ userId, symbols }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<CasinoTab>('slots')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: '0 0 80px', // bottom padding for nav
    }}>
      {/* Casino header */}
      <CasinoHeader />

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'slots' && (
            <SlotsBrowser symbols={symbols} />
          )}

          {activeTab === 'roulette' && (
            <RouletteGame />
          )}

          {activeTab === 'dice' && (
            <ComingSoon label="Dice" />
          )}

          {activeTab === 'blackjack' && (
            <ComingSoon label="Blackjack" />
          )}

          {activeTab === 'leaderboard' && (
            <div style={{
              background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1628 100%)',
              borderRadius: 20, padding: 16,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F59E0B', marginBottom: 16 }}>
                🏆 {t('casino.biggestWins')}
              </div>
              <CasinoLeaderboard />
            </div>
          )}

          {activeTab === 'stats' && (
            <div style={{
              background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1628 100%)',
              borderRadius: 20, padding: 16,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F59E0B', marginBottom: 16 }}>
                📊 {t('casino.myStatsTitle')}
              </div>
              <PlayerCasinoStats userId={userId} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
