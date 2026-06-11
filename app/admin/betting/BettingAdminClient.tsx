'use client'

import { useState, useCallback } from 'react'
import type { AdminMatchData } from './page'
import type { MarketRow } from '@/lib/odds/markets'
import {
  generateMatchMarketsAction,
  refreshMatchMarketsAction,
  adminOverrideOddsAction,
  revertToAiOddsAction,
  setMarketStatusAction,
  getMatchMarketsAction,
  settleMarketAction,
  createCustomPropAction,
} from '@/app/betting/odds/actions'
import { MARKET_LABELS } from '@/lib/betting/validation'

// ─── Design tokens (light admin theme) ───────────────────────────────────────
const C = {
  bg:      '#f9fafb',
  card:    '#ffffff',
  border:  '#e5e7eb',
  border2: '#d1d5db',
  text:    '#111827',
  text2:   '#6b7280',
  accent:  '#3b82f6',
  win:     '#10b981',
  loss:    '#ef4444',
  gold:    '#f59e0b',
  muted:   '#9ca3af',
  purple:  '#8b5cf6',
}

// ─── Status metadata ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPEN:     C.win,
  LOCKED:   C.gold,
  SETTLED:  C.muted,
  CANCELLED:C.loss,
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfBadge({ score, label }: { score: number | null; label: string | null }) {
  if (!score || !label) return null
  const color = label === 'high' ? C.win : label === 'medium' ? C.gold : C.muted
  const icon  = label === 'high' ? '↑' : label === 'medium' ? '~' : '↓'
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: `${color}18`, color, border: `1px solid ${color}44`,
    }}>
      {icon} {score}
    </span>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type Toast = { id: number; msg: string; type: 'ok' | 'err' }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'ok' ? C.win : C.loss,
          color: '#fff', padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          maxWidth: 320,
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ─── Settle modal ─────────────────────────────────────────────────────────────

type SettleState = {
  market:    MarketRow
  matchId:   string
  matchType: 'friendly' | 'championship'
  selected:  string | null
  busy:      boolean
}

function SettleModal({
  state, onConfirm, onClose,
}: {
  state:     SettleState
  onConfirm: (opt: string) => void
  onClose:   () => void
}) {
  const { market, selected, busy } = state
  const optionKeys = (['option1', 'option2', 'option3'] as const).filter(k => market.options[k])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.card, borderRadius: 16, padding: 28,
          minWidth: 360, maxWidth: 440,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          Settle Market
        </div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>
          {MARKET_LABELS[market.marketType] ?? market.marketType} — pick the winning outcome
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {optionKeys.map(key => {
            const opt = market.options[key]
            const odd = market.odds[key]
            const sel = state.selected === key
            return (
              <button
                key={key}
                onClick={() => !busy && onConfirm(key)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: 10,
                  border: `2px solid ${sel ? C.win : C.border}`,
                  background: sel ? `${C.win}12` : C.bg,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: sel ? C.win : C.text }}>
                  {opt?.label ?? key}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: sel ? C.win : C.accent }}>
                  {odd?.toFixed(2)}×
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              flex: 1, padding: '10px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.bg,
              color: C.text2, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

        <p style={{ fontSize: 11, color: C.muted, margin: '14px 0 0', textAlign: 'center' }}>
          Click an option above to settle it immediately. This cannot be undone.
        </p>
      </div>
    </div>
  )
}

// ─── Override odds form ───────────────────────────────────────────────────────

type OverrideState = {
  marketId: string
  values:   Record<string, string>
  reason:   string
  busy:     boolean
}

function OverrideForm({
  market, state, onChange, onSave, onCancel,
}: {
  market:   MarketRow
  state:    OverrideState
  onChange: (field: string, val: string) => void
  onSave:   () => void
  onCancel: () => void
}) {
  const optionKeys = (['option1', 'option2', 'option3'] as const).filter(k => market.options[k])

  return (
    <div style={{
      background: '#fffbeb', border: `1px solid ${C.gold}44`,
      borderRadius: 10, padding: 16, marginTop: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Override Odds
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {optionKeys.map(key => (
          <div key={key} style={{ flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 11, color: C.text2, display: 'block', marginBottom: 4 }}>
              {market.options[key]?.label ?? key}
            </label>
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={state.values[key] ?? ''}
              onChange={e => onChange(key, e.target.value)}
              disabled={state.busy}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 7,
                border: `1px solid ${C.border2}`, fontSize: 14, fontWeight: 700,
                background: '#fff', color: C.text,
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.text2, display: 'block', marginBottom: 4 }}>
          Reason (required)
        </label>
        <input
          type="text"
          placeholder="e.g. Adjusted for injury news"
          value={state.reason}
          onChange={e => onChange('_reason', e.target.value)}
          disabled={state.busy}
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 7,
            border: `1px solid ${C.border2}`, fontSize: 13,
            background: '#fff', color: C.text,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={state.busy || !state.reason.trim()}
          style={{
            padding: '8px 18px', borderRadius: 7,
            background: C.gold, border: 'none',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: state.busy || !state.reason.trim() ? 'not-allowed' : 'pointer',
            opacity: state.busy || !state.reason.trim() ? 0.6 : 1,
          }}
        >
          {state.busy ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={state.busy}
          style={{
            padding: '8px 14px', borderRadius: 7,
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.text2, fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Create custom prop form ──────────────────────────────────────────────────

type PropFormState = {
  description: string
  numOptions:  2 | 3
  labels:      [string, string, string]
  odds:        [string, string, string]
  busy:        boolean
}

function CustomPropForm({
  matchId, matchType, onDone, onCancel,
}: {
  matchId:   string
  matchType: 'friendly' | 'championship'
  onDone:    (msg: string) => void
  onCancel:  () => void
}) {
  const [form, setForm] = useState<PropFormState>({
    description: '',
    numOptions: 2,
    labels: ['', '', ''],
    odds: ['', '', ''],
    busy: false,
  })

  async function handleSave() {
    if (!form.description.trim()) return
    const opts = Array.from({ length: form.numOptions }, (_, i) => ({
      label: form.labels[i] || `Option ${i + 1}`,
    }))
    const customOdds = form.odds.slice(0, form.numOptions).map(Number).filter(n => n > 1)

    setForm(f => ({ ...f, busy: true }))
    try {
      await createCustomPropAction(
        matchId, matchType, form.description, opts,
        customOdds.length === form.numOptions ? customOdds : undefined
      )
      onDone('Custom prop created')
    } catch (e) {
      onDone('Error: ' + (e instanceof Error ? e.message : String(e)))
      setForm(f => ({ ...f, busy: false }))
    }
  }

  return (
    <div style={{
      background: `${C.purple}08`, border: `1px solid ${C.purple}33`,
      borderRadius: 10, padding: 16, marginTop: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        New Custom Prop
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.text2, display: 'block', marginBottom: 4 }}>Description</label>
        <input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="e.g. First goal scorer"
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 7,
            border: `1px solid ${C.border2}`, fontSize: 13, background: '#fff', color: C.text,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([2, 3] as const).map(n => (
          <button
            key={n}
            onClick={() => setForm(f => ({ ...f, numOptions: n }))}
            style={{
              padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${form.numOptions === n ? C.purple : C.border}`,
              background: form.numOptions === n ? `${C.purple}18` : 'transparent',
              color: form.numOptions === n ? C.purple : C.text2,
            }}
          >
            {n} options
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {Array.from({ length: form.numOptions }, (_, i) => (
          <div key={i} style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: C.text2, display: 'block', marginBottom: 4 }}>
              Option {i + 1} label
            </label>
            <input
              value={form.labels[i]}
              onChange={e => {
                const labels = [...form.labels] as [string, string, string]
                labels[i] = e.target.value
                setForm(f => ({ ...f, labels }))
              }}
              placeholder={`Option ${i + 1}`}
              style={{
                width: '100%', padding: '6px 9px', borderRadius: 7,
                border: `1px solid ${C.border2}`, fontSize: 12, background: '#fff',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={form.odds[i]}
              onChange={e => {
                const odds = [...form.odds] as [string, string, string]
                odds[i] = e.target.value
                setForm(f => ({ ...f, odds }))
              }}
              placeholder="Odds (opt)"
              style={{
                width: '100%', padding: '6px 9px', borderRadius: 7, marginTop: 4,
                border: `1px solid ${C.border2}`, fontSize: 12, background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={form.busy || !form.description.trim()}
          style={{
            padding: '8px 18px', borderRadius: 7,
            background: C.purple, border: 'none',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: form.busy || !form.description.trim() ? 'not-allowed' : 'pointer',
            opacity: form.busy || !form.description.trim() ? 0.6 : 1,
          }}
        >
          {form.busy ? 'Creating…' : 'Create'}
        </button>
        <button onClick={onCancel} style={{
          padding: '8px 14px', borderRadius: 7,
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.text2, fontSize: 13, cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Market detail row ────────────────────────────────────────────────────────

function MarketDetailRow({
  market,
  matchId,
  matchType,
  overrideState,
  onOverrideChange,
  onOverrideSave,
  onOverrideCancel,
  onOpenOverride,
  onOpenSettle,
  onLockToggle,
  onRevertAI,
  busy,
}: {
  market:          MarketRow
  matchId:         string
  matchType:       'friendly' | 'championship'
  overrideState:   OverrideState | null
  onOverrideChange:(field: string, val: string) => void
  onOverrideSave:  () => void
  onOverrideCancel:() => void
  onOpenOverride:  (m: MarketRow) => void
  onOpenSettle:    (m: MarketRow) => void
  onLockToggle:    (m: MarketRow) => void
  onRevertAI:      (m: MarketRow) => void
  busy:            boolean
}) {
  const optionKeys = (['option1', 'option2', 'option3'] as const).filter(k => market.options[k])
  const statusColor = STATUS_COLORS[market.status] ?? C.muted
  const isSettled  = market.status === 'SETTLED'
  const isLocked   = market.status === 'LOCKED'
  const isOverride = overrideState?.marketId === market.marketId

  const aiRaw = market.aiCalculatedOdds as Record<string, number> | null

  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 10,
      marginBottom: 8, overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: isSettled ? `${C.muted}08` : C.card,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {MARKET_LABELS[market.marketType] ?? market.marketType}
          </span>
          {market.adminOverride && (
            <span style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 8,
              background: `${C.gold}18`, color: C.gold, fontWeight: 700,
            }}>
              ADJUSTED
            </span>
          )}
          {isSettled && market.result && (
            <span style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 8,
              background: `${C.win}18`, color: C.win, fontWeight: 700,
            }}>
              ✓ {market.options[market.result as 'option1']?.label ?? market.result}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 8,
          background: `${statusColor}18`, color: statusColor,
        }}>
          {market.status}
        </span>
      </div>

      {/* Options row */}
      <div style={{ display: 'flex', gap: 0, padding: '10px 14px 0' }}>
        {optionKeys.map((key, idx) => (
          <div key={key} style={{
            flex: 1, textAlign: 'center',
            borderRight: idx < optionKeys.length - 1 ? `1px solid ${C.border}` : 'none',
            paddingRight: idx < optionKeys.length - 1 ? 12 : 0,
            paddingLeft: idx > 0 ? 12 : 0,
          }}>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 2 }}>
              {market.options[key]?.label ?? key}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>
              {(market.odds[key] ?? 0).toFixed(2)}
            </div>
            {market.adminOverride && aiRaw && (
              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                AI: {(aiRaw[key] ?? 0).toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {!isSettled && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 14px 12px',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => onLockToggle(market)}
            disabled={busy}
            style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              border: `1px solid ${isLocked ? C.win : C.gold}`,
              background: isLocked ? `${C.win}12` : `${C.gold}12`,
              color: isLocked ? C.win : C.gold,
            }}
          >
            {isLocked ? '🔓 Unlock' : '🔒 Lock'}
          </button>
          <button
            onClick={() => onOpenOverride(market)}
            disabled={busy}
            style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              border: `1px solid ${C.gold}`,
              background: `${C.gold}12`, color: C.gold,
            }}
          >
            ✏ Edit Odds
          </button>
          {market.adminOverride && (
            <button
              onClick={() => onRevertAI(market)}
              disabled={busy}
              style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                border: `1px solid ${C.border}`,
                background: 'transparent', color: C.text2,
              }}
            >
              ↩ Revert to AI
            </button>
          )}
          <button
            onClick={() => onOpenSettle(market)}
            disabled={busy || isLocked}
            style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: busy || isLocked ? 'not-allowed' : 'pointer',
              background: isLocked ? C.border : C.accent,
              border: 'none', color: '#fff',
              opacity: isLocked ? 0.5 : 1,
            }}
          >
            ✓ Settle
          </button>
        </div>
      )}

      {/* Override form */}
      {isOverride && overrideState && (
        <div style={{ padding: '0 14px 12px' }}>
          <OverrideForm
            market={market}
            state={overrideState}
            onChange={onOverrideChange}
            onSave={onOverrideSave}
            onCancel={onOverrideCancel}
          />
        </div>
      )}
    </div>
  )
}

// ─── Match card (expandable) ──────────────────────────────────────────────────

function MatchCard({
  match, pushToast,
}: {
  match:     AdminMatchData
  pushToast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [expanded,     setExpanded]     = useState(false)
  const [markets,      setMarkets]      = useState<MarketRow[] | null>(null)
  const [loadingMkts,  setLoadingMkts]  = useState(false)
  const [generatingMkts, setGenerating] = useState(false)
  const [settle,       setSettle]       = useState<SettleState | null>(null)
  const [override,     setOverride]     = useState<OverrideState | null>(null)
  const [busyMkt,      setBusyMkt]      = useState<string | null>(null)
  const [showPropForm, setShowPropForm] = useState(false)

  const [localMatch, setLocalMatch] = useState(match)

  const loadMarkets = useCallback(async () => {
    setLoadingMkts(true)
    try {
      const data = await getMatchMarketsAction(match.matchId, match.matchType)
      setMarkets(data)
    } finally {
      setLoadingMkts(false)
    }
  }, [match.matchId, match.matchType])

  function toggleExpand() {
    const next = !expanded
    setExpanded(next)
    if (next && markets === null) loadMarkets()
  }

  async function handleGenerate(refresh = false) {
    setGenerating(true)
    try {
      if (refresh) {
        await refreshMatchMarketsAction(match.matchId, match.matchType, match.homePlayerId, match.awayPlayerId)
        pushToast('Markets refreshed')
      } else {
        const result = await generateMatchMarketsAction(match.matchId, match.matchType, match.homePlayerId, match.awayPlayerId)
        const n = result.markets.filter(m => m.success).length
        pushToast(`${n} markets generated`)
        setLocalMatch(prev => ({ ...prev, totalMarkets: n, openMarkets: n }))
      }
      await loadMarkets()
      setExpanded(true)
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setGenerating(false)
    }
  }

  function handleOpenSettle(market: MarketRow) {
    setSettle({
      market, matchId: match.matchId, matchType: match.matchType,
      selected: null, busy: false,
    })
  }

  async function handleSettle(optionKey: string) {
    if (!settle) return
    setSettle(s => s && ({ ...s, selected: optionKey, busy: true }))
    try {
      const { betsSettled } = await settleMarketAction(
        settle.market.marketId,
        optionKey as 'option1' | 'option2' | 'option3',
        match.matchId,
        match.matchType
      )
      pushToast(`Settled — ${betsSettled} bet${betsSettled !== 1 ? 's' : ''} settled`)
      setSettle(null)
      await loadMarkets()
      setLocalMatch(prev => ({
        ...prev,
        openMarkets: Math.max(0, prev.openMarkets - 1),
        settledMarkets: prev.settledMarkets + 1,
      }))
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed to settle', 'err')
      setSettle(s => s && ({ ...s, busy: false }))
    }
  }

  function handleOpenOverride(market: MarketRow) {
    const vals: Record<string, string> = {}
    for (const key of ['option1', 'option2', 'option3'] as const) {
      if (market.options[key]) vals[key] = String(market.odds[key] ?? '')
    }
    setOverride({ marketId: market.marketId, values: vals, reason: '', busy: false })
  }

  function handleOverrideChange(field: string, val: string) {
    if (field === '_reason') {
      setOverride(s => s && ({ ...s, reason: val }))
    } else {
      setOverride(s => s && ({ ...s, values: { ...s.values, [field]: val } }))
    }
  }

  async function handleOverrideSave() {
    if (!override) return
    setOverride(s => s && ({ ...s, busy: true }))
    try {
      const newOdds: Record<string, number> = {}
      for (const [k, v] of Object.entries(override.values)) {
        newOdds[k] = parseFloat(v)
      }
      await adminOverrideOddsAction(override.marketId, newOdds, override.reason)
      pushToast('Odds overridden')
      setOverride(null)
      await loadMarkets()
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed', 'err')
      setOverride(s => s && ({ ...s, busy: false }))
    }
  }

  async function handleLockToggle(market: MarketRow) {
    setBusyMkt(market.marketId)
    try {
      const newStatus = market.status === 'LOCKED' ? 'OPEN' : 'LOCKED'
      await setMarketStatusAction(market.marketId, newStatus)
      pushToast(`Market ${newStatus === 'LOCKED' ? 'locked' : 'unlocked'}`)
      await loadMarkets()
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setBusyMkt(null)
    }
  }

  async function handleRevertAI(market: MarketRow) {
    setBusyMkt(market.marketId)
    try {
      await revertToAiOddsAction(market.marketId)
      pushToast('Reverted to AI odds')
      await loadMarkets()
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setBusyMkt(null)
    }
  }

  const hasMarkets = localMatch.totalMarkets > 0

  return (
    <>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
        marginBottom: 10, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {/* Match header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '14px 16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                {localMatch.homeName} <span style={{ fontWeight: 400, color: C.muted }}>vs</span> {localMatch.awayName}
              </span>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 6,
                background: localMatch.matchType === 'championship' ? `${C.purple}18` : `${C.gold}18`,
                color: localMatch.matchType === 'championship' ? C.purple : C.gold,
                fontWeight: 700, textTransform: 'uppercase',
              }}>
                {localMatch.matchType}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {hasMarkets ? (
                <>
                  <span style={{ fontSize: 12, color: C.text2 }}>
                    {localMatch.totalMarkets} markets
                  </span>
                  {localMatch.openMarkets > 0 && (
                    <span style={{ fontSize: 11, color: C.win, fontWeight: 600 }}>
                      {localMatch.openMarkets} open
                    </span>
                  )}
                  {localMatch.lockedMarkets > 0 && (
                    <span style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>
                      {localMatch.lockedMarkets} locked
                    </span>
                  )}
                  {localMatch.settledMarkets > 0 && (
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
                      {localMatch.settledMarkets} settled
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 12, color: C.muted }}>No markets yet</span>
              )}
              <ConfBadge score={localMatch.confidenceScore} label={localMatch.confidenceLabel} />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
            {!hasMarkets ? (
              <button
                onClick={() => handleGenerate(false)}
                disabled={generatingMkts}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: C.accent, border: 'none',
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  opacity: generatingMkts ? 0.7 : 1,
                }}
              >
                {generatingMkts ? 'Generating…' : '+ Generate Markets'}
              </button>
            ) : (
              <button
                onClick={() => handleGenerate(true)}
                disabled={generatingMkts}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {generatingMkts ? '…' : '↻ Refresh'}
              </button>
            )}
            {hasMarkets && (
              <button
                onClick={toggleExpand}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  background: expanded ? `${C.accent}12` : 'transparent',
                  border: `1px solid ${expanded ? C.accent : C.border}`,
                  color: expanded ? C.accent : C.text2,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {expanded ? '▲ Hide' : '▼ Markets'}
              </button>
            )}
          </div>
        </div>

        {/* Expanded market list */}
        {expanded && (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px 16px', background: `${C.bg}` }}>
            {loadingMkts && (
              <div style={{ color: C.text2, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                Loading markets…
              </div>
            )}
            {!loadingMkts && markets && markets.length === 0 && (
              <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                No markets found.
              </div>
            )}
            {!loadingMkts && markets && markets.map(market => (
              <MarketDetailRow
                key={market.marketId}
                market={market}
                matchId={match.matchId}
                matchType={match.matchType}
                overrideState={override?.marketId === market.marketId ? override : null}
                onOverrideChange={handleOverrideChange}
                onOverrideSave={handleOverrideSave}
                onOverrideCancel={() => setOverride(null)}
                onOpenOverride={handleOpenOverride}
                onOpenSettle={handleOpenSettle}
                onLockToggle={handleLockToggle}
                onRevertAI={handleRevertAI}
                busy={busyMkt === market.marketId}
              />
            ))}

            {/* Add custom prop */}
            {!loadingMkts && !showPropForm && (
              <button
                onClick={() => setShowPropForm(true)}
                style={{
                  marginTop: 8, padding: '7px 14px', borderRadius: 8,
                  border: `1px dashed ${C.purple}44`, background: `${C.purple}08`,
                  color: C.purple, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  width: '100%',
                }}
              >
                + Add Custom Prop
              </button>
            )}
            {showPropForm && (
              <CustomPropForm
                matchId={match.matchId}
                matchType={match.matchType}
                onDone={msg => {
                  setShowPropForm(false)
                  pushToast(msg, msg.startsWith('Error') ? 'err' : 'ok')
                  loadMarkets()
                }}
                onCancel={() => setShowPropForm(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Settle modal */}
      {settle && (
        <SettleModal
          state={settle}
          onConfirm={handleSettle}
          onClose={() => setSettle(null)}
        />
      )}
    </>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

type Props = {
  friendly:     AdminMatchData[]
  championship: AdminMatchData[]
}

export function BettingAdminClient({ friendly, championship }: Props) {
  const [tab, setTab]   = useState<'friendly' | 'championship'>('friendly')
  const [toasts, setToasts] = useState<Toast[]>([])
  let toastId = 0

  const pushToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = ++toastId
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const matches = tab === 'friendly' ? friendly : championship

  // Stats
  const totalOpen    = [...friendly, ...championship].reduce((s, m) => s + m.openMarkets, 0)
  const totalLocked  = [...friendly, ...championship].reduce((s, m) => s + m.lockedMarkets, 0)
  const totalSettled = [...friendly, ...championship].reduce((s, m) => s + m.settledMarkets, 0)
  const withMarkets  = [...friendly, ...championship].filter(m => m.totalMarkets > 0).length

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Matches w/ markets', value: withMarkets, color: C.accent },
          { label: 'Open markets',        value: totalOpen,   color: C.win   },
          { label: 'Locked markets',      value: totalLocked, color: C.gold  },
          { label: 'Settled markets',     value: totalSettled,color: C.muted },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: 140,
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '16px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['friendly', 'championship'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${tab === t ? C.accent : C.border}`,
              background: tab === t ? `${C.accent}12` : 'transparent',
              color: tab === t ? C.accent : C.text2,
            }}
          >
            {t === 'friendly' ? 'Friendly' : 'Championship'}
            <span style={{
              marginLeft: 7, fontSize: 11,
              background: tab === t ? C.accent : C.border,
              color: tab === t ? '#fff' : C.text2,
              borderRadius: 10, padding: '1px 7px',
            }}>
              {(t === 'friendly' ? friendly : championship).length}
            </span>
          </button>
        ))}
      </div>

      {/* Match list */}
      {matches.length === 0 && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '32px 24px', textAlign: 'center',
          color: C.text2, fontSize: 14,
        }}>
          No pending {tab} matches.
        </div>
      )}
      {matches.map(match => (
        <MatchCard key={match.matchId} match={match} pushToast={pushToast} />
      ))}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
