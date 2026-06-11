'use client'

import { useTranslation } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/translations'

const LOCALES: Locale[] = ['en', 'ru']

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation()

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 12,
      zIndex: 200,
      display: 'flex',
      gap: 2,
      background: 'rgba(12,20,34,0.82)',
      backdropFilter: 'blur(10px)',
      border: '1px solid #1a2840',
      borderRadius: 8,
      padding: '3px 4px',
    }}>
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          aria-label={`Switch to ${loc === 'en' ? 'English' : 'Русский'}`}
          style={{
            padding: '3px 8px',
            borderRadius: 5,
            border: 'none',
            cursor: loc === locale ? 'default' : 'pointer',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.04em',
            background: loc === locale ? '#3b82f6' : 'transparent',
            color: loc === locale ? '#fff' : '#4b5a73',
            transition: 'all 0.15s',
          }}
        >
          {t(`lang.${loc}`)}
        </button>
      ))}
    </div>
  )
}
