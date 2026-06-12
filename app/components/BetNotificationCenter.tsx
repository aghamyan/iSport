'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import type { BetNotification } from '@/lib/betting/settlement'
import {
  getBetNotificationsAction,
  markBetNotificationsReadAction,
} from '@/app/betting/notifications/actions'

const BG     = '#0c1422'
const CARD   = '#111d2e'
const BORDER = '#1a2840'
const TEXT   = '#f8fafc'
const TEXT2  = '#94a3b8'
const MUTED  = '#64748b'
const WIN    = '#10b981'
const LOSS   = '#ef4444'
const GOLD   = '#f59e0b'
const ACCENT = '#3b82f6'

function fmtAMD(n: number) {
  return n.toLocaleString('hy-AM') + ' AMD'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusColor(status: BetNotification['betStatus']) {
  if (status === 'WON') return WIN
  if (status === 'LOST') return LOSS
  return GOLD
}

export function BetNotificationCenter() {
  const [items, setItems] = useState<BetNotification[]>([])
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = useMemo(() => items.filter(n => !n.isRead).length, [items])

  const load = useCallback(() => {
    getBetNotificationsAction(12)
      .then(setItems)
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 30000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }

    if (open) document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function markAllRead() {
    startTransition(async () => {
      await markBetNotificationsReadAction()
      setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    })
  }

  function markOneRead(notifId: string) {
    startTransition(async () => {
      await markBetNotificationsReadAction(notifId)
      setItems(prev => prev.map(n => n.notifId === notifId ? { ...n, isRead: true } : n))
    })
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => {
          setOpen(v => !v)
          if (!open) load()
        }}
        title="Уведомления о ставках"
        style={{
          position: 'relative',
          width: 34,
          height: 34,
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: 'rgba(255,255,255,0.04)',
          color: unread > 0 ? GOLD : TEXT2,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Bell size={16} strokeWidth={2} />
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -5,
            right: -5,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            padding: '0 4px',
            background: LOSS,
            color: '#fff',
            border: `2px solid ${BG}`,
            fontSize: 10,
            fontWeight: 900,
            lineHeight: '13px',
            boxSizing: 'border-box',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 42,
          width: 'min(340px, calc(100vw - 24px))',
          maxHeight: 'min(480px, calc(100dvh - 96px))',
          overflow: 'hidden',
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.42)',
          zIndex: 100,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '11px 12px',
            borderBottom: `1px solid ${BORDER}`,
            background: CARD,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 850, color: TEXT }}>Уведомления</div>
              <div style={{ fontSize: 11, color: MUTED }}>{unread} непрочитанных</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={markAllRead}
                disabled={pending || unread === 0}
                title="Отметить все прочитанными"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: unread === 0 ? 'transparent' : `${ACCENT}18`,
                  color: unread === 0 ? MUTED : ACCENT,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: pending || unread === 0 ? 'default' : 'pointer',
                }}
              >
                <CheckCheck size={15} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Закрыть"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: 'transparent',
                  color: TEXT2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 398, overflowY: 'auto' }}>
            {items.length === 0 && (
              <div style={{ padding: 18, color: MUTED, fontSize: 12, textAlign: 'center' }}>
                Уведомлений о ставках пока нет.
              </div>
            )}

            {items.map(item => {
              const color = statusColor(item.betStatus)
              return (
                <button
                  key={item.notifId}
                  type="button"
                  onClick={() => markOneRead(item.notifId)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: `1px solid ${BORDER}`,
                    background: item.isRead ? BG : `${color}10`,
                    padding: '11px 12px',
                    display: 'grid',
                    gridTemplateColumns: '8px 1fr',
                    gap: 10,
                    textAlign: 'left',
                    cursor: item.isRead ? 'default' : 'pointer',
                  }}
                >
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    marginTop: 5,
                    background: item.isRead ? MUTED : color,
                  }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: TEXT, fontSize: 12, fontWeight: 750, lineHeight: 1.35 }}>
                      {item.message}
                    </span>
                    <span style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 5,
                      color: TEXT2,
                      fontSize: 11,
                    }}>
                      <span>{fmtDate(item.createdAt)}</span>
                      <span style={{ color, fontWeight: 800 }}>
                        {item.amount > 0 ? '+' : ''}{fmtAMD(item.amount)}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
