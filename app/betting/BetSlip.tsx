'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import supabase from '@/lib/supabase/client'
import { useBetSlip } from '@/lib/betting/BetSlipContext'
import { ensurePlayerBalanceAction } from '@/app/betting/balance/actions'

import { BetSlipContents, PlacedBetToast } from '@/app/betting/BetSlipContents'
import type { PlaceBetResult } from '@/app/betting/bets/actions'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = '#050911'
const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const WIN    = '#10b981'

// ─── Desktop detection ────────────────────────────────────────────────────────

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const check = () => setDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return desktop
}

// ─── BetSlip — global bottom-sheet (mobile) ───────────────────────────────────

type Props = { userId: string }

export function BetSlip({ userId }: Props) {
  const {
    legs, isOpen, setOpen, setBalance, summary,
  } = useBetSlip()

  const [toastResult, setToastResult] = useState<PlaceBetResult | null>(null)

  const pathname  = usePathname()
  const isDesktop = useIsDesktop()

  // Always load balance + subscribe, regardless of visibility
  useEffect(() => {
    ensurePlayerBalanceAction().then(() =>
      supabase
        .from('player_balances')
        .select('current_balance')
        .eq('player_id', userId)
        .single()
        .then(({ data }) => { if (data) setBalance(Number(data.current_balance)) })
    )

    const channel = supabase
      .channel(`slip_balance:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'player_balances', filter: `player_id=eq.${userId}`,
      }, payload => {
        setBalance(Number((payload.new as { current_balance: number }).current_balance))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, setBalance])

  // Desktop betting page: the inline panel handles the slip — suppress this component
  if (isDesktop && pathname === '/betting') return null

  // Nothing to show
  if (legs.length === 0 && !toastResult) return null

  return (
    <>
      {/* ── Collapsed floating button ── */}
      {!isOpen && legs.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: 'var(--player-nav-offset)', right: 16, zIndex: 60,
            background: ACCENT, color: '#fff', border: 'none', borderRadius: 24,
            padding: '10px 18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: `0 4px 20px ${ACCENT}55`,
            fontSize: 13, fontWeight: 800,
          }}
        >
          <span style={{
            background: WIN, borderRadius: '50%', width: 20, height: 20,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 900,
          }}>
            {legs.length}
          </span>
          Bet Slip
          {summary && (
            <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.85 }}>
              · {summary.combinedOdds.toFixed(2)}×
            </span>
          )}
        </button>
      )}

      {/* ── Expanded bottom sheet ── */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 55,
              background: 'rgba(5,9,17,0.7)', backdropFilter: 'blur(4px)',
            }}
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div style={{
            position: 'fixed', bottom: 'var(--player-nav-offset)', left: 0, right: 0, zIndex: 60,
            background: BG, borderRadius: '20px 20px 0 0',
            border: `1px solid ${BORDER}`, borderBottom: 'none',
            maxHeight: '88dvh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
          }}>
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER }} />
            </div>

            {/* Content — mobile uses showToast=false; toast surfaces at wrapper level below */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <BetSlipContents
                onClose={() => setOpen(false)}
                showToast={false}
                onBetPlaced={setToastResult}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Success toast — rendered outside sheet so it survives clearSlip() ── */}
      {toastResult && (
        <PlacedBetToast
          result={toastResult}
          onDone={() => setToastResult(null)}
        />
      )}
    </>
  )
}
