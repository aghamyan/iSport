'use client'

import { useTranslation } from '@/lib/i18n/context'

type Props = {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation()
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          padding: 28,
          width: 400,
          maxWidth: '90vw',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px',
              background: 'var(--card3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text2)',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              background: danger ? 'var(--accent)' : 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
            }}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
