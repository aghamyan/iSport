'use client'

import {
  createContext, useContext, useState, useCallback,
  useEffect, useRef, type ReactNode,
} from 'react'
import {
  validateBetSlip,
  computeSlipSummary,
  type SlipLeg,
  type SlipSummary,
  type ValidationResult,
} from './validation'

// ─── Types ────────────────────────────────────────────────────────────────────

type BetSlipContextType = {
  // State
  legs:        SlipLeg[]
  betAmount:   string          // raw input string
  isOpen:      boolean

  // Actions
  addLeg:      (leg: SlipLeg) => void
  removeLeg:   (marketId: string) => void
  clearSlip:   () => void
  setBetAmount:(v: string) => void
  setOpen:     (v: boolean) => void
  toggleOpen:  () => void

  // Queries
  isInSlip:       (marketId: string) => boolean
  getLeg:         (marketId: string) => SlipLeg | undefined
  hasMatchInSlip: (matchId: string)  => boolean

  // Computed (derived from legs + betAmount)
  summary:     SlipSummary | null
  validation:  ValidationResult
  balance:     number
  setBalance:  (n: number) => void

  // Recent placement notification
  lastPlacedBetId: string | null
  setLastPlacedBetId: (id: string | null) => void
}

const BetSlipContext = createContext<BetSlipContextType | null>(null)

const STORAGE_KEY = 'isport_bet_slip'
const MAX_LEGS    = 12

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [legs, setLegs]                       = useState<SlipLeg[]>([])
  const [betAmount, setBetAmount]             = useState('')
  const [isOpen, setIsOpen]                   = useState(false)
  const [balance, setBalance]                 = useState(0)
  const [lastPlacedBetId, setLastPlacedBetId] = useState<string | null>(null)
  const hydrated                              = useRef(false)

  // ── Hydrate from localStorage on first client render
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { legs: SlipLeg[]; betAmount: string }
        setLegs(saved.legs ?? [])
        setBetAmount(saved.betAmount ?? '')
      }
    } catch {
      // Corrupt storage — start fresh
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // ── Persist to localStorage on every change
  useEffect(() => {
    if (!hydrated.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ legs, betAmount }))
    } catch { /* quota exceeded — ignore */ }
  }, [legs, betAmount])

  // ── Actions
  const addLeg = useCallback((leg: SlipLeg) => {
    setLegs(prev => {
      if (prev.some(l => l.marketId === leg.marketId)) return prev                         // duplicate market
      if (prev.some(l => l.matchId === leg.matchId))   return prev                         // same match, different market
      if (prev.length >= MAX_LEGS) return prev                                              // cap
      return [...prev, leg]
    })
    setIsOpen(true)
  }, [])

  const removeLeg = useCallback((marketId: string) => {
    setLegs(prev => {
      const next = prev.filter(l => l.marketId !== marketId)
      if (next.length === 0) setIsOpen(false)
      return next
    })
  }, [])

  const clearSlip = useCallback(() => {
    setLegs([])
    setBetAmount('')
    setIsOpen(false)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const setOpen   = useCallback((v: boolean) => setIsOpen(v), [])
  const toggleOpen = useCallback(() => setIsOpen(v => !v), [])

  // ── Queries
  const isInSlip      = useCallback((marketId: string) => legs.some(l => l.marketId === marketId), [legs])
  const getLeg        = useCallback((marketId: string) => legs.find(l => l.marketId === marketId), [legs])
  const hasMatchInSlip = useCallback((matchId: string) => legs.some(l => l.matchId === matchId), [legs])

  // ── Computed values
  const amount     = parseFloat(betAmount) || 0
  const summary    = legs.length > 0 && amount > 0 ? computeSlipSummary(legs, amount) : null
  const validation = validateBetSlip(legs, amount, balance)

  return (
    <BetSlipContext.Provider value={{
      legs, betAmount, isOpen,
      addLeg, removeLeg, clearSlip, setBetAmount,
      setOpen, toggleOpen,
      isInSlip, getLeg, hasMatchInSlip,
      summary, validation, balance, setBalance,
      lastPlacedBetId, setLastPlacedBetId,
    }}>
      {children}
    </BetSlipContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBetSlip(): BetSlipContextType {
  const ctx = useContext(BetSlipContext)
  if (!ctx) throw new Error('useBetSlip must be used inside BetSlipProvider')
  return ctx
}
