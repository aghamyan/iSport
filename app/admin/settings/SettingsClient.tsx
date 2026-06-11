'use client'

import { useState, useTransition } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { updateSettingAction } from './actions'

type Setting = { key: string; value: unknown }
type Props = { settings: Setting[] }

const S = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '24px 28px',
    marginBottom: 20,
  } as React.CSSProperties,
  label: {
    display: 'block', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4,
  } as React.CSSProperties,
  desc: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.4 } as React.CSSProperties,
  btn: (color: string, bg: string): React.CSSProperties => ({
    padding: '8px 18px', background: bg, color, border: 'none', borderRadius: 8,
    cursor: 'pointer', fontSize: 14, fontWeight: 600,
  }),
  textarea: {
    padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 14, width: '100%', minHeight: 100, resize: 'vertical' as const,
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  } as React.CSSProperties,
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 16 }}>
      {text}
    </div>
  )
}

function GameplayRulesCard({ current }: { current: string }) {
  const { t } = useTranslation()
  const [value, setValue]    = useState(current)
  const [saved, setSaved]    = useState(false)
  const [error, setError]    = useState('')
  const [pending, start]     = useTransition()

  function save() {
    start(async () => {
      try {
        await updateSettingAction('gameplay_rules', value)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        setError('')
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  return (
    <div style={S.card}>
      <div style={S.label}>{t('admin.settings.rulesTitle')}</div>
      <div style={S.desc}>{t('admin.settings.rulesDesc')}</div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={S.textarea}
        placeholder={t('admin.settings.rulesPlaceholder')}
      />
      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '8px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button onClick={save} disabled={pending} style={S.btn('#fff', '#2563eb')}>
          {pending ? t('common.saving') : t('admin.settings.saveRules')}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{t('admin.settings.saved')}</span>}
      </div>
    </div>
  )
}

function EditWindowCard() {
  const { t } = useTranslation()
  return (
    <div style={S.card}>
      <div style={S.label}>{t('admin.settings.windowTitle')}</div>
      <div style={S.desc}>{t('admin.settings.windowDesc')}</div>
      <InfoBanner text={t('admin.settings.windowHint')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          defaultValue={4}
          disabled
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: 80, opacity: 0.5, cursor: 'not-allowed' }}
        />
        <span style={{ fontSize: 14, color: '#6b7280' }}>{t('admin.settings.windowUnit')}</span>
      </div>
    </div>
  )
}

function OddsFormatCard() {
  const { t } = useTranslation()
  return (
    <div style={S.card}>
      <div style={S.label}>{t('admin.settings.oddsTitle')}</div>
      <div style={S.desc}>{t('admin.settings.oddsDesc')}</div>
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
        {t('admin.settings.oddsNote')}
      </div>
    </div>
  )
}

export function SettingsClient({ settings }: Props) {
  const { t } = useTranslation()
  const get = (key: string, fallback: string) => {
    const s = settings.find((s) => s.key === key)
    return s ? String(s.value).replace(/^"|"$/g, '') : fallback
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#111827' }}>{t('admin.settings.title')}</h1>
      <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>{t('admin.settings.subtitle')}</p>

      <GameplayRulesCard current={get('gameplay_rules', '')} />
      <EditWindowCard />
      <OddsFormatCard />
    </div>
  )
}
